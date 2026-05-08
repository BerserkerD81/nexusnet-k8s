import { useState, useEffect } from 'react';
import { Avatar } from '../ui/Avatar';
import { PostSkeleton } from '../ui/Skeleton';
import { Heart, MessageCircle, Repeat2, Share, ArrowLeft } from 'lucide-react';
import { getPost, getPostReplies, likePost, repostPost, createComment, likeComment, getSessionUser, type FrontPost } from '../../lib/backend';

interface PostDetailScreenProps {
  post: FrontPost | null;
  onBack: () => void;
  onViewProfile?: (username: string) => void;
}

export function PostDetailScreen({ post: initialPost, onBack, onViewProfile }: PostDetailScreenProps) {
  const [post, setPost] = useState<FrontPost | null>(initialPost);
  const [replies, setReplies] = useState<FrontPost[]>([]);
  const [replyText, setReplyText] = useState('');
  const [loadingReplies, setLoadingReplies] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const currentUser = getSessionUser();

  useEffect(() => {
    if (!initialPost?.id) return;
    let active = true;

    const load = async () => {
      setLoadingReplies(true);
      try {
        const [fresh, fetchedReplies] = await Promise.all([
          getPost(initialPost.id),
          getPostReplies(initialPost.id)
        ]);
        if (!active) return;
        setPost(fresh);
        setReplies(fetchedReplies);
      } catch {
        // keep initial post
      } finally {
        if (active) setLoadingReplies(false);
      }
    };

    load();
    return () => { active = false; };
  }, [initialPost?.id]);

  const handleLike = async () => {
    if (!post) return;
    try {
      const result = await likePost(post.id);
      setPost((p) => p ? { ...p, liked: result.liked, likes: result.likesCount } : p);
    } catch {}
  };

  const handleRepost = async () => {
    if (!post) return;
    try {
      const result = await repostPost(post.id);
      setPost((p) => p ? { ...p, reposted: result.reposted, reposts: result.repostsCount } : p);
    } catch {}
  };

  const handleReply = async () => {
    if (!post || !replyText.trim()) return;
    setSubmitting(true);
    try {
      const created = await createComment(post.id, replyText.trim());
      setReplyText('');
      if (created) {
        setReplies((prev) => [...prev, created]);
      } else {
        const refreshed = await getPostReplies(post.id);
        setReplies(refreshed);
      }
      setPost((p) => p ? { ...p, replies: p.replies + 1 } : p);
    } catch {}
    finally { setSubmitting(false); }
  };

  const handleLikeReply = async (replyId: string | number) => {
    const target = replies.find((r) => r.id === replyId);
    if (!target) return;
    try {
      if (target.kind === 'post') {
        const result = await likePost(replyId);
        setReplies((prev) => prev.map((r) => r.id === replyId ? { ...r, liked: result.liked, likes: result.likesCount } : r));
      } else {
        const result = await likeComment(String(replyId));
        setReplies((prev) => prev.map((r) => r.id === replyId ? { ...r, liked: result.liked, likes: result.likesCount } : r));
      }
    } catch {}
  };

  const active = post ?? initialPost;
  if (!active) return null;

  return (
    <div className="max-w-2xl mx-auto min-h-screen" style={{ borderLeft: '2px solid #1a0000', borderRight: '2px solid #1a0000' }}>
      <div className="sticky top-0 z-10 bg-black flex items-center gap-4 p-4" style={{ borderBottom: '2px dashed #E8002D' }}>
        <button onClick={onBack} className="phreak-btn" style={{ padding: '4px 12px', fontSize: '0.9rem' }}>
          <ArrowLeft className="w-4 h-4 inline mr-1" /> BaCK
        </button>
        <span className="phreak-headline" style={{ color: '#F5F0E8', fontSize: '1.4rem' }}>PoST</span>
      </div>

      {/* Main post */}
      <div className="p-4" style={{ borderBottom: '2px dashed #E8002D' }}>
        <div className="flex gap-3 mb-4">
          <button onClick={() => onViewProfile?.(active.handle.replace(/^@/, ''))}>
            <Avatar src={active.avatar} alt={active.author} size="md" />
          </button>
          <div>
            <button
              onClick={() => onViewProfile?.(active.handle.replace(/^@/, ''))}
              className="phreak-headline"
              style={{ color: '#F5F0E8', fontSize: '1.1rem' }}
            >
              {active.author}
            </button>
            <p className="phreak-handle" style={{ fontSize: 12 }}>{active.handle}</p>
          </div>
        </div>

        <p style={{ fontFamily: 'Archivo, sans-serif', color: '#F5F0E8', fontSize: '1.2rem', lineHeight: 1.6, marginBottom: 12 }}>
          {active.content}
        </p>
        {active.image && (
          <img src={active.image} alt="" className="w-full rounded mb-3" style={{ border: '2px solid #1a0000' }} />
        )}

        <p className="phreak-mono-label" style={{ color: '#666', marginBottom: 12 }}>{active.timestamp}</p>

        <div className="flex items-center gap-6 py-3" style={{ borderTop: '1px dashed #E8002D', borderBottom: '1px dashed #E8002D' }}>
          {[
            { n: active.replies, label: 'RePLieS' },
            { n: active.reposts, label: 'ReTWeeKS' },
            { n: active.likes, label: 'LiKeS' }
          ].map(({ n, label }) => (
            <div key={label}>
              <span className="phreak-headline" style={{ color: '#E8002D', fontSize: '1.4rem' }}>{n} </span>
              <span className="phreak-mono-label" style={{ color: '#b8a89a', fontSize: 11 }}>{label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-around py-3">
          <button className="flex items-center gap-1 phreak-mono-label" style={{ color: '#666', fontSize: 11 }}>
            <MessageCircle className="w-5 h-5" />
          </button>
          <button
            onClick={handleRepost}
            className="flex items-center gap-1 phreak-mono-label"
            style={{ color: active.reposted ? '#00FFE5' : '#666', fontSize: 11 }}
          >
            <Repeat2 className="w-5 h-5" />
          </button>
          <button
            onClick={handleLike}
            className="flex items-center gap-1 phreak-mono-label"
            style={{ color: active.liked ? '#E8002D' : '#666', fontSize: 11 }}
          >
            <Heart className={`w-5 h-5 ${active.liked ? 'fill-current' : ''}`} />
          </button>
          <button className="flex items-center gap-1 phreak-mono-label" style={{ color: '#666', fontSize: 11 }}>
            <Share className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Reply composer */}
      <div className="p-4" style={{ borderBottom: '2px dashed #E8002D' }}>
        <div className="flex gap-3">
          <Avatar src={currentUser?.avatarUrl ?? ''} alt={currentUser?.displayName ?? 'You'} size="md" />
          <div className="flex-1">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="PoST YoUR RePLY..."
              className="w-full min-h-[70px] bg-transparent resize-none focus:outline-none"
              style={{ fontFamily: 'Archivo, sans-serif', color: '#F5F0E8', borderBottom: '2px solid #E8002D' }}
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleReply}
                disabled={!replyText.trim() || submitting}
                className="phreak-btn"
                style={{ opacity: replyText.trim() && !submitting ? 1 : 0.4, fontSize: '0.9rem', padding: '6px 14px' }}
              >
                {submitting ? 'SeNDiNG...' : 'RePLY'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Replies */}
      {loadingReplies ? (
        <><PostSkeleton /><PostSkeleton /></>
      ) : replies.length === 0 ? (
        <div className="p-8 text-center phreak-mono-label" style={{ color: '#666' }}>No replies yet. Be the first.</div>
      ) : (
        replies.map((reply) => (
          <div key={reply.id} className="p-4" style={{ borderBottom: '1px solid #1a0000' }}>
            <div className="flex gap-3">
              <button onClick={() => onViewProfile?.(reply.handle.replace(/^@/, ''))}>
                <Avatar src={reply.avatar} alt={reply.author} size="md" />
              </button>
              <div className="flex-1">
                <div className="flex items-baseline gap-2 mb-1">
                  <button
                    onClick={() => onViewProfile?.(reply.handle.replace(/^@/, ''))}
                    className="phreak-headline"
                    style={{ color: '#F5F0E8', fontSize: '1rem' }}
                  >
                    {reply.author}
                  </button>
                  <span className="phreak-handle" style={{ fontSize: 11 }}>{reply.handle}</span>
                  <span className="phreak-mono-label" style={{ color: '#666', fontSize: 10 }}>· {reply.timestamp}</span>
                </div>
                <p style={{ fontFamily: 'Archivo, sans-serif', color: '#F5F0E8', marginBottom: 8 }}>{reply.content}</p>
                <div className="flex items-center gap-6">
                  <button
                    onClick={() => handleLikeReply(reply.id)}
                    className="flex items-center gap-1 phreak-mono-label"
                    style={{ color: reply.liked ? '#E8002D' : '#666', fontSize: 11 }}
                  >
                    <Heart className={`w-4 h-4 ${reply.liked ? 'fill-current' : ''}`} />
                    <span>{reply.likes}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
