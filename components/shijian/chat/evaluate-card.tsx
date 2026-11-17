'use client';

import { Button } from '@/components/boardui/base/buttons/button';
import type { EvalScores } from '@/components/shijian/chat/use-shijian-chat';
import { RiCloseLine } from '@remixicon/react';
import { cx } from '@/utils/cx';

export interface EvaluateCardProps {
  scores: EvalScores | null;
  advice: string | null;
  evaluating: boolean;
  onEvaluate: () => void;
  disabled?: boolean;
  onClose?: () => void;
}

const DIMENSIONS: ReadonlyArray<{ label: string; key: keyof EvalScores }> = [
  { label: '信息提取', key: 'extraction' },
  { label: '史料辨析', key: 'analysis' },
  { label: '历史联系', key: 'connection' },
  { label: '历史解释', key: 'explanation' },
];

function formatScore(value: number | undefined | null): string {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 1 || value > 5) {
    return '—';
  }
  return String(value);
}

export function EvaluateCard({ scores, advice, evaluating, onEvaluate, onClose, disabled }: EvaluateCardProps) {
  return (
    <section
      className={cx(
        'rounded-3xl border border-border-button-default',
        'bg-background-primary-default',
        'flex flex-col gap-4 p-5'
      )}
    >
      <div className={cx('flex items-center justify-between gap-3')}>
        <h3 className={cx('text-title-3-semibold text-text-primary')}>学习反馈评价</h3>
        <div className={cx('flex items-center gap-1')}>
          {onClose ? (
            <button
              type="button"
              aria-label="关闭评价卡"
              onClick={onClose}
              className={cx(
                'flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground-icon-secondary transition-colors hover:bg-background-secondary-hover'
              )}
            >
              <RiCloseLine className={cx('size-4')} />
            </button>
          ) : null}
          <Button
            variant="primary"
            size="small"
            onClick={onEvaluate}
            disabled={evaluating || disabled}
          >
            {evaluating ? '正在生成评价…' : '生成评价'}
          </Button>
        </div>
      </div>
      <p className={cx('text-body-regular text-text-secondary')}>
        完成一次探究后，点“生成评价”让史鉴按四个维度打分（1-5 分）。
      </p>
      {evaluating ? null : scores ? (
        <>
          <div className={cx('grid grid-cols-2 gap-3 sm:grid-cols-4')}>
            {DIMENSIONS.map((dimension) => (
              <div
                key={dimension.key}
                className={cx(
                  'flex flex-col items-center gap-1 rounded-xl border border-border-button-default',
                  'bg-background-secondary-default px-3 py-3'
                )}
              >
                <span className={cx('text-caption-1-semibold text-text-secondary')}>
                  {dimension.label}
                </span>
                <span className={cx('text-title-2-medium text-text-primary')}>
                  {formatScore(scores?.[dimension.key])} / 5
                </span>
              </div>
            ))}
          </div>
          {advice ? (
            <p className={cx('text-body-regular text-text-secondary')}>
              建议：{advice}
            </p>
          ) : null}
        </>
      ) : (
        <p className={cx('text-body-regular text-text-tertiary')}>暂无评价</p>
      )}
    </section>
  );
}
