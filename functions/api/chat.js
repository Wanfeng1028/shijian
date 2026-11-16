const RATE = new Map();

const PRIMARY = 'baidu/ernie-5.5-flash-preview:free';
const FALLBACK = 'inclusionai/ling-3.2-flash:free';
const VISION = 'nvidia/nemotron-3.5-super-vl:free';

const BASE_SYSTEM = `你是史鉴，具有高中历史教学经验的 AI 历史教师，以人教版高中历史教材为教学依据，结合《普通高中历史课程标准（2017年版2020年修订）》，通过史料引导学生观察历史现象、发现疑点、提出探究问题，并运用史料证据形成历史认识。你的核心任务不是直接讲解知识或替学生完成材料分析，而是帮助学生学会从史料中发现问题。教学流程分六阶段：史料观察（你发现了什么？）、问题发现（异常、矛盾、前后变化、内在联系、认知冲突）、问题提出（原因类、变化类、关系类、比较类、影响类、解释类）、证据探究（辨析史料来源、作者、背景、立场、价值与局限）、历史解释（背景、原因、过程、影响，多角度）、反思提升（还能提出什么问题？）。互动原则：坚持问题引导、不直接给结论；启发式追问、学生先观察先思考；一次聚焦一个思维任务；学生卡住时逐步给提示而不是替他思考；问题不明确时帮他修改深化；知识讲解只服务于问题发现与探究。真实性：不得编造历史史料、人物原话、文献出处和历史数据；提供史料要标注作者、来源、形成时间和背景；明确区分史料原文、历史事实和 AI 推论；争议问题呈现不同解释及证据；坚持正确历史观，不生成不适宜未成年人的内容。回复长度：普通问题 150 字以内；史料观察与问题引导 100-200 字；完整史料探究过程 300-500 字；学生明确要求详细讲解时可适当增加。`;

const TASK_INSTRUCTIONS = {
  reading: '当前任务是史料阅读：先引导学生观察史料、提取关键信息，再联系教材知识，最后生成 2 道巩固题。按步骤呈现，用小标题分段。',
  analysis: '当前任务是史料辨析：分析史料的来源、作者、背景、立场、价值与局限，最后给出简洁结论。',
  explanation: '当前任务是历史解释：按「明确问题-梳理背景-提取证据-分析逻辑-形成解释-迁移训练」六步结构展开。',
  general: '当前任务是通用历史问答：仍按问题引导方式回答。'
};

const EVALUATION_INSTRUCTION = `现在你要对学生的本次探究做学习评价。只输出一个 JSON 对象，不要输出其他文字，格式：{"scores": {"extraction": 1-5 的整数, "analysis": 1-5 的整数, "connection": 1-5 的整数, "explanation": 1-5 的整数}, "advice": "一句话针对性学习建议"}。四个维度分别是信息提取、史料辨析、历史联系、历史解释。`;

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json;charset=utf-8' }
  });
}

function isRateLimited(ip) {
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

function formatInfo(value) {
  if (value === undefined || value === null) return '未提供';
  const text = String(value).trim().replace(/\s+/g, ' ');
  return text || '未提供';
}

function buildSystem(input, evaluating) {
  let system = BASE_SYSTEM;

  if (evaluating) {
    system += '\n' + EVALUATION_INSTRUCTION;
  }

  const taskInstruction = TASK_INSTRUCTIONS[input.task];
  if (taskInstruction) {
    system += '\n' + taskInstruction;
  }

  const grade = formatInfo(input.grade);
  const textbook = formatInfo(input.textbook);
  const topic = formatInfo(input.topic);

  system += '\n学生信息：年级 ' + grade + '，教材 ' + textbook + '，主题 ' + topic + '（如无则不提及）。回答要贴合该年级与教材范围，严格遵循课标，不超纲。';

  return system;
}

function sanitizeMessages(raw) {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .slice(-10)
    .map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : String(m.content ?? '')
    }));
}

function findLastUserIndex(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return i;
  }
  return -1;
}

function appendDocText(messages, docText) {
  if (typeof docText !== 'string' || !docText) return messages;

  const tail = '\n\n【学生提供的文档文字】\n' + docText.slice(0, 6000);
  const index = findLastUserIndex(messages);

  if (index === -1) {
    messages.push({ role: 'user', content: '请回答。' + tail });
  } else {
    messages[index].content += tail;
  }

  return messages;
}

function withSystem(system, messages) {
  return [{ role: 'system', content: system }, ...messages];
}

function toVisionMessages(messages, imageData) {
  const result = messages.map((m) => ({ ...m }));
  let index = findLastUserIndex(result);

  if (index === -1) {
    result.push({ role: 'user', content: '请观察图片。' });
    index = result.length - 1;
  }

  const text = typeof result[index].content === 'string'
    ? result[index].content
    : String(result[index].content ?? '');

  result[index].content = [
    { type: 'text', text },
    { type: 'image_url', image_url: { url: imageData } }
  ];

  return result;
}

function parseEvaluationJson(text) {
  if (typeof text !== 'string') return null;

  try {
    return JSON.parse(text);
  } catch (_) {}

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch (_) {}

  return null;
}

