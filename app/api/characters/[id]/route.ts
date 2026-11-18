/**
 * 单个人物 API：GET / PUT / DELETE /api/characters/:id。
 * 内置人物只读：GET 返回公开字段，PUT/DELETE 返回 400。
 * 自定义人物：GET 返回完整人物卡（编辑用，本就是用户自己建的），PUT 更新，DELETE 删除。
 * PUT/DELETE 需要 D1 绑定；无绑定返回 503。修改后仍跑同一套校验（id 除外）。
 */
import { getRequestContext } from '@cloudflare/next-on-pages';
import { CHARACTERS, getCharacter, toPublicCharacter, type HistoricalFigure } from '@/lib/characters';
import {
  deleteCustomCharacter,
  getCustomCharacter,
  listCustomCharacters,
  normalizeCustomFigure,
  resolveFigure,
  updateCustomCharacter,
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

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  const { id } = await params;
  const figure = await resolveFigure(id, getDb());
  if (!figure) {
    return json(404, { error: 'not_found', message: '没有这个人物' });
  }
  // 内置只给公开字段；自定义给完整卡（编辑用）。
  return json(200, { character: figure.source === 'custom' ? figure : toPublicCharacter(figure) });
}

export async function PUT(request: Request, { params }: RouteContext): Promise<Response> {
  const { id } = await params;
  if (getCharacter(id)) {
    return json(400, { error: 'builtin_readonly', message: '内置人物不可编辑' });
  }

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

  let existing: HistoricalFigure | null;
  try {
    existing = await getCustomCharacter(db, id);
  } catch (_) {
    return json(502, { error: 'custom_store_unavailable', message: '自定义人物存储读取失败' });
  }
  if (!existing) {
    return json(404, { error: 'not_found', message: '没有这个自定义人物' });
  }

  const figure = normalizeCustomFigure(input);
  if (!figure) {
    return json(400, { error: 'invalid_figure', message: '人物卡格式不正确' });
  }
  // 路径 id 为准：id 不可改。
  figure.id = id;

  let customs: HistoricalFigure[];
  try {
    customs = await listCustomCharacters(db);
  } catch (_) {
    return json(502, { error: 'custom_store_unavailable', message: '自定义人物存储读取失败' });
  }
  // 唯一性检查排除自己，否则永远报“id 已存在”。
  const existingIds = [
    ...CHARACTERS.map((c) => c.id),
    ...customs.map((c) => c.id).filter((x) => x !== id),
  ];
  const errors = validateCustomFigure(figure, existingIds);
  if (errors.length > 0) {
    return json(400, { error: 'validation_failed', message: errors.join('；'), errors });
  }

  try {
    await updateCustomCharacter(db, figure);
  } catch (_) {
    return json(502, { error: 'custom_store_unavailable', message: '自定义人物保存失败' });
  }
  return json(200, { character: toPublicCharacter(figure) });
}

export async function DELETE(_request: Request, { params }: RouteContext): Promise<Response> {
  const { id } = await params;
  if (getCharacter(id)) {
    return json(400, { error: 'builtin_readonly', message: '内置人物不可删除' });
  }

  const db = getDb();
  if (!db) {
    return json(503, { error: 'custom_store_unavailable', message: '自定义人物存储未配置（缺少 D1 绑定）' });
  }

  let deleted: boolean;
  try {
    deleted = await deleteCustomCharacter(db, id);
  } catch (_) {
    return json(502, { error: 'custom_store_unavailable', message: '自定义人物删除失败' });
  }
  if (!deleted) {
    return json(404, { error: 'not_found', message: '没有这个自定义人物' });
  }
  return json(200, { ok: true });
}
