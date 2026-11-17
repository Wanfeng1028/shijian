"use client";

import { useTemplateCopy } from "@/components/boardui/foundations/template-copy/template-copy";

import {
  RiArrowDownSLine,
  RiArrowUpLine,
  RiAttachment2,
  RiInfinityLine,
  RiSparklingLine,
  RiStopFill,
} from "@remixicon/react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import {
  Dialog as AriaDialog,
  DialogTrigger as AriaDialogTrigger,
  Popover as AriaPopover,
  Pressable,
} from "react-aria-components";
import { motion } from "motion/react";

import { ComposerLoader } from "@/components/boardui/application/composer-loader/composer-loader";
import { EffortSlider, EFFORT_LEVELS } from "@/components/boardui/application/agent-chat/effort-slider";
import { RadioDot } from "@/components/boardui/base/radio/radio";
import { cx } from "@/utils/cx";
import {
  useDismissOnOutsidePress,
  useTriggerToggle,
} from "@/utils/use-dismiss-on-outside-press";

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
            <ModelSettingsMenu
              model={model}
              onModelChange={onModelChange}
              effort={effort}
              onEffortChange={onEffortChange}
            />
          ) : null}


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

const MENU_POPOVER_CLASS = cx(
  "w-[266px] max-w-[calc(100vw-32px)] origin-bottom-left",
  "rounded-2xl border border-border-button-default bg-background-primary-default p-2.5 shadow-dropdown",
  "transition duration-150 ease-out",
  "data-[entering]:opacity-0 data-[entering]:scale-95 data-[entering]:blur-[2px]",
  "data-[exiting]:opacity-0 data-[exiting]:scale-95 data-[exiting]:blur-[2px]",
);
function useMenuState() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLElement>(null);
  const popoverRef = useRef<HTMLElement>(null);
  useDismissOnOutsidePress(open, () => setOpen(false), [triggerRef, popoverRef]);
  const allowOpenChange = useTriggerToggle(open, triggerRef);
  const onOpenChange = (next: boolean) => {
    if (allowOpenChange(next)) setOpen(next);
  };
  return { open, setOpen, triggerRef, popoverRef, onOpenChange };
}
function ModelSettingsMenu({ model, onModelChange, effort, onEffortChange }: { model: string; onModelChange?: (model: string) => void; effort: number; onEffortChange?: (effort: number) => void }) {
  const { open, setOpen, triggerRef, popoverRef, onOpenChange } = useMenuState();
  const effortLabel = EFFORT_LEVELS[effort] ?? EFFORT_LEVELS[1];
  return (
    <AriaDialogTrigger isOpen={open} onOpenChange={onOpenChange}>
      <Pressable ref={triggerRef}>
        <button
          type="button"
          className="flex h-8 shrink-0 cursor-pointer items-center justify-center gap-0.5 rounded-xl bg-background-primary-default py-1.5 pe-1 ps-2 outline-none transition-colors duration-150 ease hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <span className="px-0.5 text-body-medium whitespace-nowrap text-text-secondary">{shortModel(model)}</span>
          <RiArrowDownSLine
            className={cx(
              "size-[18px] shrink-0 text-foreground-icon-secondary transition-transform duration-200 ease",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </Pressable>
      <AriaPopover ref={popoverRef} isNonModal placement="top start" offset={8} className={MENU_POPOVER_CLASS}>
        <AriaDialog aria-label="Model settings" className="flex flex-col outline-none">
          <div className="flex flex-col">
            <div className="flex w-full flex-col gap-1.5 pt-1">
              <span className="ps-2 text-body-medium text-text-secondary">Models</span>
              <div className="flex w-full flex-col gap-1" role="radiogroup" aria-label="Model">
                {MODEL_OPTIONS.map((option) => {
                  const isDisabled = option.reason !== null;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={option.id === model}
                      disabled={isDisabled}
                      aria-disabled={isDisabled}
                      onClick={() => {
                        onModelChange?.(option.id);
                        setOpen(false);
                      }}
                      className={cx(
                        "flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-2lg p-2 outline-none transition-colors",
                        option.id === model
                          ? "bg-background-primary-hover"
                          : "hover:bg-background-primary-hover focus-visible:bg-background-primary-hover",
                        isDisabled && "cursor-not-allowed opacity-40",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-body-medium whitespace-nowrap text-text-primary">{shortModel(option.id)}</span>
                        {option.reason !== null && (
                          <span className="truncate text-caption-1-semibold text-text-tertiary">{option.reason}</span>
                        )}
                      </span>
                      <RadioDot selected={option.id === model} />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="-mx-2.5 mt-[7px] mb-3 h-px bg-border-button-default" />
            <div className="flex w-full flex-col">
              <span className="ps-2 text-body-medium text-text-secondary">
                Effort{" "}
                <motion.span
                  key={effortLabel}
                  initial={{ opacity: 0, filter: "blur(4px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="inline-block text-text-primary"
                >
                  {effortLabel}
                </motion.span>
              </span>
              <div className="flex w-full flex-col gap-1">
                <div className="flex w-full items-center justify-between px-2 pt-2 pb-[3px]">
                  <span className="text-body-2-medium whitespace-nowrap text-text-secondary">Faster</span>
                  <span className="text-body-2-medium whitespace-nowrap text-text-secondary">Smarter</span>
                </div>
                <div className="w-full px-2 pb-2">
                  <EffortSlider value={effort} onChange={(v) => onEffortChange?.(v)} />
                </div>
              </div>
            </div>
          </div>
        </AriaDialog>
      </AriaPopover>
    </AriaDialogTrigger>
  );
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
