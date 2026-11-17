"use client";

import { useTemplateCopy } from "@/components/boardui/foundations/template-copy/template-copy";

import { RiCheckLine, RiFileCopyLine, RiHeartFill, RiHeartLine, RiVolumeMuteLine, RiVolumeUpLine } from "@remixicon/react";
import { motion, useReducedMotion } from "motion/react";
import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cx } from "@/utils/cx";

/**
 * One turn in the transcript.
 *
 * Assistant replies arrive a paragraph at a time, each softening in out of a
 * blur as it first appears and then only growing, so nothing already on screen
 * ever re-animates.
 *
 * The action row is deliberately mounted at all times and revealed on hover or
 * focus. Rendering it only on hover would make it unreachable by keyboard and
 * would shift the layout as the pointer moves across the transcript.
 */

export interface AgentMessageProps {
  role: string;
  text: string;
  /** True while this message is still being streamed. */
  streaming?: boolean;
  /** When the message first appeared, for the hover timestamp. */
  at?: number;
}

export function AgentMessage({ role, text, streaming = false, at }: AgentMessageProps) {
  const localize = useTemplateCopy();
  if (!text) return null;

  if (role === "user") {
    return localize((
      <p className="ms-auto flex w-fit max-w-[75%] flex-col rounded-2xl bg-button-primary px-3 py-[11px] text-start text-body-regular break-words whitespace-pre-wrap text-white shadow-card">
        {text}
      </p>
    ));
  }

  return localize((
    <div className="group/message flex flex-col gap-1 px-1">
      <StreamedText text={text} />
      <MessageActions text={text} at={at} hidden={streaming} />
    </div>
  ));
}

/**
 * Blocks, each softening in once as it first appears. Blocks are split on
 * blank lines, with blank lines inside fenced code blocks left unbroken so a
 * code sample keeps its structure.
 *
 * The animation deliberately lives at the block level rather than the word
 * level. Animating words looks worse in practice: a token arrives as a
 * fragment, the blur-in plays on that fragment, and then the fragment mutates
 * to the finished word with no transition — which reads as a stutter. It also
 * forces a swap from animated spans back to plain text when the stream ends,
 * and everything mid-flight snaps at once.
 *
 * A block mounts exactly once and then only grows, so nothing ever restarts or
 * snaps; finished blocks never replay their animation. Evenness of the text
 * itself comes from the server, which releases whole words on a steady tick
 * (see `smoothStream` in the route). While streaming, the last block keeps
 * growing, and an unclosed ** or an unformed table is shown as raw text at
 * first and corrects itself automatically as tokens arrive.
 */
export function StreamedText({ text }: { text: string }) {
  const localize = useTemplateCopy();
  const reduceMotion = useReducedMotion();
  const blocks = useMemo(() => splitMarkdownBlocks(text), [text]);

  return localize((
    <div className="flex flex-col gap-3">
      {blocks.map((block, index) => (
        <MarkdownBlock key={index} text={block} animate={!reduceMotion} />
      ))}
    </div>
  ));
}

/**
 * At module scope so their identity is stable. A block re-renders on every
 * token of the reply — dozens of times a second — and handing Motion a fresh
 * object literal each time invites it to re-evaluate a target that has not
 * actually changed.
 */
const LINE_HIDDEN = { opacity: 0, filter: "blur(5px)", y: 4 };
const LINE_SHOWN = { opacity: 1, filter: "blur(0px)", y: 0 };
const LINE_TRANSITION = { duration: 0.42, ease: [0.22, 0.61, 0.36, 1] } as const;

/**
 * A settled block keeps `filter: blur(0px)` rather than losing the filter
 * altogether — Motion owns that property once it animates it, and a `style`
 * override does not win it back. At one filtered element per block the
 * cost is invisible; it was only a problem when every word carried its own.
 *
 * memo matters here: without it every block re-renders on each token of the
 * reply, which is wasted work for the blocks that are already finished.
 */
