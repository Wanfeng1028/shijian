'use client';

import Link from 'next/link';
import { BookOpenText, Home, MessagesSquare, UserRound, X } from 'lucide-react';
import { cx } from '@/utils/cx';
import { Button } from '@/components/boardui/base/buttons/button';
import { Select, SelectItem } from '@/components/boardui/base/select/select';
import {
  CONTEXT_EMPTY_OPTION,
  GRADE_OPTIONS,
  TASK_META,
  TASK_ORDER,
  TEXTBOOK_OPTIONS,
  type TaskId,
} from '@/components/shijian/chat/task-meta';

const NAV_ITEMS = [
  { href: '/', label: '首页', key: 'home', Icon: Home },
  { href: '/chat', label: 'AI 对话', key: 'chat', Icon: MessagesSquare },
  { href: '/records', label: '学习记录', key: 'records', Icon: BookOpenText },
] as const;

export interface ChatSidebarProps {
  currentTask: TaskId;
  onSwitchTask: (task: TaskId) => void;
  grade: string;
  setGrade: (value: string) => void;
  textbook: string;
  setTextbook: (value: string) => void;
  onOpenProfile: () => void;
  mobile?: boolean;
  onClose?: () => void;
  /** Only set on the drawer instance: the desktop and drawer instances
   *  must not share one id. */
  id?: string;
  className?: string;
}

/**
 * 史鉴对话页侧栏。壳几何取 BoardUI DashboardSidebar（260px、p-3、
 * rounded-3xl、border-border-button-white、bg-background-secondary-default、
 * shadow-sidebar）；内容全部换成史鉴的：站内导航、任务切换、学习上下文、
 * 学习档案、真实性声明。移动端由对话页按模板抽屉结构复用同一件。
 */
export function ChatSidebar({
  currentTask,
  onSwitchTask,
  grade,
  setGrade,
  textbook,
  setTextbook,
  onOpenProfile,
  mobile = false,
  onClose,
  id,
  className,
}: ChatSidebarProps) {
  return (
    <aside
      id={id}
      aria-label="史鉴导航与学习设置"
      className={cx(
        'flex h-full w-[260px] shrink-0 flex-col overflow-hidden rounded-3xl border border-border-button-white bg-background-secondary-default p-3 shadow-sidebar',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2 px-1 pt-1">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-title-2-medium text-text-primary">史鉴</p>
          <p className="text-caption-1-semibold text-text-tertiary">高中历史 AI 教学智能体</p>
        </div>
        {mobile ? (
          <button
            type="button"
            aria-label="关闭导航"
            onClick={onClose}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-icon-secondary outline-none transition-colors hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <X className="size-5" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto [scrollbar-width:none]">
        <nav className="flex w-full flex-col gap-1" aria-label="站内导航">
          {NAV_ITEMS.map(({ href, label, key, Icon }) => {
            const selected = key === 'chat';
            return (
              <Link
                key={key}
                href={href}
                aria-current={selected ? 'page' : undefined}
                className={cx(
                  'flex items-center gap-2 rounded-2lg p-2 text-body-medium outline-none transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                  selected
                    ? 'bg-linear-to-b from-accent-500 to-accent-600 text-white shadow-nav-selected'
                    : 'text-text-secondary hover:bg-background-secondary-hover hover:text-text-primary',
                )}
              >
                <Icon className={cx('size-5 shrink-0', selected ? 'text-white' : 'text-foreground-icon-secondary')} aria-hidden />
                <span className="min-w-0 truncate whitespace-nowrap">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col gap-2">
          <p className="px-1 text-title-3-semibold text-text-primary">任务切换</p>
          <div className="flex flex-col gap-1.5">
            {TASK_ORDER.map((id) => {
              const active = id === currentTask;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSwitchTask(id)}
                  aria-current={active ? 'true' : undefined}
                  className={cx(
                    'rounded-xl border px-4 py-2.5 text-left text-body-medium outline-none transition-colors',
                    'focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                    active
                      ? 'border-accent-300 bg-accent-50 text-accent-900'
                      : 'border-border-button-default bg-background-primary-default text-text-secondary hover:border-border-button-hover hover:bg-background-secondary-default',
                  )}
                >
                  {TASK_META[id].label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="px-1 text-title-3-semibold text-text-primary">学习上下文</p>
          <div className="flex flex-col gap-3">
            <Select label="年级" selectedKey={grade === '' ? '' : grade} onSelectionChange={(key) => setGrade(String(key))}>
              <SelectItem id="">{CONTEXT_EMPTY_OPTION}</SelectItem>
              {GRADE_OPTIONS.map((g) => (
                <SelectItem key={g} id={g}>{g}</SelectItem>
              ))}
            </Select>
            <Select label="教材" selectedKey={textbook === '' ? '' : textbook} onSelectionChange={(key) => setTextbook(String(key))}>
              <SelectItem id="">{CONTEXT_EMPTY_OPTION}</SelectItem>
              {TEXTBOOK_OPTIONS.map((t) => (
                <SelectItem key={t} id={t}>{t}</SelectItem>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div className="mt-4 flex shrink-0 flex-col gap-4">
        <Button variant="secondary" size="medium" onClick={onOpenProfile} className="w-full">
          <UserRound className="size-4" />
          我的学习档案
        </Button>
        <p className="px-1 text-caption-1-semibold text-text-tertiary">
          史料原文、历史事实与 AI 推论会明确区分；史鉴不编造史料、人物原话、文献出处与历史数据。
        </p>
      </div>
    </aside>
  );
}
