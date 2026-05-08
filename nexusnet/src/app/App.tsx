import { useEffect, useRef, useState } from 'react';
import { Toaster } from 'sonner';
import { io, type Socket } from 'socket.io-client';
import { LoginScreen } from './components/screens/LoginScreen';
import { FeedScreen } from './components/screens/FeedScreen';
import { ProfileScreen } from './components/screens/ProfileScreen';
import { MessagesScreen } from './components/screens/MessagesScreen';
import { NotificationsScreen } from './components/screens/NotificationsScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { PostDetailScreen } from './components/screens/PostDetailScreen';
import { ExploreScreen } from './components/screens/ExploreScreen';
import { Sidebar } from './components/layout/Sidebar';
import { RightSidebar } from './components/layout/RightSidebar';
import { Avatar } from './components/ui/Avatar';
import { Bell, Home, Compass, Mail, User as UserIcon, type LucideIcon } from 'lucide-react';
import {
  clearSession,
  getMeProfile,
  getSessionUser,
  consumeOAuthCallback,
  loadSession,
  type FrontPost,
  type BackendUser,
} from './lib/backend';

type View = 'feed' | 'explore' | 'notifications' | 'messages' | 'profile' | 'settings' | 'post-detail';

const NAV_ITEMS: { id: View; icon: LucideIcon; label: string }[] = [
  { id: 'feed', icon: Home, label: 'FeeD' },
  { id: 'explore', icon: Compass, label: 'STeaL' },
  { id: 'notifications', icon: Bell, label: 'aLeRTs' },
  { id: 'messages', icon: Mail, label: 'MsGs' },
  { id: 'profile', icon: UserIcon, label: 'PRoFiLe' },
];

const VIEW_STORAGE_KEY = 'phreak.currentView';
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const POLL_INTERVAL_MS = 30_000;

