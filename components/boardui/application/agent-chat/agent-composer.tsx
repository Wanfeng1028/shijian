"use client";

import { useTemplateCopy } from "@/components/boardui/foundations/template-copy/template-copy";

import {
  RiArrowDownSLine,
  RiArrowUpLine,
  RiAttachment2,
  RiCheckLine,
  RiInfinityLine,
  RiSparklingLine,
  RiStopFill,
} from "@remixicon/react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { ComposerLoader } from "@/components/boardui/application/composer-loader/composer-loader";
import { cx } from "@/utils/cx";

/**
 * The free composer: a 52px pill with a text field and circular controls,
 * plus the thin status row beneath it.
 *
 * It matches the proportions of the Pro composer on purpose, so a starter
 * looks like it belongs to the same product — the fixed-height pill, 8px
 * padding with 36px circles sitting flush inside it, and the 10px gap rhythm
 * across the row. What it deliberately does NOT carry is the paid work in
 * `composer`: the liquid-glass surfaces behind the controls, the model and
 * effort menus, the attachment plugin panel, and the voice equalizer. Those
 * are the reason someone buys that component, so this one leaves the slots
 * present but plain.
 *
 * The status row shows what is actually true of the running app — which
 * provider answered, which model, how many messages are in the thread —
 * rather than decorative chrome, so it stays honest in a deployed starter.
 */

export interface AgentComposerProps {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  onAddAttachment?: () => void;
  busy: boolean;
  /** Model id reported by the runtime, e.g. "openai/gpt-5-nano". */
  model?: string | null;
  /** 选中可用模型时回调 */
  onModelChange?: (model: string) => void;
  /** 思考强度档位索引 0-5，默认 1 */
  effort?: number;
  /** 切换思考强度时回调 */
  onEffortChange?: (effort: number) => void;
  provider?: string | null;
  messageCount: number;
  className?: string;
}

