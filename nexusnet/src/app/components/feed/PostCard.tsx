import React, { useState } from 'react';
import { Avatar } from '../ui/Avatar';
import { Heart, MessageCircle, Repeat2, Share, Star, Zap } from 'lucide-react';
import { likePost, repostPost } from '../../lib/backend';

type ActionIconProps = {
  children: React.ReactNode;
  rot: number;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  active?: boolean;
};

function ActionIcon({ children, rot, onClick, active }: ActionIconProps) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 group">
      <span
        style={{
          width: 28, height: 28, display: 'grid', placeItems: 'center',
          border: `2px solid ${active ? '#E8002D' : '#F5F0E8'}`,
          transform: `rotate(${rot}deg)`,
          transition: 'transform 80ms steps(2)',
          background: '#0a0000',
        }}
        className="group-hover:translate-x-[-2px] group-hover:translate-y-[-2px] group-hover:border-[#E8002D]"
      >
        {children}
      </span>
    </button>
  );
}

interface PostCardProps {
  post: {
    id: string | number;
    author: string;
    handle: string;
    avatar?: string;
    timestamp: string;
    content: string;
    image?: string;
    images?: string[]; // ✅ NEW: support multiple images
    likes: number;
    reposts: number;
    replies: number;
    liked?: boolean;
    reposted?: boolean;
    authorId?: string;
    mood?: string | null;
    pollQuestion?: string | null;
    pollOptions?: string[];
  };
  onClick?: () => void;
  onShowtime?: () => void;
  /** Called when the author avatar/name is clicked — receives the username without @. */
  onAuthorClick?: (username: string) => void;
}

function StampedName({ name }: { name: string }) {
  return (
    <span style={{ display: 'inline-block', WebkitTextStroke: '1px #000' }}>
      {name.split('').map((c, i) => (
        <span
          key={i}
          className="phreak-headline"
          style={{
            display: 'inline-block',
            color: '#FFFFFF',
            fontSize: i % 3 === 1 ? '22px' : '18px',
            lineHeight: 1,
            textShadow: '3px 3px 0 #E8002D',
            transform: `rotate(${(i % 2 ? -1 : 1) * (i % 3)}deg)`,
            padding: '0 1px',
          }}
        >
          {c}
        </span>
      ))}
    </span>
  );
}

const Diamond = () => <span style={{ color: '#E8002D', fontSize: '10px', margin: '0 4px' }}>◆</span>;

