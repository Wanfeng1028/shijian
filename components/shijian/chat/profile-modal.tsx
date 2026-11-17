'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/boardui/base/modal/modal';
import {
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@/components/boardui/base/modal/modal';
import { Select, SelectItem } from '@/components/boardui/base/select/select';
import { Input } from '@/components/boardui/base/input/input';
import { Button } from '@/components/boardui/base/buttons/button';
import type { Profile } from '@/lib/store';
import { saveProfileSkipped } from '@/lib/store';
import { GRADE_OPTIONS, PROFILE_EMPTY_OPTION, SEMESTER_OPTIONS, TEXTBOOK_OPTIONS } from '@/components/shijian/chat/task-meta';
import { cx } from '@/utils/cx';

export interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  initial: Profile | null;
  onSaved: (profile: Profile) => void;
}

export function ProfileModal({ open, onClose, initial, onSaved }: ProfileModalProps) {
  const [grade, setGrade] = useState<string>(initial?.grade ?? '');
  const [semester, setSemester] = useState<string>(initial?.semester ?? '');
  const [textbook, setTextbook] = useState<string>(initial?.textbook ?? '');
  const [progress, setProgress] = useState<string>(initial?.progress ?? '');

  useEffect(() => {
    if (open) {
      setGrade(initial?.grade ?? '');
      setSemester(initial?.semester ?? '');
      setTextbook(initial?.textbook ?? '');
      setProgress(initial?.progress ?? '');
    }
  }, [open, initial]);

  const handleSave = () => {
    onSaved({ grade, semester, textbook, progress });
    onClose();
  };

  const handleDismiss = () => {
    saveProfileSkipped(true);
    onClose();
  };

  return (
    <Modal
      isOpen={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      size="md"
      role="dialog"
      aria-label="我的学习档案"
    >
      <ModalHeader
        title="我的学习档案"
        description="填了年级和教材，史鉴才能按你的课本和进度出题。"
      />
      <ModalBody>
        <div className={cx('flex flex-col gap-5')}>
          <Select
            label="年级"
            selectedKey={grade === '' ? '' : grade}
            onSelectionChange={(key) => setGrade(key === null || key === undefined ? '' : String(key))}
          >
            <SelectItem id="">{PROFILE_EMPTY_OPTION}</SelectItem>
            {GRADE_OPTIONS.map((option) => (
              <SelectItem key={option} id={option}>
                {option}
              </SelectItem>
            ))}
          </Select>
          <Select
            label="学期"
            selectedKey={semester === '' ? '' : semester}
            onSelectionChange={(key) => setSemester(key === null || key === undefined ? '' : String(key))}
          >
            <SelectItem id="">{PROFILE_EMPTY_OPTION}</SelectItem>
            {SEMESTER_OPTIONS.map((option) => (
              <SelectItem key={option} id={option}>
                {option}
              </SelectItem>
            ))}
          </Select>
          <Select
            label="教材"
            selectedKey={textbook === '' ? '' : textbook}
            onSelectionChange={(key) => setTextbook(key === null || key === undefined ? '' : String(key))}
          >
            <SelectItem id="">{PROFILE_EMPTY_OPTION}</SelectItem>
            {TEXTBOOK_OPTIONS.map((option) => (
              <SelectItem key={option} id={option}>
                {option}
              </SelectItem>
            ))}
          </Select>
          <Input
            label="学习进度"
            placeholder="如：近代史时间线容易混淆，史料题结论表达不够简洁"
            value={progress}
            onChange={setProgress}
          />
        </div>
      </ModalBody>
      <ModalFooter>
        <div className={cx('flex w-full items-center justify-between gap-3')}>
          <Button variant="ghost" size="medium" onClick={handleDismiss}>
            先不填
          </Button>
          <div className={cx('flex items-center gap-3')}>
            <Button variant="secondary" size="medium" onClick={handleDismiss}>
              取消
            </Button>
            <Button variant="primary" size="medium" onClick={handleSave}>
              保存
            </Button>
          </div>
        </div>
      </ModalFooter>
    </Modal>
  );
}
