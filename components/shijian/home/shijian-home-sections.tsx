'use client';

import {
  Eye,
  Search,
  CircleHelp,
  FileSearch,
  MessagesSquare,
  RefreshCw,
} from 'lucide-react';
import { ButtonLink } from '@/components/boardui/base/buttons/button';

type ShijianStage = {
  index: number;
  title: string;
  description: string;
  example: string;
  icon: typeof Eye;
};

const shijianStages: ShijianStage[] = [
  {
    index: 1,
    title: '史料观察',
    description: '读懂材料出处、时间与关键信息。',
    example: '这段史料是谁写的？写于何时？',
    icon: Eye,
  },
  {
    index: 2,
    title: '问题发现',
    description: '标记矛盾、空白与值得追问处。',
    example: '这里有没有矛盾、空白或反常之处？',
    icon: Search,
  },
  {
    index: 3,
    title: '问题提出',
    description: '把疑惑整理成可探究的问题。',
    example: '能把疑惑整理成一个可探究的问题吗？',
    icon: CircleHelp,
  },
  {
    index: 4,
    title: '证据探究',
    description: '筛选史料，用证据支持或修正判断。',
    example: '哪些史料能支持这个判断？哪些会推翻它？',
    icon: FileSearch,
  },
  {
    index: 5,
    title: '历史解释',
    description: '在时空背景下形成有依据的解释。',
    example: '放在当时的时空背景下，该怎么解释？',
    icon: MessagesSquare,
  },
  {
    index: 6,
    title: '反思提升',
    description: '回看推理过程，修正认识与方法。',
    example: '回看推理过程，哪里还可以修正？',
    icon: RefreshCw,
  },
];

export function ShijianHomeSections() {
  return (
    <div className="mx-auto flex w-full max-w-[1276px] flex-col gap-20 px-3 py-16 sm:px-6">
      <section className="flex flex-col gap-12">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="max-w-2xl text-title-1-medium text-text-primary">
            六阶段探究法
          </h2>
          <p className="max-w-2xl text-body-regular text-text-secondary">
            一次只聚焦一个思维任务，让问题、证据与解释逐步推进。
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shijianStages.map((stage) => {
            const StageIcon = stage.icon;
            return (
              <article
                key={stage.index}
                className="grid grid-rows-subgrid row-span-3 gap-1.5 rounded-3xl border border-border-button-default bg-background-primary-default p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-50 text-body-medium text-accent-700">
                    {stage.index}
                  </span>
                  <StageIcon className="h-5 w-5 text-accent-700" aria-hidden />
                </div>
                <h3 className="text-title-3-semibold text-text-primary">
                  {stage.title}
                </h3>
                <div className="flex flex-col gap-1">
                  <p className="text-body-regular text-text-secondary">
                    {stage.description}
                  </p>
                  <p className="border-l-2 border-accent-500/40 pl-2 text-body-regular text-text-secondary">
                    {stage.example}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <section className="flex flex-col items-start gap-3 rounded-3xl border border-border-button-default bg-background-secondary-default p-6">
        <h2 className="text-title-1-medium text-text-primary">使用说明</h2>
        <ul className="flex max-w-2xl flex-col gap-1.5 text-body-regular text-text-secondary">
          <li>真实性：史料原文、人物原话与出处不编造，课本里没找到就直说。</li>
          <li>节奏：一次只聚焦一个思维任务，让问题、证据与解释逐步推进。</li>
          <li>记录：数据仅保存在本浏览器 localStorage，清除浏览器数据会丢失、换设备不同步。</li>
        </ul>
        <ButtonLink variant="primary" size="medium" href="/chat">
          开始探究
        </ButtonLink>
      </section>
    </div>
  );
}