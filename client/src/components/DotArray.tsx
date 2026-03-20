import React from 'react';

interface Props {
  a: number;
  b: number;
  /** When true, the whole array fades out (pair is no longer untouched) */
  faded?: boolean;
  /** Dot size in px — default 12. Pass 8 for a compact (2/3) grid. */
  cellSize?: number;
}

/** Total grid dimension: always 10 rows × 10 columns */
const GRID_SIZE = 10;
/** Cells per block (for block-gap grouping) */
const BLOCK_SIZE = 5;

/** Pre-generated row/column indices 0–9 */
const INDICES = Array.from({ length: GRID_SIZE }, (_, i) => i);

/** Clamp a and b to [1, GRID_SIZE] so invalid props never break the layout */
const clampToGrid = (n: number) => Math.max(1, Math.min(GRID_SIZE, n));

/**
 * Visual dot-array for a multiplication pair.
 * Always renders a fixed 10×10 grid — no layout shift between problems.
 * The top-left a×b rectangle is highlighted (accent color, full opacity);
 * remaining cells are dimmed (neutral color, 35% opacity).
 * The whole component fades to 20% opacity when `faded` is true.
 */
function DotArray({ a, b, faded = false, cellSize = 12 }: Props) {
  const rows = clampToGrid(a);
  const cols = clampToGrid(b);

  const gap      = Math.max(1, Math.round(cellSize * 0.25));
  const blockGap = Math.max(2, Math.round(cellSize * 0.67));
  const radius   = Math.max(1, Math.round(cellSize * 0.17));

  return (
    <div
      className={`inline-block transition-opacity duration-1000 ${faded ? 'opacity-100' : 'opacity-90'}`}
    >
      {INDICES.map((row) => (
        <div
          key={row}
          style={{
            display: 'flex',
            gap: blockGap,
            marginBottom: row === BLOCK_SIZE - 1 ? blockGap : gap,
          }}
        >
          {/* First block: columns 0–4 */}
          <div style={{ display: 'flex', gap }}>
            {INDICES.slice(0, BLOCK_SIZE).map((col) => {
              const active = row < rows && col < cols;
              return (
                <div
                  key={col}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    borderRadius: radius,
                  }}
                  className={active ? 'bg-brand-yellow border-none' : 'bg-transparent border border-brand-yellow/60 dark:border-brand-yellow/40'}
                />
              );
            })}
          </div>
          {/* Second block: columns 5–9 */}
          <div style={{ display: 'flex', gap }}>
            {INDICES.slice(BLOCK_SIZE).map((col) => {
              const active = row < rows && col < cols;
              return (
                <div
                  key={col}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    borderRadius: radius,
                  }}
                  className={active ? 'bg-brand-yellow border-none' : 'bg-transparent border border-brand-yellow/60 dark:border-brand-yellow/40'}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default React.memo(DotArray);
