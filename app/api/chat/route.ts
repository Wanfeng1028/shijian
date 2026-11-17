import { getRequestContext } from '@cloudflare/next-on-pages';
import { retrieveContext } from '@/lib/rag/retrieve';
import {
  appendDocText,
  buildRoleplaySystem,
  buildSystem,
  findLastUserIndex,
  parseEvaluationJson,
  sanitizeMessages,
  withSystem,
  type ShijianInput,
  type ShijianMessage
} from '@/lib/shijian';
import { resolveFigure } from '@/lib/custom-characters';

export const runtime = 'edge';

const RATE = new Map<string, number[]>();

const PRIMARY = 'spark-x2.6';
const FALLBACK = 'qiniu/conatus-free';

const KNOWN_MODELS: string[] = [
  'GLM-5.3',
  'GLM-5.3-Flash',
  'glm-5.3',
  'glm-5.3-flash',
  'moonshotai/kimi-k3',
  'moonshotai/kimi-k3-free',
  'qiniu/conatus-free',
  'spark-x2.6'
];

const CHAT_MAX_TOKENS = [600, 1200, 1600, 2000, 2400, 2800];
const EVAL_MAX_TOKENS = [500, 800, 1000, 1200, 1400, 1600];
const REASONING_EFFORTS = ['low', 'medium', 'medium', 'high', 'high', 'medium'];
const EFFORT_WORDS = [300, 600, 800, 1000, 1200, 1400];

interface UpstreamFailure {
  model: string;
  status: number | null;
  kind: 'not_found' | 'insufficient' | 'rate_limited' | 'auth' | 'upstream' | 'timeout' | 'network' | 'empty';
  detail: string;
}

function toFailure(err: unknown, model: string): UpstreamFailure {
  const message = err instanceof Error ? err.message : String(err);
  const statusMatch = /status (\d{3})/.exec(message);
  let status: number | null = null;
  let kind: UpstreamFailure['kind'] = 'network';
  let detail = '网络异常，未能连接上游服务';
  if (statusMatch) {
    const code = Number(statusMatch[1]);
    status = code;
    if (code === 404) {
      kind = 'not_found';
      detail = '上游返回 404：模型不存在';
    } else if (code === 402) {
      kind = 'insufficient';
      detail = '上游返回 402：余额不足';
    } else if (code === 429) {
      kind = 'rate_limited';
      detail = '上游返回 429：请求过于频繁或免费额度已用完';
    } else if (code === 401) {
      kind = 'auth';
      detail = '上游返回 401：渠道密钥已失效';
    } else if (code === 500 || code === 502 || code === 503) {
      kind = 'upstream';
      detail = '上游返回 ' + code + '：上游服务故障';
    }
  }
  if (message.includes('aborted') || (err instanceof Error && err.name === 'AbortError')) {
    kind = 'timeout';
    detail = '55 秒内未返回内容（超时）';
  } else if (message.includes('empty content') || message.includes('empty stream')) {
    kind = 'empty';
    detail = '上游返回了空内容';
  }
  return { model, status, kind, detail };
}

function combineFailures(failures: UpstreamFailure[]): { code: string; reason: string; message: string } {
  const code = 'upstream_error';
  if (failures.length === 0) {
    return {
      code,
      reason: 'unknown',
      message: '上游模型服务异常，未能返回内容，请稍后再试。'
    };
  }
  const reason = failures.map((f) => f.kind).join('+');
  if (failures.length === 1) {
    return {
      code,
      reason,
      message: '模型 ' + failures[0].model + ' ' + failures[0].detail + '，请稍后再试。'
    };
  }
  if (failures.length > 2) {
    return {
      code,
      reason,
      message: '依次尝试的模型均失败：' + failures.map((f) => f.model + ' ' + f.detail).join('；') + '。请稍后再试。'
    };
  }
  return {
    code,
    reason,
    message:
      '主模型 ' + failures[0].model + ' ' + failures[0].detail +
      '；备用模型 ' + failures[1].model + ' ' + failures[1].detail + '。请稍后再试。'
  };
}

class CombinedUpstreamError extends Error {
  failures: UpstreamFailure[];
  constructor(failures: UpstreamFailure[]) {
    super('upstream failed');
    this.name = 'CombinedUpstreamError';
    this.failures = failures;
  }
}


