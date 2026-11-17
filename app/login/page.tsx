"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/boardui/application/auth/auth-card";
import type { SocialProvider } from "@/components/boardui/base/social-button/social-providers";
import { mergeLocalRecordsToServer } from "@/lib/store";

type AuthMode = "signin" | "signup";


const DEMO_EMAIL = "demo@shijian.dev";
const DEMO_PASSWORD = "forest-meadow68-river-leaf";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signin");
  const cardRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [dialogMessage, setDialogMessage] = useState("该登录方式暂时没开放，请使用体验账号登录。");
  const [showGoogleError, setShowGoogleError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "same-origin" });
        if (!res.ok) return;
        const data: unknown = await res.json();
        if (cancelled) return;
        if (
          typeof data === "object" &&
          data !== null &&
          "user" in data &&
          (data as { user: unknown }).user !== null
        ) {
          router.replace("/chat");
        }
      } catch {
        // 忽略
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "google_not_configured") {
      setShowGoogleError(true);
    }
  }, []);

  const openDialog = (message: string) => {
    setDialogMessage(message);
    requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (dialog && !dialog.open) {
        dialog.showModal();
      }
    });
  };

  const handleProvider = (provider: SocialProvider) => {
    if (provider === "google") {
      window.location.href = "/api/auth/google";
    } else {
      openDialog("该登录方式暂时没开放，请使用体验账号登录。");
    }
  };

  const handleSubmit = (data: FormData) => {
    if (mode === "signup") {
      openDialog("该登录方式暂时没开放，请使用体验账号登录。");
      return;
    }
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");
    void (async () => {
      try {
        const res = await fetch("/api/auth/demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
          credentials: "same-origin",
        });
        if (res.status === 403) {
          openDialog("该登录方式暂时没开放，请使用体验账号登录。");
          return;
        }
        if (!res.ok) {
          openDialog("登录失败，请稍后再试");
          return;
        }
        const result: unknown = await res.json();
        if (
          typeof result === "object" &&
          result !== null &&
          "ok" in result &&
          (result as { ok: unknown }).ok === true
        ) {
          await mergeLocalRecordsToServer();
          router.push("/chat");
        } else {
          openDialog("登录失败，请稍后再试");
        }
      } catch {
        openDialog("登录失败，请稍后再试");
      }
    })();
  };

  const handleForgotPassword = () => {
    openDialog("该登录方式暂时没开放，请使用体验账号登录。");
  };

  const handleSwitchMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
  };

  const fillDemoAccount = () => {
    const container = cardRef.current;
    if (!container) return;
    const emailInput = container.querySelector<HTMLInputElement>('input[name="email"]');
    const passwordInput = container.querySelector<HTMLInputElement>('input[name="password"]');
    if (!emailInput || !passwordInput) return;

    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;

    if (setter) {
      setter.call(emailInput, DEMO_EMAIL);
    }
    emailInput.dispatchEvent(new Event("input", { bubbles: true }));

    if (setter) {
      setter.call(passwordInput, DEMO_PASSWORD);
    }
    passwordInput.dispatchEvent(new Event("input", { bubbles: true }));

    passwordInput.focus();
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background-full p-6">
      <div className="flex w-full max-w-[480px] flex-col gap-4">
        {showGoogleError && (
          <p className="text-body-regular text-text-error-primary">
            Google 登录尚未配置，请使用体验账号登录。
          </p>
        )}
        <div ref={cardRef}>
          <AuthCard
            mode={mode}
            providers={["google", "apple"]}
            onProvider={handleProvider}
            onSubmit={handleSubmit}
            onForgotPassword={handleForgotPassword}
            onSwitchMode={handleSwitchMode}
          />
        </div>
        <button
          type="button"
          onClick={fillDemoAccount}
          className="rounded-3xl border border-border-button-default bg-background-primary-default p-4 text-left"
        >
          <p className="text-body-medium text-text-primary">体验账号（点一下自动填入）</p>
          <p className="mt-2 text-body-regular text-text-secondary">{DEMO_EMAIL}</p>
          <p className="mt-1 text-body-regular text-text-secondary">••••••••</p>
        </button>
        <p className="text-center">
          <Link href="/chat" className="text-body-regular text-text-secondary underline">
            先逛逛，不登录 →
          </Link>
        </p>
      </div>
      <dialog
        ref={dialogRef}
        aria-labelledby="login-dialog-title"
        className="m-auto w-[calc(100vw-3rem)] max-w-[400px] rounded-3xl border border-border-button-default bg-background-primary-default p-6 text-text-primary"
      >
        <h2 id="login-dialog-title" className="text-body-medium text-text-primary">
          暂时没开放
        </h2>
        <p className="mt-2 text-body-regular text-text-secondary">{dialogMessage}</p>
        <form method="dialog" className="mt-6">
          <button
            autoFocus
            type="submit"
            className="rounded-full border border-border-button-default bg-background-secondary-default px-6 py-2 text-body-regular text-text-primary"
          >
            知道了
          </button>
        </form>
        <style>{`
          dialog:modal {
            overscroll-behavior: contain;
          }
          dialog::backdrop {
            background: rgba(0, 0, 0, 0.5);
          }
        `}</style>
      </dialog>
    </main>
  );
}
