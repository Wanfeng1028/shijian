'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js';

interface TurnstileParams {
  sitekey: string;
  callback: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
  theme?: 'light' | 'dark' | 'auto';
}

interface Turnstile {
  render: (element: HTMLElement, params: TurnstileParams) => number;
  reset: (widgetId?: number) => void;
  remove: (widgetId?: number) => void;
}

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

export interface TurnstileWidgetHandle {
  reset: () => void;
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  className?: string;
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('missing window'));
  }
  if (window.turnstile) {
    return Promise.resolve();
  }
  const existing = document.querySelector(
    `script[src="${TURNSTILE_SCRIPT_SRC}"]`,
  );
  if (existing) {
    return new Promise<void>((resolve) => {
      const poll = () => {
        if (window.turnstile) {
          resolve();
        } else {
          window.setTimeout(poll, 30);
        }
      };
      poll();
    });
  }
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('turnstile script load failed'));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  ({ onVerify, onExpire, onError, className }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<number | null>(null);
    const errorNotifiedRef = useRef(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    const onVerifyRef = useRef(onVerify);
    onVerifyRef.current = onVerify;
    const onExpireRef = useRef(onExpire);
    onExpireRef.current = onExpire;
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;

    const notifyError = () => {
      if (!errorNotifiedRef.current) {
        errorNotifiedRef.current = true;
        onErrorRef.current?.();
      }
    };

    useImperativeHandle(
      ref,
      () => ({
        reset: () => {
          if (widgetIdRef.current !== null && window.turnstile) {
            window.turnstile.reset(widgetIdRef.current);
          }
        },
      }),
      [],
    );

    useEffect(() => {
      if (!siteKey) {
        notifyError();
        return;
      }
      let cancelled = false;
      loadTurnstileScript()
        .then(() => {
          if (cancelled || !containerRef.current || !window.turnstile) {
            return;
          }
          if (widgetIdRef.current !== null) {
            window.turnstile.remove(widgetIdRef.current);
            widgetIdRef.current = null;
          }
          widgetIdRef.current = window.turnstile.render(
            containerRef.current,
            {
              sitekey: siteKey,
              callback: (token: string) => onVerifyRef.current(token),
              'expired-callback': () => onExpireRef.current?.(),
              'error-callback': () => notifyError(),
              theme: 'light',
            },
          );
        })
        .catch(() => {
          if (!cancelled) {
            setLoadFailed(true);
            notifyError();
          }
        });
      return () => {
        cancelled = true;
        if (widgetIdRef.current !== null && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
      };
    }, [siteKey]);

    if (!siteKey) {
      return <div role="alert">人机验证未配置，请稍后再试</div>;
    }
    if (loadFailed) {
      return <div role="alert">人机验证加载失败，请刷新页面重试</div>;
    }

    return <div ref={containerRef} className={className} />;
  },
);

TurnstileWidget.displayName = 'TurnstileWidget';