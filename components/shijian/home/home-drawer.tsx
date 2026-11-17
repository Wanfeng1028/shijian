'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { BookOpenText, Home, MessagesSquare, UserRound, X } from 'lucide-react';
import { Button } from '@/components/boardui/base/buttons/button';
import { AuthEntry } from '@/components/shijian/auth-entry';
import { cx } from '@/utils/cx';

export interface HomeDrawerProps {
  open: boolean;
  current: 'home' | 'chat' | 'records';
  onClose: () => void;
  onOpenProfile: () => void;
}

export function HomeDrawer({ open, current, onClose, onOpenProfile }: HomeDrawerProps) {
  const navItems = [
    { key: 'home' as const, label: '首页', href: '/', icon: Home },
    { key: 'chat' as const, label: 'AI 对话', href: '/chat', icon: MessagesSquare },
    { key: 'records' as const, label: '学习记录', href: '/records', icon: BookOpenText },
  ];

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex md:hidden">
      <button
        type="button"
        aria-label="关闭导航"
        onClick={onClose}
        className="absolute inset-0 cursor-pointer bg-black/40"
      />
      <div className="relative flex h-full p-3">
        <aside
          id="shijian-home-drawer"
          aria-label="史鉴导航"
          className="flex h-full w-[260px] shrink-0 flex-col gap-1 overflow-hidden rounded-3xl border border-border-button-white bg-background-secondary-default p-3 shadow-sidebar"
        >
          <div className="flex items-start justify-between gap-2 px-1 pt-1">
            <div>
              <p className="text-title-2-medium text-text-primary">史鉴</p>
              <p className="text-caption-1-semibold text-text-tertiary">高中历史 AI 教学智能体</p>
            </div>
            <button
              type="button"
              aria-label="关闭导航"
              onClick={onClose}
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-icon-secondary outline-none transition-colors hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <nav aria-label="站内导航" className="mt-4 flex w-full flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isSelected = item.key === current;

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={onClose}
                  className={cx(
                    'flex items-center gap-2 rounded-2lg p-2 text-body-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                    isSelected
                      ? 'bg-linear-to-b from-accent-500 to-accent-600 text-white shadow-nav-selected'
                      : 'text-text-secondary hover:bg-background-secondary-hover hover:text-text-primary',
                  )}
                  aria-current={isSelected ? 'page' : undefined}
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

          <div className="mt-auto flex shrink-0 flex-col gap-4">
            <AuthEntry variant="full" />
            <Button variant="secondary" size="medium" onClick={onOpenProfile} className="w-full">
              <UserRound className="size-4" aria-hidden />
              我的学习档案
            </Button>
            <p className="px-1 text-caption-1-semibold text-text-tertiary">
              史料原文、历史事实与 AI 推论会明确区分；史鉴不编造史料、人物原话、文献出处与历史数据。
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}