import { retrieveContext } from '@/lib/rag/retrieve';
import {
  appendDocText,
  buildSystem,
  findLastUserIndex,
  parseEvaluationJson,
  sanitizeMessages,
  withSystem,
  type ShijianInput,
  type ShijianMessage
} from '@/lib/shijian';

export const runtime = 'edge';

const RATE = new Map<string, number[]>();

const PRIMARY = 'spark-x2.6';
const FALLBACK = 'qiniu/conatus-free';

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
  timeoutMs = 55000
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
        max_tokens: maxTokens
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
        stream: true
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

    const messages = appendDocText(retrievalMessages, body.docText);
    const imageData = typeof body.imageData === 'string' && body.imageData.length > 0 ? body.imageData : '';
    const hasImage = imageData.length > 0;
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          if (hasImage) {
            // BotsRouter 模型清单里没有 vision 模型，不编造模型 ID。
            // 先诚实告知图片未被解析，再继续走文字对话，不破坏对话。
            controller.enqueue(encoder.encode(sseEncode({ t: '图片暂无法解析，请用文字描述关键内容。' })));
          }

          const textMessages = withSystem(system, messages);
          let tokenSent = false;

          try {
            await callBotsRouterStream(apiKey, PRIMARY, textMessages, 2000, {
              onToken(delta) {
                tokenSent = true;
                controller.enqueue(encoder.encode(sseEncode({ t: delta })));
              }
            });
            controller.enqueue(encoder.encode(sseEncode({ done: true, model: PRIMARY })));
            return;
          } catch (_) {
            if (tokenSent) {
              controller.enqueue(encoder.encode(sseEncode({
                error: 'upstream_error',
                message: '上游模型服务暂时不可用，请稍后再试'
              })));
              return;
            }
          }

          const runFallback = async () => {
            await callBotsRouterStream(apiKey, FALLBACK, textMessages, 2000, {
              firstTokenTimeoutMs: 30000,
              onToken(delta) {
                tokenSent = true;
                controller.enqueue(encoder.encode(sseEncode({ t: delta })));
              }
            });
          };
          try {
            await runFallback();
            controller.enqueue(encoder.encode(sseEncode({ done: true, model: FALLBACK })));
            return;
          } catch (firstErr) {
            if (!tokenSent && firstErr instanceof Error && firstErr.message.includes('429')) {
              await new Promise((resolve) => setTimeout(resolve, 4000));
              try {
                await runFallback();
                controller.enqueue(encoder.encode(sseEncode({ done: true, model: FALLBACK })));
                return;
              } catch (__) {}
            }
            if (tokenSent) {
              controller.enqueue(encoder.encode(sseEncode({
                error: 'upstream_error',
                message: '上游模型服务暂时不可用，请稍后再试'
              })));
              return;
            }
          }

          if (hasImage) {
            // 图片未解析的提示已在流开头
            controller.enqueue(encoder.encode(sseEncode({ done: true, model: 'none' })));
          } else {
            controller.enqueue(encoder.encode(sseEncode({
              error: 'upstream_error',
              message: '上游模型服务暂时不可用，请稍后再试'
            })));
          }
        } catch (___) {
          controller.enqueue(encoder.encode(sseEncode({
            error: 'upstream_error',
            message: '上游模型服务暂时不可用，请稍后再试'
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

  if (action === 'evaluate') {
    const system = buildSystem(body, true);
    const conversation = sanitizeMessages(body.messages)
      .map((m) => (m.role === 'user' ? '学生：' : '史鉴：') + (typeof m.content === 'string' ? m.content : String(m.content ?? '')))
      .join('\n');

    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      { role: 'user', content: conversation }
    ];

    let result: { text: string; model: string } | null = null;

    try {
      result = await callBotsRouter(apiKey, PRIMARY, messages, 800);
    } catch (_) {
      try {
        result = await callBotsRouter(apiKey, FALLBACK, messages, 800);
      } catch (__) {}
    }

    if (!result) {
      return json(502, { error: 'upstream_error', message: '评价生成失败，请稍后再试' });
    }

    const parsed = parseEvaluationJson(result.text);
    const scores = parsed && parsed.scores;
    const keys = ['extraction', 'analysis', 'connection', 'explanation'] as const;
    const validScores = !!scores
      && typeof scores === 'object'
      && keys.every((key) => Number.isInteger(scores[key]) && scores[key] >= 1 && scores[key] <= 5);

    if (!validScores) {
      return json(502, { error: 'upstream_error', message: '评价生成失败，请稍后再试' });
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
