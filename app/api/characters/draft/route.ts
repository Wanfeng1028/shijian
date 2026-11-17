/**
* 自定义人物草拟端点：POST /api/characters/draft
* 流程：输入人名 → BM25 检索教材语料（top 5）→ 模型按 DRAFT_SYSTEM 草拟人物卡 → 校验 → 返回草稿 + 依据清单；不保存。
* 检索不到（教材里没有该人物）直接返回 404，不硬编。
* 需要 BOTSROUTER_API_KEY；未配置返回 503。草稿未经人工审核，不得直接保存。
*/
import { retrieveContext} from '@/lib/rag/retrieve';
import { DRAFT_SYSTEM, parseEvaluationJson} from '@/lib/shijian';
import { normalizeCustomFigure, validateCustomFigure} from '@/lib/custom-characters';
import { CHARACTERS} from '@/lib/characters';

export const runtime = 'edge';

const PRIMARY = 'spark-x2.6';

function json(status: number, obj: unknown): Response {
return new Response(JSON.stringify(obj), {
status,
headers: { 'Content-Type': 'application/json;charset=utf-8'},
});
}

async function callDraftModel(apiKey: string, system: string, userContent: string): Promise<string> {
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 55000);
try {
const response = await fetch('https://api.botsarena.tech/v1/chat/completions', {
method: 'POST',
headers: {
Authorization: 'Bearer ' + apiKey,
'Content-Type': 'application/json',
},
signal: controller.signal,
body: JSON.stringify({
model: PRIMARY,
messages: [
{ role: 'system', content: system},
{ role: 'user', content: userContent},
],
max_tokens: 1200,
}),
});
if (!response.ok) {
throw new Error('BotsRouter upstream error with status ' + response.status);
}
const data = (await response.json()) as any;
let text: unknown =
data && data.choices && data.choices[0] && data.choices[0].message
? data.choices[0].message.content
: '';
if (Array.isArray(text)) {
text = text.map((part: any) => (part && part.text? part.text: '')).join('');
}
if (typeof text!== 'string' ||!text.trim()) {
throw new Error('BotsRouter returned empty content');
}
return text;
} finally {
clearTimeout(timer);
}
}

export async function POST(request: Request): Promise<Response> {
let input: unknown;
try {
input = await request.json();
} catch (_) {
return json(400, { error: 'invalid_body', message: '请求体不是合法 JSON'});
}
const body = (input && typeof input === 'object'? input: {}) as Record<string, unknown>;
const name = typeof body.name === 'string'? body.name.trim(): '';
const eraHint = typeof body.eraHint === 'string'? body.eraHint.trim(): '';
if (!name) {
return json(400, { error: 'invalid_name', message: '请先输入人物姓名'});
}

const apiKey = process.env.BOTSROUTER_API_KEY;
if (!apiKey ||!String(apiKey).trim()) {
return json(503, { error: 'backend_not_configured', message: '后端未配置：未设置 BOTSROUTER_API_KEY'});
}

const query = eraHint? name + ' ' + eraHint: name;
let retrieved: Awaited<ReturnType<typeof retrieveContext>>;
try {
retrieved = await retrieveContext(query, { topK: 5});
} catch (_) {
return json(502, { error: 'upstream_error', message: '教材检索失败，请稍后再试'});
}
if (!retrieved.context) {
return json(404, { error: 'no_source', message: '教材里没有“' + name + '”的相关内容，没法对话'});
}

let draftText: string;
try {
draftText = await callDraftModel(
apiKey,
DRAFT_SYSTEM,
'人物：' + name + (eraHint? '（' + eraHint + '）': '') + '\n\n\n' + retrieved.context,
);
} catch (err) {
const message = err instanceof Error? err.message: String(err);
return json(502, { error: 'upstream_error', message: '草拟失败：' + message});
}

const parsed = parseEvaluationJson(draftText);
const figure = normalizeCustomFigure(parsed);
if (!figure) {
return json(502, { error: 'invalid_draft', message: '模型返回的人物卡格式无效，请重试或手工填写'});
}
// 草稿尚未保存：用临时 id 跑校验（只校验格式与事实口径，不校验唯一性），返回时 id 置空。
figure.id = 'custom-draft';
const errors = validateCustomFigure(figure, CHARACTERS.map((c) => c.id));
if (errors.length > 0) {
return json(502, {
error: 'invalid_draft',
message: '草拟的人物卡未通过校验：' + errors.join('；'),
errors,
sources: retrieved.sources,
});
}

const draft = {...figure, id: ''};
return json(200, { draft, sources: retrieved.sources});
}
