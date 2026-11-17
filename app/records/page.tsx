'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { loadRecords, clearRecords, loadProfile, saveProfile } from '@/lib/store';
import type { Profile, RecordItem } from '@/lib/store';
import { RecordsShell } from '@/components/shijian/records-shell';
import { ProfileModal } from '@/components/shijian/chat/profile-modal';

import { Select, SelectItem } from '@/components/boardui/base/select/select';

import { Button, ButtonLink } from '@/components/boardui/base/buttons/button';
import { AlertDialog } from '@/components/boardui/base/modal/modal';
import { cx } from '@/utils/cx';

const TASK_LABELS: Record<string, string> = {
  reading: '史料阅读',
  analysis: '史料辨析',
  explanation: '历史解释',
  general: '通用对话',
};

function taskLabel(task: string): string {
  return TASK_LABELS[task] ?? task;
}

function formatDate(date: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function canResume(r: RecordItem): boolean {
  return Boolean(r.id) && Array.isArray(r.messages) && r.messages.length > 0;
}

export default function RecordsPage() {
  const router = useRouter();
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);


  useEffect(() => {
    setRecords(loadRecords());
    setProfile(loadProfile());
  }, []);

  const handleProfileSaved = (next: Profile) => {
    saveProfile(next);
    setProfile(next);
  };

  const handleConfirmClear = () => {
    clearRecords();
    setRecords(loadRecords());
  };

  const filtered = filter === 'all' ? records : records.filter((r) => r.task === filter);
  const visible = filtered.toReversed();
  return (
    <RecordsShell
      title="学习记录"
      profile={profile}
      onOpenProfile={() => setProfileOpen(true)}
      actions={
        <Button
          variant="danger"
          size="medium"
          disabled={records.length === 0}
          onClick={() => setConfirmOpen(true)}
        >
          清空全部记录
        </Button>
      }
    >
      <div className="flex w-full flex-col gap-4">
        <p className="px-1 text-body-regular text-text-secondary">
          记录你的每一次史料探究。数据保存在本浏览器 localStorage，仅本浏览器有效；清除浏览器数据会丢失，换设备不同步。
        </p>


        <section className="rounded-2xl border border-border-table bg-background-primary-default pt-2 pb-3">
          <div
            className={cx(
              'flex flex-col gap-3 px-4 pb-3',
              'sm:flex-row sm:items-center sm:justify-between',
            )}
          >
            <p className="text-body-medium text-text-tertiary">
              共 <span className="text-text-primary">{filtered.length}</span> 条记录
              {filter !== 'all' && <span className="ml-1">（全部 {records.length} 条）</span>}
            </p>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select
                aria-label="按任务类型筛选"
                selectedKey={filter}
                onSelectionChange={(key) => setFilter(String(key))}
                size="sm"
                className="w-full sm:w-[180px]"
              >
                <SelectItem id="all" textValue="全部类型">全部类型</SelectItem>
                <SelectItem id="reading" textValue="史料阅读">史料阅读</SelectItem>
                <SelectItem id="analysis" textValue="史料辨析">史料辨析</SelectItem>
                <SelectItem id="explanation" textValue="历史解释">历史解释</SelectItem>
              </Select>

            </div>
          </div>

          {records.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-body-medium text-text-tertiary">暂无学习记录，先去对话页完成一次探究</p>
              <div className="mt-4 flex justify-center">
                <ButtonLink href="/chat" size="medium">去 AI 对话</ButtonLink>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-body-medium text-text-tertiary">该任务类型下暂无记录</p>
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" size="small" onClick={() => setFilter('all')}>
                  清除筛选
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto" role="region" tabIndex={0} aria-label="学习记录表">

              <div className="min-w-[720px]">
                <div className="flex border-b border-border-table px-3 py-2 text-body-2-medium text-text-tertiary">
                  <div className="w-[110px] shrink-0">日期</div>
                  <div className="flex-1 min-w-0 px-3">主题</div>
                  <div className="w-[110px] shrink-0">任务类型</div>
                  <div className="flex-[2] min-w-0 pl-3">摘要</div>
                  <div className="w-[64px] shrink-0 pl-3">操作</div>
                </div>
                {visible.map((r, i) => (
                  <div
                    key={r.id || `${r.date}-${r.topic}-${i}`}
                    role={canResume(r) ? 'button' : undefined}
                    tabIndex={canResume(r) ? 0 : undefined}
                    aria-label={canResume(r) ? `继续对话：${r.topic}` : undefined}
                    title={canResume(r) ? '点击回到对话页继续聊' : '该记录没有完整对话内容，仅可查看'}
                    onClick={canResume(r) ? () => router.push(`/chat?session=${encodeURIComponent(r.id)}`) : undefined}
                    onKeyDown={canResume(r) ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/chat?session=${encodeURIComponent(r.id)}`); } } : undefined}
                    className={cx(
                      'flex items-center border-b border-separator-border px-3 py-2.5',
                      canResume(r) && 'cursor-pointer hover:bg-background-secondary-hover',
                      i === visible.length - 1 && 'border-b-0',
                    )}
                  >
                    <div className="w-[110px] shrink-0 whitespace-nowrap text-body-medium text-text-secondary">
                      {formatDate(r.date)}
                    </div>
                    <div className="flex-1 min-w-0 truncate px-3 text-body-medium text-text-primary">
                      {r.topic}
                    </div>
                    <div className="w-[110px] shrink-0 whitespace-nowrap text-body-medium text-text-secondary">
                      {taskLabel(r.task)}
                    </div>
                    <div className="flex-[2] min-w-0 line-clamp-2 pl-3 text-body-medium text-text-secondary">
                      {r.summary}
                    </div>
                    <div className="w-[64px] shrink-0 whitespace-nowrap pl-3 text-body-medium text-accent-600">
                      {canResume(r) ? '续聊 →' : '仅查看'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        initial={profile}
        onSaved={(next) => {
          handleProfileSaved(next);
          setProfileOpen(false);
        }}
      />

      <AlertDialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="清空全部记录"
        description="确定要清空全部学习记录吗？此操作不可恢复。"
        confirmLabel="确认清空"
        cancelLabel="取消"
        variant="danger"
        onConfirm={handleConfirmClear}
      />
    </RecordsShell>
  );
}

