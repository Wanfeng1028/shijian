'use client';

import { useEffect, useState } from 'react';
import { cx } from '@/utils/cx';

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

export interface CharacterPickerProps {
  selectedId: string | null;
  onSelect: (figure: PublicCharacter) => void;
  busy: boolean;
}

export function CharacterPicker({ selectedId, onSelect, busy }: CharacterPickerProps) {
  const [characters, setCharacters] = useState<PublicCharacter[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/characters')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data?.characters)) setCharacters(data.characters);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mb-2 rounded-2xl border border-border-button-default bg-background-primary-default p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body-medium text-text-primary">+ 历史人物</p>
        <p className="text-caption-1-semibold text-text-tertiary">
          沉浸对话 · 角色扮演（内容为按当时局限的推想，非史料原文）
        </p>
      </div>
      {failed ? (
        <p className="mt-2 text-body-2-regular text-text-secondary">人物列表加载失败，请刷新重试。</p>
      ) : (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {characters.map((c) => {
            const selected = c.id === selectedId;
            return (
              <button
                key={c.id}
                type="button"
                disabled={busy}
                onClick={() => onSelect(c)}
                className={cx(
                  'shrink-0 cursor-pointer rounded-2xl border px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                  selected
                    ? 'border-accent-500 bg-background-secondary-default'
                    : 'border-border-button-default hover:bg-background-secondary-hover',
                )}
              >
                <span className="block text-body-medium text-text-primary">
                  {c.name} · {c.era}
                </span>
                <span className="mt-0.5 block max-w-[220px] truncate text-caption-1-regular text-text-secondary">
                  {c.intro}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
