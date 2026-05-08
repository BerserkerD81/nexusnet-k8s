import { useState, useEffect, useCallback } from 'react';
import { PostCard } from '../feed/PostCard';
import { PostSkeleton } from '../ui/Skeleton';
import { Search } from 'lucide-react';
import { getExplorePosts, searchUsers, searchPosts, type FrontPost, type BackendUser } from '../../lib/backend';

interface ExploreScreenProps {
  onPostClick: (post: FrontPost) => void;
  onViewProfile?: (username: string) => void;
}

export function ExploreScreen({ onPostClick, onViewProfile }: ExploreScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [posts, setPosts] = useState<FrontPost[]>([]);
  const [userResults, setUserResults] = useState<BackendUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getExplorePosts()
      .then((items) => { if (active) setPosts(items); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // ✅ NEW: Listen for real-time explore/post updates
  useEffect(() => {
    const handleExploreRefresh = async () => {
      try {
        // If not searching, refresh explore posts
        if (!searchQuery.trim()) {
          const items = await getExplorePosts();
          setPosts(items);
        }
      } catch {
        console.warn('Failed to refresh explore');
      }
    };

    window.addEventListener('explore-refresh', handleExploreRefresh);
    window.addEventListener('feed-refresh', handleExploreRefresh);
    return () => {
      window.removeEventListener('explore-refresh', handleExploreRefresh);
      window.removeEventListener('feed-refresh', handleExploreRefresh);
    };
  }, [searchQuery]);

  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { setUserResults([]); return; }
    setSearching(true);
    try {
      const [users, filtered] = await Promise.all([searchUsers(q), searchPosts(q)]);
      setUserResults(users);
      setPosts(filtered);
    } catch {
      // keep previous results
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => { if (searchQuery) handleSearch(searchQuery); }, 350);
    return () => clearTimeout(id);
  }, [searchQuery, handleSearch]);

  const clearSearch = () => {
    setSearchQuery('');
    setUserResults([]);
    setLoading(true);
    getExplorePosts().then(setPosts).catch(() => {}).finally(() => setLoading(false));
  };

  return (
    <div className="max-w-2xl mx-auto min-h-screen" style={{ borderLeft: '2px solid #1a0000', borderRight: '2px solid #1a0000' }}>
      <div className="sticky top-0 z-10 bg-black p-4" style={{ borderBottom: '2px dashed #E8002D' }}>
        <div className="flex items-baseline gap-3 mb-3">
          <h2 style={{ margin: 0, fontSize: '2.2rem', color: '#E8002D' }}>★ STeaL</h2>
          <span className="phreak-jp" style={{ color: '#E8002D' }}>// 探索</span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#E8002D' }} />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="SeaRCH PeoRLe & PoSTs..."
            className="w-full pl-9 pr-4 py-2 focus:outline-none"
            style={{
              background: '#111', borderBottom: '2px solid #E8002D',
              color: '#F5F0E8', fontFamily: 'Space Mono', fontSize: 13
            }}
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 phreak-mono-label" style={{ color: '#FFE600', fontSize: 10 }}>...</span>
          )}
        </div>
      </div>

      {userResults.length > 0 && (
        <div style={{ borderBottom: '2px dashed #E8002D' }}>
          <div className="px-4 py-2 phreak-mono-label" style={{ color: '#FFE600', background: '#0A0000' }}>
            ◆ PeoPLe ({userResults.length})
          </div>
          {userResults.map((u) => (
            <button
              key={u.id}
              onClick={() => onViewProfile?.(u.username)}
              className="w-full text-left flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: '1px solid #1a0000' }}
            >
              <div
                className="phreak-hex shrink-0"
                style={{ width: 40, height: 40, background: '#1A0000', border: '2px solid #E8002D', display: 'grid', placeItems: 'center' }}
              >
                <span className="phreak-headline" style={{ color: '#F5F0E8', fontSize: 14 }}>
                  {u.displayName.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="phreak-headline" style={{ color: '#F5F0E8', fontSize: '1rem' }}>
                  {u.displayName}
                  {u.isVerified && <span className="ml-2 phreak-sticker px-1" style={{ background: '#FFE600', color: '#000', fontSize: 9 }}>★</span>}
                </div>
                <div className="phreak-handle" style={{ fontSize: 11 }}>@{u.username}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {searchQuery && (
        <div className="px-4 py-2 flex items-center gap-3">
          <span className="phreak-mono-label" style={{ color: '#666', fontSize: 11 }}>
            PoSTs MaTCHiNG "{searchQuery}"
          </span>
          <button onClick={clearSearch} className="phreak-mono-label" style={{ color: '#E8002D', fontSize: 11 }}>
            × CLeaR
          </button>
        </div>
      )}

      {!searchQuery && (
        <div style={{ borderBottom: '2px dashed #E8002D' }}>
          <div className="px-4 py-2 phreak-mono-label" style={{ color: '#FFE600', background: '#0A0000' }}>
            ◆ TReNDiNG PoSTs
          </div>
        </div>
      )}

      {loading ? (
        <><PostSkeleton /><PostSkeleton /><PostSkeleton /></>
      ) : posts.length === 0 ? (
        <div className="p-8 text-center phreak-mono-label" style={{ color: '#666' }}>
          No posts found
        </div>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onClick={() => onPostClick(post)}
            onAuthorClick={onViewProfile}
          />
        ))
      )}
    </div>
  );
}
