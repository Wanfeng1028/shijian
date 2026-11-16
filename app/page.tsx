'use client';

import { useEffect, useState } from 'react';
import { HomeHeader } from '@/components/shijian/home/home-header';
import { ShijianHero } from '@/components/shijian/home/shijian-hero';
import { ShijianHomeSections } from '@/components/shijian/home/shijian-home-sections';
import { ProfileModal } from '@/components/shijian/chat/profile-modal';
import { loadProfile, saveProfile, saveTask, type Profile } from '@/lib/store';

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
    <div className="flex min-h-dvh flex-col bg-background-full">
      <HomeHeader current="home" profile={ready ? profile : null} onOpenProfile={() => setModalOpen(true)} />
      <main className="flex flex-1 flex-col">
        <ShijianHero onStartTask={handleEntryClick} />
        <ShijianHomeSections />
      </main>
      <div className="mx-auto w-full max-w-[1276px] px-3 sm:px-6">
        <footer className="border-t border-separator-border py-6">
          <p className="text-center text-body-2-regular text-text-tertiary">史鉴 · 以人教版高中历史教材与《普通高中历史课程标准（2017年版2020年修订）》为依据</p>
        </footer>
      </div>
      <ProfileModal open={modalOpen} onClose={() => setModalOpen(false)} initial={profile} onSaved={handleProfileSaved} />
    </div>
  );
}