'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpenText, Home, MessagesSquare, PanelLeftClose, PanelLeftOpen, UserRound, X } from 'lucide-react';
import { loadSidebarCollapsed, saveSidebarCollapsed } from '@/lib/store';
import { Button } from '@/components/boardui/base/buttons/button';
import { AuthEntry } from '@/components/shijian/auth-entry';
import { cx } from '@/utils/cx';

export interface RecordsSidebarProps {
  mobile?: boolean;
  onClose?: () => void;
  onOpenProfile: () => void;
  id?: string;
  className?: string;
}

export function RecordsSidebar({
  mobile = false,
  onClose,
  onOpenProfile,
  id,
  className,
}: RecordsSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(loadSidebarCollapsed());
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      saveSidebarCollapsed(next);
      return next;
    });
  };

  const navItems = [
    { key: 'home', label: '首页', href: '/', icon: Home },
    { key: 'chat', label: 'AI 对话', href: '/chat', icon: MessagesSquare },
    { key: 'records', label: '学习记录', href: '/records', icon: BookOpenText },
  ];

  if (collapsed && !mobile) {
    return (
      <aside
        id={id}
        aria-label="史鉴导航与学习设置（已收起）"
        className={cx(
          'flex h-full w-[72px] shrink-0 flex-col items-center overflow-hidden rounded-3xl border border-border-button-white bg-background-secondary-default p-3 shadow-sidebar',
          className,
        )}
      >
        <button
          type="button"
          aria-label="展开侧栏"
          title="展开侧栏"
          onClick={toggleCollapsed}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-icon-secondary outline-none transition-colors hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <PanelLeftOpen className="size-5" aria-hidden />
        </button>
        <nav className="mt-4 flex flex-col gap-1" aria-label="站内导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isSelected = item.key === 'records';
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isSelected ? 'page' : undefined}
                aria-label={item.label}
                title={item.label}
                className={cx(
                  'flex size-10 items-center justify-center rounded-2lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                  isSelected
                    ? 'bg-linear-to-b from-accent-500 to-accent-600 text-white shadow-nav-selected'
                    : 'text-text-secondary hover:bg-background-secondary-hover hover:text-text-primary',
                )}
              >
                <Icon
                  className={cx(
                    'size-5 shrink-0',
                    isSelected ? 'text-white' : 'text-foreground-icon-secondary',
                  )}
                  aria-hidden
                />
              </Link>
            );
          })}
        </nav>
        <AuthEntry variant="icon" />
        <button
          type="button"
          aria-label="我的学习档案"
          title="我的学习档案"
          onClick={onOpenProfile}
          className="mt-auto flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-background-tertiary-default text-foreground-icon-secondary outline-none transition-colors hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <UserRound className="size-4" aria-hidden />
        </button>
      </aside>
    );
  }

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
        <div>
          <p className="text-title-2-medium text-text-primary">史鉴</p>
          <p className="text-caption-1-semibold text-text-tertiary">高中历史 AI 教学智能体</p>
        </div>
        {!mobile && (
          <button
            type="button"
            aria-label="收起侧栏"
            title="收起侧栏"
            onClick={toggleCollapsed}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-icon-secondary outline-none transition-colors hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <PanelLeftClose className="size-5" aria-hidden />
          </button>
        )}
        {mobile && (
          <button
            type="button"
            aria-label="关闭导航"
            onClick={onClose}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-icon-secondary outline-none transition-colors hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <X className="size-5" aria-hidden />
          </button>
        )}
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto [scrollbar-width:none]">
        <nav aria-label="站内导航" className="flex w-full flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isSelected = item.key === 'records';
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isSelected ? 'page' : undefined}
                onClick={() => {
                  if (mobile) onClose?.();
                }}
                className={cx(
                  'flex items-center gap-2 rounded-2lg p-2 text-body-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                  isSelected
                    ? 'bg-linear-to-b from-accent-500 to-accent-600 text-white shadow-nav-selected'
                    : 'text-text-secondary hover:bg-background-secondary-hover hover:text-text-primary',
                )}
              >
                <Icon
                  className={cx(
                    'size-5 shrink-0',
                    isSelected ? 'text-white' : 'text-foreground-icon-secondary',
                  )}
                  aria-hidden
                />
                <span className="min-w-0 truncate whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-4 flex shrink-0 flex-col gap-4">
        <AuthEntry variant="full" />
        <Button variant="secondary" size="medium" onClick={onOpenProfile} className="w-full">
          <UserRound className="size-4" aria-hidden />
          <span>我的学习档案</span>
        </Button>
        <p className="px-1 text-caption-1-semibold text-text-tertiary">
          史料原文、历史事实与 AI 推论会明确区分；史鉴不编造史料、人物原话、文献出处与历史数据。
        </p>
      </div>
    </aside>
  );
}