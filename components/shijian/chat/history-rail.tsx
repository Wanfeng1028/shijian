'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, Plus, UserRound } from 'lucide-react';
import { cx } from '@/utils/cx';
import { loadRecords, type RecordItem } from '@/lib/store';

const TASK_LABELS: Record<string, string> = {
  reading: '史料阅读',
  analysis: '史料辨析',
  explanation: '历史解释',
  general: '通用对话',
};

export interface HistoryRailProps {
  /** Bump to reload records (e.g. messages.length — a record is saved per reply). */
  refreshKey: number;
  onNewChat: () => void;
  onOpenProfile: () => void;
  profileLabel: string;
  onExport: () => void;
  className?: string;
}

/**
 * 史鉴对话页右侧记录栏。几何与结构取 BoardUI AgentChatHistory
 *（260px 独立卡片、rounded-3xl、bg-background-secondary-default、p-3、
 * gap-6；New chat / Recent / 底部导出）；内容换成史鉴学习记录。
 * 记录只有主题与摘要、没有全文消息，行点按进 /records 页查看，
 * 不伪造可恢复的会话。
 */
export function HistoryRail({
  refreshKey,
  onNewChat,
  onOpenProfile,
  profileLabel,
  onExport,
  className,
}: HistoryRailProps) {
  const [records, setRecords] = useState<RecordItem[]>([]);

  useEffect(() => {
    setRecords(loadRecords());
  }, [refreshKey]);

  const visible = [...records].reverse().slice(0, 30);
  const count = records.length;

  return (
    <aside
      aria-label="最近学习记录"
      className={cx(
        'flex h-full w-[260px] shrink-0 flex-col gap-6 overflow-hidden rounded-3xl bg-background-secondary-default p-3',
        className,
      )}
    >
      <button
        type="button"
        onClick={onNewChat}
        className="flex w-full cursor-pointer items-center gap-2 rounded-2lg px-2 py-2 text-body-medium text-text-primary outline-none transition-colors hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
      >
        <Plus className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
        新对话
      </button>

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto [scrollbar-width:none]">
        <p className="px-2 pb-1 text-body-2-medium text-text-tertiary">最近记录</p>

        {visible.length === 0 ? (
          <p className="px-2 text-body-2-regular text-text-tertiary">
            完成一次探究后，记录会显示在这里。
          </p>
        ) : (
          visible.map((record, i) => (
            <Link
              key={`${record.date}-${record.topic}-${i}`}
              href="/records"
              title={`${TASK_LABELS[record.task] ?? record.task}：${record.summary}`}
              className="group/row relative flex items-center rounded-2lg outline-none transition-colors hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
            >
              <span className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 ps-2 text-start">
                <span className="min-w-0 flex-1 truncate text-body-2-regular text-text-secondary">
                  {record.topic || '未命名主题'}
                </span>
              </span>
              <span className="shrink-0 pe-2 text-caption-1-regular text-text-tertiary">
                {relativeTime(record.date)}
              </span>
            </Link>
          ))
        )}
      </div>

      <div className="mt-auto flex items-center gap-1 border-t border-separator-border pt-3 pe-1">
        <button
          type="button"
          onClick={onOpenProfile}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-2lg px-1 py-1 text-start outline-none transition-colors hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background-tertiary-default">
            <UserRound className="size-4 text-foreground-icon-secondary" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 truncate text-body-2-medium text-text-primary">
            {profileLabel}
          </span>
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={count === 0}
          aria-label={count === 0 ? '暂无记录可导出' : `导出 ${count} 条记录`}
          title={count === 0 ? '暂无记录可导出' : `导出 ${count} 条记录`}
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full bg-button-primary text-white outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="size-3.5 shrink-0" aria-hidden />
        </button>
      </div>
    </aside>
  );
}

/** Compact ages for a narrow badge: now, 34m, 5h, 18h, 3d. */
function relativeTime(date: string) {
  const at = new Date(date).getTime();
  if (Number.isNaN(at)) return '';
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 60) return '刚刚';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.round(hours / 24)}天前`;
}