// ── Helper: trae el contador real del backend ─────────────────
async function fetchUnreadCount(): Promise<number> {
  const session = loadSession();
  if (!session?.accessToken) return 0;
  try {
    const res = await fetch(`${API_URL}/api/v1/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (!res.ok) return 0;
    const body = await res.json().catch(() => null);
    // Soporta { count } directo o { data: { count } } envuelto
    return body?.data?.count ?? body?.count ?? 0;
  } catch {
    return 0;
  }
}

export default function App() {
  // ── Auth ───────────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (consumeOAuthCallback()) return false;
    return Boolean(getSessionUser());
  });

  const [currentUser, setCurrentUser] = useState<BackendUser | null>(() => getSessionUser());

  // ── Vista actual (persistida) ─────────────────────────────────
  const [currentView, setCurrentView] = useState<View>(() => {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY) as View | null;
    if (saved && ['feed', 'explore', 'notifications', 'messages', 'profile', 'settings'].includes(saved)) {
      return saved;
    }
    return 'feed';
  });

  const [selectedPost, setSelectedPost] = useState<FrontPost | null>(null);
  const [viewingProfileUsername, setViewingProfileUsername] = useState<string | null>(null);
  const [profileReturnView, setProfileReturnView] = useState<View>('feed');
  const [settingsReturnView, setSettingsReturnView] = useState<View>('feed');
  const [initialConversationId, setInitialConversationId] = useState<string | null>(null);
  const [pendingPeerUsername, setPendingPeerUsername] = useState<string | null>(null);

  // ── Contador de no leídas (real, desde backend) ───────────────
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const socketRef = useRef<Socket | null>(null);

  // ── Persistir currentView (excepto post-detail) ───────────────
  useEffect(() => {
    if (currentView === 'post-detail') return;
    localStorage.setItem(VIEW_STORAGE_KEY, currentView);
  }, [currentView]);

  // ── Validar sesión al montar ──────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;

    getMeProfile()
      .then((user) => {
        if (active) setCurrentUser(user);
      })
      .catch((err) => {
        if (!active) return;
        const msg = String(err?.message ?? '');
        const isAuthError = /401|403|unauthorized|forbidden|invalid token/i.test(msg);
        if (isAuthError) {
          console.warn('[App] session invalid, logging out:', msg);
          clearSession();
          setIsAuthenticated(false);
          setCurrentUser(null);
        } else {
          console.warn('[App] /me failed (non-auth, ignoring):', msg);
        }
      });

    return () => { active = false; };
  }, [isAuthenticated]);

  // ── Polling de contador de no leídas ──────────────────────────
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let active = true;

    const refresh = async () => {
      const count = await fetchUnreadCount();
      if (active) setUnreadCount(count);
    };

    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  // ── Socket en vivo ────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    const session = loadSession();
    if (!session?.accessToken || !session?.user?.id) return;

    const socket = io(API_URL, {
      auth: {
        token: session.accessToken,
        userId: session.user.id,
      },
      transports: ['websocket'],
      path: '/socket.io',
    });

    // ✅ Notification event - refresh unread count and user profile
    socket.on('notification', async () => {
      const count = await fetchUnreadCount();
      setUnreadCount(count);
      const freshUser = await getMeProfile().catch(() => null);
      if (freshUser) setCurrentUser(freshUser);
    });

    // ✅ NEW: Post created or updated - trigger feed refresh
    socket.on('new_post', () => {
      // Trigger feed refresh by emitting a custom event that FeedScreen listens to
      window.dispatchEvent(new CustomEvent('feed-refresh'));
    });

    socket.on('post_updated', () => {
      // Trigger feed/explore refresh
      window.dispatchEvent(new CustomEvent('feed-refresh'));
      window.dispatchEvent(new CustomEvent('explore-refresh'));
    });

    // ✅ NEW: New message received
    socket.on('new_message_sent', () => {
      window.dispatchEvent(new CustomEvent('messages-refresh'));
    });

    // ✅ NEW: Conversations list updated
    socket.on('conversations_updated', () => {
      window.dispatchEvent(new CustomEvent('conversations-refresh'));
    });

    // ✅ NEW: Feed needs refresh (feed was updated)
    socket.on('feed_updated', () => {
      window.dispatchEvent(new CustomEvent('feed-refresh'));
    });

    socket.on('connect_error', (err: any) => {
      console.warn('[App] socket connect_error:', err.message);
    });

    socketRef.current = socket;
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated]);

  // ── Cuando entras a aLeRTs, refresca el badge tras unos segundos ──
  useEffect(() => {
    if (currentView !== 'notifications') return;

    // Refresco inmediato (por si recién marcó algo)
    const t1 = setTimeout(async () => {
      const count = await fetchUnreadCount();
      setUnreadCount(count);
    }, 2500);

    // Refresco final (después del auto-mark del NotificationsScreen)
    const t2 = setTimeout(async () => {
      const count = await fetchUnreadCount();
      setUnreadCount(count);
    }, 5000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [currentView]);

  // ── Cuando vuelves a la pestaña del navegador, refresca ───────
  useEffect(() => {
    if (!isAuthenticated) return;

    const onVisibility = async () => {
      if (document.visibilityState === 'visible') {
        const count = await fetchUnreadCount();
        setUnreadCount(count);
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [isAuthenticated]);

  // ── Login screen ──────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="dark">
        <LoginScreen onLoginSuccess={() => {
          setCurrentUser(getSessionUser());
          setIsAuthenticated(true);
        }} />
      </div>
    );
  }

  // ── Handlers ───────────────────────────────────────────────────
  const handlePostClick = (post: FrontPost) => {
    setSelectedPost(post);
    setCurrentView('post-detail');
  };

  const handleViewProfile = (username: string) => {
    setViewingProfileUsername(username);
    setProfileReturnView(currentView === 'post-detail' ? 'feed' : currentView);
    setCurrentView('profile');
  };

  const handleStartChat = (conversationId: string) => {
    setInitialConversationId(conversationId);
    setPendingPeerUsername(null);
    setCurrentView('messages');
  };

  const handleOpenMessage = (conversationId?: string, peerUsername?: string) => {
    if (conversationId) {
      setInitialConversationId(conversationId);
      setPendingPeerUsername(null);
    } else if (peerUsername) {
      setInitialConversationId(null);
      setPendingPeerUsername(peerUsername);
    }
    setCurrentView('messages');
  };

  const handleBackFromPost = () => {
    setCurrentView('feed');
    setSelectedPost(null);
  };

  const handleViewSettings = () => {
    setSettingsReturnView(currentView);
    setCurrentView('settings');
  };

  const navigateTo = (view: View) => {
    if (view === 'profile') setViewingProfileUsername(null);
    if (view !== 'messages') {
      setInitialConversationId(null);
      setPendingPeerUsername(null);
    }
    setCurrentView(view);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'feed':
        return <FeedScreen onPostClick={handlePostClick} onViewProfile={handleViewProfile} />;
      case 'explore':
        return <ExploreScreen onPostClick={handlePostClick} onViewProfile={handleViewProfile} />;
      case 'notifications':
        return (
          <NotificationsScreen
            onViewProfile={handleViewProfile}
            onOpenMessage={handleOpenMessage}
          />
        );
      case 'messages':
        return (
          <MessagesScreen
            initialConversationId={initialConversationId}
            pendingPeerUsername={pendingPeerUsername ?? undefined}
          />
        );
      case 'profile':
        return (
          <ProfileScreen
            onPostClick={handlePostClick}
            username={viewingProfileUsername}
            onStartChat={handleStartChat}
            onViewProfile={handleViewProfile}
            onViewSettings={handleViewSettings}
            currentUser={currentUser}
            onBack={viewingProfileUsername ? () => {
              setViewingProfileUsername(null);
              setCurrentView(profileReturnView);
            } : undefined}
          />
        );
      case 'settings':
        return <SettingsScreen currentUser={currentUser} onProfileUpdated={setCurrentUser} onClose={() => setCurrentView(settingsReturnView)} />;

      case 'post-detail':
        return selectedPost
          ? <PostDetailScreen post={selectedPost} onBack={handleBackFromPost} onViewProfile={handleViewProfile} />
          : <FeedScreen onPostClick={handlePostClick} onViewProfile={handleViewProfile} />;
      default:
        return <FeedScreen onPostClick={handlePostClick} onViewProfile={handleViewProfile} />;
    }
  };

  const showSidebars = true;
  const hideMobileChromeForMessages = false;
  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="bottom-right" />
      <div className="flex">
        {showSidebars && (
          <div className="hidden md:block sticky top-0 h-screen z-30">
            <Sidebar
              currentView={currentView}
              onNavigate={(view) => navigateTo(view as View)}
            />
          </div>
        )}

        <div className="flex-1 min-w-0 relative">
          {showSidebars && !hideMobileChromeForMessages && (
            <div
              className="sticky top-0 z-20 md:hidden"
              style={{ background: '#0A0000', borderBottom: '2px solid #E8002D', height: 48 }}
            >
              <div className="flex items-center justify-between h-full px-4">
                <button
                  onClick={() => navigateTo('feed')}
                  className="phreak-headline"
                  style={{
                    fontSize: 24,
                    color: '#FFFFFF',
                    textShadow: '2px 2px 0 #E8002D',
                    letterSpacing: '0.05em',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  PHREAK
                </button>
                <div className="flex items-center gap-3">
                  <button
                    className="relative p-1"
                    onClick={() => navigateTo('notifications')}
                    aria-label="Notifications"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                  >
                    <Bell className="w-5 h-5 text-[#FFFFFF]" />
                    {unreadCount > 0 && (
                      <span
                        style={{
                          position: 'absolute',
                          top: -2,
                          right: -2,
                          background: '#FFE600',
                          color: '#000',
                          fontSize: 9,
                          fontFamily: 'Bebas Neue',
                          padding: '0 4px',
                          minWidth: 14,
                          textAlign: 'center',
                          border: '1px solid #000',
                          transform: 'rotate(-3deg)',
                        }}
                      >
                        {badgeText}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => navigateTo('profile')}
                    aria-label="Profile"
                    className="phreak-hex"
                    style={{
                      width: 32,
                      height: 32,
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                        width: '100%',
                        height: '100%',
                        overflow: 'hidden',
                        border: '2px solid #E8002D',
                      }}
                    >
                      <Avatar
                        src={currentUser?.avatarUrl ?? ''}
                        alt={currentUser?.displayName ?? 'User'}
                        size="sm"
                      />
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className={hideMobileChromeForMessages ? '' : 'pb-[68px] md:pb-0'}>
            {renderContent()}
          </div>

          {showSidebars && !hideMobileChromeForMessages && (
            <div
              className="fixed bottom-0 left-0 right-0 md:hidden z-30"
              style={{ background: '#000', borderTop: '2px solid #E8002D', height: 60 }}
            >
              <div className="flex justify-around items-center h-full px-1">
                {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
                  const active = currentView === id;
                  const showBadge = id === 'notifications' && unreadCount > 0;
                  return (
                    <button
                      key={id}
                      onClick={() => navigateTo(id)}
                      className="flex flex-col items-center justify-center relative"
                      style={{
                        width: '20%',
                        height: 52,
                        background: active ? '#E8002D' : 'transparent',
                        transform: active ? 'skewX(-8deg)' : 'none',
                        transition: 'background 100ms steps(2)',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{ transform: active ? 'skewX(8deg)' : 'none' }}
                        className="flex flex-col items-center"
                      >
                        {active && <span style={{ color: '#FFE600', fontSize: 8, lineHeight: 1 }}>★</span>}
                        <div className="relative">
                          <Icon className="w-5 h-5" style={{ color: active ? '#FFFFFF' : '#CCCCCC' }} />
                          {showBadge && (
                            <span
                              style={{
                                position: 'absolute',
                                top: -4,
                                right: -8,
                                background: '#FFE600',
                                color: '#000',
                                fontSize: 9,
                                fontFamily: 'Bebas Neue',
                                padding: '0 3px',
                                minWidth: 12,
                                textAlign: 'center',
                                border: '1px solid #000',
                                transform: 'rotate(-3deg)',
                                lineHeight: '12px',
                              }}
                            >
                              {badgeText}
                            </span>
                          )}
                        </div>
                        <span
                          className="hidden sm:inline phreak-mono-label"
                          style={{
                            fontSize: 8,
                            color: active ? '#FFFFFF' : '#CCCCCC',
                            marginTop: 2,
                          }}
                        >
                          {label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {showSidebars && (
          <div className="hidden xl:block sticky top-0 h-screen">
            <RightSidebar />
          </div>
        )}
      </div>
    </div>
  );
}