'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronDown, FileText, Image as ImageIcon, UserRound } from 'lucide-react';
import { cx } from '@/utils/cx';
import { Topbar } from '@/components/shijian/topbar';
import { ProfileModal } from '@/components/shijian/chat/profile-modal';
import { EvaluateCard } from '@/components/shijian/chat/evaluate-card';
import {
  CONTEXT_EMPTY_OPTION,
  GRADE_OPTIONS,
  TASK_META,
  TASK_ORDER,
  TEXTBOOK_OPTIONS,
  type TaskId,
} from '@/components/shijian/chat/task-meta';
import { useShijianChat } from '@/components/shijian/chat/use-shijian-chat';
import { loadTask } from '@/lib/store';
import { AgentComposer } from '@/components/boardui/application/agent-chat/agent-composer';
import { AgentMessage } from '@/components/boardui/application/agent-chat/agent-chat-message';
import { AgentThinking } from '@/components/boardui/application/agent-thinking/agent-thinking';
import { Select, SelectItem } from '@/components/boardui/base/select/select';
import { Button } from '@/components/boardui/base/buttons/button';
import { ScrollFade, useScrollFade } from '@/components/boardui/foundations/scroll-fade/scroll-fade';

const VALID_TASKS = new Set<string>(TASK_ORDER);

function resolveInitialTask(param: string | null): TaskId {
  if (param && VALID_TASKS.has(param)) return param as TaskId;
  const stored = loadTask();
  if (stored && VALID_TASKS.has(stored)) return stored as TaskId;
  return 'reading';
}

function GradeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select label="年级" selectedKey={value === '' ? '' : value} onSelectionChange={(key) => onChange(String(key))}>
      <SelectItem id="">{CONTEXT_EMPTY_OPTION}</SelectItem>
      {GRADE_OPTIONS.map((g) => (
        <SelectItem key={g} id={g}>{g}</SelectItem>
      ))}
    </Select>
  );
}

function TextbookSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select label="教材" selectedKey={value === '' ? '' : value} onSelectionChange={(key) => onChange(String(key))}>
      <SelectItem id="">{CONTEXT_EMPTY_OPTION}</SelectItem>
      {TEXTBOOK_OPTIONS.map((t) => (
        <SelectItem key={t} id={t}>{t}</SelectItem>
      ))}
    </Select>
  );
}

function TaskSwitcher({ current, onSwitch }: { current: TaskId; onSwitch: (t: TaskId) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      {TASK_ORDER.map((id) => {
        const active = id === current;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSwitch(id)}
            className={cx(
              'rounded-xl border px-4 py-2.5 text-left text-body-medium outline-none transition-colors',
              'focus-visible:ring-2 focus-visible:ring-border-focus-ring',
              active
                ? 'border-accent-300 bg-accent-50 text-accent-900'
                : 'border-border-button-default text-text-secondary hover:border-border-button-hover hover:bg-background-secondary-default',
            )}
          >
            {TASK_META[id].label}
          </button>
        );
      })}
    </div>
  );
}

