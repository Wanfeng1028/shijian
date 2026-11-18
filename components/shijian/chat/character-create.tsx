'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { RiCloseLine } from '@remixicon/react';
import type { HistoricalFigure } from '@/lib/characters';
import { cx } from '@/utils/cx';
import type { PublicCharacter } from './character-roster';

export interface DraftSource {
  id: string;
  book: string;
  unit: string;
  lesson: string;
  page: string;
}

interface AnchorForm {
  label: string;
  source: string;
  note: string;
  quote: string;
}

interface FormState {
  name: string;
  era: string;
  lifespan: string;
  role: string;
  voice: string;
  intro: string;
  greeting: string;
  knowledgeCutoff: string;
  cannotKnow: string;
  anchors: AnchorForm[];
  neverCross: string;
  quickQuestions: string;
}

function emptyForm(name = '', era = ''): FormState {
  return {
    name,
    era,
    lifespan: '',
    role: '',
    voice: '',
    intro: '',
    greeting: '',
    knowledgeCutoff: '',
    cannotKnow: '',
    anchors: [
      { label: '', source: '', note: '', quote: '' },
      { label: '', source: '', note: '', quote: '' },
    ],
    neverCross: '',
    quickQuestions: '',
  };
}

function formFromDraft(d: HistoricalFigure): FormState {
  const anchors = (d.anchors ?? []).map((a) => ({
    label: a.label ?? '',
    source: a.source ?? '',
    note: a.note ?? '',
    quote: a.quote ?? '',
  }));
  while (anchors.length < 2) anchors.push({ label: '', source: '', note: '', quote: '' });
  return {
    name: d.name ?? '',
    era: d.era ?? '',
    lifespan: d.lifespan ?? '',
    role: d.role ?? '',
    voice: d.voice ?? '',
    intro: d.intro ?? '',
    greeting: d.greeting ?? '',
    knowledgeCutoff: d.knowledgeCutoff ?? '',
    cannotKnow: (d.cannotKnow ?? []).join('\n'),
    anchors: anchors.slice(0, 3),
    neverCross: (d.neverCross ?? []).join('\n'),
    quickQuestions: (d.quickQuestions ?? []).join('\n'),
  };
}

