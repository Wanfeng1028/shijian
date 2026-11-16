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
import { cx } from '@/utils/cx';

export interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  initial: Profile | null;
  onSaved: (profile: Profile) => void;
}

const GRADE_OPTIONS = ['高一', '高二', '高三'];
const SEMESTER_OPTIONS = ['上学期', '下学期'];
const TEXTBOOK_OPTIONS = [
  '《中外历史纲要（上）》',
  '《中外历史纲要（下）》',
  '选必一《国家制度与社会治理》',
  '选必二《经济与社会生活》',
  '选必三《文化交流与传播》',
];

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
        description="完善档案后，史鉴会尽量按你的学习阶段与教材版本调整提问和解释方式。"
      />
      <ModalBody>
        <div className={cx('flex flex-col gap-5')}>
          <Select
            label="年级"
            selectedKey={grade === '' ? '' : grade}
            onSelectionChange={(key) => setGrade(key == null ? '' : String(key))}
          >
            <SelectItem id="">请选择</SelectItem>
            {GRADE_OPTIONS.map((option) => (
              <SelectItem key={option} id={option}>
                {option}
              </SelectItem>
            ))}
          </Select>
          <Select
            label="学期"
            selectedKey={semester === '' ? '' : semester}
            onSelectionChange={(key) => setSemester(key == null ? '' : String(key))}
          >
            <SelectItem id="">请选择</SelectItem>
            {SEMESTER_OPTIONS.map((option) => (
              <SelectItem key={option} id={option}>
                {option}
              </SelectItem>
            ))}
          </Select>
          <Select
            label="教材"
            selectedKey={textbook === '' ? '' : textbook}
            onSelectionChange={(key) => setTextbook(key == null ? '' : String(key))}
          >
            <SelectItem id="">请选择</SelectItem>
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
        <div className={cx('flex w-full items-center justify-end gap-3')}>
          <Button variant="secondary" size="medium" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" size="medium" onClick={handleSave}>
            保存
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}
