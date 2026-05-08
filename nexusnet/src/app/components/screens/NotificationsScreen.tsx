import { useEffect, useRef, useState } from 'react';
import { Heart, MessageCircle, Repeat2, UserPlus, Star, AtSign, Mail, Check } from 'lucide-react';
import { io, type Socket } from 'socket.io-client';
import {
  getNotifications,
  loadSession,
  mapNotification,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationCard,
} from '../../lib/backend';

type NotificationType = 'all' | 'mentions' | 'likes' | 'follows' | 'messages';
type UiNotifType = NotificationCard['type'];

interface NotificationsScreenProps {
  onViewProfile?: (username: string) => void;
  onOpenMessage?: (conversationId?: string, peerUsername?: string) => void;
}

// Notificaciones con metadatos extra (entityId para deeplink a mensajes)
interface EnrichedNotification extends NotificationCard {
  entityId?: string;
  entityType?: string;
  rawType?: string;
}

export function NotificationsScreen({ onViewProfile, onOpenMessage }: NotificationsScreenProps) {
  const [activeTab, setActiveTab] = useState<NotificationType>('all');
  const [notifications, setNotifications] = useState<EnrichedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // IDs que el usuario ya "vio" en esta sesión (desaparecen tras un delay)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const socketRef = useRef<Socket | null>(null);
  const socketUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

  // Helper: mapea un item del backend usando mapNotification + extrae entityId
  const enrich = (raw: any): EnrichedNotification => {
    const card = mapNotification(raw);
    return {
      ...card,
      entityId: raw?.entityId,
      entityType: raw?.entityType,
      rawType: raw?.type,
    };
  };

  // ── Carga inicial ────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const session = loadSession();
    if (!session?.accessToken) {
      setLoading(false);
      setError('No has iniciado sesión');
      return;
    }

    // getNotifications ya devuelve NotificationCard[] mapeados,
    // pero necesitamos el entityId crudo. Hacemos fetch directo.
    fetch(`${socketUrl}/api/v1/notifications?limit=50`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
      .then((r) => r.json())
      .then((body) => {
        if (!active) return;
        // Soporta { items, pagination } o array plano
        const raw = body?.data ?? body;
        const items: any[] = Array.isArray(raw) ? raw : (raw?.items ?? []);
        setNotifications(items.map(enrich));
      })
      .catch((err) => {
        console.error('[Notifications] fetch error:', err);
        if (active) setError(err?.message ?? 'Error cargando notificaciones');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [socketUrl]);

  // ── Socket en tiempo real ─────────────────────────────────────
  useEffect(() => {
    const session = loadSession();
    if (!session?.accessToken || !session?.user?.id) return;

    const socket = io(socketUrl, {
      auth: {
        token: session.accessToken,
        userId: session.user.id,
      },
      transports: ['websocket'],
      path: '/socket.io',
    });

    socket.on('notification', (payload: any) => {
      try {
        const enriched = enrich(payload);
        setNotifications((prev) => {
          if (prev.some((p) => p.id === enriched.id)) return prev;
          return [enriched, ...prev];
        });
      } catch {
        /* ignora payloads malformados */
      }
    });

    socketRef.current = socket;
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [socketUrl]);

  // ✅ NEW: Listen for real-time notification updates
  useEffect(() => {
    const handleNotificationsRefresh = async () => {
      const session = loadSession();
      if (!session?.accessToken) return;

      try {
        const response = await fetch(`${socketUrl}/api/v1/notifications?limit=50`, {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        });
        const body = await response.json();
        const raw = body?.data ?? body;
        const items: any[] = Array.isArray(raw) ? raw : (raw?.items ?? []);
        setNotifications(items.map(enrich));
        // Reset dismissed set when refreshing
        setDismissedIds(new Set());
      } catch {
        console.warn('Failed to refresh notifications');
      }
    };

    window.addEventListener('feed-refresh', handleNotificationsRefresh);
    return () => window.removeEventListener('feed-refresh', handleNotificationsRefresh);
  }, [socketUrl]);

  // ── Auto-marca como leídas tras 1.5s y desvanece tras 4s ─────
  useEffect(() => {
    const unread = notifications.filter((n) => n.unread && !dismissedIds.has(n.id));
    if (unread.length === 0) return;

    // 1) Marca como leídas en backend (silencioso)
    const markTimer = setTimeout(() => {
      unread.forEach((n) => {
        markNotificationRead(n.id).catch(() => {});
      });
      // Actualiza estado local para que dejen de estar "unread"
      setNotifications((prev) =>
        prev.map((n) => (unread.some((u) => u.id === n.id) ? { ...n, unread: false } : n))
      );
    }, 1500);

    return () => clearTimeout(markTimer);
  }, [notifications, dismissedIds]);

  // ── Handlers ─────────────────────────────────────────────────
  const dismiss = (id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleClickNotification = async (n: EnrichedNotification) => {
    // Marca como leída inmediatamente
    if (n.unread) {
      try { await markNotificationRead(n.id); } catch {}
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, unread: false } : x))
      );
    }

    // Acción según tipo
    if (n.type === 'message') {
      // Para mensajes: el entityId es el messageId, no el conversationId.
      // Pasamos el username del remitente para que MessagesScreen abra/cree la conversación
      const peerUsername = n.handle.replace(/^@/, '');
      onOpenMessage?.(undefined, peerUsername);
      return;
    }

    if (n.type === 'follow') {
      onViewProfile?.(n.handle.replace(/^@/, ''));
      return;
    }

    // like/repost/mention/reply → al perfil por ahora (o al post si tienes entityId)
    onViewProfile?.(n.handle.replace(/^@/, ''));
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
      // Después de marcar todas, desvanecer las viejas
      setTimeout(() => {
        setNotifications((prev) => {
          const ids = new Set(prev.map((n) => n.id));
          setDismissedIds((d) => {
            const next = new Set(d);
            ids.forEach((id) => next.add(id));
            return next;
          });
          return prev;
        });
      }, 800);
    } catch (err) {
      console.error('[Notifications] mark all read failed:', err);
    }
  };

  // ── Iconografía ───────────────────────────────────────────────
  const iconBg: Record<UiNotifType, string> = {
    like: '#E8002D',
    follow: '#FFE600',
    repost: '#FFE600',
    mention: '#FFE600',
    reply: '#FFE600',
    message: '#00B3FF',
  };

  const Icon = ({ type }: { type: UiNotifType }) => {
    const map: Record<UiNotifType, any> = {
      like: Heart,
      follow: UserPlus,
      repost: Repeat2,
      mention: AtSign,
      reply: MessageCircle,
      message: Mail,
    };
    const I = map[type] ?? MessageCircle;
    const isLike = type === 'like';
    const isMessage = type === 'message';
    return (
      <I
        className="w-5 h-5"
        style={{ color: isLike || isMessage ? '#fff' : '#000' }}
        fill={isLike ? '#fff' : 'none'}
      />
    );
  };

  const HexAvatar = ({ alt, size = 36 }: { alt: string; size?: number }) => {
    const initials = (alt || 'U')
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const strokeWidth = Math.max(2, Math.round(size * 0.08));
    const inset = strokeWidth / 2;
    const points = `50,${inset} ${100 - inset},${25 + inset / 2} ${100 - inset},${75 - inset / 2} 50,${100 - inset} ${inset},${75 - inset / 2} ${inset},${25 + inset / 2}`;

    return (
      <div className="phreak-hex relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="absolute inset-0" aria-hidden="true">
          <polygon points={points} fill="#1A0000" stroke="#E8002D" strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span
            className="phreak-headline select-none"
            style={{
              color: '#F5F0E8',
              fontSize: 12,
              lineHeight: 1,
              letterSpacing: '0.12em',
              textShadow: '2px 2px 0 #000',
            }}
          >
            {initials}
          </span>
        </div>
      </div>
    );
  };

  // ── Filtrado ─────────────────────────────────────────────────
  const visibleNotifications = notifications.filter((n) => {
    if (dismissedIds.has(n.id)) return false;
    if (activeTab === 'all') return true;
    if (activeTab === 'mentions') return n.type === 'mention' || n.type === 'reply';
    if (activeTab === 'likes') return n.type === 'like' || n.type === 'repost';
    if (activeTab === 'follows') return n.type === 'follow';
    if (activeTab === 'messages') return n.type === 'message';
    return true;
  });

  const unreadCount = notifications.filter((n) => n.unread && !dismissedIds.has(n.id)).length;

  const tabs = ['all', 'mentions', 'likes', 'follows', 'messages'] as const;
  const labels: Record<NotificationType, string> = {
    all: 'aLL',
    mentions: 'MeNTioNs',
    likes: 'LiKeS',
    follows: 'FoLLoWs',
    messages: 'MsGs',
  };

  return (
    <div className="max-w-2xl mx-auto min-h-screen">
      <div className="sticky top-0 z-10 bg-black p-4" style={{ borderBottom: '2px dashed #E8002D' }}>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 style={{ margin: 0, fontSize: '2.2rem', color: '#E8002D' }}>★ aLeRTs</h2>
          <span className="phreak-jp" style={{ color: '#E8002D' }}>// 通知</span>
          {unreadCount > 0 && (
            <span
              className="phreak-sticker px-2 py-0.5"
              style={{ background: '#E8002D', color: '#fff', fontSize: '0.75rem' }}
            >
              {unreadCount} new
            </span>
          )}
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="phreak-mono-label ml-auto"
              style={{
                background: 'transparent',
                border: '1px solid #FFE600',
                color: '#FFE600',
                padding: '4px 10px',
                fontSize: '0.7rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Check className="w-3 h-3" /> CLeaR aLL
            </button>
          )}
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {tabs.map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="phreak-parallelogram phreak-headline"
                style={{
                  padding: '6px 14px',
                  background: active ? '#E8002D' : 'transparent',
                  border: `2px solid ${active ? '#F5F0E8' : '#E8002D'}`,
                  color: '#F5F0E8',
                  fontSize: '0.95rem',
                  boxShadow: active ? '3px 3px 0 #000' : 'none',
                  cursor: 'pointer',
                }}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-3 space-y-2">
        {loading ? (
          <div className="p-8 text-center phreak-mono-label" style={{ color: '#666' }}>
            Loading notifications...
          </div>
        ) : error ? (
          <div className="p-8 text-center phreak-mono-label" style={{ color: '#E8002D' }}>
            {error}
          </div>
        ) : visibleNotifications.length === 0 ? (
          <div className="p-8 text-center phreak-mono-label" style={{ color: '#666' }}>
            No notifications yet.
          </div>
        ) : (
          visibleNotifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleClickNotification(n)}
              className="phreak-card-tex relative p-3 cursor-pointer"
              style={{
                borderLeft: n.unread ? '5px solid #E8002D' : '5px solid #1a0000',
                border: '2px solid #1a0000',
                background: n.unread ? 'rgba(232,0,45,0.06)' : '#0D0D0D',
                transition: 'opacity 0.4s ease, transform 0.4s ease',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="phreak-sticker shrink-0"
                  style={{
                    width: 40,
                    height: 40,
                    background: iconBg[n.type] ?? '#FFE600',
                    display: 'grid',
                    placeItems: 'center',
                    transform: 'rotate(5deg)',
                  }}
                >
                  <Icon type={n.type} />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewProfile?.(n.handle.replace(/^@/, ''));
                  }}
                  style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  <HexAvatar alt={n.user} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewProfile?.(n.handle.replace(/^@/, ''));
                      }}
                      className="phreak-headline"
                      style={{
                        color: '#F5F0E8',
                        fontSize: '1.1rem',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                      }}
                    >
                      {n.user}
                    </button>
                    <span className="phreak-mono-label" style={{ color: '#888', fontSize: '0.8rem' }}>
                      {n.handle}
                    </span>
                    <span className="phreak-mono-label" style={{ color: '#b8a89a' }}>{n.action}</span>
                    <span style={{ color: '#E8002D', fontSize: '10px' }}>◆</span>
                    <span className="phreak-mono-label" style={{ color: '#666' }}>{n.timestamp}</span>
                  </div>
                  {n.content && (
                    <p style={{ fontFamily: 'Archivo, sans-serif', color: '#b8a89a', fontSize: '0.9rem', marginTop: 4 }}>
                      "{n.content}"
                    </p>
                  )}
                  {n.type === 'message' && (
                    <p
                      className="phreak-mono-label"
                      style={{ color: '#00B3FF', fontSize: '0.7rem', marginTop: 4 }}
                    >
                      → TaP To oPeN CHaT
                    </p>
                  )}
                </div>
                {n.rankUp && (
                  <div className="phreak-sticker phreak-tilt-r px-2 py-0.5" style={{ background: '#FFE600', color: '#000' }}>
                    <span className="phreak-headline" style={{ fontSize: '0.85rem' }}>
                      RaNK UP <Star className="inline w-3 h-3" />
                    </span>
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismiss(n.id);
                  }}
                  aria-label="Dismiss"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#666',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    padding: '0 4px',
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}