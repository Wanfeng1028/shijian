import { NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { SESSION_COOKIE, verifySession } from '@/lib/auth'

export const runtime = 'edge'

function getCookie(header: string | null, name: string): string | null {
  if (!header) return null
  const parts = header.split(';')
  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.startsWith(`${name}=`)) {
      return decodeURIComponent(trimmed.slice(name.length + 1))
    }
  }
  return null
}

async function requireUser(request: Request): Promise<string | null> {
  const cookieHeader = request.headers.get('cookie')
  const token = getCookie(cookieHeader, SESSION_COOKIE)
  if (!token) return null
  const secret = (getRequestContext().env as unknown as Record<string, string | undefined>).SESSION_SECRET
  if (!secret) return null
  const userId = await verifySession(token, secret)
  return userId
}

export async function GET(request: Request) {
  const userId = await requireUser(request)
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const db = getRequestContext().env.DB
  const result = await db
    .prepare(
      'SELECT id, title, task, grade, textbook, messages, created_at, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC'
    )
    .bind(userId)
    .all()
  const rows = result.results as Array<Record<string, unknown>>

  const conversations = rows.map((row) => {
    let messages: unknown[] = []
    try {
      const parsed = JSON.parse(String(row.messages))
      if (Array.isArray(parsed)) messages = parsed
    } catch {
      messages = []
    }
    return {
      id: row.id as string,
      title: row.title == null ? '' : String(row.title),
      task: row.task == null ? '' : String(row.task),
      grade: row.grade == null ? '' : String(row.grade),
      textbook: row.textbook == null ? '' : String(row.textbook),
      messages,
      created_at: row.created_at as number,
      updated_at: row.updated_at as number,
    }
  })

  return NextResponse.json({ ok: true, conversations })
}

export async function POST(request: Request) {
  const userId = await requireUser(request)
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }
  const obj = body as Record<string, unknown>

  if (!Array.isArray(obj.messages)) {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const title = obj.title == null ? '' : String(obj.title)
  const task = obj.task == null ? '' : String(obj.task)
  const grade = obj.grade == null ? '' : String(obj.grade)
  const textbook = obj.textbook == null ? '' : String(obj.textbook)

  const id =
    obj.id === undefined || obj.id === null || obj.id === ''
      ? crypto.randomUUID()
      : String(obj.id)
  const now = Math.floor(Date.now() / 1000)
  const messagesJson = JSON.stringify(obj.messages)

  const db = getRequestContext().env.DB
  const existing = await db
    .prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first()

  if (existing) {
    await db.prepare(
      'UPDATE conversations SET title=?, task=?, grade=?, textbook=?, messages=?, updated_at=? WHERE id=? AND user_id=?'
    )
      .bind(title, task, grade, textbook, messagesJson, now, id, userId)
      .run()
  } else {
    await db.prepare(
      'INSERT INTO conversations (id, user_id, title, task, grade, textbook, messages, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(id, userId, title, task, grade, textbook, messagesJson, now, now)
      .run()
  }

  return NextResponse.json({ ok: true, id })
}