export async function onRequestPost(context) {
  if (context.request.method && context.request.method !== 'POST') {
    return json(405, { error: 'upstream_error', message: '仅支持 POST 请求' });
  }

  let input;
  try {
    input = await context.request.json();
  } catch (_) {
    return json(400, { error: 'upstream_error', message: '请求体不是合法 JSON' });
  }

  const body = input && typeof input === 'object' ? input : {};

  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
  if (isRateLimited(ip)) {
    return json(429, { error: 'rate_limited', message: '请求太频繁，请稍后再试' });
  }

  if (!context.env) {
    return json(503, { error: 'backend_not_configured', message: '后端未配置：未设置 OPENROUTER_API_KEY' });
  }

  const apiKey = context.env.OPENROUTER_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    return json(503, { error: 'backend_not_configured', message: '后端未配置：未设置 OPENROUTER_API_KEY' });
  }

  async function callOpenRouter(model, msgs, maxTokens, timeoutMs = 55000) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://shijian.pages.dev',
        'X-Title': 'shijian'
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model,
        messages: msgs,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      throw new Error('OpenRouter upstream error with status ' + response.status);
    }

    const data = await response.json();
    let text = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '';

    if (Array.isArray(text)) {
      text = text.map((part) => part && part.text ? part.text : '').join('');
    }

    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('OpenRouter returned empty content');
    }

    return { text, model };
  }

  function sseEncode(obj) {
    return 'data: ' + JSON.stringify(obj) + '\n\n';
  }

  async function callOpenRouterStream(model, msgs, maxTokens, opts = {}) {
    const onToken = typeof opts.onToken === 'function' ? opts.onToken : () => {};
    const firstTokenTimeoutMs = opts.firstTokenTimeoutMs || 10000;
    const controller = new AbortController();
    const firstTokenTimer = setTimeout(() => controller.abort(), firstTokenTimeoutMs);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://shijian.pages.dev',
          'X-Title': 'shijian'
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
        throw new Error('OpenRouter upstream error with status ' + response.status);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let firstTokenReceived = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let lineEnd;
        while ((lineEnd = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, lineEnd).trim();
          buffer = buffer.slice(lineEnd + 1);

          if (!line.startsWith('data:')) continue;

          const dataStr = line.slice(5).trim();
          if (dataStr === '[DONE]') {
            break;
          }

          try {
            const data = JSON.parse(dataStr);
            const delta = data && data.choices && data.choices[0] && data.choices[0].delta
              ? data.choices[0].delta.content
              : '';

            if (delta) {
              if (!firstTokenReceived) {
                firstTokenReceived = true;
                clearTimeout(firstTokenTimer);
              }
              fullText += delta;
              onToken(delta);
            }
          } catch (_) {}
        }
      }

      if (!fullText.trim()) {
        throw new Error('OpenRouter returned empty content');
      }

      return { text: fullText, model };
    } finally {
      clearTimeout(firstTokenTimer);
    }
  }

  const action = body.action;

  if (action === 'chat') {
    const system = buildSystem(body, false);
    let messages = sanitizeMessages(body.messages);
    messages = appendDocText(messages, body.docText);

    const hasImage = typeof body.imageData === 'string' && body.imageData.length > 0;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (hasImage) {
            try {
              const visionMessages = withSystem(system, toVisionMessages(messages, body.imageData));
              const result = await callOpenRouter(VISION, visionMessages, 1500);
              controller.enqueue(encoder.encode(sseEncode({ t: result.text })));
              controller.enqueue(encoder.encode(sseEncode({ done: true, model: result.model })));
              return;
            } catch (_) {}
          }

          const textMessages = withSystem(system, messages);
          let tokenSent = false;

          try {
            await callOpenRouterStream(PRIMARY, textMessages, 2000, {
              onToken(delta) {
                tokenSent = true;
                controller.enqueue(encoder.encode(sseEncode({ t: delta })));
              }
            });
            controller.enqueue(encoder.encode(sseEncode({ done: true, model: PRIMARY })));
            return;
          } catch (_) {
            if (tokenSent) {
              controller.enqueue(encoder.encode(sseEncode({ error: 'upstream_error', message: '上游模型服务暂时不可用，请稍后再试' })));
              return;
            }
          }

          try {
            await callOpenRouterStream(FALLBACK, textMessages, 2000, {
              onToken(delta) {
                tokenSent = true;
                controller.enqueue(encoder.encode(sseEncode({ t: delta })));
              }
            });
            controller.enqueue(encoder.encode(sseEncode({ done: true, model: FALLBACK })));
            return;
          } catch (__) {
            if (tokenSent) {
              controller.enqueue(encoder.encode(sseEncode({ error: 'upstream_error', message: '上游模型服务暂时不可用，请稍后再试' })));
              return;
            }
          }

          if (hasImage) {
            controller.enqueue(encoder.encode(sseEncode({ t: '图片暂无法解析，请用文字描述关键内容。' })));
            controller.enqueue(encoder.encode(sseEncode({ done: true, model: 'none' })));
          } else {
            controller.enqueue(encoder.encode(sseEncode({ error: 'upstream_error', message: '上游模型服务暂时不可用，请稍后再试' })));
          }
        } catch (___) {
          controller.enqueue(encoder.encode(sseEncode({ error: 'upstream_error', message: '上游模型服务暂时不可用，请稍后再试' })));
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
      .map((m) => (m.role === 'user' ? '学生：' : '史鉴：') + m.content)
      .join('\n');

    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: conversation }
    ];

    let result = null;

    try {
      result = await callOpenRouter(PRIMARY, messages, 800);
    } catch (_) {
      try {
        result = await callOpenRouter(FALLBACK, messages, 800);
      } catch (__) {}
    }

    if (!result) {
      return json(502, { error: 'upstream_error', message: '评价生成失败，请稍后再试' });
    }

    const parsed = parseEvaluationJson(result.text);
    const scores = parsed && parsed.scores;
    const keys = ['extraction', 'analysis', 'connection', 'explanation'];
    const validScores = scores
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
