import { useCallback, useEffect, useRef, useState } from 'react'
import { TASK_META, TaskId } from '@/components/shijian/chat/task-meta'
import { loadProfile, saveProfile, saveRecord, saveTask, loadProfileSkipped, saveProfileSkipped, updateRecord, newRecordId, Profile, RecordItem } from '@/lib/store'

export interface ChatMessage { role: 'user' | 'assistant'; content: string; at: number }
export interface EvalScores { extraction: number; analysis: number; connection: number; explanation: number }
export interface UseShijianChatResult {
  messages: ChatMessage[];
  status: string;
  busy: boolean;
  model: string;
  setModel: (model: string) => void;
  effort: number;
  setEffort: (effort: number) => void;
  lastReplyAt: number | null;
  streamingText: string | null;
  pendingImage: string | null;
  pendingDocText: string;
  pendingDocName: string;
  currentTask: TaskId;
  switchTask: (task: TaskId) => void;
  topic: string;
  setTopic: (topic: string) => void;
  grade: string;
  setGrade: (grade: string) => void;
  textbook: string;
  setTextbook: (textbook: string) => void;
  profile: Profile | null;
  profileOpen: boolean;
  setProfileOpen: (open: boolean) => void;
  saveProfileAndSync: (profile: Profile) => void;
  restoreSession: (record: RecordItem) => void;
  send: (text: string) => Promise<void>;
  stop: () => void;
  /** Clears the open chat back to the template empty state. */
  resetChat: () => void;
  evaluate: () => Promise<void>;
  scores: EvalScores | null;
  advice: string | null;
  evaluating: boolean;
  notice: string | null;
  clearNotice: () => void;
  restoredText: string | null;
  clearRestoredText: () => void;
  handleImageFile: (file: File) => void;
  removeImage: () => void;
  handleDocFile: (file: File) => void;
  removeDoc: () => void;
}

const STALL_MS = 45000
// 评价最坏情况：PRIMARY 55 秒 + FALLBACK 55 秒 = 110 秒，60 秒会在 PRIMARY 慢失败时掐断 FALLBACK；放宽到 120 秒才兜得住。STALL_MS 保持 45 秒不变（必须比服务端 55 秒短，abort+重试才有意义）。
const EVAL_TIMEOUT_MS = 120000
const MAX_ATTEMPTS = 2

function welcomeFor(task: TaskId): ChatMessage {
  const meta = (TASK_META as Record<TaskId, { welcome?: string }>)[task]
  return { role: 'assistant', content: meta?.welcome || '你好，我是史鉴。', at: Date.now() }
}

