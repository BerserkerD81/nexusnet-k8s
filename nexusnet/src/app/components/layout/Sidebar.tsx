import React, { useEffect, useState } from 'react';
import { Home, Compass, Bell, Mail, User, Settings, Star, ChevronLeft, ChevronRight } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

const items = [
  { id: 'feed', icon: Home, label: 'FeeD', jp: 'フィード' },
  { id: 'explore', icon: Compass, label: 'STeaL', jp: '探索' },
  { id: 'notifications', icon: Bell, label: 'aLeRTs', jp: '通知' },
  { id: 'messages', icon: Mail, label: 'MsGs', jp: 'メッセージ' },
  { id: 'profile', icon: User, label: 'PRoFiLe', jp: 'プロフィール' },
  { id: 'settings', icon: Settings, label: 'CoNFiG', jp: '設定' },
];

const STORAGE_KEY = 'phreak_sidebar_state';

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'collapsed';
  });
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? 'collapsed' : 'expanded');
  }, [collapsed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === '[') setCollapsed(true);
      if (e.key === ']') setCollapsed(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const width = collapsed ? 72 : 240;

  return (
    <nav
      className="h-full phreak-hatch border-r-2 border-[#E8002D] relative"
      style={{
        background: '#0A0000',
        width,
        padding: collapsed ? '12px 8px' : 12,
        transition: 'width 200ms steps(4), padding 200ms steps(4)',
      }}
    >
      <button
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? '] eXPaND' : '[ CoLLaPSe'}
        style={{
          position: 'absolute', top: 10, right: -14, width: 28, height: 28,
          background: '#000', border: '2px solid #E8002D', color: '#E8002D',
          boxShadow: '2px 2px 0 #E8002D', zIndex: 20,
          display: 'grid', placeItems: 'center', cursor: 'pointer',
        }}
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      <div className="mb-5 px-1" style={{ minHeight: 56 }}>
        {!collapsed ? (
          <>
            <div className="phreak-tilt-l inline-block" style={{ borderBottom: '3px solid #E8002D', paddingBottom: 4 }}>
              <h1 style={{ fontSize: '2.2rem', margin: 0, color: '#FFFFFF', textShadow: '3px 3px 0 #E8002D' }}>PHREAK</h1>
            </div>
            <div className="phreak-jp mt-2" style={{ color: '#E8002D', letterSpacing: '0.3em', fontSize: 11 }}>// 怪盗団</div>
          </>
        ) : (
          <div style={{ fontSize: '1.6rem', color: '#FFFFFF', textShadow: '2px 2px 0 #E8002D', textAlign: 'center', fontFamily: 'Bebas Neue' }}>P★</div>
        )}
      </div>
      <div style={{ borderBottom: '2px dashed #E8002D', marginBottom: 12 }} />

      <div className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <div key={item.id} className="relative" onMouseEnter={() => setHovered(item.id)} onMouseLeave={() => setHovered(null)}>
              <button
                onClick={() => onNavigate(item.id)}
                className="w-full block text-left relative phreak-parallelogram"
                style={{
                  background: isActive ? '#E8002D' : 'transparent',
                  border: isActive ? 'none' : '2px solid #333333',
                  borderLeft: isActive ? '4px solid #FFFFFF' : '2px solid #333333',
                  boxShadow: isActive ? '4px 4px 0 #000' : 'none',
                  padding: collapsed ? '8px 6px' : '8px 14px',
                  transition: 'background 100ms steps(2), border-color 100ms steps(2)',
                }}
                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = '#1A0000'; e.currentTarget.style.borderColor = '#E8002D'; } }}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#333333'; } }}
              >
                <div className="flex items-center gap-3" style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}>
                  <Icon className={`w-5 h-5 ${isActive ? 'phreak-shake' : ''}`} style={{ color: isActive ? '#FFFFFF' : '#CCCCCC' }} />
                  {!collapsed && (
                    <div className="flex-1">
                      <div className="phreak-headline" style={{ fontSize: '1.2rem', color: isActive ? '#FFFFFF' : '#CCCCCC' }}>{item.label}</div>
                      <div className="phreak-jp" style={{ fontSize: 10, color: isActive ? '#FFFFFF' : '#E8002D' }}>{item.jp}</div>
                    </div>
                  )}
                  {!collapsed && isActive && <Star className="w-3 h-3" fill="#FFE600" stroke="#FFE600" />}
                </div>
              </button>
              {collapsed && hovered === item.id && (
                <div
                  style={{
                    position: 'absolute', left: 72, top: '50%', transform: 'translateY(-50%)',
                    background: '#E8002D', color: '#FFFFFF', fontFamily: 'Bebas Neue', fontSize: 14,
                    padding: '4px 10px', whiteSpace: 'nowrap', boxShadow: '3px 3px 0 #000',
                    border: '2px solid #000', zIndex: 30, letterSpacing: '0.05em',
                  }}
                >
                  {item.label} <span style={{ color: '#FFE600', fontSize: 10 }}>// {item.jp}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!collapsed && (
        <>
          <div className="mt-6 phreak-diagonal-divider mb-3" />
          <button className="phreak-btn w-full">
            {'>>'} SToRm THe FeED
          </button>
        </>
      )}
    </nav>
  );
}
