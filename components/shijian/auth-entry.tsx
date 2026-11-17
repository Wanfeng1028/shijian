'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { ButtonLink } from '@/components/boardui/base/buttons/button';
import { loadAuthUser, logout, type AuthUser } from '@/lib/store';

const iconButtonClassName =
  'flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-background-tertiary-default text-foreground-icon-secondary outline-none transition-colors hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring';

const logoutButtonClassName =
  'shrink-0 cursor-pointer text-body-medium text-text-secondary outline-none transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring';

export function AuthEntry({
  variant = 'full',
}: {
  variant?: 'header' | 'full' | 'icon';
}) {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadAuthUser().then((u) => {
      if (!cancelled) setUser(u);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await logout();
    if (ok) {
      window.location.reload();
    } else {
      setBusy(false);
    }
  };

  if (user === undefined) return null;

  if (user === null) {
    if (variant === 'icon') {
      return (
        <Link
          href="/login"
          aria-label="登录"
          title="登录"
          className={iconButtonClassName}
        >
          <LogIn className="size-4" aria-hidden />
        </Link>
      );
    }

    if (variant === 'header') {
      return (
        <ButtonLink href="/login" variant="secondary" size="small">
          <LogIn className="h-4 w-4" aria-hidden />
          登录
        </ButtonLink>
      );
    }

    return (
      <ButtonLink
        href="/login"
        variant="secondary"
        size="medium"
        className="w-full"
      >
        <LogIn className="size-4" aria-hidden />
        登录
      </ButtonLink>
    );
  }

  const displayName = (user.name || user.email).trim();
  const initial = displayName.charAt(0) || '?';

  const renderAvatar = (size: string) =>
    user.avatar ? (
      <img
        src={user.avatar}
        alt=""
        className={`${size} rounded-full object-cover`}
      />
    ) : (
      <span
        className={`${size} flex items-center justify-center rounded-full bg-accent-500 text-white`}
      >
        {initial}
      </span>
    );

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleLogout}
        disabled={busy}
        aria-label={`退出登录（${displayName}）`}
        title={`退出登录（${displayName}）`}
        className={iconButtonClassName}
      >
        {renderAvatar('size-8')}
      </button>
    );
  }

  if (variant === 'header') {
    return (
      <div className="flex items-center gap-2 rounded-full border border-border-button-default bg-background-primary-default py-1 pl-1 pr-2">
        {renderAvatar('size-6')}
        <span className="max-w-[96px] truncate whitespace-nowrap text-body-medium text-text-primary">
          {displayName}
        </span>
        <button
          type="button"
          onClick={handleLogout}
          disabled={busy}
          className={logoutButtonClassName}
        >
          退出
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full items-center gap-2 rounded-2lg border border-border-button-default bg-background-primary-default p-2">
      {renderAvatar('size-8')}
      <span className="min-w-0 flex-1 truncate whitespace-nowrap text-body-medium text-text-primary">
        {displayName}
      </span>
      <button
        type="button"
        onClick={handleLogout}
        disabled={busy}
        className={logoutButtonClassName}
      >
        退出
      </button>
    </div>
  );
}
