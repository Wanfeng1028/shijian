'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpenText, Home, Menu, MessagesSquare, UserRound, X } from 'lucide-react';
import { Button } from '@/components/boardui/base/buttons/button';
import type { Profile } from '@/lib/store';
import { cx } from '@/utils/cx';
import { HomeDrawer } from './home-drawer';

export interface HomeHeaderProps {
  current: 'home' | 'chat' | 'records';
  profile: Profile | null;
  onOpenProfile: () => void;
}

const navItems = [
  { key: 'home', href: '/', label: '首页', Icon: Home },
  { key: 'chat', href: '/chat', label: 'AI 对话', Icon: MessagesSquare },
  { key: 'records', href: '/records', label: '学习记录', Icon: BookOpenText },
] as const;

export function HomeHeader({ current, profile: _profile, onOpenProfile }: HomeHeaderProps) {
  void _profile;

  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <header className="w-full bg-background-full">
        <div className="mx-auto flex h-16 w-full max-w-[1276px] items-center justify-between gap-4 px-3 sm:px-6">
          <Link
            href="/"
            className="rounded-md text-title-1-medium text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            史鉴
          </Link>

          <nav aria-label="站内导航" className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const isCurrent = item.key === current;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-body-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                    isCurrent
                      ? 'bg-accent-50 text-accent-700'
                      : 'text-text-secondary hover:bg-background-tertiary-default hover:text-text-primary'
                  )}
                  aria-current={isCurrent ? 'page' : undefined}
                >
                  <item.Icon className="h-4 w-4" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="small"
              onClick={onOpenProfile}
              className={cx('items-center gap-2')}
            >
              <UserRound className="h-4 w-4" aria-hidden />
              我的学习档案
            </Button>
            <button
              type="button"
              className="rounded-md p-2 text-text-secondary outline-none hover:bg-background-tertiary-default hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring md:hidden"
              aria-label={drawerOpen ? '收起导航' : '展开导航'}
              aria-expanded={drawerOpen}
              aria-controls="shijian-home-drawer"
              onClick={() => setDrawerOpen(!drawerOpen)}
            >
              {drawerOpen ? (
                <X className="h-5 w-5" aria-hidden />
              ) : (
                <Menu className="h-5 w-5" aria-hidden />
              )}
            </button>
          </div>
        </div>
      </header>

      {drawerOpen ? (
        <HomeDrawer
          open={drawerOpen}
          current={current}
          onClose={() => setDrawerOpen(false)}
          onOpenProfile={() => {
            setDrawerOpen(false);
            onOpenProfile();
          }}
        />
      ) : null}
    </>
  );
}