export function useShijianChat(initialTask: TaskId): UseShijianChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState('准备就绪')
  const [busy, setBusy] = useState(false)
  const [streamingText, setStreamingText] = useState<string | null>(null)
  const [model, setModel] = useState('spark-x2.6')
  const [effort, setEffort] = useState(1)
  const [lastReplyAt, setLastReplyAt] = useState<number | null>(null)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [pendingDocText, setPendingDocText] = useState('')
  const [pendingDocName, setPendingDocName] = useState('')
  const [currentTask, setCurrentTask] = useState<TaskId>(initialTask)
  const [topic, setTopic] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [grade, setGrade] = useState('')
  const [textbook, setTextbook] = useState('')
  const [scores, setScores] = useState<EvalScores | null>(null)
  const [advice, setAdvice] = useState<string | null>(null)
  const [evaluating, setEvaluating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [restoredText, setRestoredText] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const activeRecordIdRef = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stoppedRef = useRef(false)

  useEffect(() => {
    // Template empty state: start with no messages so the suggestion chips
    // show; the welcome line lives in the empty state, not as a message.
    const p = loadProfile()
    if (p) {
      setProfile(p)
      setGrade(p.grade || '')
      setTextbook(p.textbook || '')
    } else if (!loadProfileSkipped()) {
      setProfileOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const clearNotice = useCallback(() => setNotice(null), [])
  const clearRestoredText = useCallback(() => setRestoredText(null), [])

  const saveProfileAndSync = useCallback((p: Profile) => {
    saveProfileSkipped(false)
    saveProfile(p)
    setProfile(p)
    setGrade(p.grade || '')
    setTextbook(p.textbook || '')
    setProfileOpen(false)
  }, [])

  const restoreSession = useCallback((record: RecordItem) => {
    if (!record.messages || record.messages.length === 0) return
    setMessages(record.messages.map((m) => ({ role: m.role, content: m.content, at: m.at })))
    setTopic(record.topic || '')
    const meta = (TASK_META as Record<string, { welcome?: string } | undefined>)[record.task]
    if (meta) {
      setCurrentTask(record.task as TaskId)
      saveTask(record.task)
    }
    setGrade(record.grade || '')
    setTextbook(record.textbook || '')
    setScores(null)
    setAdvice(null)
    setNotice(null)
    setStatus('准备就绪')
    activeRecordIdRef.current = record.id || null
  }, [])

  const switchTask = useCallback((task: TaskId) => {
    setCurrentTask(task)
    saveTask(task)
    // Only greet mid-thread; on an empty thread the empty state already
    // shows the new task's description and suggestion chips.
    setMessages((prev) => (prev.length === 0 ? prev : [...prev, { ...welcomeFor(task), at: Date.now() }]))
  }, [])

  const resetChat = useCallback(() => {
    setMessages([])
    setScores(null)
    setAdvice(null)
    setNotice(null)
    setStatus('准备就绪')
    activeRecordIdRef.current = null
  }, [])

  const resetTimer = useCallback((controller: AbortController, onStall: () => void) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      controller.abort()
      onStall()
    }, STALL_MS)
  }, [])

  const buildBody = useCallback(
    (text: string, lastMessages: ChatMessage[], action: 'chat' | 'evaluate') => {
      const EFFORT_LABELS = ['Low', 'Medium', 'Balanced', 'High', 'Very High', 'Max']
      const body: Record<string, unknown> = {
        action,
        task: currentTask,
        grade,
        textbook,
        topic,
        model,
        effort,
        effortLabel: EFFORT_LABELS[effort] || 'Medium',
        messages: lastMessages.slice(-10),
      }
      if (action === 'chat') {
        if (text) body.text = text
        if (pendingImage) body.imageData = pendingImage
        if (pendingDocText) body.docText = pendingDocText
      }
      return body
    },
    [currentTask, grade, textbook, topic, model, effort, pendingImage, pendingDocText]
  )

  const send = useCallback(
    async (text: string) => {
      if (!text || !text.trim()) return
      if (busy) return
      stoppedRef.current = false
      setBusy(true)
      setNotice(null)
      setRestoredText(null)
      setStatus('史鉴正在思考…')
      const userMsg: ChatMessage = { role: 'user', content: text, at: Date.now() }
      const baseMessages = [...messages, userMsg]
      setMessages(baseMessages)

      let fatal: 'backend_not_configured' | 'rate_limited' | null = null
      let fatalStatus = ''
      let sseErrorMessage: string | null = null
      let success = false
      let replyText = ''
      let attempt = 0

      while (attempt < MAX_ATTEMPTS) {
        attempt++
        const controller = new AbortController()
        abortRef.current = controller
        let stalled = false
        try {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildBody(text, baseMessages, 'chat')),
            signal: controller.signal,
          })
          const contentType = res.headers.get('Content-Type') || ''

          if (contentType.includes('application/json')) {
            const data = await res.json()
            if (data && typeof data.reply === 'string') {
              replyText = data.reply
              setMessages((prev) => [...prev, { role: 'assistant', content: data.reply, at: Date.now() }])
              setStatus('准备就绪')
              success = true
              break
            }
            if (data && data.error === 'backend_not_configured') {
              fatal = 'backend_not_configured'
              fatalStatus = '后端未配置：请联系管理员配置 BOTSROUTER_API_KEY 后再试'
              break
            }
            if (data && data.error === 'rate_limited') {
              fatal = 'rate_limited'
              fatalStatus = '请求太频繁，请稍后再试'
              break
            }
            if (data && typeof data.message === 'string' && data.message) sseErrorMessage = data.message
            throw new Error('bad response')
          }

          if (contentType.includes('text/event-stream')) {
            if (!res.body) throw new Error('no body')
            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let full = ''
            let firstToken = false
            resetTimer(controller, () => {
              stalled = true
              controller.abort()
            })
            for (;;) {
              const { done, value } = await reader.read()
              if (done) break
              if (timerRef.current) clearTimeout(timerRef.current)
              resetTimer(controller, () => {
                stalled = true
                controller.abort()
              })
              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''
              for (const rawLine of lines) {
                const line = rawLine.trim()
                if (!line || line.startsWith(':')) continue
                if (!line.startsWith('data:')) continue
                const payload = line.slice(5).trim()
                if (!payload) continue
                let obj: { t?: string; done?: boolean; error?: string; message?: string; code?: string; reason?: string }
                try {
                  obj = JSON.parse(payload)
                } catch {
                  continue
                }
                if (obj.error) {
                if (typeof obj.message === 'string' && obj.message) sseErrorMessage = obj.message
                throw new Error(obj.error)
                }
                if (obj.done) {
                  if (timerRef.current) clearTimeout(timerRef.current)
                  replyText = full
                  setMessages((prev) => [...prev, { role: 'assistant', content: full, at: Date.now() }])
                  setStreamingText(null)
                  setStatus('准备就绪')
                  success = true
                  break
                }
                if (typeof obj.t === 'string' && obj.t.length) {
                  if (!firstToken) {
                    firstToken = true
                    setStatus('史鉴正在回答…')
                    setStreamingText('')
                  }
                  full += obj.t
                  setStreamingText(full)
                }
              }
              if (success) break
            }
            if (success) break
            throw new Error('stream ended without done')
          }

          throw new Error('unsupported content type')
        } catch (err) {
          if (timerRef.current) clearTimeout(timerRef.current)
          if (stoppedRef.current) break
          if (fatal) break
          if (stalled) {
            // stall: treat as retryable failure
          }
          if (attempt >= MAX_ATTEMPTS) {
            break
          }
          // non-fatal failure: auto retry once, do not restore input
        }
      }

      if (timerRef.current) clearTimeout(timerRef.current)
      abortRef.current = null

      if (stoppedRef.current) {
        setBusy(false)
        setStatus('准备就绪')
        return
      }

      if (success) {
        if (replyText) {
          const doneMessages: ChatMessage[] = [...baseMessages, { role: 'assistant', content: replyText, at: Date.now() }]
          const activeId = activeRecordIdRef.current
          if (activeId) {
            updateRecord(activeId, {
              messages: doneMessages,
              summary: replyText.slice(0, 60),
              date: new Date().toISOString(),
            })
          } else {
            const id = newRecordId()
            saveRecord({
              id,
              date: new Date().toISOString(),
              topic: topic || text.slice(0, 20),
              task: currentTask,
              summary: replyText.slice(0, 60),
              messages: doneMessages,
              grade,
              textbook,
            })
            activeRecordIdRef.current = id
          }
        }
        setLastReplyAt(Date.now())
        setPendingImage(null)
        setPendingDocText('')
        setPendingDocName('')
        setBusy(false)
        return
      }

      if (fatal) {
        setStatus(fatalStatus)
        setNotice(fatalStatus)
        setRestoredText(text)
        setBusy(false)
        return
      }

      const failureMessage = sseErrorMessage || '网络异常，回复未完成，请检查网络后重试'
      setStatus(failureMessage)
      setNotice(failureMessage)
      setRestoredText(text)
      setBusy(false)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, messages, buildBody, resetTimer, topic, currentTask]
  )

  const stop = useCallback(() => {
    if (!busy) return
    stoppedRef.current = true
    abortRef.current?.abort()
    if (streamingText) {
      const partial = streamingText
      setMessages((prev) => [...prev, { role: 'assistant', content: partial, at: Date.now() }])
      setStreamingText(null)
    }
    setBusy(false)
    setStatus('准备就绪')
  }, [busy, streamingText])

  const evaluate = useCallback(async () => {
    if (messages.length < 2) {
      setNotice('先完成一次对话再生成评价')
      return
    }
    setEvaluating(true)
    setNotice(null)
    setStatus('正在生成评价…')
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), EVAL_TIMEOUT_MS)
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody('', messages, 'evaluate')),
        signal: controller.signal,
      })
      clearTimeout(timer)
      const data = await res.json()
      if (data && data.scores && typeof data.advice === 'string') {
        const s = data.scores as Record<string, unknown>
        const num = (v: unknown): number =>
          typeof v === 'number' && Number.isFinite(v) ? v : NaN
        setScores({
          extraction: num(s.extraction),
          analysis: num(s.analysis),
          connection: num(s.connection),
          explanation: num(s.explanation),
        })
        setAdvice(data.advice)
        setStatus('准备就绪')
      } else if (data && data.error === 'rate_limited') {
        setStatus('请求太频繁，请稍后再试')
        setNotice(typeof data.message === 'string' && data.message ? data.message : '请求太频繁，请稍后再试')
      } else {
        setNotice(typeof data.message === 'string' && data.message ? data.message : '评价未生成：上游模型服务异常，请稍后再试')
        setStatus('准备就绪')
      }
    } catch {
      setNotice('网络异常或请求超时，评价未生成，请检查网络后重试')
      setStatus('准备就绪')
    } finally {
      setEvaluating(false)
    }
  }, [messages, buildBody])

  const handleImageFile = useCallback((file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      setNotice('图片超过 2MB，请换一张更小的图片')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setPendingImage(typeof reader.result === 'string' ? reader.result : null)
    }
    reader.readAsDataURL(file)
  }, [])

  const removeImage = useCallback(() => setPendingImage(null), [])

  const handleDocFile = useCallback((file: File) => {
    const name = file.name || ''
    setPendingDocName(name)
    const lower = name.toLowerCase()
    if (lower.endsWith('.txt') || lower.endsWith('.md')) {
      const reader = new FileReader()
      reader.onload = () => {
        setPendingDocText(typeof reader.result === 'string' ? reader.result : '')
      }
      reader.readAsText(file)
    } else {
      setPendingDocText('')
      setNotice('PDF / Word 文档暂不支持直接读取正文，请把文字复制粘贴到输入框')
    }
  }, [])

  const removeDoc = useCallback(() => {
    setPendingDocText('')
    setPendingDocName('')
  }, [])

  return {
    messages,
    status,
    busy,
    streamingText,
    pendingImage,
    pendingDocText,
    pendingDocName,
    currentTask,
    switchTask,
    topic,
    setTopic,
    grade,
    setGrade,
    textbook,
    setTextbook,
    profile,
    profileOpen,
    setProfileOpen,
    saveProfileAndSync,
    restoreSession,
    send,
    stop,
    resetChat,
    evaluate,
    scores,
    advice,
    evaluating,
    notice,
    clearNotice,
    restoredText,
    clearRestoredText,
    handleImageFile,
    removeImage,
    handleDocFile,
    removeDoc,
    model,
    setModel,
    effort,
    setEffort,
    lastReplyAt,
  }
}
