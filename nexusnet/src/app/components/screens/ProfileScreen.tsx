import { useEffect, useState } from 'react';
import { Avatar } from '../ui/Avatar';
import { PostCard } from '../feed/PostCard';
import { PostSkeleton } from '../ui/Skeleton';
import { Modal } from '../ui/Modal';
import { Calendar, MapPin, MessageCircle, Settings } from 'lucide-react';
import {
  getMeProfile, getUserPosts, followUser, unfollowUser,
  getFollowers, getFollowing, getFollowRequests, respondToFollowRequest, removeFollower,
  getUserProfile, getSessionUser, createConversation,
  type FrontPost, type BackendUser, type BackendFollower
} from '../../lib/backend';

interface ProfileScreenProps {
  onPostClick: (post: FrontPost) => void;
  username?: string | null;
  onBack?: () => void;
  onStartChat?: (conversationId: string) => void;
  onViewProfile?: (username: string) => void;
  onViewSettings?: () => void;
  currentUser?: BackendUser | null;
}

export function ProfileScreen({ onPostClick, username, onBack, onStartChat, onViewProfile, currentUser }: ProfileScreenProps) {
  const [activeTab, setActiveTab] = useState<'posts' | 'replies' | 'media' | 'likes'>('posts');
  const [profile, setProfile] = useState<BackendUser | null>(null);
  const [posts, setPosts] = useState<FrontPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [pending, setPending] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [followersModalOpen, setFollowersModalOpen] = useState(false);
  const [followersData, setFollowersData] = useState<BackendFollower[]>([]);
  const [followingData, setFollowingData] = useState<BackendFollower[]>([]);
  const [followersTab, setFollowersTab] = useState<'followers' | 'following' | 'requests'>('followers');
  const [followRequests, setFollowRequests] = useState<BackendFollower[]>([]);
  const sessionUser = currentUser ?? getSessionUser();
  const isSelf = Boolean(sessionUser?.id && profile?.id && profile.id === sessionUser.id);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const viewingUsername = username ?? sessionUser?.username;
        if (!viewingUsername) return;
        if (!username && sessionUser) {
          setProfile(sessionUser);
          setFollowing(false);
          setPending(false);
        }
        const me = username ? await getUserProfile(viewingUsername) : await getMeProfile();
        if (!active) return;
        setProfile(me);
        setFollowing(Boolean(me.isFollowing));
        setPending(Boolean(me.isPending));
        const userPosts = await getUserPosts(viewingUsername);
        if (!active) return;
        setPosts(userPosts);
      } catch {}
      finally { if (active) setLoading(false); }
    };
    load();
    return () => { active = false; };
  }, [username, sessionUser?.username]);

  const handleFollow = async () => {
    if (!profile || isSelf) return;
    setFollowLoading(true);
    try {
      if (following || pending) {
        await unfollowUser(profile.id);
        setFollowing(false);
        setPending(false);
        setProfile((p) => p ? { ...p, followersCount: (p.followersCount ?? 1) - 1 } : p);
      } else {
        const result = await followUser(profile.id);
        const status = String(result?.status ?? '').toUpperCase();
        const accepted = status === 'ACCEPTED';
        const isPending = status === 'PENDING';
        setFollowing(accepted);
        setPending(isPending);
        if (accepted) {
          setProfile((p) => p ? { ...p, followersCount: (p.followersCount ?? 0) + 1 } : p);
        }
      }
    } catch {}
    finally { setFollowLoading(false); }
  };

  const handleMessage = async () => {
    if (!profile || isSelf || !onStartChat) return;
    setMessageLoading(true);
    try {
      const conversation = await createConversation(profile.id);
      if (conversation?.id) onStartChat(conversation.id);
    } catch {}
    finally { setMessageLoading(false); }
  };

  const openFollowersModal = async (tab: 'followers' | 'following' | 'requests') => {
    if (!profile) return;
    setFollowersTab(tab);
    setFollowersModalOpen(true);
    try {
      const [f, fing] = await Promise.all([getFollowers(profile.id), getFollowing(profile.id)]);
      setFollowersData(f);
      setFollowingData(fing);
      if (isSelf) {
        const requests = await getFollowRequests();
        setFollowRequests(requests);
      }
    } catch {}
  };

  if (loading || !profile) {
    return (
      <div className="max-w-2xl mx-auto min-h-screen">
        <PostSkeleton /><PostSkeleton /><PostSkeleton />
      </div>
    );
  }

  const joinDate = profile.createdAt
    ? `Joined ${new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`
    : '';

  const shownFollowers = followersTab === 'followers'
    ? followersData
    : followersTab === 'following'
      ? followingData
      : followRequests;

  return (
    <>
      <div className="max-w-2xl mx-auto min-h-screen">
        <div className="sticky top-0 z-10 bg-black p-4" style={{ borderBottom: '2px dashed #E8002D' }}>
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-3">
              {onBack && (
                <button onClick={onBack} className="phreak-btn" style={{ padding: '4px 12px', fontSize: '0.9rem' }}>
                  BaCK
                </button>
              )}
              <h2 style={{ margin: 0, fontSize: '2.2rem', color: '#E8002D' }}>★ PRoFiLe</h2>
              <span className="phreak-jp" style={{ color: '#E8002D' }}>// プロフィール</span>
            </div>
            {isSelf && (
              <button
                onClick={() => onViewSettings?.()}
                className="phreak-btn md:hidden"
                style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="relative">
          {profile.bannerUrl ? (
            <img src={profile.bannerUrl} alt="" className="w-full h-48 object-cover" />
          ) : (
            <div className="h-48 phreak-speedlines relative" style={{ background: '#1a0000' }}>
              <div className="absolute inset-0 phreak-halftone" style={{ opacity: 0.15 }} />
            </div>
          )}
          <div className="px-4 pb-4">
            <div className="flex justify-between items-end -mt-12 mb-4">
              <div className="phreak-hex" style={{ width: 90, height: 90, boxShadow: '0 0 16px rgba(232,0,45,0.6)' }}>
                <div style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', width: '100%', height: '100%', overflow: 'hidden' }}>
                  <Avatar src={profile.avatarUrl ?? ''} alt={profile.displayName} size="xl" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleFollow}
                  disabled={followLoading || isSelf}
                  className="phreak-btn"
                  style={{ minWidth: 140, background: following ? '#E8002D' : 'transparent', color: '#F5F0E8', opacity: followLoading || isSelf ? 0.6 : 1 }}
                >
                  {isSelf ? 'iT\'S YoU' : pending ? 'PeNDiNG' : following ? 'フォロー済 ★' : 'FoLLoW'}
                </button>
                {!isSelf && (
                  <button
                    onClick={handleMessage}
                    disabled={messageLoading}
                    className="phreak-btn"
                    style={{ minWidth: 120, background: 'transparent', color: '#00FFE5', borderColor: '#00FFE5', opacity: messageLoading ? 0.6 : 1 }}
                  >
                    <MessageCircle className="w-4 h-4 inline mr-1" /> MsG
                  </button>
                )}
                {isSelf && (
                  <button
                    onClick={() => onViewSettings?.()}
                    className="phreak-btn hidden md:flex items-center gap-1"
                    style={{ minWidth: 120, background: 'transparent', color: '#00FFE5', borderColor: '#00FFE5' }}
                  >
                    <Settings className="w-4 h-4" /> eDiT
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h2 style={{ margin: 0, fontSize: '2.6rem', color: '#F5F0E8', textShadow: '3px 3px 0 #E8002D', fontStyle: 'normal' }}>
                  {profile.displayName}
                </h2>
                <div className="flex items-center gap-2">
                  <span className="phreak-handle">@{profile.username}</span>
                  {profile.isVerified && <span className="phreak-sticker px-1.5" style={{ background: '#FFE600', color: '#000' }}>★ VeRiFied</span>}
                </div>
              </div>

              {profile.bio && <p style={{ fontFamily: 'Archivo, sans-serif', color: '#F5F0E8' }}>{profile.bio}</p>}

              <div className="flex flex-wrap gap-4 phreak-mono-label" style={{ color: '#b8a89a' }}>
                {joinDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {joinDate}</span>}
                {profile.isPrivate && <span>🔒 PRiVaTe</span>}
              </div>

              <div className="phreak-diagonal-divider my-2" />

              <div className="flex flex-wrap gap-5">
                {[
                  { n: profile.postsCount ?? 0, l: 'PoSTs', onClick: undefined },
                  { n: profile.followersCount ?? 0, l: 'FoLLoWeRS', onClick: () => openFollowersModal('followers') },
                  { n: profile.followingCount ?? 0, l: 'FoLLoWiNG', onClick: () => openFollowersModal('following') },
                ].map((s) => (
                  <button key={s.l} onClick={s.onClick} className="text-left">
                    <span style={{ color: '#E8002D', fontFamily: 'Bebas Neue', fontSize: '1.8rem' }}>◆ {s.n}</span>{' '}
                    <span className="phreak-mono-label" style={{ color: '#F5F0E8' }}>{s.l}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ borderBottom: '2px dashed #E8002D' }}>
          <div className="flex relative">
            {(['posts', 'replies', 'media', 'likes'] as const).map((tab) => {
              const labels: Record<string, string> = { posts: 'PoSTs', replies: 'RePLieS', media: 'MeDiA', likes: 'LiKeS' };
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab} onClick={() => setActiveTab(tab)}
                  className="flex-1 py-3 phreak-headline relative"
                  style={{ color: isActive ? '#F5F0E8' : '#b8a89a', fontSize: '1.1rem' }}
                >
                  {labels[tab]}
                  {isActive && <span className="absolute bottom-0 left-2 right-2 phreak-parallelogram" style={{ height: 4, background: '#E8002D' }} />}
                </button>
              );
            })}
          </div>
        </div>

        {posts.length === 0 ? (
          <div className="p-8 text-center phreak-mono-label" style={{ color: '#666' }}>
            {profile.isPrivate && !isSelf && !following ? (
              <>
                <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔒</div>
                <div style={{ color: '#b8a89a' }}>ThIs AcCoUNT Is PRiVaTe</div>
                <div style={{ fontSize: '0.85rem', color: '#666', marginTop: 6 }}>FoLLoW To SeE PoSTs</div>
              </>
            ) : (
              'No posts yet.'
            )}
          </div>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} onClick={() => onPostClick(post)} />)
        )}
      </div>

      <Modal isOpen={followersModalOpen} onClose={() => setFollowersModalOpen(false)} title="Connections" size="sm">
        <div className="flex gap-2 px-4 pt-3">
          {(['followers', 'following'] as const).map((t) => (
            <button key={t} onClick={() => setFollowersTab(t)}
              className="phreak-parallelogram phreak-headline flex-1"
              style={{ padding: '6px', background: followersTab === t ? '#E8002D' : 'transparent', border: '2px solid #E8002D', color: '#F5F0E8', fontSize: '0.9rem' }}
            >
              {t === 'followers' ? 'FoLLoWeRS' : 'FoLLoWiNG'}
            </button>
          ))}
          {isSelf && (
            <button onClick={() => setFollowersTab('requests')}
              className="phreak-parallelogram phreak-headline flex-1"
              style={{ padding: '6px', background: followersTab === 'requests' ? '#E8002D' : 'transparent', border: '2px solid #E8002D', color: '#F5F0E8', fontSize: '0.9rem' }}
            >
              ReQUeSTS
            </button>
          )}
        </div>
        <div className="p-4 space-y-4">
          {shownFollowers.length === 0 ? (
            <div className="text-center phreak-mono-label" style={{ color: '#666' }}>
              {followersTab === 'followers' && 'No followers yet.'}
              {followersTab === 'following' && 'No following yet.'}
              {followersTab === 'requests' && 'No follow requests.'}
            </div>
          ) : shownFollowers.map((user) => (
            <div key={user.id} className="w-full flex items-center gap-3">
              <button
                type="button"
                onClick={() => onViewProfile?.(user.username)}
                className="flex-1 text-left flex items-center gap-3"
              >
                <div className="phreak-hex shrink-0" style={{ width: 40, height: 40, background: '#1A0000', border: '2px solid #E8002D', display: 'grid', placeItems: 'center' }}>
                  <span className="phreak-headline" style={{ color: '#F5F0E8', fontSize: 13 }}>{user.displayName.slice(0, 2).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="phreak-headline truncate" style={{ color: '#F5F0E8', fontSize: '1rem' }}>
                    {user.displayName}
                    {user.isVerified && <span className="ml-1 phreak-sticker px-1" style={{ background: '#FFE600', color: '#000', fontSize: 9 }}>★</span>}
                  </p>
                  <p className="phreak-handle truncate" style={{ fontSize: 11 }}>@{user.username}</p>
                </div>
              </button>
              {followersTab === 'followers' && isSelf && (
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      await removeFollower(user.id);
                      setFollowersData((prev) => prev.filter((item) => item.id !== user.id));
                      setProfile((p) => p ? { ...p, followersCount: Math.max(0, (p.followersCount ?? 1) - 1) } : p);
                    } catch {}
                  }}
                  className="phreak-btn"
                  style={{ background: 'transparent', borderColor: '#E8002D', color: '#E8002D', padding: '6px 10px', fontSize: '0.8rem' }}
                >
                  ReMoVe
                </button>
              )}
              {followersTab === 'requests' && isSelf && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await respondToFollowRequest(user.id, true);
                        setFollowRequests((prev) => prev.filter((item) => item.id !== user.id));
                        setFollowersData((prev) => [...prev, user]);
                        setProfile((p) => p ? { ...p, followersCount: (p.followersCount ?? 0) + 1 } : p);
                      } catch {}
                    }}
                    className="phreak-btn"
                    style={{ background: '#00FFE5', color: '#000', padding: '6px 10px', fontSize: '0.8rem' }}
                  >
                    AcCePt
                  </button>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await respondToFollowRequest(user.id, false);
                        setFollowRequests((prev) => prev.filter((item) => item.id !== user.id));
                      } catch {}
                    }}
                    className="phreak-btn"
                    style={{ background: 'transparent', borderColor: '#E8002D', color: '#E8002D', padding: '6px 10px', fontSize: '0.8rem' }}
                  >
                    ReJeCT
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Modal>

    </>
  );
}
