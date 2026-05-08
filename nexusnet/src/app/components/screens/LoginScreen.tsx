import React, { useState } from 'react';
import { Mail } from 'lucide-react';
import { login, register, saveSession, validateMfa, startOAuth } from '../../lib/backend';

type AuthMode = 'login' | 'register' | 'mfa' | 'forgot';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const derivedUsername = email
    .split('@')[0]
    .replace(/[^a-z0-9_]/gi, '')
    .toLowerCase()
    .slice(0, 30) || 'phantom';

  const derivedDisplayName = email
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim() || 'New Phantom';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'mfa') {
      const token = mfaCode.join('');
      if (!pendingUserId) {
        setError('Missing MFA challenge');
        return;
      }

      setLoading(true);
      try {
        const result = await validateMfa(pendingUserId, token);
        saveSession({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          user: result.user
        });
        onLoginSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to validate MFA');
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const result = mode === 'register'
        ? await register(email, derivedUsername, password, derivedDisplayName)
        : await login(email, password);

      if (result.mfaRequired) {
        setPendingUserId(result.user.id);
        setMode('mfa');
        setMfaCode(['', '', '', '', '', '']);
        return;
      }

      saveSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user
      });
      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaInput = (index: number, value: string) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newCode = [...mfaCode];
      newCode[index] = value;
      setMfaCode(newCode);
      if (value && index < 5) document.getElementById(`mfa-${index + 1}`)?.focus();
    }
  };

  const handleOAuth = (provider: 'github' | 'google') => {
    startOAuth(provider);
  };

  const Background = (
    <>
      {/* Tilted red diamond */}
      <div
        className="absolute -z-10 pointer-events-none"
        style={{
          top: '-20%', left: '-15%', width: '90vw', height: '90vw',
          background: '#E8002D', transform: 'rotate(35deg)',
          opacity: 0.95,
        }}
      />
      <div
        className="absolute inset-0 -z-10 pointer-events-none phreak-halftone"
        style={{ opacity: 0.18 }}
      />
      {/* Diagonal slashes */}
      <div className="absolute -z-10 pointer-events-none" style={{
        top: 0, right: 0, width: '60%', height: '8px',
        background: 'repeating-linear-gradient(-45deg, #F5F0E8 0 12px, transparent 12px 24px)',
      }} />
    </>
  );

  const Logo = (
    <div className="text-center mb-6 relative">
      <div className="inline-block">
        {'PHREAK'.split('').map((c, i) => (
          <span
            key={i}
            className="inline-block phreak-headline"
            style={{
              fontSize: '5rem',
              color: '#F5F0E8',
              textShadow: '5px 5px 0 #E8002D, 9px 9px 0 #000',
              transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (2 + (i % 3))}deg)`,
              padding: '0 2px',
            }}
          >
            {c}
          </span>
        ))}
      </div>
      <div className="phreak-marker mt-2" style={{ color: '#FFE600', fontSize: '1.1rem', transform: 'rotate(-2deg)', display: 'inline-block' }}>
        "Steal the Feed. Own the Truth."
      </div>
      <div className="phreak-jp mt-1">怪盗団 SOCIAL OPS</div>
    </div>
  );

  if (mode === 'mfa') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4 relative overflow-hidden">
        {Background}
        <div className="w-full max-w-md relative">
          {Logo}
          <div className="phreak-sticker p-6" style={{ background: '#0a0000' }}>
            <div className="phreak-mono-label mb-2" style={{ color: '#FF2244' }}>// SeCuRiTy CheCk</div>
            <h3 style={{ margin: 0, color: '#E8002D' }}>EnTeR ThE CoDe</h3>
            <div className="phreak-jp mb-4">6桁のコード</div>
            <div className="flex gap-2 justify-center mb-6">
              {mfaCode.map((digit, i) => (
                <input
                  key={i}
                  id={`mfa-${i}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleMfaInput(i, e.target.value)}
                  className="w-12 h-14 text-center bg-black focus:outline-none"
                  style={{
                    border: digit ? '2px solid #E8002D' : '2px solid #F5F0E8',
                    color: '#F5F0E8', fontSize: '1.5rem', fontFamily: 'Bebas Neue',
                    boxShadow: digit ? '3px 3px 0 #E8002D' : 'none',
                  }}
                />
              ))}
            </div>
            {error && <div className="mb-4 phreak-mono-label" style={{ color: '#FFE600' }}>{error}</div>}
            <button onClick={handleSubmit} className="phreak-btn w-full" disabled={loading}>
              {loading ? 'UnLoCkInG...' : 'EnTeR ThE MeTaVeRsE'}
            </button>
            <button onClick={() => setMode('login')} className="phreak-mono-label mt-4 w-full" style={{ color: '#b8a89a' }}>
              ← BaCK
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4 relative overflow-hidden">
      {Background}
      <div className="w-full max-w-md relative">
        {Logo}
        <div className="phreak-sticker p-6" style={{ background: '#0a0000' }}>
          <div className="phreak-mono-label mb-1" style={{ color: '#FF2244' }}>// {mode === 'login' ? 'LoGiN' : mode === 'forgot' ? 'ReSeT' : 'JoIn ThE CrEW'}</div>
          <h3 style={{ margin: '0 0 8px', fontSize: '2rem' }}>
            {mode === 'login' ? 'WeLcOmE BaCk' : mode === 'forgot' ? 'FoRgOt?' : 'NeW PhAnToM'}
          </h3>
          <div className="phreak-diagonal-divider mb-5" />
          {error && <div className="mb-4 phreak-mono-label" style={{ color: '#FFE600' }}>{error}</div>}

          {mode !== 'forgot' && (
            <div className="flex gap-3 mb-5">
              <button onClick={() => handleOAuth('google')} className="phreak-btn phreak-btn-cyan flex-1">
                <Mail className="w-4 h-4" /> GoOgLe
              </button>
              <button onClick={() => handleOAuth('github')} className="phreak-btn phreak-btn-outline flex-1">
                GiTHuB
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label>EmAiL // メール</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="phantom@thieves.io"
                required
                className="w-full bg-transparent px-2 py-2 mt-1 focus:outline-none"
                style={{ borderBottom: '2px solid #E8002D', color: '#F5F0E8' }}
              />
            </div>
            {mode !== 'forgot' && (
              <div>
                <label>PaSsWoRd // パス</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-transparent px-2 py-2 mt-1 focus:outline-none"
                  style={{ borderBottom: '2px solid #E8002D', color: '#F5F0E8' }}
                />
              </div>
            )}

            <button type="submit" className="phreak-btn w-full mt-4" disabled={loading}>
              {loading ? 'LoAdInG...' : mode === 'forgot' ? 'SeNd ReSeT' : 'EnTeR ThE MeTaVeRsE'}
            </button>
          </form>

          <div className="flex justify-between mt-5">
            <button
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="phreak-mono-label"
              style={{ color: '#FF2244' }}
            >
              {mode === 'login' ? '+ NeW AcCt' : '← SiGn In'}
            </button>
            {mode === 'login' && (
              <button onClick={() => setMode('forgot')} className="phreak-mono-label" style={{ color: '#FFE600' }}>
                FoRgOt?
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
