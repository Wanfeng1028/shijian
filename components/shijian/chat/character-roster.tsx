'use client';

import { useCallback, useEffect, useState } from 'react';
import { RiAddLine, RiCloseLine, RiDeleteBinLine, RiEditLine, RiSearchLine } from '@remixicon/react';
import { cx } from '@/utils/cx';
import type { HistoricalFigure } from '@/lib/characters';
import { AgentAvatar, avatarForCharacter, AvatarKeyframes } from './character-avatar';
import { CharacterCreate } from './character-create';

/** /api/characters 返回的公开字段（不含 anchors / neverCross）。 */
export interface PublicCharacter {
  id: string;
  source: string;
  name: string;
  era: string;
  lifespan: string;
  role: string;
  intro: string;
  greeting: string;
  quickQuestions: string[];
}

export interface CharacterRosterProps {
  selectedId: string | null;
  onSelect: (figure: PublicCharacter) => void;
  busy: boolean;
  className?: string;
}

export function CharacterRoster({ selectedId, onSelect, busy, className }: CharacterRosterProps) {
  const [characters, setCharacters] = useState<PublicCharacter[]>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; figure: HistoricalFigure } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/characters');
        const data = (await res.json()) as { characters?: unknown };
        if (!cancelled && Array.isArray(data?.characters)) setCharacters(data.characters as PublicCharacter[]);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** 新建保存后：刷新列表，并直接选中新人物开始对话。 */
  const handleCreated = useCallback(
    (figure: PublicCharacter) => {
      setCharacters((prev) => (prev.some((c) => c.id === figure.id) ? prev : [...prev, figure]));
      onSelect(figure);
    },
    [onSelect],
  );

  /** 编辑保存后：只更新列表条目，不清空当前对话（改的开场白下次选它时才生效）。 */
  const handleUpdated = useCallback((figure: PublicCharacter) => {
    setCharacters((prev) => prev.map((c) => (c.id === figure.id ? figure : c)));
  }, []);

  async function startEdit(figure: PublicCharacter) {
    setActionError(null);
    try {
      const res = await fetch('/api/characters/' + figure.id);
      const data = (await res.json().catch(() => ({}))) as { character?: unknown };
      if (res.ok && data.character && typeof data.character === 'object') {
        setEditing({ id: figure.id, figure: data.character as HistoricalFigure });
      } else if (res.status === 404) {
        setActionError('这个人物已被删除，请刷新列表。');
      } else {
        setActionError('打不开编辑页，请重试。');
      }
    } catch {
      setActionError('请求失败，请检查网络后重试。');
    }
  }

  async function confirmDelete(figure: PublicCharacter) {
    setDeleteBusy(true);
    setActionError(null);
    try {
      const res = await fetch('/api/characters/' + figure.id, { method: 'DELETE' });
      if (res.ok) {
        const remaining = characters.filter((c) => c.id !== figure.id);
        setCharacters(remaining);
        setDeletingId(null);
        // 删的正是当前对话的人物：回到列表第一位（孔子），另开对话。
        if (selectedId === figure.id && remaining.length > 0) onSelect(remaining[0]);
      } else if (res.status === 404) {
        setActionError('这个人物已被删除，请刷新列表。');
        setCharacters((prev) => prev.filter((c) => c.id !== figure.id));
        setDeletingId(null);
      } else {
        setActionError('删除失败，请重试。');
      }
    } catch {
      setActionError('请求失败，请检查网络后重试。');
    } finally {
      setDeleteBusy(false);
    }
  }

  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visibleCharacters = q
    ? characters.filter((c) =>
        [c.name, c.era, c.role, c.intro].some((t) => t.toLowerCase().includes(q)),
      )
    : characters;

  return (
    <div className={cx("min-h-0 shrink-0", className)}>
      <aside
        aria-label="历史人物"
        className="flex min-h-0 w-[260px] shrink-0 flex-col rounded-3xl border border-border-button-white bg-background-secondary-default p-[7px] shadow-sidebar"
      >
        <div className="flex h-9 w-full items-center gap-2 rounded-full ps-3 pe-2">
          <RiSearchLine className="size-5 shrink-0 text-foreground-icon-tertiary" aria-hidden />
          <input
            type="text"
            placeholder="搜索人物…"
            aria-label="搜索人物"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-body-regular text-text-primary outline-none placeholder:text-text-tertiary"
          />
          <button
            type="button"
            aria-label="Close search"
            title="Close search"
            onClick={() => {
              setQuery("");
            }}
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground-icon-secondary outline-none hover:bg-background-tertiary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <RiCloseLine className="size-4" aria-hidden />
          </button>
        </div>

        <AvatarKeyframes />

        {failed && <p className="p-3 text-body-regular text-text-tertiary">人物列表加载失败，请刷新重试。</p>}
        {actionError ? (
          <p className="rounded-xl bg-background-secondary-default px-3 py-2 text-body-regular text-text-error-primary">{actionError}</p>
        ) : null}

        {/* Chat list */}
        <div className="mt-2 flex min-h-0 flex-1 flex-col">
          <div
            tabIndex={0}
            className="flex h-full flex-col gap-2 overflow-y-auto overscroll-contain outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring"
          >
                        {visibleCharacters.map((c, i) => {
              const active = c.id === selectedId;
              const isCustom = c.source === 'custom';
              return (
                <div key={c.id} className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onSelect(c)}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "flex h-[54px] min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1.5 text-start outline-none transition-colors focus-visible:ring-2 focus-visible:ring-border-focus-ring",
                      active ? "bg-background-tertiary-default" : "hover:bg-background-secondary-hover",
                    )}
                  >
                    <AgentAvatar agent={avatarForCharacter(c.id, c.name)} size={40} blinkDelay={`${(i % 5) * 0.7}s`} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-body-medium text-text-primary">{c.name}</span>
                      <span title={c.intro} className="truncate text-body-regular text-text-tertiary">{c.intro}</span>
                    </span>
                  </button>
                  {isCustom ? (
                    deletingId === c.id ? (
                      <span className="flex shrink-0 items-center gap-1 pe-1">
                        <button
                          type="button"
                          disabled={deleteBusy}
                          onClick={() => confirmDelete(c)}
                          className="cursor-pointer rounded-full bg-button-primary px-2.5 py-1 text-body-2-regular text-white outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:opacity-40"
                        >
                          {deleteBusy ? '删除中…' : '确定删除'}
                        </button>
                        <button
                          type="button"
                          disabled={deleteBusy}
                          onClick={() => setDeletingId(null)}
                          className="cursor-pointer rounded-full px-2 py-1 text-body-2-regular text-text-secondary outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:opacity-40"
                        >
                          取消
                        </button>
                      </span>
                    ) : (
                      <span className="flex shrink-0 items-center pe-1">
                        <button
                          type="button"
                          aria-label={'编辑' + c.name}
                          title="编辑"
                          disabled={busy}
                          onClick={() => startEdit(c)}
                          className="flex size-7 cursor-pointer items-center justify-center rounded-full text-foreground-icon-secondary outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:opacity-40"
                        >
                          <RiEditLine className="size-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          aria-label={'删除' + c.name}
                          title="删除"
                          disabled={busy}
                          onClick={() => setDeletingId(c.id)}
                          className="flex size-7 cursor-pointer items-center justify-center rounded-full text-foreground-icon-secondary outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:opacity-40"
                        >
                          <RiDeleteBinLine className="size-4" aria-hidden />
                        </button>
                      </span>
                    )
                  ) : null}
                </div>
              );
            })}
            {visibleCharacters.length === 0 && !failed && !loading && (
              <p className="px-2 py-3 text-body-regular text-text-tertiary">
                没有匹配“{query.trim()}”的人物。
              </p>
            )}

          </div>
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="mt-2 flex h-[44px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-button-default text-body-regular text-text-secondary outline-none transition-colors hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <RiAddLine className="size-5" aria-hidden />
          新建人物
        </button>
      </aside>
      {createOpen ? (
        <CharacterCreate
          onClose={() => setCreateOpen(false)}
          existingNames={characters.map((c) => c.name)}
          onCreated={handleCreated}
        />
      ) : null}
      {editing ? (
        <CharacterCreate
          editing={editing}
          onUpdated={handleUpdated}
          onClose={() => setEditing(null)}
          existingNames={characters.map((c) => c.name)}
          onCreated={handleCreated}
        />
      ) : null}
    </div>
  );
}