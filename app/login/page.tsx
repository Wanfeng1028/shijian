"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/boardui/application/auth/auth-card";
import type { SocialProvider } from "@/components/boardui/base/social-button/social-providers";
import { TurnstileWidget } from "@/components/shijian/auth/turnstile-widget";
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
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileKey, setTurnstileKey] = useState(0);

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
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");
    void (async () => {
      try {
        if (mode === "signup") {
          const confirmPassword = String(data.get("confirmPassword") ?? "");
          const normalizedEmail = email.trim().toLowerCase();
          if (!normalizedEmail || !normalizedEmail.includes("@")) {
            openDialog("邮箱格式不正确");
            return;
          }
          if (
            password.length < 8 ||
            !/[a-zA-Z]/.test(password) ||
            !/[0-9]/.test(password)
          ) {
            openDialog("密码至少 8 位，需包含字母和数字");
            return;
          }
          if (password !== confirmPassword) {
            openDialog("两次输入的密码不一致");
            return;
          }
          if (!turnstileToken) {
            openDialog("请先完成人机验证");
            return;
          }
          const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: normalizedEmail,
              password,
              turnstileToken,
            }),
            credentials: "same-origin",
          });
          if (res.ok) {
            const result: unknown = await res.json();
            if (
              typeof result === "object" &&
              result !== null &&
              "ok" in result &&
              (result as { ok: unknown }).ok === true
            ) {
              await mergeLocalRecordsToServer();
              router.push("/chat");
              return;
            }
          }
          if (res.status === 409) {
            openDialog("该邮箱已注册，请直接登录");
            return;
          }
          if (res.status === 429) {
            openDialog("注册尝试过于频繁，请稍后再试");
            return;
          }
          if (res.status === 403) {
            openDialog("人机验证未通过，请重试");
            setTurnstileToken(null);
            setTurnstileKey((k) => k + 1);
            return;
          }
          if (res.status === 400) {
            const result: unknown = await res.json().catch(() => null);
            if (
              typeof result === "object" &&
              result !== null &&
              "error" in result
            ) {
              const error = (result as { error: unknown }).error;
              if (error === "weak_password") {
                openDialog("密码至少 8 位，需包含字母和数字");
                return;
              }
              if (error === "invalid_email") {
                openDialog("邮箱格式不正确");
                return;
              }
            }
          }
          openDialog("注册失败，请稍后再试");
          return;
        }
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
          credentials: "same-origin",
        });
        if (res.ok) {
          const result: unknown = await res.json();
          if (
            typeof result === "object" &&
            result !== null &&
            "ok" in result &&
            (result as { ok: unknown }).ok === true
          ) {
            await mergeLocalRecordsToServer();
            router.push("/chat");
            return;
          }
        }
        if (res.status === 403) {
          openDialog("邮箱或密码不正确");
          return;
        }
        openDialog("登录失败，请稍后再试");
      } catch {
        openDialog(
          mode === "signup" ? "注册失败，请稍后再试" : "登录失败，请稍后再试"
        );
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
            confirmPassword={mode === "signup"}
            providers={["google", "apple"]}
            onProvider={handleProvider}
            onSubmit={handleSubmit}
            onForgotPassword={handleForgotPassword}
            onSwitchMode={handleSwitchMode}
          />
        </div>
        {mode === "signup" ? (
          <div className="rounded-3xl border border-border-button-default bg-background-primary-default p-4">
            <p className="text-body-medium text-text-primary">人机验证</p>
            <div className="mt-3">
              <TurnstileWidget
                key={turnstileKey}
                onVerify={(token) => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken(null)}
                onError={() => setTurnstileToken(null)}
              />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={fillDemoAccount}
            className="rounded-3xl border border-border-button-default bg-background-primary-default p-4 text-left"
          >
            <p className="text-body-medium text-text-primary">体验账号（点一下自动填入）</p>
            <p className="mt-2 text-body-regular text-text-secondary">{DEMO_EMAIL}</p>
            <p className="mt-1 text-body-regular text-text-secondary">••••••••</p>
          </button>
        )}
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
