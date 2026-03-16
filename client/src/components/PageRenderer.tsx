import type { MutableRefObject } from 'react';
import type { Page } from '../navigation.js';
import RegisterPage from '../pages/RegisterPage.js';
import LobbyPage from '../pages/LobbyPage.js';
import ProgressPage from '../pages/ProgressPage.js';
import SprintPage from '../pages/SprintPage.js';
import ResultsPage from '../pages/ResultsPage.js';
import AccountPage from '../pages/AccountPage.js';
import ClassroomPage from '../pages/ClassroomPage.js';
import ClassroomsPage from '../pages/ClassroomsPage.js';
import ClassSprintResultsPage from '../pages/ClassSprintResultsPage.js';

type Player = {
  identity: { toHexString(): string };
  username: string;
  bestScore: number;
  totalSessions: number;
  learningTier: number;
  recoveryEmailed?: boolean;
  onboardingDone?: boolean;
  extendedMode: boolean;
};

interface Props {
  page: Page;
  myPlayer: Player | undefined;
  myIdentityHex: string | undefined;
  sessionId: bigint | null;
  classroomId: bigint | null;
  sprintOrigin: 'lobby' | 'classroom';
  activeClassSprintId: bigint | null;
  tierAtSprintStartRef: MutableRefObject<number>;
  inClassroom: boolean;
  showBottomNav: boolean;
  onStartSprint: (id: bigint, origin: 'lobby' | 'classroom') => void;
  onEnterClassroom: (id: bigint) => void;
  onGoToAccount: () => void;
  setPage: (page: Page) => void;
  setSessionId: (id: bigint | null) => void;
  setActiveClassSprintId: (id: bigint | null) => void;
  navigate: (page: Page, hash?: string) => void;
}

export default function PageRenderer({
  page,
  myPlayer,
  myIdentityHex,
  sessionId,
  classroomId,
  sprintOrigin,
  activeClassSprintId,
  tierAtSprintStartRef,
  inClassroom,
  showBottomNav,
  onStartSprint,
  onEnterClassroom,
  onGoToAccount,
  setPage,
  setSessionId,
  setActiveClassSprintId,
  navigate,
}: Props) {
  return (
    <main className={`content-area${showBottomNav ? ' has-bottom-nav' : ''}`}>
      {page === 'register' && <RegisterPage onRegistered={() => {
        // Preserve ?join=CODE so LobbyPage can auto-join after new-user registration
        const search = window.location.search;
        window.history.pushState(null, '', search ? `/${search}` : '/');
        setPage('lobby');
      }} />}
      {page === 'lobby' && (
        <LobbyPage
          myPlayer={myPlayer}
          myIdentityHex={myIdentityHex}
          onStartSprint={(id) => onStartSprint(id, 'lobby')}
          onEnterClassroom={onEnterClassroom}
          onGoToAccount={onGoToAccount}
        />
      )}
      {page === 'classrooms' && (
        <ClassroomsPage
          myIdentityHex={myIdentityHex}
          onEnterClassroom={onEnterClassroom}
        />
      )}
      {page === 'progress' && myIdentityHex && (
        <ProgressPage
          myIdentityHex={myIdentityHex}
          playerLearningTier={myPlayer?.learningTier ?? 0}
          extendedMode={myPlayer?.extendedMode ?? false}
        />
      )}
      {page === 'classroom' && (
        <ClassroomPage
          myIdentityHex={myIdentityHex!}
          classroomId={classroomId!}
          onStartSprint={(id) => onStartSprint(id, 'classroom')}
          onStartClassSprint={(csId) => {
            setActiveClassSprintId(csId);
            navigate('classsprintresults');
          }}
          onLeave={() => navigate('lobby')}
        />
      )}
      {page === 'sprint' && (
        <SprintPage
          myIdentityHex={myIdentityHex!}
          classSprintId={activeClassSprintId ?? undefined}
          onFinished={(id) => {
            setSessionId(id);
            if (activeClassSprintId !== null) {
              navigate('classsprintresults');
            } else {
              navigate('results');
            }
          }}
        />
      )}
      {page === 'results' && (
        <ResultsPage
          sessionId={sessionId!}
          myIdentityHex={myIdentityHex!}
          playerLearningTier={myPlayer?.learningTier ?? 0}
          newlyUnlockedTier={
            // eslint-disable-next-line react-hooks/refs
            (myPlayer?.learningTier ?? 0) > tierAtSprintStartRef.current
              ? myPlayer!.learningTier
              : undefined
          }
          onNextSprint={() => {
            tierAtSprintStartRef.current = myPlayer?.learningTier ?? 0;
            navigate('sprint');
          }}
          onBack={() => navigate(inClassroom ? 'classroom' : sprintOrigin as Page)}
        />
      )}
      {page === 'account' && (
        <AccountPage
          myPlayer={myPlayer!}
          myIdentityHex={myIdentityHex!}
          onBack={() => navigate('lobby')}
        />
      )}
      {page === 'classsprintresults' && activeClassSprintId !== null && (
        <ClassSprintResultsPage
          classSprintId={activeClassSprintId}
          myIdentityHex={myIdentityHex!}
          onBack={() => {
            setActiveClassSprintId(null);
            navigate('classroom');
          }}
        />
      )}
    </main>
  );
}
