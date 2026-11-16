'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Topbar } from '@/components/shijian/topbar';
import { ProfileModal } from '@/components/shijian/chat/profile-modal';
import { loadProfile, saveProfile, saveTask, type Profile } from '@/lib/store';
import { cx } from '@/utils/cx';
import {
  FileText,
  Search,
  MessageSquare,
  ArrowRight,
  Eye,
  CircleHelp,
  FileSearch,
  MessagesSquare,
  RefreshCw,
} from 'lucide-react';

type IconType = typeof FileText;

interface EntryCard {
  task: string;
  title: string;
  desc: string;
  icon: IconType;
}

interface Stage {
  num: number;
  title: string;
  desc: string;
  icon: IconType;
}

const ENTRY_CARDS: EntryCard[] = [
  {
    task: 'reading',
    title: '史料阅读',
    desc: '从出处、时间与关键词入手，读懂材料的基本信息。',
    icon: FileText,
  },
  {
    task: 'analysis',
    title: '史料辨析',
    desc: '比较材料差异，发现疑点，判断证据的立场与价值。',
    icon: Search,
  },
  {
    task: 'explanation',
    title: '历史解释',
    desc: '把证据放入时空背景，形成条理清晰的历史解释。',
    icon: MessageSquare,
  },
];

const STAGES: Stage[] = [
  { num: 1, title: '史料观察', desc: '读懂材料出处、时间与关键信息。', icon: Eye },
  { num: 2, title: '问题发现', desc: '标记矛盾、空白与值得追问处。', icon: Search },
  { num: 3, title: '问题提出', desc: '把疑惑整理成可探究的问题。', icon: CircleHelp },
  { num: 4, title: '证据探究', desc: '筛选史料，用证据支持或修正判断。', icon: FileSearch },
  { num: 5, title: '历史解释', desc: '在时空背景下形成有依据的解释。', icon: MessagesSquare },
  { num: 6, title: '反思提升', desc: '回看推理过程，修正认识与方法。', icon: RefreshCw },
];

export default function HomePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const p = loadProfile();
    setProfile(p);
    if (p === null) {
      setModalOpen(true);
    }
    setReady(true);
  }, []);

  const handleProfileSaved = (next: Profile) => {
    saveProfile(next);
    setProfile(next);
  };

  const handleEntryClick = (task: string) => {
    saveTask(task);
  };

  return (
    <div className="min-h-dvh bg-background-full">
      <Topbar current="home" initialProfile={ready ? profile : null} onProfileSaved={handleProfileSaved} />

      <main className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {/* 欢迎区 */}
        <section className="flex flex-col items-center py-12 text-center sm:py-16">
          <span className="rounded-full border border-border-button-default bg-background-secondary-default px-4 py-1.5 text-caption-1-semibold text-text-primary">
            以史料为证据 · 以问题为线索
          </span>
          <h1 className="mt-6 text-[40px] leading-[48px] text-text-primary">
            从史料中发现问题
          </h1>
          <p className="mt-4 max-w-2xl text-body-regular text-text-secondary">
            史鉴以“史料观察→问题发现→问题提出→证据探究→历史解释→反思提升”的六阶段探究法，通过启发式追问引导你运用史料证据形成有依据的历史认识。
          </p>
        </section>

        {/* 三个入口卡片 */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {ENTRY_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.task}
                href={`/chat?task=${card.task}`}
                onClick={() => handleEntryClick(card.task)}
                className={cx(
                  'flex h-full flex-col justify-between gap-4 rounded-3xl border border-border-button-default bg-background-primary-default p-6 transition-colors',
                  'hover:border-border-button-hover hover:bg-background-secondary-default',
                  'outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-700">
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className="text-title-3-semibold text-text-primary">{card.title}</h3>
                </div>
                <p className="text-body-regular text-text-secondary">{card.desc}</p>
                <div className="flex justify-end">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-500 px-4 py-2 text-body-medium text-white">
                    开始
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            );
          })}
        </section>

        {/* 六阶段 section */}
        <section className="mt-12 sm:mt-16">
          <h2 className="text-title-2-medium text-text-primary">六阶段探究法</h2>
          <p className="mt-2 text-body-regular text-text-secondary">
            一次只聚焦一个思维任务，让问题、证据与解释逐步推进。
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STAGES.map((stage) => {
              const Icon = stage.icon;
              return (
                <div
                  key={stage.num}
                  className="rounded-3xl border border-border-button-default bg-background-primary-default p-6"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-50 text-body-medium text-accent-700">
                      {stage.num}
                    </span>
                    <Icon className="h-5 w-5 text-accent-700" />
                  </div>
                  <h3 className="mt-4 text-title-3-semibold text-text-primary">{stage.title}</h3>
                  <p className="mt-1 text-body-regular text-text-secondary">{stage.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 使用说明 */}
        <section className="mt-12 rounded-3xl border border-border-button-default bg-background-secondary-default p-6">
          <p className="text-body-regular text-text-secondary">
            <span className="text-body-medium text-text-primary">使用说明：</span>
            数据仅保存在本浏览器 localStorage，清除浏览器数据会丢失、换设备不同步。
          </p>
        </section>
      </main>

      {/* 页脚 */}
      <footer className="mt-12 border-t border-separator-border py-6">
        <p className="text-center text-body-2-regular text-text-tertiary">
          史鉴 · 以人教版高中历史教材与《普通高中历史课程标准（2017年版2020年修订）》为依据
        </p>
      </footer>

      <ProfileModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={profile}
        onSaved={handleProfileSaved}
      />
    </div>
  );
}