function splitMarkdownBlocks(text: string): string[] {
  const lines = text.split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;

  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      current.push(line);
      continue;
    }

    if (line.trim() === "" && !inFence) {
      if (current.length > 0) {
        const block = current.join("\n").trim();
        if (block.length > 0) {
          blocks.push(block);
        }
        current = [];
      }
      continue;
    }

    current.push(line);
  }

  if (current.length > 0) {
    const block = current.join("\n").trim();
    if (block.length > 0) {
      blocks.push(block);
    }
  }

  return blocks;
}

const MARKDOWN_COMPONENTS: Components = {
  h1: ({ node, children, ...rest }) => (
    <h1 className="text-title-2-semibold break-words text-text-primary" {...rest}>
      {children}
    </h1>
  ),
  h2: ({ node, children, ...rest }) => (
    <h2 className="text-title-3-semibold break-words text-text-primary" {...rest}>
      {children}
    </h2>
  ),
  h3: ({ node, children, ...rest }) => (
    <h3 className="text-body-medium break-words text-text-primary" {...rest}>
      {children}
    </h3>
  ),
  h4: ({ node, children, ...rest }) => (
    <h4 className="text-body-medium break-words text-text-primary" {...rest}>
      {children}
    </h4>
  ),
  p: ({ node, children, ...rest }) => (
    <p className="text-body-regular break-words text-text-primary" {...rest}>
      {children}
    </p>
  ),
  ul: ({ node, children, ...rest }) => (
    <ul className="list-disc space-y-1 ps-5 text-body-regular text-text-primary" {...rest}>
      {children}
    </ul>
  ),
  ol: ({ node, children, ...rest }) => (
    <ol className="list-decimal space-y-1 ps-5 text-body-regular text-text-primary" {...rest}>
      {children}
    </ol>
  ),
  li: ({ node, children, ...rest }) => (
    <li className="break-words text-text-primary" {...rest}>
      {children}
    </li>
  ),
  blockquote: ({ node, children, ...rest }) => (
    <blockquote className="border-l-2 border-border-button-default ps-3 text-body-regular text-text-secondary" {...rest}>
      {children}
    </blockquote>
  ),
  code: ({ node, children, className, ...rest }) => (
    <code
      className={
        className?.includes("language-")
          ? "font-mono text-body-2-regular text-text-primary"
          : "rounded bg-background-secondary-default px-1 py-0.5 font-mono text-body-2-regular text-text-primary"
      }
      {...rest}
    >
      {children}
    </code>
  ),
  pre: ({ node, children, ...rest }) => (
    <pre className="overflow-x-auto rounded-lg bg-background-secondary-default p-3 font-mono text-body-2-regular text-text-primary" {...rest}>
      {children}
    </pre>
  ),
  table: ({ node, children, ...rest }) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-body-regular text-text-primary [&_th:first-child]:whitespace-nowrap [&_td:first-child]:whitespace-nowrap" {...rest}>
        {children}
      </table>
    </div>
  ),
  th: ({ node, children, ...rest }) => (
    <th className="border border-border-table bg-background-secondary-default px-2 py-1 text-start text-body-medium text-text-primary" {...rest}>
      {children}
    </th>
  ),
  td: ({ node, children, ...rest }) => (
    <td className="border border-border-table px-2 py-1 break-words text-body-regular text-text-primary" {...rest}>
      {children}
    </td>
  ),
  a: ({ node, children, ...rest }) => (
    <a className="text-accent-600 underline underline-offset-2" target="_blank" rel="noreferrer noopener" {...rest}>
      {children}
    </a>
  ),
  strong: ({ node, children, ...rest }) => (
    <strong className="font-semibold text-text-primary" {...rest}>
      {children}
    </strong>
  ),
  em: ({ node, children, ...rest }) => (
    <em className="italic" {...rest}>
      {children}
    </em>
  ),
  hr: ({ node, children, ...rest }) => (
    <hr className="border-border-button-default" {...rest} />
  ),
};