function lines(s: string): string[] {
  return s
    .split('\n')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function deathYearOf(lifespan: string): number | null {
  const years = lifespan.match(/\d{3,4}/g) ?? [];
  return years.length > 0 ? Number(years[years.length - 1]) : null;
}

/** 与后端 validateCustomFigure 同口径的保存前检查（后端还会再跑一次）。 */
function validateForm(f: FormState): string[] {
  const errors: string[] = [];
  if (!f.name.trim()) errors.push('姓名必填');
  if (!f.era.trim()) errors.push('朝代必填');
  if (!f.lifespan.trim()) errors.push('生卒必填');
  if (!f.role.trim()) errors.push('身份必填');
  if (!f.voice.trim()) errors.push('口吻必填');
  if (!f.intro.trim()) errors.push('介绍必填');
  if (!f.greeting.trim()) errors.push('开场白必填');
  if (!f.knowledgeCutoff.trim()) errors.push('知识截止必填');
  if (f.greeting.trim().length > 100) errors.push('开场白超过 100 字');
  const filledAnchors = f.anchors.filter((a) => a.label.trim() && a.source.trim() && a.note.trim());
  if (filledAnchors.length < 2) errors.push('课本锚点至少 2 条（每条都要有标题、出处、事实说明）');
  if (lines(f.cannotKnow).length < 1) errors.push('“绝不能知道的事”至少 1 条');
  if (lines(f.neverCross).length < 1) errors.push('“绝不越过的线”至少 1 条');
  const qs = lines(f.quickQuestions);
  if (qs.length < 1 || qs.length > 3) errors.push('快捷提问 1–3 条');
  const deathYear = deathYearOf(f.lifespan);
  if (deathYear === null) {
    errors.push('生卒未给出年份，无法核对知识截止');
  } else if (!f.knowledgeCutoff.includes(String(deathYear))) {
    errors.push('知识截止须等于卒年（' + deathYear + '）');
  }
  return errors;
}

const inputCls =
  'w-full rounded-xl border border-border-button-default bg-background-primary-default px-3 py-2 text-body-regular text-text-primary outline-none placeholder:text-text-tertiary focus-visible:ring-2 focus-visible:ring-border-focus-ring';

const labelCls = 'mb-1.5 flex items-center gap-2 text-body-medium text-text-primary';

function Field({
  label,
  hint,
  modified,
  children,
}: {
  label: string;
  hint?: string;
  modified?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelCls}>
        {label}
        {modified ? <span className="rounded-full bg-background-secondary-default px-2 py-0.5 text-body-2-regular text-text-secondary">已修改</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-body-2-regular text-text-tertiary">{hint}</span> : null}
    </label>
  );
}

export interface CharacterCreateProps {
  onClose: () => void;
  existingNames: string[];
  onCreated: (figure: PublicCharacter) => void;
}

/**
 * 新建自定义人物：输入姓名 → RAG 草拟人物卡 → 用户审核修改 → 保存 → 直接对话。
 * 草拟不到（教材里没有该人物）直接拒，不硬编；草拟失败可手工填写。
 * 七条铁律与内置人物一致；保存前须逐条勾选“依据属实”。
 */
export function CharacterCreate({ onClose, existingNames, onCreated }: CharacterCreateProps) {
  const [phase, setPhase] = useState<'input' | 'review'>('input');
  const [name, setName] = useState('');
  const [eraHint, setEraHint] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [edited, setEdited] = useState<Set<string>>(new Set());
  const [sources, setSources] = useState<DraftSource[]>([]);
  const [evidenceChecked, setEvidenceChecked] = useState<Set<string>>(new Set());
  const [manualConfirm, setManualConfirm] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !drafting && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drafting, saving, onClose]);

  const trimmedName = name.trim();
  const duplicate = trimmedName.length > 0 && existingNames.includes(trimmedName);

  const allEvidenceChecked = useMemo(
    () => sources.length > 0 && sources.every((s) => evidenceChecked.has(s.id)),
    [sources, evidenceChecked],
  );
  const evidenceReady = sources.length > 0 ? allEvidenceChecked : manualConfirm;
  const canSave = evidenceReady && !saving;

  function markEdited(key: string) {
    setEdited((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    markEdited(String(key));
  }

  function setAnchor(index: number, key: keyof AnchorForm, value: string) {
    setForm((prev) => ({
      ...prev,
      anchors: prev.anchors.map((a, i) => (i === index ? { ...a, [key]: value } : a)),
    }));
    markEdited('anchors[' + index + '].' + key);
  }

  async function requestDraft() {
    if (!trimmedName || duplicate) return;
    setDrafting(true);
    setError(null);
    try {
      const res = await fetch('/api/characters/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, eraHint: eraHint.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        if (res.status === 404) {
          setError('教材里没有“' + trimmedName + '”的相关内容，没法对话。换个名字试试，或加上朝代提示再草拟。');
        } else if (res.status === 503) {
          setError('后端未配置模型 key，草拟暂不可用。可以先手工填写人物卡，或稍后再试。');
        } else if (typeof data.message === 'string' && data.message) {
          setError(data.message + '可以重试，或手工填写。');
        } else {
          setError('草拟失败，请重试，或手工填写。');
        }
        return;
      }
      const draft = data.draft as HistoricalFigure | undefined;
      if (!draft || typeof draft !== 'object') {
        setError('草拟返回的人物卡格式不对，请重试，或手工填写。');
        return;
      }
      setForm(formFromDraft(draft));
      setEdited(new Set());
      setSources(Array.isArray(data.sources) ? (data.sources as DraftSource[]) : []);
      setEvidenceChecked(new Set());
      setManualConfirm(false);
      setManualMode(false);
      setFormErrors([]);
      setPhase('review');
    } catch {
      setError('请求失败，请检查网络后重试。');
    } finally {
      setDrafting(false);
    }
  }

  function startManual() {
    setForm(emptyForm(trimmedName, eraHint.trim()));
    setEdited(new Set());
    setSources([]);
    setEvidenceChecked(new Set());
    setManualConfirm(false);
    setManualMode(true);
    setFormErrors([]);
    setError(null);
    setPhase('review');
  }

  async function save() {
    const errs = validateForm(form);
    setFormErrors(errs);
    if (errs.length > 0) return;
    if (!evidenceReady) return;
    setSaving(true);
    setError(null);
    try {
      const figure = {
        id: '',
        source: 'custom',
        name: form.name.trim(),
        era: form.era.trim(),
        lifespan: form.lifespan.trim(),
        role: form.role.trim(),
        voice: form.voice.trim(),
        intro: form.intro.trim(),
        greeting: form.greeting.trim(),
        knowledgeCutoff: form.knowledgeCutoff.trim(),
        cannotKnow: lines(form.cannotKnow),
        anchors: form.anchors
          .filter((a) => a.label.trim() && a.source.trim() && a.note.trim())
          .map((a) => ({
            label: a.label.trim(),
            source: a.source.trim(),
            note: a.note.trim(),
            ...(a.quote.trim() ? { quote: a.quote.trim() } : {}),
          })),
        neverCross: lines(form.neverCross),
        quickQuestions: lines(form.quickQuestions),
      };
      const res = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(figure),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.status === 201 && data.character && typeof data.character === 'object') {
        onCreated(data.character as PublicCharacter);
        onClose();
        return;
      }
      if (res.status === 503) {
        setError('自定义人物存储未配置，保存失败，请稍后再试。');
      } else if (Array.isArray(data.errors) && data.errors.length > 0) {
        setFormErrors((data.errors as unknown[]).map((e) => String(e)));
      } else if (typeof data.message === 'string' && data.message) {
        setError(data.message);
      } else {
        setError('保存失败，请重试。');
      }
    } catch {
      setError('请求失败，请检查网络后重试。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="新建历史人物">
      <button type="button" aria-label="关闭" onClick={onClose} disabled={drafting || saving} className="absolute inset-0 cursor-pointer bg-black/40" />
      <div className="relative max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border-button-default bg-background-primary-default p-5 shadow-xl">
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-body-medium text-text-primary">新建历史人物</h2>
            <p className="mt-0.5 text-body-2-regular text-text-tertiary">
              {phase === 'input'
                ? '第 1 步：输入姓名，系统从 5 册历史教材里找依据、草拟人物卡。'
                : '第 2 步：逐条核对人物卡，确认无误后保存，即可开始对话。'}
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            disabled={drafting || saving}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground-icon-secondary outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:opacity-40"
          >
            <RiCloseLine className="size-5" aria-hidden />
          </button>
        </div>

        {phase === 'input' ? (
          <div className="mt-4 flex flex-col gap-4">
            <Field label="姓名" hint="教材上的任何人物都可以；检索不到会直接告诉你，不硬编。">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') requestDraft();
                }}
                placeholder="例如：汉武帝、岳飞、李清照"
                autoFocus
                className={inputCls}
              />
            </Field>
            {duplicate ? (
              <p className="rounded-xl bg-background-secondary-default px-3 py-2 text-body-regular text-text-secondary">
                “{trimmedName}”已在人物列表里，点它就能直接对话，不用新建。
              </p>
            ) : null}
            <Field label="朝代提示（选填）" hint="同名人物多时用来消歧，例如“唐朝的李白”。">
              <input type="text" value={eraHint} onChange={(e) => setEraHint(e.target.value)} placeholder="例如：汉朝、西宋" className={inputCls} />
            </Field>
            {error ? (
              <p className="rounded-xl bg-background-secondary-default px-3 py-2 text-body-regular text-text-error-primary">{error}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={requestDraft}
                disabled={!trimmedName || duplicate || drafting}
                className="cursor-pointer rounded-full bg-button-primary px-5 py-2.5 text-body-regular text-white outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-not-allowed disabled:opacity-40"
              >
                {drafting ? '正在草拟…' : '开始草拟'}
              </button>
              <button
                type="button"
                onClick={startManual}
                disabled={!trimmedName || duplicate || drafting}
                className="cursor-pointer rounded-full border border-border-button-default px-4 py-2.5 text-body-regular text-text-secondary outline-none transition-colors hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-not-allowed disabled:opacity-40"
              >
                手工填写
              </button>
            </div>
            <p className="text-body-2-regular text-text-tertiary">
              草拟只按教材段落整理人物卡，段落里没有的内容不写、不猜；保存前要你逐条勾选“依据属实”。
            </p>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {manualMode ? (
              <p className="rounded-xl bg-background-secondary-default px-3 py-2 text-body-regular text-text-secondary">
                手工填写：请按教材填写，保存时后端会再校验一次；引文必须能在教材里逐字找到。
              </p>
            ) : null}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="姓名" modified={edited.has('name')}>
                <input type="text" value={form.name} onChange={(e) => setField('name', e.target.value)} className={inputCls} />
              </Field>
              <Field label="朝代 / 时期" modified={edited.has('era')}>
                <input type="text" value={form.era} onChange={(e) => setField('era', e.target.value)} className={inputCls} />
              </Field>
              <Field label="生卒" hint="写清年份，如“公元前 156—前 87 年”；知识截止须等于卒年。" modified={edited.has('lifespan')}>
                <input type="text" value={form.lifespan} onChange={(e) => setField('lifespan', e.target.value)} className={inputCls} />
              </Field>
              <Field label="身份" modified={edited.has('role')}>
                <input type="text" value={form.role} onChange={(e) => setField('role', e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="口吻" hint="一句话：按人物在教材中的行事风格提炼，并标明是推想。" modified={edited.has('voice')}>
              <input type="text" value={form.voice} onChange={(e) => setField('voice', e.target.value)} className={inputCls} />
            </Field>
            <Field label="一句话介绍" modified={edited.has('intro')}>
              <input type="text" value={form.intro} onChange={(e) => setField('intro', e.target.value)} className={inputCls} />
            </Field>
            <Field label="开场白（第一人称，100 字以内）" hint={'已写 ' + form.greeting.trim().length + ' / 100 字'} modified={edited.has('greeting')}>
              <textarea
                value={form.greeting}
                onChange={(e) => setField('greeting', e.target.value)}
                rows={3}
                className={cx(inputCls, 'resize-y')}
              />
            </Field>
            <Field label="知识截止" hint="人物所知止于哪一年，一般等于卒年。" modified={edited.has('knowledgeCutoff')}>
              <input type="text" value={form.knowledgeCutoff} onChange={(e) => setField('knowledgeCutoff', e.target.value)} className={inputCls} />
            </Field>

            <div>
              <span className={labelCls}>课本锚点（2–3 条，每条都要有标题、出处、事实说明）</span>
              <div className="flex flex-col gap-3">
                {form.anchors.map((a, i) => (
                  <div key={i} className="rounded-2xl border border-border-button-default p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-body-medium text-text-primary">
                        锚点 {i + 1}
                        {edited.has('anchors[' + i + '].note') || edited.has('anchors[' + i + '].label') ? (
                          <span className="ms-2 rounded-full bg-background-secondary-default px-2 py-0.5 text-body-2-regular text-text-secondary">已修改</span>
                        ) : null}
                      </span>
                      {form.anchors.length > 2 ? (
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, anchors: prev.anchors.filter((_, j) => j !== i) }))}
                          className="cursor-pointer rounded-full px-2 py-1 text-body-2-regular text-text-tertiary outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                        >
                          删除
                        </button>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input type="text" value={a.label} onChange={(e) => setAnchor(i, 'label', e.target.value)} placeholder="标题，如“罢黜百家，独尊儒术”" className={inputCls} />
                      <input type="text" value={a.source} onChange={(e) => setAnchor(i, 'source', e.target.value)} placeholder="出处，如《中外历史纲要（上）·西汉的建立》" className={inputCls} />
                      <textarea value={a.note} onChange={(e) => setAnchor(i, 'note', e.target.value)} rows={2} placeholder="一句话事实说明" className={cx(inputCls, 'resize-y')} />
                      <input
                        type="text"
                        value={a.quote}
                        onChange={(e) => setAnchor(i, 'quote', e.target.value)}
                        placeholder="可引原话（选填；必须是教材里逐字能找到的原话）"
                        className={inputCls}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {form.anchors.length < 3 ? (
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, anchors: [...prev.anchors, { label: '', source: '', note: '', quote: '' }] }))}
                  className="mt-2 cursor-pointer rounded-full border border-border-button-default px-4 py-2 text-body-regular text-text-secondary outline-none transition-colors hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                >
                  + 再加一条锚点
                </button>
              ) : null}
            </div>

            <Field label="绝不能知道的事（每行一条，至少 1 条）" hint="死后之事一律列入，如后世朝代、后世评价。" modified={edited.has('cannotKnow')}>
              <textarea value={form.cannotKnow} onChange={(e) => setField('cannotKnow', e.target.value)} rows={2} placeholder={'秦二世而亡\n汉朝及以后'} className={cx(inputCls, 'resize-y')} />
            </Field>
            <Field label="绝不越过的线（每行一条，至少 1 条）" modified={edited.has('neverCross')}>
              <textarea value={form.neverCross} onChange={(e) => setField('neverCross', e.target.value)} rows={2} placeholder="不编造教材以外的言论；不确定的话只说“按我的主张推想”，并标明推想" className={cx(inputCls, 'resize-y')} />
            </Field>
            <Field label="快捷提问（每行一条，1–3 条）" modified={edited.has('quickQuestions')}>
              <textarea value={form.quickQuestions} onChange={(e) => setField('quickQuestions', e.target.value)} rows={2} className={cx(inputCls, 'resize-y')} />
            </Field>

            {sources.length > 0 ? (
              <div>
                <span className={labelCls}>依据清单（草拟的依据，保存前请逐条勾选“依据属实”）</span>
                <div className="flex flex-col gap-2">
                  {sources.map((s) => (
                    <label key={s.id} className="flex cursor-pointer items-start gap-2 rounded-xl border border-border-button-default px-3 py-2">
                      <input
                        type="checkbox"
                        checked={evidenceChecked.has(s.id)}
                        onChange={(e) => {
                          const next = new Set(evidenceChecked);
                          if (e.target.checked) next.add(s.id);
                          else next.delete(s.id);
                          setEvidenceChecked(next);
                        }}
                        className="mt-0.5 size-4 shrink-0 accent-accent-500"
                      />
                      <span className="min-w-0">
                        <span className="block text-body-regular text-text-primary">
                          {s.book}·{s.unit}·{s.lesson}，第 {s.page} 页
                        </span>
                        <span className="block truncate text-body-2-regular text-text-tertiary">{s.id}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border-button-default px-3 py-2">
                <input type="checkbox" checked={manualConfirm} onChange={(e) => setManualConfirm(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-accent-500" />
                <span className="text-body-regular text-text-primary">我已按教材核对过以上内容（手工填写无自动依据）。</span>
              </label>
            )}

            {formErrors.length > 0 ? (
              <div className="rounded-xl bg-background-secondary-default px-3 py-2">
                {formErrors.map((e) => (
                  <p key={e} className="text-body-regular text-text-error-primary">
                    {e}
                  </p>
                ))}
              </div>
            ) : null}
            {error ? <p className="rounded-xl bg-background-secondary-default px-3 py-2 text-body-regular text-text-error-primary">{error}</p> : null}
            {!evidenceReady ? (
              <p className="text-body-2-regular text-text-tertiary">
                {sources.length > 0 ? '请把依据清单逐条勾选“依据属实”后，才能保存。' : '请勾选“我已按教材核对”后，才能保存。'}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={save}
                disabled={!canSave}
                className="cursor-pointer rounded-full bg-button-primary px-5 py-2.5 text-body-regular text-white outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? '正在保存…' : '保存并开始对话'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPhase('input');
                  setError(null);
                  setFormErrors([]);
                }}
                disabled={saving}
                className="cursor-pointer rounded-full border border-border-button-default px-4 py-2.5 text-body-regular text-text-secondary outline-none transition-colors hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-not-allowed disabled:opacity-40"
              >
                返回重填
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
