import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import type { Classroom, Player } from '../module_bindings/types.js';
import PageContainer from '../components/PageContainer.js';
import { PlayIcon, ProgressIcon, FriendsIcon, ClassesIcon, Swosh, TestLevelIcon, LobbyIcon } from '../components/Icons.js';
import NetworkLeaderboard from '../components/NetworkLeaderboard.js';
import { computeProficiency, relevantKCsForTier, KC_TRIVIAL } from '../utils/kcProficiency.js';
import type { KcProficiency } from '../utils/kcProficiency.js';
import type { Answer } from '../module_bindings/types.js';

const TIER_EMOJI = ['🌱', '🔨', '⚡', '🎯', '🔥', '💫', '🌟', '🏆'];



interface Props {
  myPlayer: Player | undefined;
  myIdentityHex: string | undefined;
  onStartSprint: (sessionId: bigint) => void;
  onRetakeDiagnostic: () => void;
  onEnterClassroom: (id: bigint) => void;
  onGoToAccount: () => void;
}

export default function LobbyPage({ myPlayer, myIdentityHex, onStartSprint, onRetakeDiagnostic, onEnterClassroom, onGoToAccount: _onGoToAccount }: Props) {
  const { t } = useTranslation();
  const [classrooms] = useTable(tables.my_classrooms);
  const [_classroomMembers] = useTable(tables.my_classroom_members);
  const [answers] = useTable(tables.my_answers);
  const joinClassroom = useSTDBReducer(reducers.joinClassroom);

  const myAnswers = useMemo(
    () => (answers as unknown as Answer[])?.filter(a => myIdentityHex && a.playerIdentity.toHexString() === myIdentityHex) ?? [],
    [answers, myIdentityHex]
  );

  const proficiencies = useMemo(
    () => myPlayer ? computeProficiency(myAnswers, relevantKCsForTier(myPlayer.learningTier ?? 0)) : [],
    [myAnswers, myPlayer?.learningTier]
  );


  const [starting, setStarting] = useState(false);
  // Pending auto-join code from ?join=CODE URL param; cleared once we navigate
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null);

  // Auto-join from ?join=CODE URL param (QR code scan).
  // Step 1: detect the code and fire the reducer.
  useEffect(() => {
    if (!myPlayer) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('join');
    if (!code) return;
    window.history.replaceState({}, '', '/');   // clean the URL immediately
    const upperCode = code.trim().toUpperCase();
    setPendingJoinCode(upperCode);
    joinClassroom({ code: upperCode }).catch(() => setPendingJoinCode(null));
  }, [myPlayer?.identity]); // eslint-disable-line react-hooks/exhaustive-deps

  // Step 2: navigate once the classrooms subscription delivers the joined classroom.
  // (classrooms may be empty when Step 1 fires — SpacetimeDB subscription catches up asynchronously)
  useEffect(() => {
    if (!pendingJoinCode) return;
    const classroom = (classrooms as unknown as Classroom[]).find(c => c.code === pendingJoinCode);
    if (classroom) {
      setPendingJoinCode(null);
      onEnterClassroom(classroom.id);
    }
  }, [pendingJoinCode, classrooms]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartSprint = () => {
    setStarting(true);
    onStartSprint(0n); // SprintPage owns session creation on mount
  };

  return (
    <PageContainer className="pb-[100px] sm:pb-[140px]">


      {myPlayer && (() => {
        const tier = myPlayer.learningTier ?? 0;
        const isMaxTier = tier >= 7;
        const tierEmoji = TIER_EMOJI[Math.min(tier, 7)];
        const tierName = t(`tiers.tier${tier}Name` as ParseKeys);

        const withData = proficiencies.filter((p: KcProficiency) => p.classification !== 'untouched');
        const untouched = proficiencies.filter((p: KcProficiency) => p.classification === 'untouched' && !KC_TRIVIAL.has(p.kcIndex));
        const allFluent = proficiencies.length > 0 && proficiencies.every((p: KcProficiency) => p.classification === 'fluent' || KC_TRIVIAL.has(p.kcIndex));

        const focus: KcProficiency | undefined =
          withData.filter((p: KcProficiency) => p.classification === 'struggling').sort((a: KcProficiency, b: KcProficiency) => a.accuracy - b.accuracy)[0]
          ?? withData.filter((p: KcProficiency) => p.classification === 'developing').sort((a: KcProficiency, b: KcProficiency) => a.accuracy - b.accuracy)[0]
          ?? untouched[0];

        // Mission text: what should the player do next?
        const missionText = allFluent && !isMaxTier
          ? t(`tiers.nextUnlock${tier}` as ParseKeys)
          : allFluent && isMaxTier
            ? t('tiers.allUnlocked' as ParseKeys)
            : focus
              ? focus.classification === 'untouched'
                ? t('lobby.focusNew' as ParseKeys, { kc: t(focus.nameKey as ParseKeys) })
                : t('lobby.focusPractice' as ParseKeys, { kc: t(focus.nameKey as ParseKeys), accuracy: Math.round(focus.accuracy * 100) })
              : t(`tiers.nextUnlock${tier}` as ParseKeys);

        return (
          <>
            {/* ── Greeting ── */}
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mt-2 flex items-center gap-3 relative">
              <div className="flex h-[1.3em] w-[1.3em] shrink-0 items-center justify-center rounded-2xl bg-white border border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700">
                <LobbyIcon className="scale-110" />
              </div>
              <span className="relative z-10">
                {t('lobby.welcomeBack', { defaultValue: 'Welcome back,' })} <span className="relative z-10 inline-block text-brand-yellow-hover pr-1">{myPlayer.username}<Swosh className="absolute w-[105%] h-[0.35em] -bottom-1 -left-[2.5%] text-brand-yellow/40 z-[-1]" /></span>! 👋
              </span>
            </h1>

            {/* ── Card 2: Mission + Sprint CTA ── */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <span className="text-3xl mt-0.5">{tierEmoji}</span>
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    {tierName} · {t('tiers.statusLevel' as ParseKeys, { tier: tier + 1 })}
                  </span>
                  <span className="text-[15px] font-bold text-slate-800 dark:text-slate-100 leading-snug">
                    {missionText}
                  </span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full pt-1">
                <button
                  className={`group flex items-center justify-center gap-2 sm:flex-[2] rounded-[18px] bg-brand-yellow py-4 px-6 text-[16px] font-black tracking-wide text-slate-900 transition-all active:scale-[0.97] ${starting ? 'opacity-70 cursor-default' : 'hover:bg-brand-yellow-hover shadow-sm hover:shadow-[0_8px_30px_rgba(250,204,21,0.4)]'}`}
                  onClick={handleStartSprint}
                  disabled={starting}
                >
                  <PlayIcon className={`h-6 w-6 transition-transform ${starting ? '' : 'group-hover:scale-110'}`} />
                  {starting ? t('lobby.starting') : t('progress.startSprint', { defaultValue: 'Start Sprint' })}
                </button>
                <button
                  onClick={onRetakeDiagnostic}
                  title={t('tierPicker.testMyLevel')}
                  className="sm:flex-[1] rounded-[18px] bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 py-4 px-4 text-[15px] font-bold text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.98] flex items-center justify-center gap-2 group shadow-sm min-w-[50px] whitespace-nowrap overflow-hidden"
                >
                  <TestLevelIcon className="h-5 w-5 scale-110 transition-transform group-hover:scale-[1.2]" />
                  <span>{t('tierPicker.testMyLevel')}</span>
                </button>
              </div>
            </div>

            {/* ── Directory Links ── */}
            <div className="flex flex-col gap-3">
              <a
                href="/progress"
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 flex items-center gap-4 no-underline transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 group"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-900/50 transition-colors group-hover:bg-brand-yellow/10">
                  <ProgressIcon className="scale-125 transition-transform group-hover:scale-[1.4]" />
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-[15px] font-black text-slate-800 dark:text-slate-100">
                    {t('nav.progress', { defaultValue: 'Your Learning Profile' })}
                  </span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t('lobby.progressProfileDesc', { defaultValue: 'View your mastery grid and learning insights.' })}
                  </span>
                </div>
              </a>

              {myIdentityHex && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href="/friends"
                    className="flex-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 flex items-center gap-4 no-underline transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 group"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-900/50 transition-colors group-hover:bg-brand-yellow/10">
                      <FriendsIcon className="scale-110 transition-transform group-hover:scale-125" />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm font-black text-slate-800 dark:text-slate-100">{t('lobby.friendsTitle' as ParseKeys)}</span>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{t('lobby.friendsDesc' as ParseKeys)}</span>
                    </div>
                  </a>
                  <a
                    href="/classrooms"
                    className="flex-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 flex items-center gap-4 no-underline transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 group"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-900/50 transition-colors group-hover:bg-brand-yellow/10">
                      <ClassesIcon className="scale-110 transition-transform group-hover:scale-125" />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm font-black text-slate-800 dark:text-slate-100">{t('lobby.classesTitle' as ParseKeys)}</span>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{t('lobby.classesDesc' as ParseKeys)}</span>
                    </div>
                  </a>
                </div>
              )}
            </div>

            {/* ── Community Leaderboard ── */}
            {myIdentityHex && (
              <NetworkLeaderboard myIdentityHex={myIdentityHex} />
            )}
          </>
        );
      })()}
    </PageContainer>
  );
}
