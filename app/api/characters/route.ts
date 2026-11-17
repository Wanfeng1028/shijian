/**
 * 人物列表 API：GET 返回内置 9 位 + D1 自定义人物；POST 新建自定义人物。
 * 不需要 BOTSROUTER_API_KEY（只做数据读写与校验，不调模型）。
 * D1 未绑定时：GET 只返回内置人物；POST 返回 503（自定义存储未配置）。
 */
import { getRequestContext } from '@cloudflare/next-on-pages';
import { CHARACTERS, toPublicCharacter } from '@/lib/characters';
import {
  listCustomCharacters,
  newCustomId,
  normalizeCustomFigure,
  saveCustomCharacter,
  validateCustomFigure,
} from '@/lib/custom-characters';

export const runtime = 'edge';

function json(status: number, obj: unknown): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json;charset=utf-8' },
  });
}

function getDb(): D1Database | null {
  try {
    return getRequestContext().env.DB ?? null;
  } catch (_) {
    return null;
  }
}

export async function GET(): Promise<Response> {
  const builtin = CHARACTERS.map(toPublicCharacter);
  const db = getDb();
  if (!db) {
    return json(200, { characters: builtin, customUnavailable: true });
  }
  try {
    const customs = await listCustomCharacters(db);
    return json(200, { characters: [...builtin, ...customs.map(toPublicCharacter)] });
  } catch (_) {
    return json(200, { characters: builtin, customUnavailable: true });
  }
}

export async function POST(request: Request): Promise<Response> {
  let input: unknown;
  try {
    input = await request.json();
  } catch (_) {
    return json(400, { error: 'invalid_body', message: '请求体不是合法 JSON' });
  }

  const db = getDb();
  if (!db) {
    return json(503, { error: 'custom_store_unavailable', message: '自定义人物存储未配置（缺少 D1 绑定）' });
  }

  const figure = normalizeCustomFigure(input);
  if (!figure) {
    return json(400, { error: 'invalid_figure', message: '人物卡格式不正确' });
  }
  // 未给 id 则由后端生成；给了 id 则走校验（格式 + 唯一性）。
  if (!figure.id) figure.id = newCustomId();

  let existingIds: string[];
  try {
    const customs = await listCustomCharacters(db);
    existingIds = [...CHARACTERS.map((c) => c.id), ...customs.map((c) => c.id)];
  } catch (_) {
    return json(502, { error: 'custom_store_unavailable', message: '自定义人物存储读取失败' });
  }

  const errors = validateCustomFigure(figure, existingIds);
  if (errors.length > 0) {
    return json(400, { error: 'validation_failed', message: errors.join('；'), errors });
  }

  try {
    await saveCustomCharacter(db, figure);
  } catch (_) {
    return json(502, { error: 'custom_store_unavailable', message: '自定义人物保存失败' });
  }
  return json(201, { character: toPublicCharacter(figure) });
}
