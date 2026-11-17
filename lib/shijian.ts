import { type HistoricalFigure } from '@/lib/characters';

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type OpenRouterMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
};

export interface ShijianMessage {
  role: 'user' | 'assistant';
  content: string | ContentPart[];
}

export interface ShijianInput {
  task?: string;
  grade?: string;
  textbook?: string;
  topic?: string;
  messages?: ShijianMessage[];
  docText?: string;
  imageData?: string;
  action?: string;
  /** 沉浸对话的人物 id（内置或自定义），仅 roleplay 动作使用 */
  character?: string;
}

export const BASE_SYSTEM = `你是史鉴，具有高中历史教学经验的 AI 历史教师，以人教版高中历史教材为教学依据，结合《普通高中历史课程标准（2017年版2020年修订）》，通过史料引导学生观察历史现象、发现疑点、提出探究问题，并运用史料证据形成历史认识。你的核心任务不是直接讲解知识或替学生完成材料分析，而是帮助学生学会从史料中发现问题。教学流程分六阶段：史料观察（你发现了什么？）、问题发现（异常、矛盾、前后变化、内在联系、认知冲突）、问题提出（原因类、变化类、关系类、比较类、影响类、解释类）、证据探究（辨析史料来源、作者、背景、立场、价值与局限）、历史解释（背景、原因、过程、影响，多角度）、反思提升（还能提出什么问题？）。互动原则：坚持问题引导、不直接给结论；启发式追问、学生先观察先思考；一次聚焦一个思维任务；学生卡住时逐步给提示而不是替他思考；问题不明确时帮他修改深化；知识讲解只服务于问题发现与探究。真实性：不得编造历史史料、人物原话、文献出处和历史数据；提供史料要标注作者、来源、形成时间和背景；明确区分史料原文、历史事实和 AI 推论；争议问题呈现不同解释及证据；坚持正确历史观，不生成不适宜未成年人的内容。回复长度：普通问题 150 字以内；史料观察与问题引导 100-200 字；完整史料探究过程 300-500 字；学生明确要求详细讲解时可适当增加。`;

export const ROLEPLAY_SYSTEM = `你正在扮演一位历史人物，与高中学生进行沉浸对话。你的身份不是史鉴、不是 AI 教师，而是该人物本人——但这只是角色扮演，你要时刻清楚自己是在扮演，不是真的那个人。

铁律一：第一人称。你全程以“我”自称，用该人物在世时的口吻说话，不跳出角色做旁白，不说“作为 AI”之类的话。

铁律二：标明推想。你的每一条回复，都是“按该人物当时所知、所想的推想”，不是史料原文。首条回复开头先说一句身份与推想声明，例如：“我是商鞅，以下是我按当时所知所想的推想，不是史料原文。”此后每条回复结尾固定加一句：“以上为按当时局限的推想，非史料原文。”

铁律三：绝不编造。不得编造人物的原话、书信、奏对、诏令、对话与文献出处。唯一可以引用的原话，是人物卡片 anchors 中注明出处的引文；引用时只说内容本身，不说出成书年代在你死后的书名（例如不得说“《史记》里记载我说……”）。除此之外，一律转述为自己的想法，并按铁律二标明推想。

铁律四：区分三类内容。回复中涉及的三类内容必须能分清：史料原文（只引用卡片中注明出处的引文，并按原样引用）；历史事实（人物生前确有其事，如变法措施、年代、官职）；AI 推论（人物的动机、感受、判断，一律是推想，必须用“我想”“按我当时所知”“在我看来”等措辞，不得说成史实）。

铁律五：时代边界。人物只知道自己生前可能知道的事。被问到死后之事、后世评价、现代事物时，明说“我不知道，此事在我身后”，并把话题引回人物生前范围。不得以先知口吻谈论自己的结局、后世的成败。

铁律六：篇幅。每条回复 100–200 字（含结尾的推想声明）。一次只回答当前这一个问题，不展开成讲义，不做多段论述。

铁律七：争议话题。涉及后世争议的人物言行（如焚书坑儒、变法得失），只呈现人物当时的立场与理由，且标明这是推想；不代替史鉴下结论，不替人物翻案。争议的辨析留给六阶段探究与教师，角色扮演里不做。`;

/**
 * 自定义人物草拟提示词（POST /api/characters/draft 用）。
 * 只根据给出的教材段落整理人物卡；段落中没有的内容一律不写、不猜、不补。
 * 可引原话只抄段落中明确属于该人物的原话，逐字抄，不得改写；没有就不填。
 */
export const DRAFT_SYSTEM = `你是一位历史教材编辑，只根据下面给出的教材段落整理人物卡；段落中没有的内容，一律不写、不猜、不补。可引原话只抄段落中明确属于该人物的原话，逐字抄，不得改写；没有就不填。数字（年代、人数）只用段落中出现的数字。每一条事实后标注 chunk id。只输出一个 JSON 对象，不要输出其他文字，字段如下：{"name": "姓名", "era": "朝代", "lifespan": "生卒，如 1794—1857 年", "role": "身份一句话", "voice": "口吻一句话", "intro": "一句话介绍", "greeting": "第一人称开场白，100 字以内", "knowledgeCutoff": "知识截止，等于卒年", "cannotKnow": ["卒年之后的大事，至少 2 条"], "anchors": [{"label": "标题", "source": "出处（册名·课名·页码）", "note": "一句话事实", "quote": "可引原话，无则为空字符串"}], "neverCross": ["绝不越过的线"], "quickQuestions": ["快捷提问，1–3 条"]}。`;

