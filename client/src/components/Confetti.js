import React, { useEffect, useState } from 'react';
import './Confetti.css';

const COLORS = ['#7C3AED','#EC4899','#10B981','#F59E0B','#3B82F6','#EF4444','#A855F7','#06B6D4'];
const SHAPES = ['','confetti-circle','confetti-rect'];

export default function Confetti({ active, onDone }) {
  const [visible, setVisible] = useState(false);
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    if (!active) return;
    const arr = Array.from({ length: 80 }, (_, i) => {
      const fallDur = 1.4 + Math.random() * 1.2;
      const wobbleDur = 0.3 + Math.random() * 0.4;
      const delay = Math.random() * 0.7;
      return {
        id: i,
        left: `${4 + Math.random() * 92}%`,
        color: COLORS[i % COLORS.length],
        shape: SHAPES[i % SHAPES.length],
        size: 6 + Math.random() * 8,
        fallDur: `${fallDur}s`,
        wobbleDur: `${wobbleDur}s`,
        delay: `${delay}s, ${delay}s`,
      };
    });
    setPieces(arr);
    setVisible(true);
    const t = setTimeout(() => { setVisible(false); onDone?.(); }, 3200);
    return () => clearTimeout(t);
  }, [active]);

  if (!visible || !pieces.length) return null;

  return (
    <div className="confetti-container" aria-hidden="true">
      {pieces.map(p => (
        <div
          key={p.id}
          className={`confetti-piece ${p.shape}`}
          style={{
            left: p.left,
            background: p.color,
            width: p.size,
            height: p.shape === 'confetti-rect' ? p.size * 0.5 : p.size,
            animationDuration: `${p.fallDur}, ${p.wobbleDur}`,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
}
