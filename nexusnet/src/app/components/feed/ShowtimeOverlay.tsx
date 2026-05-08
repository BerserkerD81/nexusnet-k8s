import React, { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';

interface ShowtimePost {
  author: string;
  handle: string;
  content: string;
  likes: number;
  reposts: number;
  replies: number;
}

export function ShowtimeOverlay({ post, onClose }: { post: ShowtimePost; onClose: () => void }) {
  const [stage, setStage] = useState<'flash' | 'banner' | 'spotlight'>('flash');
  const [counts, setCounts] = useState({ l: post.likes, r: post.reposts, c: post.replies });

  useEffect(() => {
    const t1 = setTimeout(() => setStage('banner'), 100);
    const t2 = setTimeout(() => setStage('spotlight'), 900);
    const t3 = setTimeout(onClose, 3000);
    const tick = setInterval(() => {
      setCounts((p) => ({ l: p.l + 1, r: p.r + (Math.random() < 0.4 ? 1 : 0), c: p.c + (Math.random() < 0.3 ? 1 : 0) }));
    }, 180);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearInterval(tick); };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center cursor-pointer"
      style={{ background: stage === 'spotlight' ? 'rgba(0,0,0,0.92)' : '#000' }}
    >
      {stage === 'flash' && (
        <div className="absolute inset-0" style={{ background: '#FFFFFF', animation: 'phreak-blink 80ms steps(2) 1' }} />
      )}

      <div className="absolute inset-0 phreak-speedlines pointer-events-none" style={{ opacity: stage === 'spotlight' ? 0.5 : 0.3 }} />

      {stage !== 'flash' && (
        <div className="relative text-center px-6">
          <Zap
            className="mx-auto phreak-slam-down"
            style={{ width: 80, height: 80, color: '#FFE600', filter: 'drop-shadow(4px 4px 0 #E8002D)' }}
          />
          <div
            className="phreak-headline phreak-color-flash phreak-slam-down"
            style={{
              fontSize: 'clamp(64px, 12vw, 120px)', lineHeight: 1,
              letterSpacing: '0.04em', marginTop: 8,
            }}
          >
            SHoWTiMe
          </div>
          <div className="phreak-mono-label" style={{ color: '#E8002D', letterSpacing: '0.4em', marginTop: 8 }}>
            // スタンプ発動 — ALL-OUT ATTACK
          </div>

          {stage === 'spotlight' && (
            <div className="mt-8 max-w-2xl mx-auto phreak-card-tex p-5" style={{ border: '3px solid #E8002D', boxShadow: '0 0 32px rgba(232,0,45,0.6), 6px 6px 0 #000' }}>
              <div className="phreak-headline" style={{ fontSize: '2rem', color: '#FFFFFF', textShadow: '3px 3px 0 #E8002D' }}>
                {post.author}
              </div>
              <div className="phreak-handle">{post.handle}</div>
              <p className="mt-3" style={{ fontFamily: 'Archivo, sans-serif', fontSize: 18, color: '#FFFFFF', lineHeight: 1.6 }}>
                {post.content}
              </p>
              <div className="phreak-diagonal-divider my-4" style={{ height: 3 }} />
              <div className="flex items-center justify-center gap-4 flex-wrap">
                {[
                  { label: '❤', n: counts.l },
                  { label: '🔁', n: counts.r },
                  { label: '💬', n: counts.c },
                ].map((s, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span style={{ color: '#E8002D', fontSize: 18 }}>◆</span>}
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 24 }}>{s.label}</span>
                      <span className="phreak-headline" style={{ fontSize: 36, color: '#FFE600', textShadow: '3px 3px 0 #000' }}>
                        {s.n}
                      </span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          <div className="phreak-mono-label mt-6" style={{ color: '#888' }}>// CLiCK aNyWHeRe To DiSMiSS</div>
        </div>
      )}
    </div>
  );
}
