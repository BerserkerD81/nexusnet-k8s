import { useEffect, useState } from 'react';
import { PostCard } from '../feed/PostCard';
import { ComposeModal } from '../feed/ComposeModal';
import { ShowtimeOverlay } from '../feed/ShowtimeOverlay';
import { PostSkeleton } from '../ui/Skeleton';
import { Pencil } from 'lucide-react';
import { createPost, getFeedPosts, getSessionUser, type FrontPost } from '../../lib/backend';
import type { ComposePayload } from '../feed/ComposeModal';

interface FeedScreenProps {
  onPostClick: (post: FrontPost) => void;
  /** Navigate to a user's profile by username. */
  onViewProfile?: (username: string) => void;
}

export function FeedScreen({ onPostClick, onViewProfile }: FeedScreenProps) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showtimePost, setShowtimePost] = useState<FrontPost | null>(null);
  const [showtimeCount, setShowtimeCount] = useState(3);
  const [posts, setPosts] = useState<FrontPost[]>([]);
  const [currentUser, setCurrentUser] = useState({ name: 'You', avatar: '' });

  useEffect(() => {
    let active = true;
    const loadFeed = async () => {
      setLoading(true);
      try {
        const feedPosts = await getFeedPosts();
        if (!active) return;
        const sessionUser = getSessionUser();
        setCurrentUser({ name: sessionUser?.displayName ?? 'You', avatar: sessionUser?.avatarUrl ?? '' });
        setPosts(feedPosts);
      } catch {
        if (active) setPosts([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadFeed();
    return () => { active = false; };
  }, []);

  // ✅ NEW: Listen for real-time feed updates
  useEffect(() => {
    const handleFeedRefresh = async () => {
      try {
        const feedPosts = await getFeedPosts();
        setPosts(feedPosts);
      } catch {
        console.warn('Failed to refresh feed');
      }
    };

    window.addEventListener('feed-refresh', handleFeedRefresh);
    return () => window.removeEventListener('feed-refresh', handleFeedRefresh);
  }, []);

  const handleCompose = async (payload: ComposePayload) => {
    const created = await createPost(payload.content, {
      files: payload.files, // ✅ NEW: pass files directly
      mood: payload.mood,
      poll: payload.poll,
    });
    if (created) {
      setPosts((prev) => [created, ...prev]);
    } else {
      const refreshed = await getFeedPosts();
      setPosts(refreshed);
    }
  };

  return (
    <>
      <div className="max-w-2xl mx-auto min-h-screen relative" style={{ borderLeft: '2px solid #1a0000', borderRight: '2px solid #1a0000' }}>
        <div className="sticky top-0 z-10 bg-black border-b-2 border-[#E8002D] p-4">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 style={{ margin: 0, fontSize: '3rem', color: '#FFFFFF', textShadow: '4px 4px 0 #E8002D', fontStyle: 'normal' }}>FeeD</h2>
            <span className="phreak-jp" style={{ color: '#E8002D', letterSpacing: '0.4em', fontSize: 12 }}>// フィード</span>
            <span className="ml-auto flex items-center gap-2 phreak-sticker" style={{ background: '#E8002D', color: '#FFFFFF', padding: '3px 10px' }}>
              <span className="phreak-blink" style={{ width: 8, height: 8, background: '#FFFFFF', borderRadius: 999, display: 'inline-block' }} />
              <span className="phreak-headline" style={{ fontSize: '0.95rem' }}>LiVe</span>
            </span>
          </div>
          <div className="phreak-mono-label mt-2" style={{ color: '#FFE600' }}>
            ⚡ {showtimeCount} SHoWTiMeS ToDaY <span style={{ color: '#E8002D' }}>// 本日の発動</span>
          </div>
        </div>

        <div className="p-4">
          <button
            onClick={() => setComposeOpen(true)}
            className="w-full flex items-center justify-center gap-2"
            style={{
              height: 52, background: '#E8002D', color: '#FFFFFF',
              borderTop: '2px solid #FFFFFF', borderRight: '2px solid #FFFFFF',
              borderBottom: '2px solid #FFFFFF', borderLeft: '4px solid #FFFFFF',
              boxShadow: '5px 5px 0 #000',
              fontFamily: 'Bebas Neue', fontSize: '1.55rem', letterSpacing: '0.1em', fontWeight: 700,
              transition: 'transform 80ms steps(2), box-shadow 80ms steps(2)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translate(-3px,-3px)'; e.currentTarget.style.boxShadow = '8px 8px 0 #000'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '5px 5px 0 #000'; }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'translate(2px,2px)'; e.currentTarget.style.boxShadow = '2px 2px 0 #000'; }}
          >
            <Pencil className="w-5 h-5" /> ⚡ SToRm THe FeED
          </button>
        </div>

        <button onClick={() => setComposeOpen(true)} className="phreak-fab fixed bottom-20 right-4 z-30 lg:hidden" aria-label="Compose">
          <Pencil className="w-5 h-5" />
        </button>

        {loading ? (
          <><PostSkeleton /><PostSkeleton /><PostSkeleton /></>
        ) : posts.length === 0 ? (
          <div className="p-8 text-center phreak-mono-label" style={{ color: '#666' }}>
            No posts yet. Follow some people or be the first to post!
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onClick={() => onPostClick(post)}
              onShowtime={() => { setShowtimePost(post); setShowtimeCount((c) => c + 1); }}
              // ✅ NEW: allow clicking the author to navigate to their profile
              onAuthorClick={onViewProfile}
            />
          ))
        )}
      </div>

      <ComposeModal
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        currentUser={currentUser}
        onSubmit={handleCompose}
      />
      {showtimePost && <ShowtimeOverlay post={showtimePost} onClose={() => setShowtimePost(null)} />}
    </>
  );
}