import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import type { Answer, ClassSprint, Classroom, ClassroomMember, Player, ProblemStat, Session } from '../module_bindings/types.js';
import ClassroomSettingsModal from '../components/classroom/ClassroomSettingsModal.js';
import ClassroomStartSprintModal from '../components/classroom/ClassroomStartSprintModal.js';
import ClassroomLiveSprintView from '../components/classroom/ClassroomLiveSprintView.js';
import ClassroomSprintReviewView from '../components/classroom/ClassroomSprintReviewView.js';
import ClassroomLobbyView from '../components/classroom/ClassroomLobbyView.js';

interface Props {
  myIdentityHex: string;
  classroomId: bigint;
  onStartSprint: (id: bigint) => void;
  onStartClassSprint: (csId: bigint) => void;
  onLeave: () => void;
}

interface ClassRecoveryResult {
  memberIdentity: { toHexString: () => string };
  teacherIdentity: { toHexString: () => string };
  classroomId: bigint;
  username: string;
  code: string;
}

export default function ClassroomPage({ myIdentityHex, classroomId, onLeave }: Props) {
  const { t } = useTranslation();
  const [classrooms]        = useTable(tables.classrooms);
  const [classroomMembers]  = useTable(tables.classroom_members);
  const [classSprints]      = useTable(tables.class_sprints);
  const [sessions]          = useTable(tables.sessions);
  const [answers]           = useTable(tables.answers);
  const [players]           = useTable(tables.players);
  const [problemStats]      = useTable(tables.problem_stats);
  // recovery_keys removed (SEC-01): private table — teachers can no longer read student recovery codes

  const leaveClassroom        = useSTDBReducer(reducers.leaveClassroom);
  const toggleVisibility      = useSTDBReducer(reducers.toggleClassroomVisibility);
  const startClassSprint      = useSTDBReducer(reducers.startClassSprint);
  const endClassSprint        = useSTDBReducer(reducers.endClassSprint);
  const getClassRecoveryCodes = useSTDBReducer(reducers.getClassRecoveryCodes);
  // Subscription not filtered server-side — rows are teacher-scoped at insert time.
  // Client filters by classroomId in the polling loop below.
  const [classRecoveryResults] = useTable(tables.class_recovery_results);
  // Ref so async polling in handleDownloadCodes always reads the latest rows
  const classRecoveryResultsRef = useRef<ClassRecoveryResult[]>([]);
  useEffect(() => {
    classRecoveryResultsRef.current = classRecoveryResults as unknown as ClassRecoveryResult[];
  }, [classRecoveryResults]);

  const [startingClassSprint, setStartingClassSprint] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [sprintError, setSprintError] = useState<string | null>(null);
  const [endingClassSprint, setEndingClassSprint] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [reviewSprintId, setReviewSprintId] = useState<bigint | null>(null);
  const prevActiveSprintId = useRef<bigint | null>(null);

  // Teacher QR card modal

  // Countdown timer for teacher's live feed view
  const [sprintTimeLeft, setSprintTimeLeft] = useState<number | null>(null);

  // Find this specific classroom
  const myClassroom = (classrooms as unknown as Classroom[]).find(c => c.id === classroomId) ?? null;
  const myMembership = (classroomMembers as unknown as ClassroomMember[]).find(
    m => m.classroomId === classroomId && m.playerIdentity.toHexString() === myIdentityHex
  );

  // Derived state — computed unconditionally so hooks below are never called after an early return.
  const isTeacher = myClassroom?.teacher.toHexString() === myIdentityHex;
  const amHidden: boolean = myMembership?.hidden ?? false;

  // ── Class sprint state ──────────────────────────────────────────────────────
  const roomSprints = (classSprints as unknown as ClassSprint[])
    .filter(s => s.classroomId === classroomId)
    .sort((a, b) => Number(b.id - a.id));
  const latestSprint = roomSprints[0] ?? null;
  const activeSprint = latestSprint?.isActive ? latestSprint : null;
  
  useEffect(() => {
    if (activeSprint) {
      prevActiveSprintId.current = activeSprint.id;
      setReviewSprintId(null);
    } else if (prevActiveSprintId.current !== null) {
      setReviewSprintId(prevActiveSprintId.current);
      prevActiveSprintId.current = null;
    }
  }, [activeSprint?.id]);

  // Sessions + answers belonging to the active/ended sprint (for live ticker + mini LB)
  const targetSprintIdStr = reviewSprintId ? String(reviewSprintId) : activeSprint ? String(activeSprint.id) : null;
  const rawSprintSessions = targetSprintIdStr
    ? (sessions as unknown as Session[]).filter(s => String(s.classSprintId) === targetSprintIdStr)
    : [];

  // Deduplicate structurally to prevent legacy DB rows from crashing React list reconcilers
  const sprintSessions = rawSprintSessions.filter((s, index, self) => 
    index === self.findIndex(t => t.playerIdentity.toHexString() === s.playerIdentity.toHexString())
  );
  const sprintSessionIdStrs = new Set<string>(sprintSessions.map(s => String(s.id)));
  const sprintAnswers = (answers as unknown as Answer[]).filter(a => sprintSessionIdStrs.has(String(a.sessionId)));

  // Last 20 answers sorted newest-first for the live ticker
  const recentAnswers = [...sprintAnswers]
    .sort((a, b) => Number(b.id - a.id))
    .slice(0, 20);

  // Mini live leaderboard (top 5) — compute score from answers, not session.weightedScore
  // (weightedScore is only written at end_session; it stays 0 during an active sprint)
  const liveLB = sprintSessions
    .map(s => {
      const p = (players as unknown as Player[]).find(pl => pl.identity.toHexString() === s.playerIdentity.toHexString());
      const mine = sprintAnswers.filter(a => String(a.sessionId) === String(s.id));
      const score = mine
        .filter(a => a.isCorrect)
        .reduce((sum, a) => {
          const key = a.a * 100 + a.b;
          const stat = (problemStats as unknown as ProblemStat[]).find(ps => ps.problemKey === key);
          return sum + (stat?.difficultyWeight ?? 1.0);
        }, 0);
      const correct = mine.filter(a => a.isCorrect).length;
      return { 
        identityHex: s.playerIdentity.toHexString(),
        username: p?.username ?? s.username, 
        score, 
        correct 
      };
    })
    .sort((a, b) => b.score - a.score);

  // True once every student session has finished — used to auto-end the sprint
  const allSessionsComplete =
    sprintSessions.length > 0 &&
    sprintSessions.every(s => s.isComplete);

  // Early exit: call end_class_sprint as soon as all online students finish,
  // rather than waiting for the server's 62 s scheduled auto-end.
  useEffect(() => {
    if (!isTeacher || !activeSprint || !allSessionsComplete) return;
    endClassSprint({ classSprintId: activeSprint.id }).catch(console.error);
  }, [allSessionsComplete, activeSprint?.id, isTeacher]); // eslint-disable-line react-hooks/exhaustive-deps
  // Offline-student deadline is handled server-side via the EndSprintSchedule table.

  // Countdown timer — ticks from server startedAt, same logic as SprintPage
  useEffect(() => {
    if (!activeSprint || !isTeacher) { setSprintTimeLeft(null); return; }
    const DURATION = 60;
    const startMs = Number(activeSprint.startedAt.microsSinceUnixEpoch / 1000n);
    const tick = () => setSprintTimeLeft(Math.max(0, DURATION - Math.floor((Date.now() - startMs) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeSprint?.id, isTeacher]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── End of class sprint state ───────────────────────────────────────────────

  if (!myClassroom) {
    return (
      <div className="loading">
        <span className="text-muted text-base">{t('classroom.notFound')}</span>
      </div>
    );
  }

  const handleStartClassSprint = async (diagnostic: boolean) => {
    setShowStartModal(false);
    setStartingClassSprint(true);
    setSprintError(null);
    try {
      await startClassSprint({ classroomId, isDiagnostic: diagnostic });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSprintError(msg);
    } finally {
      setStartingClassSprint(false);
    }
  };

  const handleEndClassSprint = async () => {
    if (!activeSprint) return;
    setEndingClassSprint(true);
    try {
      await endClassSprint({ classSprintId: activeSprint.id });
    } finally {
      setEndingClassSprint(false);
    }
  };

  // All members of this classroom
  const members = (classroomMembers as unknown as ClassroomMember[]).filter(m => m.classroomId === classroomId);
  // Visible members (included in leaderboard + mastery)
  const visibleMembers = members.filter(m => !m.hidden);
  const visibleIds = new Set(visibleMembers.map(m => m.playerIdentity.toHexString()));

  // Best weighted score per VISIBLE member (across all time)
  const bestByMember = new Map<string, number>();
  for (const s of sessions as unknown as Session[]) {
    if (!s.isComplete || !visibleIds.has(s.playerIdentity.toHexString())) continue;
    const id = s.playerIdentity.toHexString();
    if ((bestByMember.get(id) ?? 0) < s.weightedScore) {
      bestByMember.set(id, s.weightedScore);
    }
  }

  // All member rows (for the Settings Modal — shows everyone)
  const memberRows = members.map(m => {
    const id = m.playerIdentity.toHexString();
    const player = (players as unknown as Player[]).find(p => p.identity.toHexString() === id);
    return {
      id,
      username: player?.username ?? id.slice(0, 8),
      best: bestByMember.get(id),
      hidden: m.hidden as boolean,
    };
  }).sort((a, b) => (b.best ?? 0) - (a.best ?? 0));

  // Leaderboard rows — visible only, sorted by best score
  const leaderRows = memberRows.filter(m => !m.hidden && m.best !== undefined);

  // Mastery grid — only answers from visible members
  const classAnswers = (answers as unknown as Answer[]).filter(a => visibleIds.has(a.playerIdentity.toHexString()));

  const handleLeave = async () => {
    setLeaving(true);
    await leaveClassroom({ classroomId });
    onLeave();
  };

  // 1) Config & Onboarding View (Teacher Only)
  if (showSettings && isTeacher) {
    return (
      <ClassroomSettingsModal
        classroomId={classroomId}
        myClassroom={myClassroom}
        members={members}
        bestByMember={bestByMember}
        amHidden={amHidden}
        onClose={() => setShowSettings(false)}
        onLeave={() => handleLeave()}
      />
    );
  }

  // 2) Live Class Sprint View (Teacher Only)
  if (activeSprint) {
    return (
      <ClassroomLiveSprintView
        myClassroom={myClassroom}
        sprintTimeLeft={sprintTimeLeft}
        endingClassSprint={endingClassSprint}
        onEndSprint={handleEndClassSprint}
        sprintAnswers={sprintAnswers}
        problemStats={problemStats as unknown as ProblemStat[]}
        liveLB={liveLB}
        recentAnswers={recentAnswers}
        players={players as unknown as Player[]}
      />
    );
  }

  // 3) Post-Sprint Review View (Teacher Only)
  if (reviewSprintId && isTeacher) {
    return (
      <ClassroomSprintReviewView
        myClassroom={myClassroom}
        sprintAnswers={sprintAnswers}
        liveLB={liveLB}
        problemStats={problemStats as unknown as ProblemStat[]}
        onReturnToLobby={() => setReviewSprintId(null)}
      />
    );
  }

  // 4) Idle Classroom View
  return (
    <ClassroomLobbyView
      myClassroom={myClassroom}
      myIdentityHex={myIdentityHex}
      isTeacher={isTeacher}
      members={members}
      visibleMembers={visibleMembers}
      leaderRows={leaderRows}
      classAnswers={classAnswers}
      problemStats={problemStats as unknown as ProblemStat[]}
      sprintError={sprintError}
      startingClassSprint={startingClassSprint}
      leaving={leaving}
      onOpenSettings={() => setShowSettings(true)}
      onOpenStartModal={() => setShowStartModal(true)}
      onLeave={handleLeave}
    >
      {showStartModal && (
        <ClassroomStartSprintModal
          onClose={() => setShowStartModal(false)}
          onSelectType={handleStartClassSprint}
        />
      )}
    </ClassroomLobbyView>
  );
}