async function fetchModelIds(apiKey: string): Promise<string[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch('https://api.botsarena.tech/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      return [...KNOWN_MODELS];
    }
    const body: any = await res.json();
    if (!Array.isArray(body?.data)) {
      return [...KNOWN_MODELS];
    }
    const ids: string[] = [];
    for (const entry of body.data) {
      const id = (entry as any)?.id;
      if (typeof id === 'string') {
        ids.push(id);
      }
    }
    if (ids.length === 0) {
      return [...KNOWN_MODELS];
    }
    return ids;
  } catch {
    return [...KNOWN_MODELS];
  } finally {
    clearTimeout(timeoutId);
  }
}

function resolveModel(requested: unknown, allowed: string[]): string {
  if (typeof requested === 'string' && allowed.includes(requested)) {
    return requested;
  }
  return PRIMARY;
}

async function tryEvalModels(
  apiKey: string,
  models: string[],
  msgs: ChatMessage[],
  maxTokens: number,
  reasoningEffort?: string
): Promise<{ text: string; model: string }> {
  const failures: UpstreamFailure[] = [];
  const seen = new Set<string>();
  for (const model of models) {
    if (seen.has(model)) {
      continue;
    }
    seen.add(model);
    try {
      return await callBotsRouter(apiKey, model, msgs, maxTokens, undefined, reasoningEffort);
    } catch (err) {
      failures.push(toFailure(err, model));
    }
  }
  throw new CombinedUpstreamError(failures);
}

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: unknown;
};

function json(status: number, obj: unknown): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json;charset=utf-8' }
  });
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - 60000;

  for (const [key, times] of RATE.entries()) {
    const fresh = times.filter((t) => t >= cutoff);
    if (fresh.length) RATE.set(key, fresh);
    else RATE.delete(key);
  }

  const times = RATE.get(ip) || [];
  if (times.length >= 10) return true;

  times.push(now);
  RATE.set(ip, times);
  return false;
}

function getRetrievalQuery(input: ShijianInput, messages: ShijianMessage[]): string {
  if (typeof input.topic === 'string' && input.topic) return input.topic;

  const index = findLastUserIndex(messages);
  if (index === -1) return '';

  const content = messages[index].content;
  return typeof content === 'string' ? content : String(content ?? '');
}

async function callBotsRouter(
  apiKey: string,
  model: string,
  msgs: ChatMessage[],
  maxTokens: number,
  timeoutMs = 55000,
  reasoningEffort?: string
): Promise<{ text: string; model: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.botsarena.tech/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: msgs,
        max_tokens: maxTokens,
        ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {})
      })
    });

    if (!response.ok) {
      throw new Error('BotsRouter upstream error with status ' + response.status);
    }

    const data = (await response.json()) as any;
    let text: unknown = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '';

    if (Array.isArray(text)) {
      text = text.map((part: any) => part && part.text ? part.text : '').join('');
    }

    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('BotsRouter returned empty content');
    }

    return { text, model };
  } finally {
    clearTimeout(timer);
  }
}

function sseEncode(obj: unknown): string {
  return 'data: ' + JSON.stringify(obj) + '\n\n';
}

