'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from "motion/react";
import { useRouter, useSearchParams } from 'next/navigation';
import { RiCloseLine, RiMenuLine } from '@remixicon/react';
import { FileText } from 'lucide-react';
import { cx } from '@/utils/cx';
import { ProfileModal } from '@/components/shijian/chat/profile-modal';
import { EvaluateCard } from '@/components/shijian/chat/evaluate-card';
import { ChatSidebar } from '@/components/shijian/chat/chat-sidebar';
import { HistoryRail } from '@/components/shijian/chat/history-rail';
import { TASK_META, TASK_ORDER, type TaskId } from '@/components/shijian/chat/task-meta';
import { useShijianChat } from '@/components/shijian/chat/use-shijian-chat';
import { loadRecords, loadTask } from '@/lib/store';
import { AgentChatActions } from '@/components/boardui/application/agent-chat/agent-chat-actions';
import { AgentComposer } from '@/components/boardui/application/agent-chat/agent-composer';
import { AgentMessage } from '@/components/boardui/application/agent-chat/agent-chat-message';
import { AgentThinking } from '@/components/boardui/application/agent-thinking/agent-thinking';
import { Button } from '@/components/boardui/base/buttons/button';
import { IconButton } from '@/components/boardui/base/buttons/icon-button';

/**
 * 史鉴对话页。布局与结构直接套用 BoardUI chat-starter / AgentChat 模板原样
 *（外框 h-dvh p-3 gap-4；260px 侧栏 + rounded-3xl secondary 聊天面 +
 * xl 下 260px 记录栏；覆盖式 h-12 header；transcript 列 max-w-3xl pt-[72px]；
 * 空状态建议芯片；52px pill 输入框）；只换里面的史鉴内容。
 * 数据流不动：use-shijian-chat → /api/chat SSE → localStorage 记录。
 */

const VALID_TASKS = new Set<string>(TASK_ORDER);

function resolveInitialTask(param: string | null): TaskId {
  if (param && VALID_TASKS.has(param)) return param as TaskId;
  const stored = loadTask();
  if (stored && VALID_TASKS.has(stored)) return stored as TaskId;
  return 'reading';
}

function deriveTitle(messages: Array<{ role: string; content: string }>): string {
  const firstUser = messages.find((m) => m.role === 'user');
  const text = firstUser?.content.trim() ?? '';
  if (!text) return '新对话';
  return text.length > 48 ? `${text.slice(0, 48)}…` : text;
}

function ChatPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const taskParam = searchParams.get('task');
  const sessionParam = searchParams.get('session');
  const restoredRef = useRef(false);
  const [initialTask] = useState<TaskId>(() => resolveInitialTask(taskParam));
  const [navOpen, setNavOpen] = useState(false);

  const chat = useShijianChat(initialTask);
  const {
    messages,
    busy,
    streamingText,
    pendingImage,
    pendingDocText,
    pendingDocName,
    currentTask,
    switchTask,
    grade,
    setGrade,
    textbook,
    setTextbook,
    model,
    setModel,
    effort,
    setEffort,
    lastReplyAt,
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
  } = chat;

  useEffect(() => {
    if (restoredRef.current) return;
    if (!sessionParam) return;
    restoredRef.current = true;
    const record = loadRecords().find((r) => r.id === sessionParam);
    if (record && record.messages && record.messages.length > 0) {
      restoreSession(record);
    }
    router.replace('/chat', { scroll: false });
  }, [sessionParam, restoreSession, router]);

  const [inputValue, setInputValue] = useState('');
  const [evalVisible, setEvalVisible] = useState(false);
  const evalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  /** True once the transcript is scrolled at all. */
  const [scrolledUnder, setScrolledUnder] = useState(false);
  /** Whether the title and the message column actually overlap horizontally. */
  const [canClash, setCanClash] = useState(false);

  const headerTitle = useMemo(() => deriveTitle(messages), [messages]);

  const transcript = useMemo(
    () =>
      messages
        .map((m) => `${m.role === 'user' ? '我' : '史鉴'}：${m.content}`)
        .filter((line) => !line.endsWith('：'))
        .join('\n\n'),
    [messages],
  );

  const profileLabel = useMemo(() => {
    if (!profile) return '我的学习档案';
    const parts = [profile.grade, profile.textbook].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : '我的学习档案';
  }, [profile]);

  const exportRecords = useCallback(() => {
    const records = loadRecords();
    if (records.length === 0) return;
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'shijian-records.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, []);

  useEffect(() => {
    if (restoredText !== null) {
      setInputValue(restoredText);
      clearRestoredText();
    }
  }, [restoredText, clearRestoredText]);

  // Geometry, not a breakpoint: the title is as wide as its text, so whether
  // it reaches the column depends on both and has to be measured.
  useEffect(() => {
    const measure = () => {
      const title = titleRef.current?.getBoundingClientRect();
      const column = columnRef.current?.getBoundingClientRect();
      if (!title || !column) return;
      // A 16px buffer so text never slides right up against the title.
      setCanClash(title.right + 16 > column.left);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (scrollRef.current) observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, [messages.length, headerTitle]);

  // Template scrolls on every streamed token because its `messages` mutate
  // per token; here streamed text lives in `streamingText`, so it must be a
  // dep too, or the transcript only scrolls when a message commits.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy, streamingText]);

  // Escape closes the mobile drawer (Modern Web Guidance: navigation-drawer —
  // a drawer must dismiss on Escape as well as on backdrop / close button).
  useEffect(() => {
    if (!navOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [navOpen]);

  const hideEval = useCallback(() => {
    if (evalTimerRef.current) {
      clearTimeout(evalTimerRef.current);
      evalTimerRef.current = null;
    }
    setEvalVisible(false);
  }, []);

  const showEvalTimed = useCallback(() => {
    if (evalTimerRef.current) clearTimeout(evalTimerRef.current);
    setEvalVisible(true);
    evalTimerRef.current = setTimeout(() => setEvalVisible(false), 10000);
  }, []);

  useEffect(() => () => {
    if (evalTimerRef.current) clearTimeout(evalTimerRef.current);
  }, []);

  useEffect(() => {
    if (lastReplyAt !== null) showEvalTimed();
  }, [lastReplyAt, showEvalTimed]);

  useEffect(() => {
    if (scores !== null) showEvalTimed();
  }, [scores, showEvalTimed]);

  const handleSubmit = () => {
    hideEval();
    const value = inputValue;
    setInputValue('');
    void send(value);
  };

  const handleAttachFile = (file: File) => {
    const isImage =
      file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name);
    if (isImage) handleImageFile(file);
    else handleDocFile(file);
  };

  const openAttachPicker = () => {
    attachInputRef.current?.click();
  };

  const sidebar = (
    <ChatSidebar
      currentTask={currentTask}
      onSwitchTask={(task) => {
        switchTask(task);
        setNavOpen(false);
      }}
      grade={grade}
      setGrade={setGrade}
      textbook={textbook}
      setTextbook={setTextbook}
      onOpenProfile={() => {
        setProfileOpen(true);
        setNavOpen(false);
      }}
    />
  );

  return (
    <div className="relative flex h-dvh w-full gap-4 overflow-hidden bg-background-full p-3">
      <div className="hidden lg:flex lg:h-full lg:shrink-0">
        {sidebar}
      </div>

      {/* Below lg the sidebar rides in as an overlay drawer. The Pro template
          pushes the workspace across instead; this is the plain version. */}
      {navOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            aria-label="关闭导航"
            onClick={() => setNavOpen(false)}
            className="absolute inset-0 cursor-pointer bg-black/40"
          />
          <div className="relative flex h-full p-3">
            <ChatSidebar
              mobile
              id="shijian-chat-sidebar"
              onClose={() => setNavOpen(false)}
              currentTask={currentTask}
              onSwitchTask={(task) => {
                switchTask(task);
                setNavOpen(false);
              }}
              grade={grade}
              setGrade={setGrade}
              textbook={textbook}
              setTextbook={setTextbook}
              onOpenProfile={() => {
                setProfileOpen(true);
                setNavOpen(false);
              }}
              className="flex"
            />
          </div>
        </div>
      )}

      <div className="relative flex min-h-0 min-w-0 flex-1 gap-3 overflow-hidden">
        <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-3xl bg-background-secondary-default">
          <header
            className={cx(
              'absolute inset-x-0 top-0 z-10 flex h-12 items-center gap-2 border-b px-4 pt-[7px] transition-colors',
              // Overlaid rather than stacked above the transcript. A rule only
              // earns its place when the text both passes under the header AND
              // the title is wide enough to be in its way. The border is always
              // present but transparent, so appearing costs no height.
              scrolledUnder && canClash
                ? 'border-separator-border bg-background-primary-default/80 backdrop-blur-[20px]'
                : 'border-transparent',
            )}
          >
            <IconButton
              icon={navOpen ? RiCloseLine : RiMenuLine}
              size="small"
              aria-label="打开导航"
              aria-expanded={navOpen}
              aria-controls="shijian-chat-sidebar"
              onClick={() => setNavOpen((open) => !open)}
              className="lg:hidden"
            />
            <span
              ref={titleRef}
              className="min-w-0 shrink truncate text-headline-medium text-text-primary"
            >
              {headerTitle}
            </span>

            <AgentChatActions
              className="ms-auto"
              transcript={transcript}
              onExport={exportRecords}
              onDelete={resetChat}
              disabled={messages.length === 0}
            />
          </header>

          <div
            ref={scrollRef}
            onScroll={(event) => setScrolledUnder(event.currentTarget.scrollTop > 0)}
            className="min-h-0 flex-1 overflow-y-auto scroll-smooth"
          >
            <div
              ref={columnRef}
              className={cx(
                'mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pt-[72px] pb-6',
                // With nothing to read, the prompt sits in the middle of
                // the empty space rather than pinned under the header.
                messages.length === 0 && 'min-h-full justify-center',
              )}
            >
              {messages.length === 0 ? (
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-title-2-medium text-text-primary">你好，我是史鉴</h2>
                    <p className="text-body-regular text-text-secondary">{TASK_META[currentTask].desc}</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {TASK_META[currentTask].quick.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => { hideEval(); void send(suggestion); }}
                        className="cursor-pointer rounded-full bg-background-primary-default px-3.5 py-2 text-body-regular text-text-secondary shadow-xs transition-colors hover:bg-background-primary-hover"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <AgentMessage key={i} role={m.role} text={m.content} at={m.at} />
                ))
              )}

              {messages.length > 0 && evalVisible ? (
                <EvaluateCard
                  scores={scores}
                  advice={advice}
                  evaluating={evaluating}
                  onEvaluate={evaluate}
                  onClose={hideEval}
                  disabled={busy || messages.length < 2}
                />
              ) : null}

              {busy && streamingText === null ? (
      <motion.div initial={{ opacity: 0, y: 6, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }} className="rounded-3xl border border-border-button-default bg-background-primary-default p-5">
        <AgentThinking variant="wave" label="史鉴正在思考…" showTimer />
        <div className="mt-4 flex flex-col gap-2">
          <div className="h-3 w-11/12 animate-pulse rounded-full bg-background-secondary-default" />
          <div className="h-3 w-8/12 animate-pulse rounded-full bg-background-secondary-default" />
          <div className="h-3 w-9/12 animate-pulse rounded-full bg-background-secondary-default" />
        </div>
        <p className="mt-3 text-caption-1-semibold text-text-tertiary">正在组织史料与教材依据…</p>
      </motion.div>
    ) : null}
    {streamingText !== null ? (
      <motion.div key="streaming" initial={{ opacity: 0, y: 6, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}>
        <AgentMessage role="assistant" text={streamingText} streaming />
      </motion.div>
    ) : null}
            </div>
          </div>

          <div className="shrink-0 px-3 pb-3">
            <div className="mx-auto w-full max-w-3xl">
              {notice ? (
                <div className="mb-2 flex items-center justify-between rounded-xl border border-accent-300 bg-accent-50 px-3 py-2">
                  <p className="min-w-0 text-body-2-regular text-accent-900">{notice}</p>
                  <button
                    type="button"
                    onClick={clearNotice}
                    className="shrink-0 whitespace-nowrap text-caption-1-semibold text-text-tertiary outline-none hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                  >
                    关闭
                  </button>
                </div>
              ) : null}

              {pendingImage ? (
                <div className="mb-2 flex items-center gap-3 rounded-xl border border-border-button-default bg-background-primary-default p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pendingImage} alt="待发送图片预览" className="h-[120px] w-[120px] rounded-md object-cover" />
                  <Button variant="ghost" size="small" onClick={removeImage}>移除图片</Button>
                </div>
              ) : null}

              {pendingDocName ? (
                <div className="mb-2 flex items-center gap-3 rounded-xl border border-border-button-default bg-background-primary-default px-3 py-2">
                  <FileText className="size-4 text-text-secondary" />
                  <span className="min-w-0 flex-1 truncate text-body-2-regular text-text-secondary">{pendingDocName}</span>
                  <Button variant="ghost" size="xs" onClick={removeDoc}>移除</Button>
                </div>
              ) : null}

              <AgentComposer
                value={inputValue}
                onValueChange={(v: string) => { setInputValue(v); if (v.trim().length > 0) hideEval(); }}
                onSubmit={handleSubmit}
                onStop={stop}
                onAddAttachment={openAttachPicker}
                busy={busy}
                model={model}
                onModelChange={setModel}
                effort={effort}
                onEffortChange={setEffort}
                provider="BotsRouter"
                messageCount={messages.length}
              />

              <input
                ref={attachInputRef}
                type="file"
                accept="image/*,.txt,.md,.pdf,.doc,.docx"
                className="visually-hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAttachFile(file);
                  e.target.value = '';
                }}
              />
              <p className="mt-2 hidden text-caption-1-semibold text-text-tertiary text-center sm:block">
                纯文本文档可直接读取，PDF / Word 若无法读取正文，请复制粘贴文字。
              </p>
            </div>
          </div>
        </div>

        <HistoryRail
          refreshKey={messages.length}
          onNewChat={resetChat}
          onOpenProfile={() => setProfileOpen(true)}
          profileLabel={profileLabel}
          onExport={exportRecords}
          className="hidden xl:flex"
        />
      </div>

      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        initial={profile}
        onSaved={saveProfileAndSync}
      />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
    </Suspense>
  );
}
