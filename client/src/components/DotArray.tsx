interface Props {
  a: number;
  b: number;
  /** When true, the whole array fades out (pair is no longer untouched) */
  faded?: boolean;
}

/**
 * Visual dot-array for a multiplication pair.
 * Arranged as `a` rows × `b` columns.
 * Columns beyond the 5th are rendered at 35% opacity to show grouping.
 * The whole component fades to 20% opacity once `faded` is true.
 */
export default function DotArray({ a, b, faded = false }: Props) {
  return (
    <div
      className="mb-3"
      style={{
        opacity: faded ? 0.2 : 1,
        transition: 'opacity 1s',
        display: 'inline-block',
      }}
    >
      {Array.from({ length: a }, (_, row) => (
        <div key={row} className="row mb-1" style={{ gap: 3 }}>
          {Array.from({ length: b }, (_, col) => (
            <div key={col} style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--accent)',
              opacity: col >= 5 ? 0.35 : 1,
            }} />
          ))}
        </div>
      ))}
    </div>
  );
}