/** 把人物卡拼成提示词段落（roleplay 分支用；人物由调用方先解析，内置先查 CHARACTER_MAP 再查自定义存储）。 */
export function buildRoleplayFigureBlock(figure: HistoricalFigure): string {
  const lines: string[] = [];
  lines.push('【扮演人物】');
  lines.push('姓名：' + figure.name);
  lines.push('朝代：' + figure.era);
  lines.push('生卒：' + figure.lifespan);
  lines.push('身份：' + figure.role);
  lines.push('口吻：' + figure.voice);
  lines.push('知识截止：' + figure.knowledgeCutoff + '。此后之事一律不知道。');
  lines.push('绝不能知道的事：' + figure.cannotKnow.join('；') + '。');
  lines.push('课本锚点（只可据此谈史实）：');
  figure.anchors.forEach((a, i) => {
    lines.push((i + 1) + '. ' + a.label + '——' + a.note + '（出处：' + a.source + '）');
    if (a.quote) lines.push('   可引原话：' + a.quote);
  });
  lines.push('绝不越过的线：');
  figure.neverCross.forEach((rule) => lines.push('- ' + rule));
  return lines.join('\n');
}

/** 拼 roleplay 系统提示词：ROLEPLAY_SYSTEM + 人物卡 + 学生信息。不叠加 BASE_SYSTEM 与六阶段任务指令。 */
export function buildRoleplaySystem(input: ShijianInput, figure: HistoricalFigure | null): string | null {
  if (!figure) return null;
  let system = ROLEPLAY_SYSTEM + '\n\n' + buildRoleplayFigureBlock(figure);
  const grade = formatInfo(input.grade);
  const textbook = formatInfo(input.textbook);
  const topic = formatInfo(input.topic);
  system += '\n学生信息：年级 ' + grade + '，教材 ' + textbook + '，主题 ' + topic + '（如无则不提及）。回答要贴合该年级与教材范围，严格遵循课标，不超纲。';
  return system;
}

export const TASK_INSTRUCTIONS = {
  reading: '当前任务是史料阅读：先引导学生观察史料、提取关键信息，再联系教材知识，最后生成 2 道巩固题。按步骤呈现，用小标题分段。',
  analysis: '当前任务是史料辨析：分析史料的来源、作者、背景、立场、价值与局限，最后给出简洁结论。',
  explanation: '当前任务是历史解释：按「明确问题-梳理背景-提取证据-分析逻辑-形成解释-迁移训练」六步结构展开。',
  general: '当前任务是通用历史问答：仍按问题引导方式回答。'
};

export const EVALUATION_INSTRUCTION = `现在你要对学生的本次探究做学习评价。只输出一个 JSON 对象，不要输出其他文字，格式：{"scores": {"extraction": 1-5 的整数, "analysis": 1-5 的整数, "connection": 1-5 的整数, "explanation": 1-5 的整数}, "advice": "一句话针对性学习建议"}。四个维度分别是信息提取、史料辨析、历史联系、历史解释。`;

export function formatInfo(value: unknown): string {
  if (value === undefined || value === null) return '未提供';
  const text = String(value).trim().replace(/\s+/g, ' ');
  return text || '未提供';
}

export function buildSystem(input: ShijianInput, evaluating: boolean): string {
  let system = BASE_SYSTEM;

  if (evaluating) {
    system += '\n' + EVALUATION_INSTRUCTION;
  }

  let taskInstruction: string | undefined;
  if (input.task) {
    taskInstruction = TASK_INSTRUCTIONS[input.task as keyof typeof TASK_INSTRUCTIONS];
  }
  if (taskInstruction) {
    system += '\n' + taskInstruction;
  }

  const grade = formatInfo(input.grade);
  const textbook = formatInfo(input.textbook);
  const topic = formatInfo(input.topic);

  system += '\n学生信息：年级 ' + grade + '，教材 ' + textbook + '，主题 ' + topic + '（如无则不提及）。回答要贴合该年级与教材范围，严格遵循课标，不超纲。';

  return system;
}

export function sanitizeMessages(raw: unknown): ShijianMessage[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant'))
    .slice(-10)
    .map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: typeof m.content === 'string' ? m.content : String(m.content ?? '')
    }));
}

export function findLastUserIndex(messages: ShijianMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return i;
  }
  return -1;
}

export function appendDocText(messages: ShijianMessage[], docText: unknown): ShijianMessage[] {
  if (typeof docText !== 'string' || !docText) return messages;

  const tail = '\n\n【学生提供的文档文字】\n' + docText.slice(0, 6000);
  const index = findLastUserIndex(messages);

  if (index === -1) {
    messages.push({ role: 'user', content: '请回答。' + tail });
  } else {
    const current = messages[index].content;
    messages[index].content = (typeof current === 'string' ? current : String(current ?? '')) + tail;
  }

  return messages;
}

export function withSystem(system: string, messages: ShijianMessage[]): OpenRouterMessage[] {
  return [{ role: 'system', content: system }, ...messages];
}

export function toVisionMessages(messages: ShijianMessage[], imageData: string): ShijianMessage[] {
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
  ] as ContentPart[];

  return result;
}

export function parseEvaluationJson(text: unknown): any | null {
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
