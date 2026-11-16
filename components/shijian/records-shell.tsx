'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { RiCloseLine, RiMenuLine } from '@remixicon/react';
import { IconButton } from '@/components/boardui/base/buttons/icon-button';
import { type Profile } from '@/lib/store';
import { RecordsSidebar } from './records-sidebar';

export interface RecordsShellProps {
  title: string;
  profile: Profile | null;
  onOpenProfile: () => void;
  actions?: ReactNode;
  children: ReactNode;
}

export function RecordsShell({
  title,
  profile: _profile,
  onOpenProfile,
  actions,
  children,
}: RecordsShellProps) {
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!navOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNavOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [navOpen]);

  void _profile;

  return (
    <div className="relative flex h-dvh w-full gap-4 overflow-hidden bg-background-full p-3">
      <RecordsSidebar
        onOpenProfile={onOpenProfile}
        className="hidden lg:flex"
      />

      {navOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            aria-label="关闭导航"
            onClick={() => setNavOpen(false)}
            className="absolute inset-0 cursor-pointer bg-black/40"
          />
          <div className="relative flex h-full p-3">
            <RecordsSidebar
              mobile
              id="shijian-records-sidebar"
              onClose={() => setNavOpen(false)}
              onOpenProfile={onOpenProfile}
              className="flex"
            />
          </div>
        </div>
      ) : null}

      <main className="relative flex min-h-0 min-w-0 flex-1 justify-center overflow-x-hidden overflow-y-auto bg-background-full sm:pt-3">
        <div className="flex w-full max-w-[1300px] flex-col gap-2.5">
          <header className="flex w-full flex-col gap-2">
            <nav
              aria-label="面包屑"
              className="flex items-center gap-1 px-1 text-body-medium text-text-tertiary"
            >
              <Link
                href="/"
                className="outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
              >
                首页
              </Link>
              <span aria-hidden>/</span>
              <span className="text-text-primary">{title}</span>
            </nav>
            <div className="flex w-full flex-wrap items-end justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <IconButton
                  icon={navOpen ? RiCloseLine : RiMenuLine}
                  size="medium"
                  aria-label="打开导航"
                  onClick={() => setNavOpen((open) => !open)}
                  className="lg:hidden"
                />
                <h1 className="px-1 text-title-2-medium whitespace-nowrap text-text-primary">
                  {title}
                </h1>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2.5">
                {actions}
              </div>
            </div>
          </header>
          <div className="flex w-full flex-col gap-4 pb-4">{children}</div>
        </div>
      </main>
    </div>
  );
}