export function PostCard({ post, onClick, onShowtime, onAuthorClick }: PostCardProps) {
  // ✅ FIX: initialize liked/reposted from the post data returned by the backend
  const [liked, setLiked] = useState(Boolean(post.liked));
  const [reposted, setReposted] = useState(Boolean(post.reposted));
  const [likesCount, setLikesCount] = useState(post.likes);
  const [repostsCount, setRepostsCount] = useState(post.reposts);
  const [bursting, setBursting] = useState(false);
  const [spin, setSpin] = useState(false);
  const [shownTriggered, setShownTriggered] = useState(false);
  const [badgeFlash, setBadgeFlash] = useState(false);

  const isShowtime = likesCount >= 100 || repostsCount >= 50;

  const triggerShowtime = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (shownTriggered || !onShowtime) return;
    setBadgeFlash(true);
    setTimeout(() => setBadgeFlash(false), 200);
    setShownTriggered(true);
    onShowtime();
  };

  // ✅ FIX: actually calls the API and reflects real server state
  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const wasLiked = liked;
    // Optimistic update
    setLiked(!wasLiked);
    setLikesCount((c) => c + (wasLiked ? -1 : 1));
    if (!wasLiked) { setBursting(true); setTimeout(() => setBursting(false), 400); }
    try {
      const result = await likePost(post.id);
      setLiked(result.liked);
      setLikesCount(result.likesCount);
    } catch {
      // Revert on error
      setLiked(wasLiked);
      setLikesCount((c) => c + (wasLiked ? 1 : -1));
    }
  };

  // ✅ FIX: actually calls the API
  const handleRepost = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const wasReposted = reposted;
    setReposted(!wasReposted);
    setRepostsCount((c) => c + (wasReposted ? -1 : 1));
    setSpin(true);
    setTimeout(() => setSpin(false), 400);
    try {
      const result = await repostPost(post.id);
      setReposted(result.reposted);
      setRepostsCount(result.repostsCount);
    } catch {
      setReposted(wasReposted);
      setRepostsCount((c) => c + (wasReposted ? 1 : -1));
    }
  };

  // ✅ NEW: navigate to author profile when clicking avatar or name
  const handleAuthorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAuthorClick && post.handle) {
      // handle is stored as "@username"
      const username = post.handle.replace(/^@/, '');
      onAuthorClick(username);
    }
  };

  return (
    <div
      onClick={onClick}
      className="phreak-card-tex phreak-slide-in phreak-fold relative p-4 mb-2 cursor-pointer overflow-visible"
      style={{
        background: '#111111',
        borderLeft: '5px solid #E8002D',
        borderTop: '1px dashed rgba(232,0,45,0.6)',
        boxShadow: '-3px 0 10px rgba(232,0,45,0.5)',
        transition: 'transform 150ms steps(3), background 150ms steps(3), box-shadow 150ms steps(3)',
      }}
      onMouseOver={(e) => { e.currentTarget.style.background = '#1A0000'; e.currentTarget.style.boxShadow = '-4px 0 16px rgba(232,0,45,0.6)'; }}
      onMouseOut={(e) => { e.currentTarget.style.background = '#111111'; e.currentTarget.style.boxShadow = '-3px 0 10px rgba(232,0,45,0.5)'; }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = 'rotate(-1deg)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'rotate(0deg)')}
    >
      <div className="flex gap-3">
        {/* ✅ NEW: avatar is clickable to view author profile */}
        <button
          onClick={handleAuthorClick}
          className="phreak-hex shrink-0"
          style={{ width: 50, height: 50 }}
          title={`View ${post.author}'s profile`}
        >
          <div style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', width: '100%', height: '100%', overflow: 'hidden' }}>
            <Avatar src={post.avatar} alt={post.author} size="md" />
          </div>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            {/* ✅ NEW: author name is also clickable */}
            <button onClick={handleAuthorClick} className="hover:underline">
              <StampedName name={post.author} />
            </button>
            <Star className="w-3 h-3" fill="#FFE600" stroke="#FFE600" />
            <Diamond />
            <span className="phreak-handle">{post.handle}</span>
            <Diamond />
            <span className="phreak-mono-label" style={{ color: '#666' }}>{post.timestamp}</span>
            {isShowtime && !shownTriggered && (
              <button
                onClick={triggerShowtime}
                className={`phreak-sticker phreak-headline ml-auto group relative phreak-breathe`}
                style={{
                  background: badgeFlash ? '#FFFFFF' : '#FFE600',
                  color: '#000', padding: '3px 8px', fontSize: '13px',
                  letterSpacing: '0.1em', border: '2px solid #000',
                  boxShadow: '3px 3px 0 #000',
                  transition: 'transform 100ms steps(2), box-shadow 100ms steps(2), background 200ms steps(2)',
                }}
                title="TRiGGeR SHoWTiMe // クリックして発動"
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translate(-2px,-2px) rotate(-2deg) scale(1.1)'; e.currentTarget.style.boxShadow = '5px 5px 0 #000'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '3px 3px 0 #000'; }}
              >
                <Zap className="inline w-3.5 h-3.5 mb-0.5" /> SHoWTiMe
              </button>
            )}
            {isShowtime && shownTriggered && (
              <span className="phreak-sticker phreak-headline ml-auto" style={{ background: '#333', color: '#FFFFFF', padding: '2px 8px', fontSize: '11px', letterSpacing: '0.1em' }}>
                ★ SHoWN
              </span>
            )}
          </div>
          <div className="phreak-jp" style={{ color: '#FF6666', letterSpacing: '0.3em', fontSize: 11 }}>// スタンプ済 — PHaNToM ThieF</div>

          <div className="phreak-diagonal-divider my-3" style={{ height: 2 }} />

          <p className="whitespace-pre-wrap" style={{ fontFamily: 'Archivo, sans-serif', fontSize: 15, lineHeight: 1.6, color: '#F5F0E8' }}>
            {post.content}
          </p>

          {/* ✅ IMPROVED: Better mood display with emoji styling */}
          {post.mood && (
            <div className="mt-3 inline-block phreak-sticker" style={{
              background: 'linear-gradient(135deg, #FFE600 0%, #FFC700 100%)',
              color: '#000',
              padding: '6px 12px',
              fontSize: '1rem',
              fontWeight: 'bold',
              boxShadow: '2px 2px 0 #000',
              border: '2px solid #000'
            }}>
              <span style={{ fontSize: '1.4em', marginRight: '6px' }}>{post.mood}</span>
              <span className="phreak-headline">MoOD</span>
            </div>
          )}

          {/* ✅ IMPROVED: Better poll display with interactive styling */}
          {post.pollQuestion && Array.isArray(post.pollOptions) && post.pollOptions.length > 0 && (
            <div className="mt-3 p-3" style={{
              border: '3px solid #00FFE5',
              background: 'linear-gradient(135deg, #050505 0%, #0a0a0a 100%)',
              boxShadow: '4px 4px 0 #00FFE5',
              transform: 'rotate(-1deg)'
            }}>
              <div className="phreak-headline" style={{ color: '#00FFE5', fontSize: '1.1rem', marginBottom: '8px' }}>
                📊 {post.pollQuestion}
              </div>
              <div className="mt-3 space-y-2">
                {post.pollOptions.map((option, index) => (
                  <div
                    key={`${post.id}-poll-${index}`}
                    className="phreak-mono-label"
                    style={{
                      border: '2px solid #00FFE5',
                      padding: '8px 12px',
                      color: '#F5F0E8',
                      background: '#0a0a0a',
                      cursor: 'pointer',
                      transition: 'all 80ms steps(2)',
                      transform: 'rotate(0.5deg)'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.transform = 'rotate(-0.5deg) scale(1.02)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#0a0a0a'; e.currentTarget.style.transform = 'rotate(0.5deg) scale(1)'; }}
                  >
                    <span style={{ color: '#00FFE5', marginRight: '8px' }}>[{index + 1}]</span>
                    {option}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ✅ NEW: Display multiple images in grid */}
          {(post.images && post.images.length > 0 ? post.images : (post.image ? [post.image] : [])).length > 0 && (
            <div
              className="mt-3 grid gap-2 overflow-hidden phreak-fold"
              style={{
                gridTemplateColumns: (post.images?.length ?? 1) > 2 ? 'repeat(2, 1fr)' : (post.images?.length ?? 1) === 1 ? '1fr' : '1fr 1fr',
                border: '3px solid #E8002D',
                boxShadow: '4px 4px 0 #000'
              }}
            >
              {(post.images && post.images.length > 0 ? post.images : (post.image ? [post.image] : [])).map((img, idx) => (
                <div
                  key={`${post.id}-img-${idx}`}
                  className="relative overflow-hidden"
                  style={{ background: '#000', minHeight: '200px', transform: idx % 2 === 0 ? 'rotate(-0.5deg)' : 'rotate(0.5deg)' }}
                >
                  <img src={img} alt={`image-${idx}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(0deg, rgba(232,0,45,0.06) 0 2px, transparent 2px 4px)' }} />
                </div>
              ))}
            </div>
          )}

          <div className="phreak-diagonal-divider my-3" style={{ height: 2 }} />

          <div className="flex items-center gap-3">
            <ActionIcon rot={-1} onClick={(e) => e.stopPropagation()}>
              <MessageCircle className="w-4 h-4 text-[#F5F0E8]" />
            </ActionIcon>
            <span className="phreak-mono-label" style={{ color: post.replies > 0 ? '#FFE600' : '#F5F0E8', transform: post.replies > 0 ? 'rotate(-2deg)' : 'none', display: 'inline-block' }}>{post.replies}</span>

            <Diamond />

            <ActionIcon rot={2} active={reposted} onClick={handleRepost}>
              <Repeat2 className="w-4 h-4" style={{ color: reposted ? '#00FFE5' : '#F5F0E8', transform: spin ? 'rotate(180deg)' : 'none', transition: 'transform 400ms steps(8)' }} />
            </ActionIcon>
            <span className="phreak-mono-label" style={{ color: repostsCount > 0 ? '#FFE600' : '#F5F0E8' }}>{repostsCount}</span>

            <Diamond />

            <ActionIcon rot={-3} active={liked} onClick={handleLike}>
              <span className="relative">
                <Heart className={`w-4 h-4 ${liked ? 'fill-[#E8002D] text-[#E8002D]' : 'text-[#F5F0E8]'} ${bursting ? 'phreak-pop' : ''}`} />
                {bursting && (
                  <svg className="absolute -top-3 -left-3 w-10 h-10 pointer-events-none" viewBox="0 0 40 40">
                    {[0, 72, 144, 216, 288].map((a) => (
                      <circle key={a} cx={20 + Math.cos((a * Math.PI) / 180) * 14} cy={20 + Math.sin((a * Math.PI) / 180) * 14} r="2.5" fill="#E8002D" />
                    ))}
                  </svg>
                )}
              </span>
            </ActionIcon>
            <span className="phreak-mono-label" style={{ color: likesCount > 0 ? '#FFE600' : '#F5F0E8' }}>{likesCount}</span>

            <ActionIcon rot={1} onClick={(e) => e.stopPropagation()}>
              <Share className="w-4 h-4 text-[#F5F0E8]" />
            </ActionIcon>
          </div>
        </div>
      </div>
    </div>
  );
}