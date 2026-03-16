interface Props {
  a: number;
  b: number;
  /** When true, the whole array fades out (pair is no longer untouched) */
  faded?: boolean;
}

/** Total grid dimension: always 10 rows × 10 columns */
const GRID_SIZE = 10;
/** Cells per block (for block-gap grouping) */
const BLOCK_SIZE = 5;
/** Dot size in px */
const CELL_SIZE = 12;
/** Gap between dots within a block */
const CELL_GAP = 3;
/** Gap between the two 5-cell blocks */
const BLOCK_GAP = 8;

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
export default function DotArray({ a, b, faded = false }: Props) {
  const rows = clampToGrid(a);
  const cols = clampToGrid(b);

  return (
    <div
      className="mb-3"
      style={{
        opacity: faded ? 1 : 0.9,
        transition: 'opacity 1s',
        display: 'inline-block',
      }}
    >
      {INDICES.map((row) => (
        <div
          key={row}
          style={{
            display: 'flex',
            gap: BLOCK_GAP,
            marginBottom: row === BLOCK_SIZE - 1 ? BLOCK_GAP : CELL_GAP,
          }}
        >
          {/* First block: columns 0–4 */}
          <div style={{ display: 'flex', gap: CELL_GAP }}>
            {INDICES.slice(0, BLOCK_SIZE).map((col) => (
              <div
                key={col}
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  borderRadius: 2,
                  backgroundColor: row < rows && col < cols ? 'var(--accent)' : "transparent",
                  border: row < rows && col < cols ? 'none' : "1px solid var(--accent)",
                  opacity: 1,
                }}
              />
            ))}
          </div>
          {/* Second block: columns 5–9 */}
          <div style={{ display: 'flex', gap: CELL_GAP }}>
            {INDICES.slice(BLOCK_SIZE).map((col) => (
              <div
                key={col}
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  borderRadius: 2,
                  backgroundColor: row < rows && col < cols ? 'var(--accent)' : "transparent",
                  border: row < rows && col < cols ? 'none' : "1px solid var(--accent)",
                  opacity: 1,
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
