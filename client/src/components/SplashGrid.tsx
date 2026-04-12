import { useState, useEffect } from 'react';

const CELL_POSITIONS = [
  { x: 6,  y: 6  }, { x: 37, y: 6  }, { x: 68, y: 6  },
  { x: 6,  y: 37 }, { x: 37, y: 37 }, { x: 68, y: 37 },
  { x: 6,  y: 68 }, { x: 37, y: 68 }, { x: 68, y: 68 },
];
const SHUFFLE_COLORS = ['#5DD23C', '#FBBA00', '#4FA7FF', '#E8391D', 'rgba(255,255,255,0.18)'];
const INITIAL_COLORS = ['#5DD23C','#5DD23C','#FBBA00','#5DD23C','#FBBA00','#4FA7FF','#4FA7FF','#E8391D','rgba(255,255,255,0.18)'];

export default function SplashGrid({ brokenMode = false }: { brokenMode?: boolean }) {
  const [colors, setColors] = useState<string[]>(INITIAL_COLORS);
  const [brokenTiles, setBrokenTiles] = useState<number[]>(brokenMode ? [4] : []);

  // Update colors constantly
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

  // In broken mode, randomly select 1 or 2 tiles to be "broken" with high randomness
  useEffect(() => {
    if (!brokenMode) return;
    
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const triggerNextBreak = () => {
      const numBroken = Math.random() > 0.8 ? 2 : 1; 
      const newBroken: number[] = [];
      while(newBroken.length < numBroken) {
        const pick = Math.floor(Math.random() * 9);
        if (!newBroken.includes(pick)) newBroken.push(pick);
      }
      setBrokenTiles(newBroken);
      
      // Highly random delay before the short-circuit moves again (between 1.5s and 6s)
      const nextDelay = 1500 + Math.random() * 4500;
      timeoutId = setTimeout(triggerNextBreak, nextDelay);
    };
    
    triggerNextBreak();
    
    return () => clearTimeout(timeoutId);
  }, [brokenMode]);

  return (
    <>
      <svg className="splash-bolt" width="80" height="80" viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" rx="14" className="fill-slate-800 dark:fill-slate-950 transition-colors duration-200"/>
      {CELL_POSITIONS.map((pos, i) => {
        const isBroken = brokenMode && brokenTiles.includes(i);
        return (
          <rect key={i} x={pos.x} y={pos.y} width="26" height="26" rx="5"
            className={isBroken ? 'animate-[flicker_3.1s_infinite]' : ''}
            style={{ 
              fill: colors[i], 
              transition: isBroken ? 'none' : 'fill 0.22s ease',
              transformOrigin: `${pos.x + 13}px ${pos.y + 13}px`,
              animationDelay: isBroken ? `-${(i * 0.83) % 3}s` : '0s'
            }}
          />
        );
      })}
      </svg>
      {brokenMode && (
        <style>{`
          @keyframes flicker {
            /* Dead state */
            0%, 82.999%, 88%, 93.999%, 95%, 100% { 
              opacity: 0.15; 
              transform: scale(0.95);
              filter: brightness(0.4);
            }
            /* One major intense zap */
            83%, 87.999% { 
              opacity: 1; 
              transform: scale(1.15) skew(4deg, -2deg) translate(-1px, 2px);
              filter: brightness(3.5) drop-shadow(0 0 12px rgba(255,255,255,1));
              fill: #FFF !important;
            }
            /* A tiny microscopic secondary glitch buzz */
            94%, 94.999% { 
              opacity: 0.8; 
              transform: scale(1.02) skew(-1deg, 2deg) translate(1px, -1px);
              filter: brightness(2) drop-shadow(0 0 4px rgba(250,204,21,0.6));
            }
          }
        `}</style>
      )}
    </>
  );
}
