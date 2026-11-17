import Link from 'next/link';
import { Paperclip, ArrowUp } from 'lucide-react';
import { TASK_META, type TaskId } from '@/components/shijian/chat/task-meta';

const PREVIEW_CONTENT: Record<TaskId, { turns: { role: 'user' | 'assistant'; text: string }[]; tagLabel: string; tags: string[] }> = {
  reading: {
    turns: [
      { role: 'user', text: '《南京条约》规定：开放广州、福州、厦门、宁波、上海五处为通商口岸。' },
      { role: 'assistant', text: '你注意到“五处”这个细节了吗？为什么偏偏是这五个港口，而不是其他地方？' },
      { role: 'user', text: '因为……它们都在沿海？方便贸易？' },
      { role: 'assistant', text: '沿海是一个角度。再看时间：1842年，清朝前期长期只开广州一口，为什么一下子开五口？这背后是什么在推动？' },
    ],
    tagLabel: '走到的阶段',
    tags: ['史料观察', '问题发现', '问题提出'],
  },
  analysis: {
    turns: [
      { role: 'user', text: '有人说“鸦片战争是中国近代史的开端”，这段说法可信吗？' },
      { role: 'assistant', text: '先别急着下结论。我们先看它是谁说的、在什么时候、为什么而说——来源、立场、价值、局限，一个一个来。' },
      { role: 'user', text: '这是教材里的结论，应该是后世史学界的共识吧？' },
      { role: 'assistant', text: '来源上它有依据：1842年之后，中国社会的主要矛盾、革命任务都变了。但也别只认一家之言，单一视角的结论需要多方史料互证。' },
    ],
    tagLabel: '辨析四问',
    tags: ['来源', '立场', '价值', '局限'],
  },
  explanation: {
    turns: [
      { role: 'user', text: '为什么会发生鸦片战争？' },
      { role: 'assistant', text: '我们按六步来。先明确问题：问的是“为什么”，要找的是原因，不是经过。' },
      { role: 'user', text: '那第一步之后呢？' },
      { role: 'assistant', text: '再梳理背景：19世纪上半期，英国工业革命后急需市场和原料，清朝却长期闭关自守。背景理清了，证据才有地方放。' },
    ],
    tagLabel: '六步结构',
    tags: ['明确问题', '梳理背景', '提取证据', '分析逻辑', '形成解释', '迁移训练'],
  },
};

export function HeroPreview({ task, onStartTask }: { task: TaskId; onStartTask: (task: TaskId) => void }) {
  const content = PREVIEW_CONTENT[task];
  const questions =
    task === 'explanation' ? TASK_META[task].quick.slice(1, 3) : TASK_META[task].quick.slice(0, 2);

  return (
    <div className="relative flex h-[480px] flex-col bg-background-secondary-default sm:h-[560px]">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 sm:px-6">
        {content.turns.map((turn, index) =>
          turn.role === 'user' ? (
            <p
              key={index}
              className="ms-auto w-fit max-w-[85%] rounded-2xl bg-background-primary-default px-3 py-[11px] text-start text-body-regular break-words whitespace-pre-wrap text-text-primary shadow-card"
            >
              {turn.text}
            </p>
          ) : (
            <div key={index} className="flex items-start gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-500 text-caption-1-semibold text-white" aria-hidden>
                史
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-caption-1-medium text-text-secondary">史鉴</p>
                <p className="mt-0.5 text-body-regular break-words text-text-primary">{turn.text}</p>
              </div>
            </div>
          ),
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2 sm:px-6">
        <span className="text-caption-1-medium text-text-tertiary">{content.tagLabel}：</span>
        {content.tags.flatMap((tag, index) =>
          index === 0
            ? [
                <span key={tag} className="rounded-full bg-background-primary-default px-2.5 py-1 text-caption-1-medium text-text-secondary">
                  {tag}
                </span>,
              ]
            : [
                <span key={`sep-${index}`} aria-hidden className="text-caption-1-medium text-text-tertiary">
                  →
                </span>,
                <span key={tag} className="rounded-full bg-background-primary-default px-2.5 py-1 text-caption-1-medium text-text-secondary">
                  {tag}
                </span>,
              ],
        )}
      </div>
      <ul className="flex flex-col gap-2 px-4 pb-4 sm:px-6">
        {questions.map((question) => (
          <li key={question}>
            <Link
              href={`/chat?task=${task}`}
              onClick={() => onStartTask(task)}
              className="block w-fit rounded-full bg-background-primary-default px-3.5 py-2 text-body-regular text-text-primary shadow-xs outline-none transition-colors hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
            >
              {question}
            </Link>
          </li>
        ))}
      </ul>
      <div
        aria-hidden="true"
        className="pointer-events-none mx-4 mb-4 flex h-[52px] shrink-0 items-center gap-2.5 rounded-full bg-background-primary-default px-2 shadow-xs sm:mx-6"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ai-chat-composer-add-background text-foreground-icon-primary">
          <Paperclip className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate text-body-regular text-text-tertiary">输入你的观察或问题…</span>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-button-primary text-white opacity-40">
          <ArrowUp className="size-5" aria-hidden />
        </span>
      </div>
    </div>
  );
}