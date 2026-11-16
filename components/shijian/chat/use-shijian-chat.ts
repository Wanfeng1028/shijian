import { useCallback, useEffect, useRef, useState } from 'react'
import { TASK_META, TaskId } from '@/components/shijian/chat/task-meta'
import { loadProfile, saveProfile, saveRecord, saveTask, Profile } from '@/lib/store'

export interface ChatMessage { role: 'user' | 'assistant'; content: string; at: number }
export interface EvalScores { extraction: number; analysis: number; connection: number; explanation: number }
export interface UseShijianChatResult {
  messages: ChatMessage[];
  status: string;
  busy: boolean;
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
  send: (text: string) => Promise<void>;
  stop: () => void;
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
const EVAL_TIMEOUT_MS = 60000
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stoppedRef = useRef(false)

  useEffect(() => {
    setMessages([{ ...welcomeFor(initialTask), at: Date.now() }])
    const p = loadProfile()
    if (p) {
      setProfile(p)
      setGrade(p.grade || '')
      setTextbook(p.textbook || '')
    } else {
      setProfileOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const clearNotice = useCallback(() => setNotice(null), [])
  const clearRestoredText = useCallback(() => setRestoredText(null), [])

  const saveProfileAndSync = useCallback((p: Profile) => {
    saveProfile(p)
    setProfile(p)
    setGrade(p.grade || '')
    setTextbook(p.textbook || '')
    setProfileOpen(false)
  }, [])

  const switchTask = useCallback((task: TaskId) => {
    setCurrentTask(task)
    saveTask(task)
    setMessages((prev) => [...prev, { ...welcomeFor(task), at: Date.now() }])
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
      const body: Record<string, unknown> = {
        action,
        task: currentTask,
        grade,
        textbook,
        topic,
        messages: lastMessages.slice(-10),
      }
      if (action === 'chat') {
        if (text) body.text = text
        if (pendingImage) body.imageData = pendingImage
        if (pendingDocText) body.docText = pendingDocText
      }
      return body
    },
    [currentTask, grade, textbook, topic, pendingImage, pendingDocText]
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
              fatalStatus = '后端未配置：请联系管理员配置 OPENROUTER_API_KEY 后再试'
              break
            }
            if (data && data.error === 'rate_limited') {
              fatal = 'rate_limited'
              fatalStatus = '请求太频繁，请稍后再试'
              break
            }
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
                let obj: { t?: string; done?: boolean; error?: string }
                try {
                  obj = JSON.parse(payload)
                } catch {
                  continue
                }
                if (obj.error) throw new Error(obj.error)
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
          saveRecord({
            date: new Date().toISOString(),
            topic: topic || text.slice(0, 20),
            task: currentTask,
            summary: replyText.slice(0, 60),
          })
        }
        setPendingImage(null)
        setPendingDocText('')
        setPendingDocName('')
        setBusy(false)
        return
      }

      if (fatal) {
        setStatus(fatalStatus)
        setRestoredText(text)
        setBusy(false)
        return
      }

      setStatus('服务暂时不可用，请稍后再试')
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
        setNotice('评价生成失败，请稍后再试')
      } else {
        setNotice('评价生成失败，请稍后再试')
        setStatus('准备就绪')
      }
    } catch {
      setNotice('评价生成失败，请稍后再试')
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
    send,
    stop,
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
  }
}