// memo + 稳定 key 保证已定稿块不重播动画；原始 HTML 按文本处理，不加 rehype-raw，不使用 dangerouslySetInnerHTML。
const MarkdownBlock = memo(function MarkdownBlock({ text, animate }: { text: string; animate: boolean }) {
  return (
    <motion.div initial={animate ? LINE_HIDDEN : false} animate={LINE_SHOWN} transition={LINE_TRANSITION}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
        {text}
      </ReactMarkdown>
    </motion.div>
  );
});

const LIKE_STORAGE_KEY_PREFIX = "shijian-like-";

function hashText(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

function MessageActions({ text, at, hidden }: { text: string; at?: number; hidden: boolean }) {
  const localize = useTemplateCopy();
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [liked, setLiked] = useState(false);

  const storageKey = useMemo(
    () =>
      at
        ? `${LIKE_STORAGE_KEY_PREFIX}${at}`
        : `${LIKE_STORAGE_KEY_PREFIX}hash-${hashText(text)}`,
    [at, text],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setLiked(window.localStorage.getItem(storageKey) === "1");
    } catch {
      setLiked(false);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  // Speech keeps running if the component goes away mid-sentence, so it is
  // cancelled on unmount rather than left talking over the next screen.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard access can be refused (insecure origin, denied permission).
      // Silently leaving the icon unchanged is better than a thrown error.
    }
  };

  const toggleSpeech = () => {
    const synth = typeof window === "undefined" ? undefined : window.speechSynthesis;
    if (!synth) return;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(utterance);
    setSpeaking(true);
  };

  const toggleLike = () => {
    const next = !liked;
    try {
      if (next) window.localStorage.setItem(storageKey, "1");
      else window.localStorage.removeItem(storageKey);
    } catch {
      // 存储不可用时静默，状态只保存在内存
    }
    setLiked(next);
  };

  return localize((
    <div
      className={cx(
        "flex items-center gap-1 transition-opacity duration-150",
        // Revealed on hover, and whenever a control inside has keyboard focus.
        hidden
          ? "pointer-events-none opacity-0"
          : "opacity-70 hover:opacity-100 focus-within:opacity-100",
      )}
    >
      <ActionButton label={copied ? "Copied" : "Copy message"} onClick={copy}>
        {copied ? <RiCheckLine className="size-4" aria-hidden /> : <RiFileCopyLine className="size-4" aria-hidden />}
      </ActionButton>

      <ActionButton label={liked ? "取消点赞" : "点赞"} onClick={toggleLike}>
        {liked ? (
          <RiHeartFill className="size-4 text-red-500" aria-hidden />
        ) : (
          <RiHeartLine className="size-4" aria-hidden />
        )}
      </ActionButton>

      <ActionButton label={speaking ? "Stop reading aloud" : "Read aloud"} onClick={toggleSpeech}>
        {speaking ? (
          <RiVolumeMuteLine className="size-4" aria-hidden />
        ) : (
          <RiVolumeUpLine className="size-4" aria-hidden />
        )}
      </ActionButton>

      {at ? (
        <time dateTime={new Date(at).toISOString()} className="ms-1 text-caption-1-regular text-text-tertiary">
          {formatAgo(at)}
        </time>
      ) : null}
    </div>
  ));
}

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const localize = useTemplateCopy();
  return localize((
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-7 cursor-pointer items-center justify-center rounded-md text-foreground-icon-tertiary transition-colors hover:bg-background-primary-default hover:text-foreground-icon-secondary focus-visible:ring-2 focus-visible:ring-border-focus-ring focus-visible:outline-none"
    >
      {children}
    </button>
  ));
}

/** "just now", "3 minutes ago", "2 hours ago" — matching how the rail reads. */
function formatAgo(at: number) {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
