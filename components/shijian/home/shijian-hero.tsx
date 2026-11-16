'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, FileText, MessageSquare, Search } from 'lucide-react';

import { ButtonLink } from '@/components/boardui/base/buttons/button';
import { TASK_META, TASK_ORDER, type TaskId } from '@/components/shijian/chat/task-meta';
import { cx } from '@/utils/cx';


export interface ShijianHeroProps {
  onStartTask: (task: TaskId) => void;
}

const ROTATOR_WORDS = ['史料阅读', '史料辨析', '历史解释'] as const;

const TASK_ICONS = {
  reading: FileText,
  analysis: Search,
  explanation: MessageSquare,
} as const;

const ROTATION_INTERVAL = 2600;

export function ShijianHero({ onStartTask }: ShijianHeroProps) {
  const [active, setActive] = useState<TaskId>('reading');
  const tab = TASK_META[active];


  const [word, setWord] = useState<(typeof ROTATOR_WORDS)[number]>(ROTATOR_WORDS[0]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    let index = 0;
    const timer = window.setInterval(() => {
      index = (index + 1) % ROTATOR_WORDS.length;
      setWord(ROTATOR_WORDS[index]);
    }, ROTATION_INTERVAL);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="relative overflow-clip" aria-label="史鉴介绍">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[420px] overflow-hidden select-none sm:h-[620px] lg:h-[1060px]">
        <div aria-hidden className="absolute inset-0 bg-linear-to-b from-accent-500/15 via-accent-500/5 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-[820px] flex-col items-start px-6 pt-12 text-start sm:items-center sm:pt-16 sm:text-center">
        <span className="flex items-center gap-2 rounded-full border border-border-button-default bg-background-secondary-default py-1 ps-1 pe-3 text-caption-1-semibold text-text-primary">
          <span className="rounded-full bg-accent-500 px-1.5 py-px text-caption-1-semibold text-white">
            六阶段
          </span>
          以史料为证据 · 以问题为线索
        </span>

        <h1 className="mt-5 text-[32px] leading-[38px] font-medium tracking-[-0.02em] text-text-primary sm:text-[48px] sm:leading-[56px]">
          <span className="block">从史料中发现问题</span>
          <span className="block" key={word}>
            {word}
          </span>
          <span className="sr-only" aria-live="polite">
            {word}
          </span>
        </h1>

        <p className="mt-4 max-w-2xl text-body-regular text-pretty text-text-secondary">
          史鉴以“史料观察→问题发现→问题提出→证据探究→历史解释→反思提升”的六阶段探究法，通过启发式追问引导你运用史料证据形成有依据的历史认识。
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-start gap-3 sm:justify-center">
          <ButtonLink variant="primary" size="medium" href="/chat">
            开始探究
          </ButtonLink>
          <ButtonLink variant="secondary" size="medium" href="/records">
            查看学习记录
          </ButtonLink>
        </div>

        <ul className="mt-6 flex flex-wrap items-center justify-start gap-2 sm:justify-center" aria-label="适用范围">
          <li className="rounded-full bg-background-secondary-default px-3 py-1 text-caption-1-medium text-text-secondary">
            高中历史
          </li>
          <li className="rounded-full bg-background-secondary-default px-3 py-1 text-caption-1-medium text-text-secondary">
            人教版教材
          </li>
          <li className="rounded-full bg-background-secondary-default px-3 py-1 text-caption-1-medium text-text-secondary">
            课程标准（2017年版2020年修订）
          </li>
        </ul>
      </div>

      <div className="relative z-10 mx-auto mt-10 w-full max-w-[1276px] px-3 sm:px-6">
        <div className="overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default">
          <div
            role="tablist"
            aria-label="探究入口预览"
            className="flex gap-1 overflow-x-auto border-b border-separator-border p-2"
          >
            {TASK_ORDER.map((task) => {
              const meta = TASK_META[task];
              const Icon = TASK_ICONS[task];              const selected = task === active;
              return (
                <button
                  key={task}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActive(task)}
                  className={cx(
                    'flex shrink-0 cursor-pointer items-center gap-2 rounded-2lg px-3 py-2 text-body-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                    selected
                      ? 'bg-background-secondary-default text-text-primary'
                      : 'text-text-secondary hover:bg-background-secondary-hover hover:text-text-primary',
                  )}
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  {meta.label}
                </button>
              );
            })}
          </div>
          <div className="relative flex h-[480px] flex-col justify-center bg-background-secondary-default px-4 py-6 sm:h-[560px] sm:px-6">            <h3 className="text-title-2-medium text-text-primary">{tab.label}</h3>
            <p className="mt-2 max-w-2xl text-body-regular text-text-secondary">{tab.desc}</p>
            <ul className="mt-4 flex flex-col gap-2">
              {tab.quick.map((question) => (
                <li key={question}>
                  <Link
                    href={`/chat?task=${active}`}
                    onClick={() => onStartTask(active)}
                    className="block w-fit rounded-full bg-background-primary-default px-3.5 py-2 text-body-regular text-text-primary shadow-xs outline-none transition-colors hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                  >
                    {question}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-separator-border px-4 py-3">
            <p className="text-body-regular text-text-secondary">
              {tab.label} · 点按开始一次探究
            </p>
            <span className="flex flex-wrap items-center gap-3">
              <Link
                href={`/chat?task=${active}`}
                onClick={() => onStartTask(active)}
                className="group inline-flex items-center gap-1 text-body-medium text-text-secondary transition-colors hover:text-text-primary"
              >
                开始{tab.label}
                <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
              </Link>
              <ButtonLink href="/records" variant="secondary" size="small">
                查看学习记录
              </ButtonLink>
            </span>
          </div>
        </div>
      </div>
    </section>

  );
}