export function AgentComposer({
  value,
  onValueChange,
  onSubmit,
  onStop,
  onAddAttachment,
  onModelChange,
  onEffortChange,
  busy,
  model = "spark-x2.6",
  effort = 1,
  provider,
  messageCount,
  className,
}: AgentComposerProps) {
  const localize = useTemplateCopy();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 116)}px`;
  }, [value]);

  const MODEL_OPTIONS: ReadonlyArray<{ id: string; reason: string | null }> = [
    { id: "spark-x2.6", reason: null },
    { id: "GLM-5.3", reason: "上游故障 500" },
    { id: "GLM-5.3-Flash", reason: "余额不足 402" },
    { id: "glm-5.3", reason: "渠道密钥失效 401（向量潮汐）" },
    { id: "glm-5.3-flash", reason: "余额不足 402" },
    { id: "moonshotai/kimi-k3", reason: "不存在 404" },
    { id: "moonshotai/kimi-k3-free", reason: "已退役 502（2026-10-27）" },
    { id: "qiniu/conatus-free", reason: "全局限流 429" },
  ];

  const EFFORT_LEVELS: ReadonlyArray<{ label: string; zh: string; desc: string }> = [
    { label: "Low", zh: "低", desc: "最快、最简短" },
    { label: "Medium", zh: "中", desc: "默认均衡" },
    { label: "Balanced", zh: "均衡", desc: "质量与速度平衡" },
    { label: "High", zh: "高", desc: "更深入" },
    { label: "Very High", zh: "很高", desc: "更详尽" },
    { label: "Max", zh: "最强", desc: "最完整、最慢" },
  ];
  const [openMenu, setOpenMenu] = useState<"model" | "effort" | null>(null);

  const currentEffort = EFFORT_LEVELS[effort] ?? EFFORT_LEVELS[1];

  useEffect(() => {
    if (!openMenu) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [openMenu]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  };

  return localize((
    <div className={cx("flex w-full flex-col gap-2.5", className)}>
      {openMenu !== null ? (
        <button
          type="button"
          aria-label="关闭菜单"
          onClick={() => setOpenMenu(null)}
          className="fixed inset-0 z-40 cursor-default bg-transparent"
        />
      ) : null}
      {/* radius omitted: ComposerLoader defaults to a full pill, matching the form. */}
      <ComposerLoader active={busy}>
        {/* The pill sits one step lighter than the chat surface behind it in
            both themes (white on neutral-100 in light, neutral-800 on
            neutral-900 in dark), so a single token works without a dark
            override. Its controls then step back down to secondary. */}
        <form
          onSubmit={submit}
          className={cx(
            "flex min-h-[52px] w-full items-end gap-2.5 rounded-full p-2 flex-wrap",
            // ComposerLoader paints its own pill surface and runs the light
            // behind its children, so an opaque form would cover the light
            // entirely. While busy the form steps aside and lets it show.
            busy ? "bg-transparent" : "bg-background-primary-default shadow-xs",
          )}
        >
          {/* Attachment slot. Plain on purpose — the plugin panel behind this
              button in the Pro composer is part of what that component sells. */}
          {/* Shares the Pro composer's add-button tokens so the two read as the
              same control. They resolve one step lighter than the pill in dark
              and one step darker in light, which is why a single pair works for
              both themes without a dark: override. */}
          {/* 史鉴加的上传入口：点回形针打开文件选择。BoardUI 免费模板原版此处无回调（它是 Pro 版插件面板的占位），接线是用户亲令的偏离 1:1 之处。 */}
          <button
            type="button"
            aria-label="Add attachment"
            onClick={onAddAttachment}
            disabled={busy}
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-ai-chat-composer-add-background text-foreground-icon-primary transition-colors duration-150 ease hover:bg-ai-chat-composer-add-hover-background disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RiAttachment2 className="size-5" aria-hidden />
          </button>

          <label className="sr-only" htmlFor="agent-composer-input">
            Message
          </label>
          {/* 本地化：输入框占位符由 BoardUI 原文 Ask me anything 改为中文（史鉴副本，MIT 允许改） */}
          <textarea
            id="agent-composer-input"
            ref={inputRef}
            rows={1}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="输入你的观察或问题…"
            autoComplete="off"
            className="resize-none overflow-y-auto py-2 min-w-[180px] flex-1 bg-transparent text-body-regular text-text-primary caret-text-primary outline-none placeholder:text-text-tertiary"
            style={{ maxHeight: 116 }}
          />

          {model ? (
            <div className="relative shrink-0">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={openMenu === "model"}
                onClick={() => setOpenMenu(openMenu === "model" ? null : "model")}
                className="flex h-8 shrink-0 items-center gap-1 rounded-xl py-1.5 pe-2 ps-2 text-body-2-medium text-text-secondary transition-colors hover:bg-background-secondary-hover"
              >
                <RiSparklingLine className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />
                <span className="hidden max-w-[13ch] truncate sm:inline">{shortModel(model)}</span>
                <RiArrowDownSLine
                  className={cx(
                    "size-4 shrink-0 text-foreground-icon-secondary transition-transform",
                    openMenu === "model" && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>

              {openMenu === "model" ? (
                <div
                  role="menu"
                  aria-label="选择模型"
                  className="absolute bottom-full left-0 z-50 mb-2 max-h-80 w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-border-button-default bg-background-primary-default p-1.5 shadow-lg"
                >
                  <div className="px-2 py-1.5 text-caption-1-semibold text-text-tertiary">
                    模型（仅 spark-x2.6 可用）
                  </div>
                  {MODEL_OPTIONS.map((option) => (
                    <button
                      type="button"
                      role="menuitem"
                      key={option.id}
                      disabled={option.reason !== null}
                      aria-disabled={option.reason !== null}
                      onClick={() => {
                        onModelChange?.(option.id);
                        setOpenMenu(null);
                      }}
                      className={cx(
                        "flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-start transition-colors hover:bg-background-secondary-hover disabled:hover:bg-transparent",
                        option.reason !== null && "opacity-40 cursor-not-allowed",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-body-2-medium text-text-primary">
                          {shortModel(option.id)}
                        </span>
                        {option.reason === null ? (
                          <span className="shrink-0 rounded-full bg-accent-50 px-1.5 text-caption-1-semibold text-accent-900">
                            可用
                          </span>
                        ) : null}
                        {option.reason !== null ? (
                          <span className="truncate text-caption-1-semibold text-text-tertiary">
                            {option.reason}
                          </span>
                        ) : null}
                      </span>
                      {option.id === model ? (
                        <RiCheckLine className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="relative shrink-0">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={openMenu === "effort"}
              onClick={() => setOpenMenu(openMenu === "effort" ? null : "effort")}
              className="flex h-8 shrink-0 items-center gap-1 rounded-xl py-1.5 pe-2 ps-2 text-body-2-medium text-text-secondary transition-colors hover:bg-background-secondary-hover"
            >
              <span className="truncate">{currentEffort.label} {currentEffort.zh}</span>
              <RiArrowDownSLine
                className={cx(
                  "size-4 shrink-0 text-foreground-icon-secondary transition-transform",
                  openMenu === "effort" && "rotate-180",
                )}
                aria-hidden
              />
            </button>

            {openMenu === "effort" ? (
              <div
                role="menu"
                aria-label="选择思考强度"
                className="absolute bottom-full left-0 z-50 mb-2 w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-border-button-default bg-background-primary-default p-1.5 shadow-lg"
              >
                <div className="px-2 py-1.5 text-caption-1-semibold text-text-tertiary">
                  思考强度
                </div>
                {EFFORT_LEVELS.map((level, index) => (
                  <button
                    type="button"
                    role="menuitem"
                    key={level.label}
                    onClick={() => {
                      onEffortChange?.(index);
                      setOpenMenu(null);
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-start transition-colors hover:bg-background-secondary-hover"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-body-2-medium text-text-primary">
                        {level.label} {level.zh}
                      </span>
                      <span className="truncate text-caption-1-semibold text-text-tertiary">
                        {level.desc}
                      </span>
                    </span>
                    {index === effort ? (
                      <RiCheckLine className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2 ps-1.5">
            {busy ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop generating"
                className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-background-secondary-default text-foreground-icon-secondary transition-colors hover:bg-background-secondary-hover"
              >
                <RiStopFill className="size-5" aria-hidden />
              </button>
            ) : (
              <button
                type="submit"
                aria-label="Send message"
                disabled={value.trim().length === 0}
                className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-button-primary text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RiArrowUpLine className="size-5" aria-hidden />
              </button>
            )}
          </div>
        </form>
      </ComposerLoader>

      <div className="flex h-[26px] w-full items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusItem icon={RiInfinityLine} label={provider ?? "Not configured"} />
        </div>
        <div className="flex items-center gap-3">
          <StatusItem
            icon={RiSparklingLine}
            label={messageCount === 0 ? "New chat" : `${messageCount} messages`}
          />
        </div>
      </div>
    </div>
  ));
}

function StatusItem({
  icon: Icon,
  label,
}: {
  icon: typeof RiInfinityLine;
  label: string;
}) {
  const localize = useTemplateCopy();
  return localize((
    <span className="flex items-center gap-1">
      <Icon className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />
      <span className="whitespace-nowrap text-body-2-medium text-text-secondary">{label}</span>
    </span>
  ));
}

/** "openai/gpt-5-nano" reads better in a 13ch slot as "gpt-5-nano". */
function shortModel(model: string) {
  const slash = model.lastIndexOf("/");
  return slash === -1 ? model : model.slice(slash + 1);
}
