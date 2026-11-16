export interface Profile {
  grade: string
  semester: string
  textbook: string
  progress: string
}

export interface RecordItem {
  date: string
  topic: string
  task: string
  summary: string
}

const PROFILE_KEY = 'shijian_profile'
const RECORDS_KEY = 'shijian_records'
export const TASK_KEY = 'shijian_task'
const MAX_RECORDS = 200

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

function normalizeRecord(value: unknown): RecordItem {
  if (!isRecord(value)) return { date: '', topic: '', task: '', summary: '' }
  return {
    date: toStr(value.date),
    topic: toStr(value.topic),
    task: toStr(value.task),
    summary: toStr(value.summary),
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

export function saveRecord(rec: RecordItem): boolean {
  try {
    if (typeof window === 'undefined') return false
    const records = loadRecords()
    records.push(normalizeRecord(rec))
    const trimmed = records.length > MAX_RECORDS ? records.slice(records.length - MAX_RECORDS) : records
    window.localStorage.setItem(RECORDS_KEY, JSON.stringify(trimmed))
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
