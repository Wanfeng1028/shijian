import type { JSX } from "react";

import { cx } from "@/utils/cx";

export interface TimelineEvent {
  label: string;
  text: string;
}

export interface ChartBar {
  label: string;
  value: number;
}

export function parseRichBlock(
  block: string,
): { kind: 'timeline'; events: TimelineEvent[] } | { kind: 'chart'; title: string; bars: ChartBar[] } | null {
  const trimmed = block.trim();
  if (!trimmed) return null;

  const lines = trimmed.split("\n");
  if (lines.length < 3) return null;

  const firstLine = lines[0].trimEnd();
  const lastLine = lines[lines.length - 1].trim();
  if (lastLine !== "```") return null;

  if (firstLine === "```timeline") {
    const events: TimelineEvent[] = [];
    for (const rawLine of lines.slice(1, lines.length - 1)) {
      const parts = rawLine.split("|");
      const label = parts[0]?.trim() ?? "";
      const text = parts[1]?.trim() ?? "";
      if (label === "" || text === "") continue;
      events.push({ label, text });
    }
    if (events.length < 2) return null;
    return { kind: "timeline", events };
  }

  if (firstLine === "```chart") {
    const contentLines = lines.slice(1, lines.length - 1);
    const title = contentLines[0]?.trim() ?? "";
    if (title === "") return null;

    const bars: ChartBar[] = [];
    for (const rawLine of contentLines.slice(1)) {
      const parts = rawLine.split("|");
      const label = parts[0]?.trim() ?? "";
      const rawValue = parts[1] ?? "";
      const normalized = rawValue
        .replace(/[,，\s]/g, "")
        .replace(/[\u4e00-\u9fa5]/g, "");
      const value = Number(normalized);
      if (label === "" || Number.isNaN(value)) continue;
      bars.push({ label, value });
    }
    if (bars.length < 2) return null;
    return { kind: "chart", title, bars: bars.slice(0, 8) };
  }

  return null;
}

export function TimelineBlock({ events }: { events: TimelineEvent[] }): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      {events.map((event, index) => (
        <div key={index} className="flex items-stretch gap-4">
          <div className="flex w-2 flex-col items-center">
            <span className="h-2 w-2 rounded-full bg-accent-600" />
            {index < events.length - 1 && (
              <div className="w-px flex-1 bg-border-button-default" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className={cx("text-body-medium font-bold text-text-primary", "shrink-0 whitespace-nowrap min-w-0")}>
              {event.label}
            </span>
            <p className={cx("text-body-regular text-text-secondary", "break-words")}>
              {event.text}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChartBlock({ title, bars }: { title: string; bars: ChartBar[] }): JSX.Element {
  const max = bars.reduce((acc, bar) => Math.max(acc, bar.value), 0);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-body-medium text-text-primary">{title}</h3>
      <ul className="flex flex-col gap-3">
        {bars.map((bar) => (
          <li key={bar.label} className="flex min-w-0 items-center gap-3">
            <span className="w-28 min-w-0 truncate text-body-regular text-text-secondary">
              {bar.label}
            </span>
            <div className="min-w-0 flex-1 rounded-full bg-background-secondary-default">
              <div
                className="h-2 rounded-full bg-accent-600"
                style={{ width: `${(max > 0 ? (bar.value / max) * 100 : 0)}%` }}
              />
            </div>
            <span className="whitespace-nowrap text-body-regular text-text-primary">
              {bar.value.toLocaleString('en-US')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