async function callBotsRouterStream(
  apiKey: string,
  model: string,
  msgs: ChatMessage[],
  maxTokens: number,
  opts: {
    onToken?: (delta: string) => void;
    firstTokenTimeoutMs?: number;
    reasoningEffort?: string;
  } = {}
): Promise<{ text: string; model: string }> {
  const onToken: (delta: string) => void = typeof opts.onToken === 'function' ? opts.onToken : () => {};
  const firstTokenTimeoutMs = opts.firstTokenTimeoutMs || 20000;
  const controller = new AbortController();
  let firstTokenTimer: ReturnType<typeof setTimeout> | undefined = undefined;
  const resetActivityTimer: () => void = () => {
    if (firstTokenTimer !== undefined) clearTimeout(firstTokenTimer);
    firstTokenTimer = setTimeout(() => controller.abort(), firstTokenTimeoutMs);
  };
  resetActivityTimer();
  const totalTimer = setTimeout(() => controller.abort(), 55000);

  try {
    const response = await fetch('https://api.botsarena.tech/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: msgs,
        max_tokens: maxTokens,
        stream: true,
        ...(opts.reasoningEffort ? { reasoning_effort: opts.reasoningEffort } : {})
      })
    });

    if (!response.ok) {
      throw new Error('BotsRouter upstream error with status ' + response.status);
    }

    if (!response.body) {
      throw new Error('BotsRouter returned empty stream');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let firstTokenReceived = false;
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let lineEnd: number;

      while ((lineEnd = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, lineEnd).trim();
        buffer = buffer.slice(lineEnd + 1);

        if (!line.startsWith('data:')) continue;

        const dataStr = line.slice(5).trim();
        if (dataStr === '[DONE]') {
          streamDone = true;
          break;
        }

        try {
          const data = JSON.parse(dataStr) as any;
          const deltaObj = data && data.choices && data.choices[0] && data.choices[0].delta
            ? data.choices[0].delta
            : {};
          const delta = deltaObj && deltaObj.content ? deltaObj.content : '';
          const reasoning = deltaObj && deltaObj.reasoning ? deltaObj.reasoning : '';
          const reasoningContent = deltaObj && deltaObj.reasoning_content ? deltaObj.reasoning_content : '';

          if (delta || reasoning || reasoningContent) {
            resetActivityTimer();
            firstTokenReceived = true;
          }

          if (delta) {
            const tokenText = typeof delta === 'string' ? delta : String(delta);
            fullText += tokenText;
            onToken(tokenText);
          }
        } catch (_) {}
      }
    }

    if (!fullText.trim()) {
      throw new Error('BotsRouter returned empty content');
    }

    return { text: fullText, model };
  } finally {
    if (firstTokenTimer !== undefined) clearTimeout(firstTokenTimer);
    clearTimeout(totalTimer);
  }
}

/**
 * 复用现有流式管线：主模型 → 备用模型 → 备用重试（限流时 4 秒后重试一次），
 * SSE 事件与 chat 分支完全一致：{ t: token }、{ done: true, model }、错误信封。
 * hasImage 为真时，先在流开头提示图片暂无法解析（BotsRouter 模型清单里没有 vision 模型）。
 */
