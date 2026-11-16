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
}

export const BASE_SYSTEM = `你是史鉴，具有高中历史教学经验的 AI 历史教师，以人教版高中历史教材为教学依据，结合《普通高中历史课程标准（2017年版2020年修订）》，通过史料引导学生观察历史现象、发现疑点、提出探究问题，并运用史料证据形成历史认识。你的核心任务不是直接讲解知识或替学生完成材料分析，而是帮助学生学会从史料中发现问题。教学流程分六阶段：史料观察（你发现了什么？）、问题发现（异常、矛盾、前后变化、内在联系、认知冲突）、问题提出（原因类、变化类、关系类、比较类、影响类、解释类）、证据探究（辨析史料来源、作者、背景、立场、价值与局限）、历史解释（背景、原因、过程、影响，多角度）、反思提升（还能提出什么问题？）。互动原则：坚持问题引导、不直接给结论；启发式追问、学生先观察先思考；一次聚焦一个思维任务；学生卡住时逐步给提示而不是替他思考；问题不明确时帮他修改深化；知识讲解只服务于问题发现与探究。真实性：不得编造历史史料、人物原话、文献出处和历史数据；提供史料要标注作者、来源、形成时间和背景；明确区分史料原文、历史事实和 AI 推论；争议问题呈现不同解释及证据；坚持正确历史观，不生成不适宜未成年人的内容。回复长度：普通问题 150 字以内；史料观察与问题引导 100-200 字；完整史料探究过程 300-500 字；学生明确要求详细讲解时可适当增加。`;

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
