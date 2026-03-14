import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import { useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings/index.js';
import type { ProblemStat } from '../module_bindings/types.js';
import { getRechenweg } from '../utils/rechenwege.js';
import MasteryGrid from '../components/MasteryGrid.js';

type Session = {
  id: bigint; playerIdentity: { toHexString(): string };
  weightedScore: number; rawScore: number; accuracyPct: number;
  totalAnswered: number; isComplete: boolean;
};
type Answer = {
  id: bigint; playerIdentity: { toHexString(): string }; sessionId: bigint;
  a: number; b: number; isCorrect: boolean; responseMs: number;
};

interface Props {
  sessionId: bigint;
  myIdentityHex: string;
  playerLearningTier?: number;
  newlyUnlockedTier?: number;
  onNextSprint?: () => void;
  onBack: () => void;
}

export default function ResultsPage({ sessionId, myIdentityHex, playerLearningTier = 0, newlyUnlockedTier, onNextSprint, onBack }: Props) {
  const { t } = useTranslation();
  const [sessions] = useTable(tables.sessions);
  const [allAnswers] = useTable(tables.answers);
  const [problemStats] = useTable(tables.problem_stats);
  const session = sessions.find(s => (s as Session).id === sessionId) as Session | undefined;
  const myAnswers = allAnswers.filter(a => a.playerIdentity.toHexString() === myIdentityHex) as Answer[];
  const sessionAnswers = myAnswers.filter(a => a.sessionId === sessionId);

  // Rank in leaderboard
  const completedSessions = sessions.filter(s => (s as Session).isComplete) as Session[];
  const sorted = [...completedSessions].sort((a, b) => b.weightedScore - a.weightedScore);
  const myRank = sorted.findIndex(s => s.id === sessionId) + 1;

  // Top 3 hardest pairs this session (wrong answers by difficulty weight)
  const wrongPairs = sessionAnswers
    .filter(ans => !ans.isCorrect)
    .map(ans => ({
      key: `${ans.a}×${ans.b}`,
      a: ans.a, b: ans.b,
      weight: (problemStats as ProblemStat[]).find(s => s.problemKey === ans.a * 100 + ans.b)?.difficultyWeight ?? 1,
    }));
  const uniqueHard = [...new Map(wrongPairs.map(p => [p.key, p])).values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [gridFocus, setGridFocus] = useState<{ a: number; b: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const isComplete = session?.isComplete ?? false;

  return (
    <div className="page" style={{ alignItems: 'center' }}>
      <div className="text-center" style={{ paddingTop: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 4 }}>🏁</div>
        <h1>{t('results.heading')}</h1>
      </div>

      {/* Tier-up unlock toast */}
      {newlyUnlockedTier !== undefined && (
        <div className="card w-full text-center" style={{ border: '1px solid var(--accent)' }}>
          <div style={{ fontSize: 32 }}>🎉</div>
          <h2 className="text-accent" style={{ margin: '8px 0 4px' }}>
            {t(`tiers.unlocked${newlyUnlockedTier}` as ParseKeys)}
          </h2>
          <p className="text-sm text-muted" style={{ margin: '0 0 10px' }}>
            {t(`tiers.unlockedDesc${newlyUnlockedTier}` as ParseKeys)}
          </p>
          <a href="/progress#tier-status" className="text-sm text-accent fw-semibold" style={{ textDecoration: 'none' }}>
            {t('results.viewProgress')} →
          </a>
        </div>
      )}

      {/* Score card */}
      <div className="card w-full text-center">
        {!isComplete ? (
          <p className="text-muted">{t('results.finalizing')}</p>
        ) : (
          <>
            <div className="text-warn fw-extrabold" style={{
              fontSize: 72,
              lineHeight: 1,
              marginBottom: 8,
            }}>
              {session!.weightedScore.toFixed(1)}
            </div>
            <p className="text-muted text-base">{t('results.weightedScore')}</p>
            <a
              href="/progress#scoring-guide"
              className="text-sm text-muted"
              style={{ textDecoration: 'none', marginTop: 2, display: 'inline-block' }}
            >
              {t('results.scoringExplained')} →
            </a>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 16,
              marginTop: 24,
              padding: '20px 0',
              borderTop: '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
            }}>
              <Stat label={t('results.correct')} value={`${session!.rawScore} / ${session!.totalAnswered}`} />
              <Stat label={t('results.accuracy')} value={`${session!.accuracyPct}%`} />
              <Stat label={t('results.rank')} value={myRank ? `#${myRank}` : '—'} accent />
            </div>

            {uniqueHard.length > 0 && (
              <div style={{ marginTop: 20, textAlign: 'left' }}>
                <h3 className="mb-3">{t('results.struggled')}</h3>
                <div className="col gap-6">
                  {uniqueHard.map(p => {
                    const rw = getRechenweg(p.a, p.b);
                    const isOpen = expandedKey === p.key;
                    return (
                      <div key={p.key}>
                        <button
                          onClick={() => {
                            setExpandedKey(isOpen ? null : p.key);
                            setGridFocus({ a: p.a, b: p.b });
                            setTimeout(() => gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '2px 0', width: '100%', textAlign: 'left',
                          }}
                        >
                          <span className="tag tag-red" style={{ fontSize: 14, padding: '4px 12px' }}>
                            {p.key} = {p.a * p.b}
                          </span>
                          <span className="text-muted" style={{ fontSize: 12 }}>
                            {isOpen ? '▲' : '▼'}
                          </span>
                        </button>
                        {isOpen && (
                          <div style={{
                            background: 'var(--card2)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            padding: '10px 14px',
                            marginTop: 4,
                          }}>
                            <div className="text-xs text-muted fw-semibold mb-1" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {t(rw.strategyKey as ParseKeys)}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              {rw.steps.map((step, i) => (
                                <div key={i} style={{
                                  fontSize: 15,
                                  fontVariantNumeric: 'tabular-nums',
                                  fontWeight: i === rw.steps.length - 1 ? 700 : 400,
                                  color: i === rw.steps.length - 1 ? 'var(--accent)' : 'var(--text)',
                                }}>
                                  {step}{i === rw.steps.length - 1 ? ' ✓' : ''}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-muted" style={{ fontSize: 12, marginTop: 10 }}>
                  {t('results.struggledHint')}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Next Sprint CTA */}
      {onNextSprint && (
        <button
          onClick={onNextSprint}
          style={{
            width: '100%',
            padding: '18px 0',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 14,
            color: '#2C3E50',
            fontSize: 20,
            fontWeight: 900,
            cursor: 'pointer',
            boxShadow: '0 6px 28px rgba(251,186,0,0.4)',
            letterSpacing: '-0.5px',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {t('results.nextSprint')}
        </button>
      )}

      {/* Mastery grid */}
      {myAnswers.length > 0 && (
        <div ref={gridRef} className="card w-full">
          <h2 className="mb-1">{t('results.masteryTitle')}</h2>
          <p className="text-sm text-muted mb-4">
            {t('results.masteryDesc')}
          </p>
          <MasteryGrid
            answers={myAnswers}
            problemStats={problemStats as ProblemStat[]}
            highlightSession={sessionId}
            sessionAnswers={sessionAnswers}
            tier1Unlocked={playerLearningTier >= 3}
            playerLearningTier={playerLearningTier}
            focusCell={gridFocus}
          />
        </div>
      )}

      <button className="btn btn-secondary w-full text-base" onClick={onBack} style={{ maxWidth: 320 }}>
        {t('results.backToLobby')}
      </button>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div style={{
        fontSize: 28,
        fontWeight: 700,
        color: accent ? 'var(--accent)' : 'var(--text)',
      }}>{value}</div>
      <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>{label}</div>
    </div>
  );
}