async function streamChatResponse(
  apiKey: string,
  selectedModel: string,
  textMessages: ChatMessage[],
  maxTokens: number,
  reasoningEffort: string | undefined,
  hasImage: boolean,
): Promise<Response> {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const chatFailures: UpstreamFailure[] = [];
        try {
          if (hasImage) {
            // BotsRouter 模型清单里没有 vision 模型，不编造模型 ID。
            // 先诚实告知图片未被解析，再继续走文字对话，不破坏对话。
            controller.enqueue(encoder.encode(sseEncode({ t: '图片暂无法解析，请用文字描述关键内容。' })));
          }

          let tokenSent = false;

          try {
            await callBotsRouterStream(apiKey, selectedModel, textMessages, maxTokens, {
              reasoningEffort,
              onToken(delta) {
                tokenSent = true;
                controller.enqueue(encoder.encode(sseEncode({ t: delta })));
              }
            });
            controller.enqueue(encoder.encode(sseEncode({ done: true, model: selectedModel })));
            return;
          } catch (err) {
            chatFailures.push(toFailure(err, selectedModel));
            if (tokenSent) {
              const combined = combineFailures(chatFailures);
              controller.enqueue(encoder.encode(sseEncode({
                error: combined.code,
                code: combined.code,
                reason: combined.reason,
                message: combined.message
              })));
              return;
            }
          }

          const fallbackModels = selectedModel === PRIMARY ? [FALLBACK] : [PRIMARY, FALLBACK];
          for (const fbModel of fallbackModels) {
            try {
              await callBotsRouterStream(apiKey, fbModel, textMessages, maxTokens, {
                reasoningEffort,
                firstTokenTimeoutMs: 30000,
                onToken(delta) {
                  tokenSent = true;
                  controller.enqueue(encoder.encode(sseEncode({ t: delta })));
                }
              });
              controller.enqueue(encoder.encode(sseEncode({ done: true, model: fbModel })));
              return;
            } catch (fbErr) {
              const fbFailure = toFailure(fbErr, fbModel);
              chatFailures.push(fbFailure);
              if (!tokenSent && fbFailure.kind === 'rate_limited' && fbModel === FALLBACK) {
                await new Promise((resolve) => setTimeout(resolve, 4000));
                try {
                  await callBotsRouterStream(apiKey, fbModel, textMessages, maxTokens, {
                    reasoningEffort,
                    firstTokenTimeoutMs: 30000,
                    onToken(delta) {
                      tokenSent = true;
                      controller.enqueue(encoder.encode(sseEncode({ t: delta })));
                    }
                  });
                  controller.enqueue(encoder.encode(sseEncode({ done: true, model: fbModel })));
                  return;
                } catch (retryErr) {
                  chatFailures.push(toFailure(retryErr, fbModel));
                }
              }
              if (tokenSent) {
                const combined = combineFailures(chatFailures);
                controller.enqueue(encoder.encode(sseEncode({
                  error: combined.code,
                  code: combined.code,
                  reason: combined.reason,
                  message: combined.message
                })));
                return;
              }
            }
          }

          if (hasImage) {
            // 图片未解析的提示已在流开头
            controller.enqueue(encoder.encode(sseEncode({ done: true, model: 'none' })));
          } else {
            const combined = combineFailures(chatFailures);
            controller.enqueue(encoder.encode(sseEncode({
              error: combined.code,
              code: combined.code,
              reason: combined.reason,
              message: combined.message
            })));
          }
        } catch (___) {
          const combined = combineFailures(chatFailures);
          controller.enqueue(encoder.encode(sseEncode({
            error: combined.code,
            code: combined.code,
            reason: combined.reason,
            message: combined.message
          })));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
}

export async function POST(request: Request): Promise<Response> {
  let input: unknown;

  try {
    input = await request.json();
  } catch (_) {
    return json(400, { error: 'upstream_error', message: '请求体不是合法 JSON' });
  }

  const body: ShijianInput = input && typeof input === 'object' ? (input as ShijianInput) : {};

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (isRateLimited(ip)) {
    return json(429, { error: 'rate_limited', message: '请求太频繁，请稍后再试' });
  }

  const apiKey = process.env.BOTSROUTER_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    return json(503, { error: 'backend_not_configured', message: '后端未配置：未设置 BOTSROUTER_API_KEY' });
  }

  const bodyRecord = (body as unknown as Record<string, unknown>);
  const requestedModel = typeof bodyRecord.model === 'string' ? bodyRecord.model : '';
  const allowedIds = await fetchModelIds(apiKey);
  const selectedModel = resolveModel(requestedModel, allowedIds);
  const effortRaw = typeof bodyRecord.effort === 'number' ? bodyRecord.effort : 1;
  const effortIdx = Number.isFinite(effortRaw) ? Math.min(5, Math.max(0, Math.floor(effortRaw))) : 1;
  const chatMaxTokens = CHAT_MAX_TOKENS[effortIdx];
  const evalMaxTokens = EVAL_MAX_TOKENS[effortIdx];
  const reasoningEffort = REASONING_EFFORTS[effortIdx];
  const effortWords = EFFORT_WORDS[effortIdx];
  const action = body.action;

  if (action === 'chat') {
    let system = buildSystem(body, false);

    const retrievalMessages = sanitizeMessages(body.messages);
    const query = getRetrievalQuery(body, retrievalMessages);

    try {
      const retrieved = await retrieveContext(query, {
        task: body.task,
        grade: body.grade,
        textbook: body.textbook
      });
      const retrievedContext = typeof retrieved?.context === 'string' ? retrieved.context : '';
      if (retrievedContext) {
        system += '\n\n【课本相关段落（供参考，以原文为准）】\n' + retrievedContext;
      } else {
        system += '\n\n本次未检索到相关课本段落：涉及课本原文、页码、课名时只按已给材料回答，不知道就明说不知道，不得编造出处。';
      }
    } catch (_) {}

    system += '\n\n回答涉及课本内容时，必须引用本次提供的【课本相关段落】，并按（册名·课名·页码）格式标注出处；只许引用本次提供的段落，绝不编造史料、人物原话、数据或出处；没有给出的段落就明说课本里没找到，不许硬凑。';
    system += '\n\n回复中出现的年份必须与题干史料或本次提供的段落一致；如不一致，以题干史料和段落为准。';
    system += '\n\n本次回复请控制在约 ' + effortWords + ' 字左右。';
    const messages = appendDocText(retrievalMessages, body.docText);
    const imageData = typeof body.imageData === 'string' && body.imageData.length > 0 ? body.imageData : '';
    const textMessages = withSystem(system, messages);
    return streamChatResponse(apiKey, selectedModel, textMessages, chatMaxTokens, reasoningEffort, imageData.length > 0);
  }

  if (action === 'roleplay') {
    // D1 绑定只在 Cloudflare Pages 运行时存在；本地 next dev 取不到时按 null 处理（内置人物仍可用）。
    let db: D1Database | null = null;
    try {
      db = getRequestContext().env.DB ?? null;
    } catch (_) {
      db = null;
    }
    const figure = await resolveFigure(body.character, db);
    const system0 = buildRoleplaySystem(body, figure);
    if (!system0) {
      return json(400, { error: 'unknown_character', message: '未知的人物 id，请先选择历史人物' });
    }
    let system = system0;

    // RAG 仍可附加：只取与人物生前相符的段落作史实依据。
    const retrievalMessages = sanitizeMessages(body.messages);
    const query = getRetrievalQuery(body, retrievalMessages);
    try {
      const retrieved = await retrieveContext(query, {
        task: body.task,
        grade: body.grade,
        textbook: body.textbook,
      });
      const retrievedContext = typeof retrieved?.context === 'string' ? retrieved.context : '';
      if (retrievedContext) {
        system += '\n\n【课本相关段落（供参考，以原文为准）】\n' + retrievedContext;
        system += '\n段落中与人物生前不符的内容（如其死后之事、后世评价）不得作为人物所知，只能作为你判断时代边界的依据。';
      }
    } catch (_) {}

    // 角色扮演不做六阶段任务指令、不做评价；字数由提示词铁律六控制（100–200 字）。
    const messages = appendDocText(retrievalMessages, body.docText);
    const imageData = typeof body.imageData === 'string' && body.imageData.length > 0 ? body.imageData : '';
    const textMessages = withSystem(system, messages);
    // 固定 600 tokens：100–200 字约 300–400 tokens，留出结尾推想声明的余量；不随 effort 档位变化。
    return streamChatResponse(apiKey, selectedModel, textMessages, 600, undefined, imageData.length > 0);
  }

  if (action === 'evaluate') {
    if (typeof body.character === 'string' && body.character.length > 0) {
      return json(400, { error: 'evaluation_not_available', message: '沉浸对话不参与学习评价' });
    }
    const system = buildSystem(body, true);
    const conversation = sanitizeMessages(body.messages)
      .map((m) => (m.role === 'user' ? '学生：' : '史鉴：') + (typeof m.content === 'string' ? m.content : String(m.content ?? '')))
      .join('\n');

    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      { role: 'user', content: conversation }
    ];

    let result: { text: string; model: string } | null = null;
    let evalFailures: UpstreamFailure[] = [];

    try {
      result = await tryEvalModels(apiKey, [selectedModel, PRIMARY, FALLBACK], messages, evalMaxTokens, reasoningEffort);
    } catch (err) {
      if (err instanceof CombinedUpstreamError) {
        evalFailures = err.failures;
      } else {
        evalFailures = [toFailure(err, selectedModel)];
      }
    }

    if (!result) {
      const combined = combineFailures(evalFailures);
      return json(502, { error: combined.code, code: combined.code, reason: combined.reason, message: combined.message });
    }

    const parsed = parseEvaluationJson(result.text);
    const scores = parsed && parsed.scores;
    const keys = ['extraction', 'analysis', 'connection', 'explanation'] as const;
    const validScores = !!scores
      && typeof scores === 'object'
      && keys.every((key) => Number.isInteger(scores[key]) && scores[key] >= 1 && scores[key] <= 5);

    if (!validScores) {
      return json(502, { error: 'upstream_error', code: 'invalid_evaluation', reason: 'invalid_scores', message: '模型 ' + result.model + ' 返回的评价格式无效，未能解析出四项 1–5 分的评分，请重试。' });
    }

    return json(200, {
      scores: {
        extraction: scores.extraction,
        analysis: scores.analysis,
        connection: scores.connection,
        explanation: scores.explanation
      },
      advice: typeof parsed.advice === 'string' ? parsed.advice : '',
      model: result.model
    });
  }

  return json(400, { error: 'upstream_error', message: '未知的 action' });
}
