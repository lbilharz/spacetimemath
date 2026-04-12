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

import { APP_LANGUAGES } from '../components/LanguagePicker.js';
import { TIER_EMOJI } from '../utils/learningTier.js';
import type { Page } from '../navigation.js';
import PartyOverlay from '../components/PartyOverlay.js';


interface Props {
  myPlayer: Player | undefined;
  myIdentityHex: string | undefined;
  onStartSprint: (sessionId: bigint) => void;
  onRetakeDiagnostic: () => void;
  onEnterClassroom: (id: bigint) => void;
  onGoToAccount: () => void;
  navigate: (page: Page, hash?: string) => void;
}

export default function LobbyPage({ myPlayer, myIdentityHex, onStartSprint, onRetakeDiagnostic, onEnterClassroom, onGoToAccount: _onGoToAccount, navigate }: Props) {
  const { t, i18n } = useTranslation();
  const [greeting] = useState(() => APP_LANGUAGES[Math.floor(Math.random() * APP_LANGUAGES.length)]);
  const isSameLang = i18n.language.startsWith(greeting.code);
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

  // Inline forms state
  const [activeJoin, setActiveJoin] = useState<'class' | 'friend' | null>(null);
  const [joinInput, setJoinInput] = useState('');
  const [joining, setJoining] = useState(false);
  const acceptFriendInvite = useSTDBReducer(reducers.acceptFriendInvite);

  const handleInlineJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinInput || joinInput.length < 4 || !myIdentityHex) return;
    setJoining(true);
    const code = joinInput.trim().toUpperCase();
    try {
      if (activeJoin === 'class') {
        await joinClassroom({ code });
        setPendingJoinCode(code); // Will auto-redirect once the classroom row arrives
      } else {
        await acceptFriendInvite({ token: code });
        setJoinInput('');
        setActiveJoin(null);
        navigate('friends'); // Move to friends page to see the invite
      }
    } catch {
       // fallback silently on error for now or just reset
    } finally {
      setJoining(false);
    }
  };

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
  const [successClassroom, setSuccessClassroom] = useState<Classroom | null>(null);

  useEffect(() => {
    if (!pendingJoinCode) return;
    const classroom = (classrooms as unknown as Classroom[]).find(c => c.code === pendingJoinCode);
    if (classroom) {
      setPendingJoinCode(null);
      setSuccessClassroom(classroom);
      
      // Celebrate for 2 seconds, then transition to classroom
      setTimeout(() => {
        setSuccessClassroom(null);
        onEnterClassroom(classroom.id);
      }, 2500);
    }
  }, [pendingJoinCode, classrooms]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartSprint = () => {
    setStarting(true);
    onStartSprint(0n); // SprintPage owns session creation on mount
  };

  return (
    <PageContainer className="pb-[100px] sm:pb-[140px]">

      {/* ── PARTY OVERLAY ── */}
      {successClassroom && (
        <PartyOverlay
          icon="🏫"
          message={`${t('classes.joinedSuccess', { defaultValue: 'You joined the class' })} \`${successClassroom.name}\`!`}
          subMessage={t('common.loading', { defaultValue: 'Loading...' })}
          onClick={() => { setSuccessClassroom(null); onEnterClassroom(successClassroom.id); }}
        />
      )}

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
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mt-2 flex items-start gap-4 relative">
              <div className="flex h-[1.3em] w-[1.3em] shrink-0 items-center justify-center rounded-2xl bg-white border border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700">
                <LobbyIcon className="scale-110" />
              </div>
              <span className="relative z-10 flex flex-col gap-1.5 pt-0.5">
                <span className="flex items-center flex-wrap leading-tight">
                  {greeting.greeting},&nbsp;<span className="whitespace-nowrap"><span className="relative z-10 inline-block text-brand-yellow-hover pr-1">{myPlayer.username}<Swosh className="absolute w-[105%] h-[0.35em] -bottom-1 -left-[2.5%] text-brand-yellow/40 z-[-1]" /></span>! 👋</span>
                </span>
                {!isSameLang && (
                  <span className="text-sm font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5 opacity-90 transition-opacity hover:opacity-100">
                    <span className="text-base leading-none -mt-px">{greeting.flag}</span> 
                    <span className="leading-none">{
                      (() => {
                        try {
                          const langStr = new Intl.DisplayNames([i18n.language], { type: 'language' }).of(greeting.code) || greeting.code;
                          return langStr.charAt(0).toUpperCase() + langStr.slice(1);
                        } catch {
                          return greeting.code.toUpperCase();
                        }
                      })()
                    }</span> 
                    <span className="opacity-40 text-[11px] mx-0.5 uppercase tracking-widest font-black">➔</span> 
                    <span className="leading-none text-slate-500 dark:text-slate-400">{t('lobby.welcomeBack', { defaultValue: 'Welcome back,' }).replace(/,$/, '')}</span>
                  </span>
                )}
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
                  data-testid="start-sprint-button"
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
                  
                  {activeJoin === 'friend' ? (
                     <form onSubmit={handleInlineJoin} className="flex-1 rounded-2xl border border-brand-yellow bg-brand-yellow/5 p-4 shadow-sm flex flex-col gap-3 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-black text-slate-800 dark:text-slate-100">{t('friends.addFriend', { defaultValue: 'Add Friend' })}</span>
                          <a href="/friends" className="text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors">{t('common.viewAll')} ➔</a>
                        </div>
                        <div className="flex gap-2">
                           <input 
                             type="text" 
                             placeholder={t('common.6digitCode', { defaultValue: '6-DIGIT CODE' })} 
                             maxLength={6}
                             value={joinInput}
                             onChange={e => setJoinInput(e.target.value.toUpperCase())}
                             className="flex-1 w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-black tracking-widest text-center uppercase focus:border-brand-yellow focus:outline-none"
                             autoFocus
                           />
                           <button type="submit" disabled={joining || joinInput.length < 4} className="bg-brand-yellow text-slate-900 font-black px-4 rounded-xl hover:bg-yellow-400 disabled:opacity-50">➔</button>
                        </div>
                     </form>
                  ) : (
                    <button
                      onClick={() => { setActiveJoin('friend'); setJoinInput(''); }}
                      className="flex-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 flex items-center gap-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 group text-left cursor-pointer"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-900/50 transition-colors group-hover:bg-brand-yellow/10">
                        <FriendsIcon className="scale-110 transition-transform group-hover:scale-125" />
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-sm font-black text-slate-800 dark:text-slate-100">{t('lobby.friendsTitle' as ParseKeys)}</span>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{t('lobby.friendsDesc' as ParseKeys)}</span>
                      </div>
                    </button>
                  )}

                  {activeJoin === 'class' ? (
                     <form onSubmit={handleInlineJoin} className="flex-1 rounded-2xl border border-brand-yellow bg-brand-yellow/5 p-4 shadow-sm flex flex-col gap-3 animate-in zoom-in-95 duration-200">
                         <div className="flex items-center justify-between">
                          <span className="text-sm font-black text-slate-800 dark:text-slate-100">{t('classes.joinButton', { defaultValue: 'Join Class' })}</span>
                          <a href="/classrooms" className="text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors">{t('common.viewAll')} ➔</a>
                        </div>
                        <div className="flex gap-2">
                           <input 
                             type="text" 
                             placeholder={t('common.6digitCode', { defaultValue: '6-DIGIT CODE' })} 
                             maxLength={6}
                             value={joinInput}
                             onChange={e => setJoinInput(e.target.value.toUpperCase())}
                             className="flex-1 w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-black tracking-widest text-center uppercase focus:border-brand-yellow focus:outline-none"
                             autoFocus
                           />
                           <button type="submit" disabled={joining || joinInput.length < 4} className="bg-brand-yellow text-slate-900 font-black px-4 rounded-xl hover:bg-yellow-400 disabled:opacity-50">➔</button>
                        </div>
                     </form>
                  ) : (
                    <button
                      onClick={() => { setActiveJoin('class'); setJoinInput(''); }}
                      className="flex-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 flex items-center gap-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 group text-left cursor-pointer"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-900/50 transition-colors group-hover:bg-brand-yellow/10">
                        <ClassesIcon className="scale-110 transition-transform group-hover:scale-125" />
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-sm font-black text-slate-800 dark:text-slate-100">{t('lobby.classesTitle' as ParseKeys)}</span>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{t('lobby.classesDesc' as ParseKeys)}</span>
                      </div>
                    </button>
                  )}
                  
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
