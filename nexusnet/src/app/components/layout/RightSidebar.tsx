import React, { useEffect, useMemo, useState } from 'react';
import { Skull } from 'lucide-react';
import { getExplorePosts, type FrontPost } from '../../lib/backend';

export function RightSidebar() {
  const [trendsSource, setTrendsSource] = useState<FrontPost[]>([]);

  useEffect(() => {
    let active = true;
    getExplorePosts()
      .then((items) => { if (active) setTrendsSource(items); })
      .catch(() => { if (active) setTrendsSource([]); });
    return () => { active = false; };
  }, []);

  const trends = useMemo(() => {
    if (trendsSource.length === 0) return [] as { topic: string; posts: number }[];
    const stop = new Set([
      'this', 'that', 'with', 'from', 'they', 'them', 'their', 'your', 'you', 'and', 'the', 'for', 'are', 'was', 'were',
      'have', 'has', 'had', 'not', 'but', 'too', 'out', 'all', 'any', 'can', 'cant', 'just', 'like', 'what', 'when', 'where',
      'who', 'why', 'how', 'esto', 'esta', 'este', 'porque', 'para', 'pero', 'como', 'cuando', 'donde', 'sobre', 'entre',
      'post', 'reply', 'replies'
    ]);
    const counts = new Map<string, number>();
    const normalized = (word: string) => word.toLowerCase().replace(/[^a-z0-9]/g, '');

    trendsSource.forEach((post) => {
      const words = post.content.split(/\s+/);
      words.forEach((raw) => {
        const w = normalized(raw);
        if (w.length < 4 || stop.has(w)) return;
        counts.set(w, (counts.get(w) ?? 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([topic, posts]) => ({ topic, posts }));
  }, [trendsSource]);

  return (
    <div className="w-80 h-full p-4 space-y-5 bg-black border-l-2 border-[#E8002D]">
      <div className="phreak-sticker phreak-tilt-r p-3" style={{ background: '#000' }}>
        <div className="phreak-mono-label" style={{ color: '#E8002D' }}>// SyStEm</div>
        <div className="phreak-headline" style={{ fontSize: '1.4rem', color: '#F5F0E8' }}>MeTaVeRsE OnLiNe</div>
        <div className="phreak-jp">全システム稼働中</div>
      </div>

      <div className="p-3" style={{ background: '#1a0000', border: '2px solid #F5F0E8', boxShadow: '4px 4px 0 #E8002D' }}>
        <div className="flex items-baseline gap-2 mb-3">
          <h3 style={{ margin: 0, fontSize: '1.6rem' }}>TReNDinG</h3>
          <span className="phreak-jp">// トレンド</span>
        </div>
        <div className="phreak-diagonal-divider mb-3" />
        {trends.length === 0 ? (
          <div className="phreak-mono-label" style={{ color: '#666' }}>No trends yet.</div>
        ) : trends.map((trend, i) => (
          <div key={trend.topic} className="py-2 cursor-pointer hover:translate-x-[-2px]" style={{ transition: 'transform 80ms steps(2)' }}>
            <div className="phreak-mono-label" style={{ color: '#E8002D' }}>// HoT #{i + 1}</div>
            <div className="phreak-headline" style={{ fontSize: '1.2rem', color: '#F5F0E8' }}>{trend.topic}</div>
            <div className="flex items-center gap-2">
              <span className="phreak-mono-label" style={{ color: '#FFE600' }}>{trend.posts} PoStS</span>
            </div>
          </div>
        ))}
      </div>

      <div className="phreak-sticker p-3 phreak-tilt-l" style={{ background: '#FFE600', color: '#000' }}>
        <div className="flex items-center gap-2">
          <Skull className="w-5 h-5" />
          <div>
            <div className="phreak-headline" style={{ fontSize: '1.1rem' }}>ShAdOw DeTeCtEd</div>
            <div className="phreak-mono-label">2 NeW TaRgEtS</div>
          </div>
        </div>
      </div>
    </div>
  );
}
