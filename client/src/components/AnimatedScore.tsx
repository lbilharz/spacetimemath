import { useState, useEffect } from 'react';
import { playTick, playDing } from '../utils/audio.js';

interface Props {
  score: number;
}

export default function AnimatedScore({ score }: Props) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    if (score <= 0) return;

    const start = 0;
    const end = score;
    const duration = 1500; // 1.5 seconds to count up
    let lastTickTime = 0;
    let startTime: number | null = null;
    let frameId: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);

      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - percentage, 3);
      const currentVal = start + (end - start) * easeOut;
      
      setDisplayScore(currentVal);

      // Play tick sound every ~4 score increments
      if (currentVal - lastTickTime > 4 && percentage < 1) {
        lastTickTime = currentVal;
        playTick();
      }

      if (progress < duration) {
        frameId = requestAnimationFrame(animate);
      } else {
        setDisplayScore(end);
        playDing(); // Finish with a ding!
      }
    };

    frameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameId);
  }, [score]);

  return (
    <div className="text-brand-yellow font-black text-[80px] leading-none mb-2 drop-shadow-sm tabular-nums">
      {displayScore.toFixed(1)}
    </div>
  );
}
