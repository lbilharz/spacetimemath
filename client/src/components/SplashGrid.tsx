import { useState, useEffect } from 'react';

const CELL_POSITIONS = [
  { x: 6,  y: 6  }, { x: 37, y: 6  }, { x: 68, y: 6  },
  { x: 6,  y: 37 }, { x: 37, y: 37 }, { x: 68, y: 37 },
  { x: 6,  y: 68 }, { x: 37, y: 68 }, { x: 68, y: 68 },
];
const SHUFFLE_COLORS = ['#5DD23C', '#FBBA00', '#4FA7FF', '#E8391D', 'rgba(255,255,255,0.18)'];
const INITIAL_COLORS = ['#5DD23C','#5DD23C','#FBBA00','#5DD23C','#FBBA00','#4FA7FF','#4FA7FF','#E8391D','rgba(255,255,255,0.18)'];

export default function SplashGrid() {
  const [colors, setColors] = useState<string[]>(INITIAL_COLORS);
  useEffect(() => {
    const id = setInterval(() => {
      setColors(prev => {
        const next = [...prev];
        const cell  = Math.floor(Math.random() * 9);
        const color = SHUFFLE_COLORS[Math.floor(Math.random() * SHUFFLE_COLORS.length)];
        next[cell] = color;
        return next;
      });
    }, 280);
    return () => clearInterval(id);
  }, []);
  return (
    <svg className="splash-bolt" width="80" height="80" viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" rx="14" fill="#2C3E50"/>
      {CELL_POSITIONS.map((pos, i) => (
        <rect key={i} x={pos.x} y={pos.y} width="26" height="26" rx="5"
          style={{ fill: colors[i], transition: 'fill 0.22s ease' }}
        />
      ))}
    </svg>
  );
}
