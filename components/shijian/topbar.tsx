'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, UserRound } from 'lucide-react';
import { Button } from '@/components/boardui/base/buttons/button';
import { ProfileModal } from '@/components/shijian/chat/profile-modal';
import type { Profile } from '@/lib/store';
import { cx } from '@/utils/cx';

export interface TopbarProps {
  current?: 'home' | 'chat' | 'records';
  initialProfile: Profile | null;
  onProfileSaved: (profile: Profile) => void;
}

const NAV_ITEMS: ReadonlyArray<{ href: string; label: string; key: 'home' | 'chat' | 'records' }> = [
  { href: '/', label: '首页', key: 'home' },
  { href: '/chat', label: 'AI 对话', key: 'chat' },
  { href: '/records', label: '学习记录', key: 'records' },
];

export function Topbar({ current, initialProfile, onProfileSaved }: TopbarProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const renderNavLinks = (extraClass: string) =>
    NAV_ITEMS.map((item) => (
      <Link
        key={item.key}
        href={item.href}
        onClick={() => setMenuOpen(false)}
        className={cx(
          extraClass,
          'rounded-full px-4 py-2 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring',
          'transition-colors',
          current === item.key
            ? 'bg-accent-50 text-accent-700'
            : 'text-text-secondary hover:text-text-primary hover:bg-background-tertiary-default'
        )}
      >
        {item.label}
      </Link>
    ));

  return (
    <header
      className={cx(
        'sticky top-0 z-40 w-full border-b border-separator-border',
        'bg-background-primary-default'
      )}
    >
      <div className={cx('mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6')}>
        <div className={cx('flex items-center gap-2')}>
          <Link
            href="/"
            className={cx(
              'rounded-md outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring',
              'text-title-1-medium text-text-primary'
            )}
          >
            史鉴
          </Link>
        </div>

        <nav className={cx('hidden items-center gap-1 md:flex')}>{renderNavLinks('text-body-medium')}</nav>

        <div className={cx('flex items-center gap-2')}>
          <Button
            variant="secondary"
            size="small"
            onClick={() => setProfileOpen(true)}
            className={cx('items-center gap-2')}
          >
            <UserRound className={cx('h-4 w-4')} aria-hidden="true" />
            我的学习档案
          </Button>
          <button
            type="button"
            aria-label={menuOpen ? '收起导航' : '展开导航'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className={cx(
              'rounded-md p-2 text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring',
              'hover:bg-background-tertiary-default hover:text-text-primary md:hidden'
            )}
          >
            {menuOpen ? (
              <X className={cx('h-5 w-5')} aria-hidden="true" />
            ) : (
              <Menu className={cx('h-5 w-5')} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div
          className={cx(
            'border-t border-separator-border bg-background-primary-default px-4 py-3 md:hidden'
          )}
        >
          <nav className={cx('flex flex-col gap-1')}>{renderNavLinks('text-body-medium')}</nav>
        </div>
      ) : null}

      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        initial={initialProfile}
        onSaved={(profile) => {
          onProfileSaved(profile);
          setProfileOpen(false);
        }}
      />
    </header>
  );
}
