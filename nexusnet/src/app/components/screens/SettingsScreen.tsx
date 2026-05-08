import { useEffect, useState, ChangeEvent } from 'react';
import { Avatar } from '../ui/Avatar';
import { Smartphone, Monitor, Trash2, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import {
  getMeProfile, updateProfile, getSessions, revokeSession,
  enableMfa, verifyMfa, logout, loadSession, saveSession,
  type BackendUser, type BackendSession
} from '../../lib/backend';

function ArcanaHeader({ name, jp }: { name: string; jp: string }) {
  return (
    <div className="mb-4">
      <div className="phreak-headline" style={{ fontSize: '1.6rem', color: '#F5F0E8' }}>
        ★ {name} <span className="phreak-jp" style={{ color: '#E8002D' }}>// {jp}</span>
      </div>
      <div className="phreak-diagonal-divider mt-1" />
    </div>
  );
}

interface SettingsScreenProps {
  currentUser?: BackendUser | null;
  onProfileUpdated?: (user: BackendUser) => void;
  onClose?: () => void;
}

export function SettingsScreen({ currentUser, onProfileUpdated, onClose }: SettingsScreenProps) {
  const [profile, setProfile] = useState<BackendUser | null>(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [sessions, setSessions] = useState<BackendSession[]>([]);

  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaQr, setMfaQr] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaStep, setMfaStep] = useState<'idle' | 'scan' | 'verify'>('idle');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (currentUser) {
          setProfile(currentUser);
          setUsername(currentUser.username);
          setDisplayName(currentUser.displayName);
          setBio(currentUser.bio ?? '');
          setIsPrivate(Boolean(currentUser.isPrivate));
          setAvatarPreview(currentUser.avatarUrl ?? null);
          setMfaEnabled(Boolean(currentUser.mfaEnabled));
        }
        const [me, s] = await Promise.all([getMeProfile(), getSessions()]);
        if (!active) return;
        setProfile(me);
        setUsername(me.username);
        setDisplayName(me.displayName);
        setBio(me.bio ?? '');
        setIsPrivate(Boolean(me.isPrivate));
        setAvatarPreview(me.avatarUrl ?? null);
        setMfaEnabled(Boolean(me.mfaEnabled));
        setSessions(s);
      } catch {
        // keep the loading state fallback
      }
    };
    load();
    return () => { active = false; };
  }, [currentUser]);

  const validateUsername = (value: string) => {
    if (value.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return false;
    }
    if (value.length > 30) {
      setUsernameError('Username must be 30 characters or less');
      return false;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      setUsernameError('Username can only contain letters, numbers, _ and -');
      return false;
    }
    setUsernameError(null);
    return true;
  };

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB');
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleUsernameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);
    validateUsername(value);
  };

  const handleTogglePrivate = async () => {
    const nextPrivate = !isPrivate;
    setIsPrivate(nextPrivate);
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProfile({ isPrivate: nextPrivate });
      setProfile(updated);
      onProfileUpdated?.(updated);
      toast.success(nextPrivate ? 'PRiVaCY ENAbLeD' : 'PRiVaCY DISAbLeD');
    } catch (error: unknown) {
      setIsPrivate((current) => !current);
      const message = error instanceof Error ? error.message : 'Failed to update privacy';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!validateUsername(username)) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      let updated: BackendUser;
      if (avatarFile) {
        const session = loadSession();
        if (!session?.accessToken) {
          throw new Error('Authentication token missing');
        }

        const formData = new FormData();
        formData.append('username', username);
        formData.append('displayName', displayName);
        formData.append('bio', bio);
        formData.append('isPrivate', String(isPrivate));
        formData.append('avatar', avatarFile);

        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/users/me`, {
          method: 'PUT',
          body: formData,
          headers: {
            Authorization: `Bearer ${session.accessToken}`
          },
          credentials: 'include'
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.message ?? 'Failed to save profile');
        }

        const body = await response.json();
        updated = body.data;
      } else {
        updated = await updateProfile({ username, displayName, bio, isPrivate });
      }

      setProfile(updated);
      onProfileUpdated?.(updated);
      toast.success('PRoFiLe SaVeD');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeSession = async (id: string) => {
    try {
      await revokeSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast.success('SeSSioN TeRMiNaTeD');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to revoke');
    }
  };

  const handleEnableMfa = async () => {
    try {
      const { qrCodeDataUrl } = await enableMfa();
      if (!qrCodeDataUrl) {
        throw new Error('QR code not returned');
      }
      setMfaQr(qrCodeDataUrl);
      setMfaStep('scan');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to enable MFA');
    }
  };

  const handleVerifyMfa = async () => {
    try {
      await verifyMfa(mfaToken);
      const updated = await getMeProfile();
      const session = loadSession();
      if (session) {
        saveSession({ ...session, user: updated });
      }
      setProfile(updated);
      setMfaEnabled(Boolean(updated.mfaEnabled));
      setMfaStep('idle');
      setMfaQr(null);
      setMfaToken('');
      toast.success('MFa AcTiVaTeD');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Invalid code');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  const formatDate = (s: string) => {
    try { return new Date(s).toLocaleString(); } catch { return s; }
  };

  return (
    <div className="max-w-2xl mx-auto min-h-screen">
      <div className="sticky top-0 z-10 bg-black p-4" style={{ borderBottom: '2px dashed #E8002D' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <button
              onClick={() => onClose?.()}
              className="phreak-btn"
              style={{ padding: '4px 10px', fontSize: '0.9rem', minWidth: 92 }}
            >
              BaCK
            </button>
            <div>
              <h2 style={{ margin: 0, fontSize: '2.2rem', color: '#E8002D' }}>★ CoNFiG</h2>
              <span className="phreak-jp" style={{ color: '#E8002D' }}>// 設定</span>
            </div>
          </div>
          <button
            onClick={() => onClose?.()}
            className="phreak-btn hidden md:inline-flex"
            style={{ padding: '6px 12px', fontSize: '0.9rem' }}
          >
            EXIT
          </button>
        </div>
      </div>

      <div className="p-5 space-y-8">
        {/* Profile */}
        <section>
          <ArcanaHeader name="ThE ToWeR" jp="アカウント" />
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="phreak-hex" style={{ width: 92, height: 92, boxShadow: '0 0 16px rgba(232,0,45,0.4)' }}>
                <div style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', width: '100%', height: '100%', overflow: 'hidden' }}>
                  <Avatar src={avatarPreview ?? profile?.avatarUrl ?? ''} alt={profile?.displayName ?? ''} size="xl" />
                </div>
              </div>
              <label className="phreak-btn flex items-center gap-2" style={{ cursor: 'pointer', padding: '8px 12px', fontSize: '0.85rem' }}>
                Change Photo
                <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              </label>
            </div>
            <div>
              <label className="phreak-mono-label" style={{ color: '#b8a89a', fontSize: 11 }}>EmAiL</label>
              <input
                readOnly
                value={profile?.email ?? ''}
                className="w-full bg-transparent px-2 py-2 mt-1 focus:outline-none"
                style={{ borderBottom: '2px solid #444', color: '#666' }}
              />
            </div>
            <div>
              <label className="phreak-mono-label" style={{ color: '#b8a89a', fontSize: 11 }}>@HaNDLe</label>
              <input
                value={username}
                onChange={handleUsernameChange}
                className="w-full bg-transparent px-2 py-2 mt-1 focus:outline-none"
                style={{ borderBottom: `2px solid ${usernameError ? '#FF4444' : '#E8002D'}`, color: '#F5F0E8' }}
              />
              {usernameError && (
                <div className="phreak-mono-label" style={{ color: '#FF4444', fontSize: 11, marginTop: 4 }}>
                  {usernameError}
                </div>
              )}
            </div>
            <div>
              <label className="phreak-mono-label" style={{ color: '#b8a89a', fontSize: 11 }}>DiSPLaY NaMe</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-transparent px-2 py-2 mt-1 focus:outline-none"
                style={{ borderBottom: '2px solid #E8002D', color: '#F5F0E8' }}
              />
            </div>
            <div>
              <label className="phreak-mono-label" style={{ color: '#b8a89a', fontSize: 11 }}>BiO</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full bg-transparent px-2 py-2 mt-1 focus:outline-none resize-none"
                style={{ borderBottom: '2px solid #E8002D', color: '#F5F0E8', fontFamily: 'Archivo, sans-serif' }}
              />
            </div>
            {error && (
              <div className="phreak-card-tex p-3" style={{ borderLeft: '5px solid #FF4444' }}>
                <div className="phreak-mono-label" style={{ color: '#FF4444' }}>{error}</div>
              </div>
            )}
            <button onClick={handleSaveProfile} disabled={saving || Boolean(usernameError)} className="phreak-btn" style={{ opacity: saving || Boolean(usernameError) ? 0.6 : 1 }}>
              {saving ? 'SaViNG...' : 'SaVe ChaNGes'}
            </button>
          </div>
        </section>

        {/* Privacy + MFA */}
        <section>
          <ArcanaHeader name="ThE HeRMiT" jp="プライバシー" />
          <div className="space-y-4">
            <div className="phreak-card-tex p-3 flex items-center justify-between" style={{ borderLeft: '5px solid #E8002D' }}>
              <div>
                <div className="phreak-headline" style={{ color: '#F5F0E8' }}>PRiVaTe AcCoUNT</div>
                <div className="phreak-mono-label" style={{ color: '#b8a89a' }}>oNLy FoLLoWeRS CaN SeE PoSTs</div>
              </div>
              <span className="phreak-eye" data-on={isPrivate} onClick={handleTogglePrivate} />
            </div>

            <div className="phreak-card-tex p-3" style={{ borderLeft: '5px solid #E8002D' }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="phreak-headline" style={{ color: '#F5F0E8' }}>MFa AuTHeNTiCaTioN</div>
                  <div className="phreak-mono-label" style={{ color: '#b8a89a' }}>
                    {mfaEnabled ? 'aCTiVe ★' : 'iNaCTiVe'}
                  </div>
                </div>
                {!mfaEnabled && mfaStep === 'idle' && (
                  <button onClick={handleEnableMfa} className="phreak-btn" style={{ fontSize: '0.85rem', padding: '5px 12px' }}>
                    <QrCode className="w-4 h-4 inline mr-1" /> eNaBLe
                  </button>
                )}
                {mfaEnabled && (
                  <span className="phreak-sticker px-2" style={{ background: '#00FFE5', color: '#000', fontSize: 11 }}>● oN</span>
                )}
              </div>
              {mfaStep === 'scan' && mfaQr && (
                <div className="mt-3 space-y-3">
                  <div className="phreak-mono-label" style={{ color: '#FFE600', fontSize: 11 }}>ScaN WiTH YouR aUTH aPP:</div>
                  <img src={mfaQr} alt="MFA QR Code" className="w-40 h-40 border-2 border-white" />
                  <div className="flex gap-2">
                    <input
                      value={mfaToken}
                      onChange={(e) => setMfaToken(e.target.value)}
                      maxLength={6}
                      placeholder="6-DiGiT CoDe"
                      className="flex-1 bg-transparent px-2 py-1 focus:outline-none"
                      style={{ borderBottom: '2px solid #E8002D', color: '#F5F0E8', fontFamily: 'Bebas Neue', fontSize: '1.2rem', letterSpacing: '0.3em' }}
                    />
                    <button onClick={handleVerifyMfa} className="phreak-btn" style={{ fontSize: '0.85rem', padding: '5px 12px' }}>
                      VeRiFy
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Sessions */}
        <section>
          <ArcanaHeader name="ThE EMPeRoR" jp="セッション" />
          <div className="space-y-3">
            {sessions.length === 0 ? (
              <div className="phreak-mono-label" style={{ color: '#666' }}>No sessions loaded.</div>
            ) : sessions.map((s) => (
              <div key={s.id} className="phreak-card-tex p-3 flex items-center gap-3" style={{ borderLeft: '5px solid #E8002D' }}>
                <div className="phreak-sticker" style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', background: '#000' }}>
                  {s.deviceInfo?.toLowerCase().includes('mobile') || s.deviceInfo?.toLowerCase().includes('iphone') || s.deviceInfo?.toLowerCase().includes('android')
                    ? <Smartphone className="w-4 h-4 text-[#FFFFFF]" />
                    : <Monitor className="w-4 h-4 text-[#FFFFFF]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="phreak-headline" style={{ color: '#F5F0E8' }}>
                    {s.deviceInfo?.trim() ? s.deviceInfo : s.ipAddress ? `IP: ${s.ipAddress}` : 'UnKNoWN DeViCe'}
                    {s.isCurrent && <span className="ml-2 phreak-sticker" style={{ background: '#FFE600', color: '#000', padding: '1px 6px', fontSize: 10 }}>CuRRENT</span>}
                  </div>
                  <div className="phreak-mono-label" style={{ color: '#b8a89a', fontSize: 10 }}>
                    {s.ipAddress && `◆ ${s.ipAddress} `}◆ {formatDate(s.createdAt)}
                  </div>
                </div>
                {!s.isCurrent && (
                  <button
                    onClick={() => handleRevokeSession(s.id)}
                    className="phreak-btn"
                    style={{ background: 'transparent', color: '#E8002D', borderColor: '#E8002D', fontSize: '0.85rem', padding: '4px 10px' }}
                  >
                    TeRMiNaTe
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Logout */}
        <section>
          <button onClick={handleLogout} className="phreak-btn w-full" style={{ background: 'transparent', borderColor: '#666', color: '#b8a89a' }}>
            LoG ouT
          </button>
        </section>

        {/* Danger zone */}
        <section className="p-4" style={{ background: '#1a0000', border: '2px solid #E8002D', boxShadow: '4px 4px 0 #000' }}>
          <ArcanaHeader name="ThE JuDGeMeNT" jp="危険区域" />
          <p style={{ fontFamily: 'Archivo, sans-serif', color: '#F5F0E8', marginBottom: 12 }}>
            DeLeTinG ThE AcCoUnt is PERMaNeNT. NoTHinG SuRViVeS.
          </p>
          <button className="phreak-btn" style={{ background: 'transparent', borderColor: '#E8002D', color: '#E8002D' }}>
            <Trash2 className="w-4 h-4 inline mr-2" /> DeLeTE AcCoUnt
          </button>
        </section>
      </div>
    </div>
  );
}
