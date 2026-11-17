export interface Profile {
  grade: string
  semester: string
  textbook: string
  progress: string
}

export interface StoredMessage {
  role: 'user' | 'assistant'
  content: string
  at: number
}

export interface RecordItem {
  id: string
  date: string
  topic: string
  task: string
  summary: string
  messages: StoredMessage[]
  grade: string
  textbook: string
}

const PROFILE_KEY = 'shijian_profile'
const RECORDS_KEY = 'shijian_records'
export const TASK_KEY = 'shijian_task'
const MAX_RECORDS = 200
const PROFILE_SKIPPED_KEY = 'shijian_profile_skipped'
const SIDEBAR_KEY = 'shijian_sidebar_collapsed'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toStr(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeProfile(value: unknown): Profile {
  if (!isRecord(value)) return { grade: '', semester: '', textbook: '', progress: '' }
  return {
    grade: toStr(value.grade),
    semester: toStr(value.semester),
    textbook: toStr(value.textbook),
    progress: toStr(value.progress),
  }
}

function normalizeStoredMessage(value: unknown): StoredMessage | null {
  if (!isRecord(value)) return null
  const role = value.role
  if (role !== 'user' && role !== 'assistant') return null
  const content = typeof value.content === 'string' ? value.content : String(value.content ?? '')
  const atNum = Number(value.at)
  const at = Number.isFinite(atNum) ? atNum : 0
  return { role, content, at }
}

function normalizeRecord(value: unknown): RecordItem {
  if (!isRecord(value)) return { id: '', date: '', topic: '', task: '', summary: '', messages: [], grade: '', textbook: '' }
  const rawMessages = Array.isArray(value.messages) ? value.messages : []
  const messages = rawMessages.map(normalizeStoredMessage).filter((m): m is StoredMessage => m !== null)
  return {
    id: toStr(value.id),
    date: toStr(value.date),
    topic: toStr(value.topic),
    task: toStr(value.task),
    summary: toStr(value.summary),
    messages,
    grade: toStr(value.grade),
    textbook: toStr(value.textbook),
  }
}

export function loadProfile(): Profile | null {
  try {
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem(PROFILE_KEY)
    if (raw === null) return null
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!isRecord(parsed)) return null
      return normalizeProfile(parsed)
    } catch {
      return null
    }
  } catch {
    return null
  }
}

export function saveProfile(obj: Profile): boolean {
  try {
    if (typeof window === 'undefined') return false
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(normalizeProfile(obj)))
    return true
  } catch {
    return false
  }
}

export function loadRecords(): RecordItem[] {
  try {
    if (typeof window === 'undefined') return []
    const raw = window.localStorage.getItem(RECORDS_KEY)
    if (raw === null) return []
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.map(normalizeRecord)
    } catch {
      return []
    }
  } catch {
    return []
  }
}

export function newRecordId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function saveRecord(rec: RecordItem): boolean {
  try {
    if (typeof window === 'undefined') return false
    const normalized = normalizeRecord(rec)
    const record = normalized.id === '' ? { ...normalized, id: newRecordId() } : normalized
    const records = loadRecords()
    records.push(record)
    const trimmed = records.length > MAX_RECORDS ? records.slice(records.length - MAX_RECORDS) : records
    window.localStorage.setItem(RECORDS_KEY, JSON.stringify(trimmed))
    return true
  } catch {
    return false
  }
}

export function updateRecord(id: string, patch: Partial<RecordItem>): boolean {
  try {
    if (typeof window === 'undefined') return false
    const records = loadRecords()
    const idx = records.findIndex((r) => r.id === id)
    if (idx === -1) return false
    const original = records[idx]
    const merged = { ...original, ...normalizeRecord({ ...original, ...patch }) }
    records[idx] = merged
    window.localStorage.setItem(RECORDS_KEY, JSON.stringify(records))
    return true
  } catch {
    return false
  }
}

export function clearRecords(): boolean {
  try {
    if (typeof window === 'undefined') return false
    window.localStorage.removeItem(RECORDS_KEY)
    return true
  } catch {
    return false
  }
}

export function loadTask(): string {
  try {
    if (typeof window === 'undefined') return ''
    return window.sessionStorage.getItem(TASK_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveTask(task: string): boolean {
  try {
    if (typeof window === 'undefined') return false
    window.sessionStorage.setItem(TASK_KEY, task)
    return true
  } catch {
    return false
  }
}

export function loadProfileSkipped(): boolean {
  try {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(PROFILE_SKIPPED_KEY) === '1'
  } catch {
    return false
  }
}

export function saveProfileSkipped(skipped: boolean): boolean {
  try {
    if (typeof window === 'undefined') return false
    if (skipped) {
      window.localStorage.setItem(PROFILE_SKIPPED_KEY, '1')
    } else {
      window.localStorage.removeItem(PROFILE_SKIPPED_KEY)
    }
    return true
  } catch {
    return false
  }
}

export function loadSidebarCollapsed(): boolean {
  try {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}

export function saveSidebarCollapsed(collapsed: boolean): boolean {
  try {
    if (typeof window === 'undefined') return false
    if (collapsed) {
      window.localStorage.setItem(SIDEBAR_KEY, '1')
    } else {
      window.localStorage.removeItem(SIDEBAR_KEY)
    }
    return true
  } catch {
    return false
  }
}