function ChatPageInner() {
  const searchParams = useSearchParams();
  const taskParam = searchParams.get('task');
  const [initialTask] = useState<TaskId>(() => resolveInitialTask(taskParam));
  const [mobileCardOpen, setMobileCardOpen] = useState(false);

  const chat = useShijianChat(initialTask);
  const {
    messages,
    status,
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
  } = chat;

  const [inputValue, setInputValue] = useState('');
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const scrollFade = useScrollFade();

  useEffect(() => {
    if (restoredText !== null) {
      setInputValue(restoredText);
      clearRestoredText();
    }
  }, [restoredText, clearRestoredText]);

  const handleSubmit = () => {
    const value = inputValue;
    setInputValue('');
    void send(value);
  };

  const contextBlock = (
    <div className="flex flex-col gap-3">
      <GradeSelect value={grade} onChange={setGrade} />
      <TextbookSelect value={textbook} onChange={setTextbook} />
    </div>
  );

  const taskSwitchBlock = (
    <TaskSwitcher current={currentTask} onSwitch={switchTask} />
  );

  return (
    <div className="min-h-dvh bg-background-full">
      <div className="lg:hidden">
        <Topbar
          current="chat"
          initialProfile={profile}
          onProfileSaved={saveProfileAndSync}
        />
      </div>

      <div className="flex min-h-dvh flex-col gap-4 p-3 lg:h-dvh lg:flex-row">
        {/* 移动端折叠卡片：任务切换 + 学习上下文 */}
        <div className="rounded-3xl border border-border-button-default bg-background-primary-default p-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileCardOpen((v) => !v)}
            aria-expanded={mobileCardOpen}
            className="flex w-full items-center justify-between outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <span className="text-title-3-semibold text-text-primary">任务与上下文</span>
            <ChevronDown
              className={cx(
                'size-4 text-text-secondary transition-transform duration-200',
                mobileCardOpen && 'rotate-180',
              )}
            />
          </button>
          {mobileCardOpen ? (
            <>
              <p className="mt-3 text-title-3-semibold text-text-primary">任务切换</p>
              <div className="mt-3">{taskSwitchBlock}</div>
              <p className="mt-4 text-title-3-semibold text-text-primary">学习上下文</p>
              <div className="mt-3">{contextBlock}</div>
            </>
          ) : null}
        </div>

        {/* 桌面端左侧栏 */}
        <aside className="hidden w-[260px] shrink-0 flex-col rounded-3xl border border-border-button-default bg-background-primary-default p-4 lg:flex">
          <div className="flex flex-col gap-1">
            <p className="text-title-2-medium text-text-primary">史鉴</p>
            <p className="text-caption-1-semibold text-text-tertiary">高中历史 AI 教学智能体</p>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <p className="text-title-3-semibold text-text-primary">任务切换</p>
            {taskSwitchBlock}
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <p className="text-title-3-semibold text-text-primary">学习上下文</p>
            {contextBlock}
          </div>

          <div className="mt-6">
            <Button variant="secondary" size="medium" onClick={() => setProfileOpen(true)}>
              <UserRound className="size-4" />
              我的学习档案
            </Button>
          </div>

          <div className="mt-auto pt-6">
            <p className="text-caption-1-semibold text-text-tertiary">
              史料原文、历史事实与 AI 推论会明确区分；史鉴不编造史料、人物原话、文献出处与历史数据。
            </p>
          </div>
        </aside>

        {/* 右侧对话面 */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col rounded-3xl border border-border-button-default bg-background-primary-default">
          <div className="border-b border-separator-border px-6 pt-5 pb-4">
            <h1 className="text-title-1-medium text-text-primary">AI 教学对话</h1>
            <p className="mt-1 text-body-regular text-text-secondary">{TASK_META[currentTask].desc}</p>
            {status ? (
              <p className="mt-1 text-caption-1-semibold text-text-tertiary">{status}</p>
            ) : null}
          </div>

          {/* 消息列表 */}
          <div className="relative min-h-[200px] min-w-0 flex-1 px-6 lg:min-h-0">
            <div
              onScroll={scrollFade.onScroll}
              className="h-full overflow-y-auto py-4"
            >
              <div className="flex flex-col gap-4">
                {messages.map((m, i) => (
                  <AgentMessage key={i} role={m.role} text={m.content} at={m.at} />
                ))}
                {busy && streamingText === null ? (
                  <AgentThinking label="史鉴正在思考…" />
                ) : null}
                {streamingText !== null ? (
                  <AgentMessage role="assistant" text={streamingText} streaming />
                ) : null}
              </div>
            </div>
            <ScrollFade progress={scrollFade.progress} surfaceClassName="from-background-primary-default" />
          </div>

          {/* 快捷提问 */}
          <div className="px-6 pb-2">
            <p className="text-caption-1-semibold text-text-tertiary">快捷提问</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {TASK_META[currentTask].quick.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={busy}
                  onClick={() => void send(q)}
                  className={cx(
                    'rounded-full border border-border-button-default bg-background-secondary-default px-3.5 py-1.5 text-body-2-medium text-text-secondary',
                    'outline-none transition-colors hover:border-border-button-hover hover:text-text-primary',
                    'focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                  )}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* 输入区 */}
          <div className="sticky bottom-0 border-t border-separator-border bg-background-primary-default px-6 pb-4 pt-3 lg:static lg:pb-6">
            {notice ? (
              <div className="mb-2 flex items-center justify-between rounded-xl border border-accent-300 bg-accent-50 px-3 py-2">
                <p className="text-body-2-regular text-accent-900">{notice}</p>
                <button
                  type="button"
                  onClick={clearNotice}
                  className={cx(
                    'text-caption-1-semibold text-text-tertiary outline-none hover:text-text-secondary',
                    'focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                  )}
                >
                  关闭
                </button>
              </div>
            ) : null}

            {pendingImage ? (
              <div className="mb-2 flex items-center gap-3 rounded-xl border border-border-button-default bg-background-secondary-default p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pendingImage} alt="待发送图片预览" className="h-[120px] w-[120px] rounded-md object-cover" />
                <Button variant="ghost" size="small" onClick={removeImage}>移除图片</Button>
              </div>
            ) : null}

            {pendingDocName ? (
              <div className="mb-2 flex items-center gap-3 rounded-xl border border-border-button-default bg-background-secondary-default px-3 py-2">
                <FileText className="size-4 text-text-secondary" />
                <span className="min-w-0 flex-1 truncate text-body-2-regular text-text-secondary">{pendingDocName}</span>
                <Button variant="ghost" size="xs" onClick={removeDoc}>移除</Button>
              </div>
            ) : null}

            <AgentComposer
              value={inputValue}
              onValueChange={setInputValue}
              onSubmit={handleSubmit}
              onStop={stop}
              busy={busy}
              model="glm-5.3"
              provider="BotsRouter"
              messageCount={messages.length}
            />

            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="visually-hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageFile(file);
                    e.target.value = '';
                  }}
                />
                <Button
                  variant="ghost"
                  size="small"
                  disabled={busy}
                  onClick={() => imageInputRef.current?.click()}
                >
                  <ImageIcon className="size-4" />
                  图片
                </Button>

                <input
                  ref={docInputRef}
                  type="file"
                  accept=".txt,.md,.pdf,.doc,.docx"
                  className="visually-hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleDocFile(file);
                    e.target.value = '';
                  }}
                />
                <Button
                  variant="ghost"
                  size="small"
                  disabled={busy}
                  onClick={() => docInputRef.current?.click()}
                >
                  <FileText className="size-4" />
                  文档
                </Button>
              </div>
            </div>

            <p className="mt-2 text-caption-1-semibold text-text-tertiary">
              Enter 发送，Shift + Enter 换行；纯文本文档可直接读取，PDF / Word 若无法读取正文，请复制粘贴文字。
            </p>
          </div>

          {/* 学习反馈评价卡片 */}
          <div className="border-t border-separator-border px-6 py-4">
            <EvaluateCard
              scores={scores}
              advice={advice}
              evaluating={evaluating}
              onEvaluate={evaluate}
              disabled={busy || messages.length < 2}
            />
          </div>
        </main>
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
