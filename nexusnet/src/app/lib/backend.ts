// ─────────────────────────────────────────────────────────────────
// NexusNet — API client (single source of truth for all backend calls)
// ─────────────────────────────────────────────────────────────────

export type BackendUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  isPrivate?: boolean;
  isVerified?: boolean;
  mfaEnabled?: boolean;
  isFollowing?: boolean;
  isPending?: boolean;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type FrontPost = {
  id: string | number;
  author: string;
  handle: string;
  avatar?: string;
  createdAt?: string;
  timestamp: string;
  content: string;
  image?: string;
  images?: string[]; // ✅ NEW: All images for grid display
  likes: number;
  reposts: number;
  replies: number;
  liked?: boolean;
  reposted?: boolean;
  authorId?: string;
  kind?: 'post' | 'comment';
  mood?: string | null;
  pollQuestion?: string | null;
  pollOptions?: string[];
};

export type CreatePostOptions = {
  parentId?: string | number;
  mediaUrls?: string[];
  files?: File[]; // ✅ NEW: for multipart file uploads
  mood?: string | null;
  poll?: {
    question: string;
    options: string[];
  } | null;
};

export type NotificationCard = {
  id: string;
  type: 'like' | 'follow' | 'repost' | 'mention' | 'reply' | 'message';
  user: string;
  handle: string;
  action: string;
  content?: string;
  timestamp: string;
  rankUp: boolean;
  unread: boolean;
};

export type ConversationCard = {
  id: string;
  peerId?: string;
  name: string;
  handle: string;
  last: string;
  timestamp: string;
  unread: number;
  online: boolean;
  verified: boolean;
  avatar?: string;
};

export type ChatMessageCard = {
  id: string;
  content: string;
  timestamp: string;
  createdAt?: string;
  isMine: boolean;
  mediaUrl?: string | null;
  messageType?: 'TEXT' | 'IMAGE' | 'VIDEO';
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: BackendUser;
};

export type BackendSession = {
  id: string;
  deviceInfo?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent?: boolean;
};

export type BackendFollower = {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
  isVerified?: boolean;
};

export type BidirectionalOnlineStatus = {
  bidirectional?: boolean;
  currentOnline?: boolean;
  otherOnline?: boolean;
  isOnline?: boolean;
  userId?: string;
};

type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  message: string;
  pagination?: { nextCursor: string | null; hasMore: boolean };
};

type LoginPayload = { identifier: string; password: string };
type RegisterPayload = { email: string; username: string; password: string; displayName: string };

const SESSION_KEY = 'nexusnet.session';
// ✅ UPDATED: Use a full backend base URL or a reverse-proxied /api prefix
const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

export function loadSession(): AuthSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthSession; } catch { return null; }
}

export function getSessionUser(): BackendUser | null {
  return loadSession()?.user ?? null;
}

export function saveSession(session: AuthSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function absoluteUrl(path: string) {
  const base = API_BASE_URL.replace(/\/$/, '');
  if (path.startsWith(`${base}/`)) {
    return path;
  }
  return `${base}${path}`;
}

export function formatRelativeTime(input?: string | null) {
  if (!input) return 'now';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return 'now';
  const diff = Date.now() - date.getTime();
  if (diff < 0) return 'now';
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString();
}

async function refreshSession(refreshToken: string) {
  const response = await fetch(absoluteUrl('/api/v1/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  const body = (await response.json().catch(() => null)) as ApiResponse<{ accessToken: string; refreshToken: string }> | null;
  if (!response.ok || !body?.success || !body.data) { clearSession(); return null; }
  const current = loadSession();
  if (current) saveSession({ ...current, accessToken: body.data.accessToken, refreshToken: body.data.refreshToken });
  return body.data;
}

// ─── Request helper (tolerante a respuestas envueltas y crudas) ───
async function request<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  const session = loadSession();
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
  if (authenticated && session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`);

  const response = await fetch(absoluteUrl(path), { ...init, headers, credentials: 'include' });

  // 204 No Content → no hay body
  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => null);

  // Auto-refresh en 401
  if (response.status === 401 && authenticated && session?.refreshToken) {
    const refreshed = await refreshSession(session.refreshToken);
    if (refreshed) return request<T>(path, init, authenticated);
  }

  if (!response.ok) {
    const msg = (body && typeof body === 'object' && 'message' in body)
      ? (body as any).message
      : `Request failed (${response.status})`;
    throw new Error(msg ?? `Request failed (${response.status})`);
  }

  // Solo desempaquetar si TIENE success Y data (y no es una respuesta cruda con items)
  if (
    body &&
    typeof body === 'object' &&
    'success' in body &&
    'data' in body &&
    !('items' in body)
  ) {
    if (!(body as any).success) {
      throw new Error((body as any).message ?? `Request failed (${response.status})`);
    }
    return (body as any).data as T;
  }

  // Respuesta cruda
  return body as T;
}

// ─── Mappers ──────────────────────────────────────────────────────

export function mapUser(user: any): BackendUser {
  const username = user?.username ?? user?.userName ?? '';
  const displayName = user?.displayName ?? user?.display_name ?? username ?? 'Unknown';
  return {
    id: user?.id ?? user?.userId ?? '',
    email: user?.email ?? user?.emailAddress ?? '',
    username,
    displayName: displayName || 'Unknown',
    bio: user?.bio ?? null,
    avatarUrl: user?.avatarUrl ?? user?.avatar_url ?? null,
    bannerUrl: user?.bannerUrl ?? user?.banner_url ?? null,
    isPrivate: Boolean(user?.isPrivate ?? user?.is_private),
    isVerified: Boolean(user?.isVerified ?? user?.is_verified),
    mfaEnabled: Boolean(user?.mfaEnabled ?? user?.mfa_enabled),
    isFollowing: Boolean(user?.isFollowing ?? user?.is_following),
    isPending: Boolean(user?.isPending ?? user?.is_pending),
    followersCount: user?._count?.followers ?? user?.followersCount ?? user?.followers_count ?? 0,
    followingCount: user?._count?.following ?? user?.followingCount ?? user?.following_count ?? 0,
    postsCount: user?._count?.posts ?? user?.postsCount ?? user?.posts_count ?? 0,
    createdAt: user?.createdAt ?? user?.created_at,
    updatedAt: user?.updatedAt ?? user?.updated_at
  };
}

export function mapPost(post: any): FrontPost {
  const author = mapUser(post?.author);
  const mediaUrls = Array.isArray(post?.mediaUrls) ? post.mediaUrls : [];
  
  return {
    id: post?.id ?? crypto.randomUUID(),
    author: author.displayName,
    handle: `@${author.username}`,
    avatar: author.avatarUrl ?? '',
    createdAt: post?.createdAt,
    timestamp: formatRelativeTime(post?.createdAt),
    content: post?.content ?? '',
    image: mediaUrls[0], // First image for compatibility
    images: mediaUrls, // ✅ NEW: All images for grid display
    mood: post?.mood ?? null,
    pollQuestion: post?.pollQuestion ?? null,
    pollOptions: Array.isArray(post?.pollOptions) ? post.pollOptions : [],
    likes: post?._count?.likes ?? post?.likesCount ?? 0,
    reposts: post?._count?.reposts ?? post?.repostsCount ?? 0,
    replies: post?._count?.comments ?? post?.commentsCount ?? 0,
    liked: Boolean(post?.isLiked),
    reposted: Boolean(post?.isReposted),
    authorId: author.id,
    kind: 'post'
  };
}

export function mapComment(comment: any): FrontPost {
  const author = mapUser(comment?.author);
  return {
    id: comment?.id ?? crypto.randomUUID(),
    author: author.displayName,
    handle: `@${author.username}`,
    avatar: author.avatarUrl ?? '',
    createdAt: comment?.createdAt,
    timestamp: formatRelativeTime(comment?.createdAt),
    content: comment?.content ?? '',
    image: undefined,
    likes: comment?.likesCount ?? 0,
    reposts: 0,
    replies: 0,
    liked: false,
    reposted: false,
    authorId: author.id,
    kind: 'comment'
  };
}

export function mapNotification(n: any): NotificationCard {
  const actorRaw = n?.actor ?? n?.user ?? n?.fromUser ?? {};
  const username = actorRaw?.username ?? '';
  const displayName = actorRaw?.displayName ?? username ?? 'Unknown';

  const typeMap: Record<string, NotificationCard['type']> = {
    LIKE: 'like',
    FOLLOW: 'follow',
    REPOST: 'repost',
    COMMENT: 'reply',
    REPLY: 'reply',
    MENTION: 'mention',
    MESSAGE: 'message'
  };
  const actionMap: Record<NotificationCard['type'], string> = {
    like: 'le dio like a tu post',
    follow: 'empezó a seguirte',
    repost: 'reposteó tu post',
    mention: 'te mencionó',
    reply: 'respondió a tu post',
    message: 'te envió un mensaje'
  };
  const rawType = String(n?.type ?? 'MENTION').toUpperCase();
  const mappedType = typeMap[rawType] ?? 'mention';

  return {
    id: n?.id ?? crypto.randomUUID(),
    type: mappedType,
    user: displayName || 'Unknown',
    handle: `@${username || 'unknown'}`,
    action: actionMap[mappedType],
    content: n?.content ?? undefined,
    timestamp: formatRelativeTime(n?.createdAt),
    rankUp: false,
    unread: n?.isRead === false
  };
}

function getConversationPeer(conversation: any, currentUserId: string) {
  const participant =
    conversation?.participants?.find((e: any) => e?.user?.id !== currentUserId)?.user
    ?? conversation?.participants?.[0]?.user;
  return mapUser(participant);
}

// ─── Auth ─────────────────────────────────────────────────────────

export async function login(identifier: string, password: string) {
  const response = await request<{ accessToken: string; refreshToken: string; user: BackendUser; mfaRequired: boolean }>(
    '/api/v1/auth/login',
    { method: 'POST', body: JSON.stringify({ identifier, password } satisfies LoginPayload) },
    false
  );
  return { ...response, user: mapUser(response.user) };
}

export async function register(email: string, username: string, password: string, displayName: string) {
  const response = await request<{ accessToken: string; refreshToken: string; user: BackendUser; mfaRequired: boolean }>(
    '/api/v1/auth/register',
    { method: 'POST', body: JSON.stringify({ email, username, password, displayName } satisfies RegisterPayload) },
    false
  );
  return { ...response, user: mapUser(response.user) };
}

export async function validateMfa(userId: string, token: string) {
  const response = await request<{ accessToken: string; refreshToken: string; user: BackendUser; mfaRequired: boolean }>(
    '/api/v1/auth/mfa/validate',
    { method: 'POST', body: JSON.stringify({ userId, token }) },
    false
  );
  return { ...response, user: mapUser(response.user) };
}

export async function logout() {
  const session = loadSession();
  try {
    await request<void>('/api/v1/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: session?.refreshToken })
    });
  } finally {
    clearSession();
  }
}

export async function getMeProfile() {
  return mapUser(await request<any>('/api/v1/users/me'));
}

export function startOAuth(provider: 'github' | 'google') {
  window.location.href = absoluteUrl(`/api/v1/auth/oauth/${provider}`);
}

export function consumeOAuthCallback(): boolean {
  const params = new URLSearchParams(window.location.search);
  const accessToken = params.get('accessToken');
  const refreshToken = params.get('refreshToken');
  if (!accessToken || !refreshToken) return false;

  const clean = new URL(window.location.href);
  clean.searchParams.delete('accessToken');
  clean.searchParams.delete('refreshToken');
  window.history.replaceState({}, '', clean.toString());

  fetch(absoluteUrl('/api/v1/users/me'), {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
    .then((r) => r.json())
    .then((body: ApiResponse<any>) => {
      if (body?.success && body.data) {
        saveSession({ accessToken, refreshToken, user: mapUser(body.data) });
        window.location.reload();
      }
    })
    .catch(() => {});

  return true;
}

// ─── Sessions ─────────────────────────────────────────────────────

export async function getSessions(): Promise<BackendSession[]> {
  const items = await request<any[]>('/api/v1/auth/sessions');
  if (!Array.isArray(items)) return [];
  return items.map((s) => ({
    id: s?.id ?? crypto.randomUUID(),
    deviceInfo: s?.deviceInfo ?? null,
    ipAddress: s?.ipAddress ?? null,
    createdAt: s?.createdAt ?? '',
    expiresAt: s?.expiresAt ?? '',
    isCurrent: Boolean(s?.isCurrent)
  }));
}

export async function revokeSession(sessionId: string) {
  await request<void>(`/api/v1/auth/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
}

// ─── MFA ──────────────────────────────────────────────────────────

export async function enableMfa(): Promise<{ qrCodeDataUrl: string; secret: string; provisioningUri: string }> {
  return request<{ qrCodeDataUrl: string; secret: string; provisioningUri: string }>('/api/v1/auth/mfa/enable', { method: 'POST' });
}

export async function verifyMfa(token: string) {
  await request<void>('/api/v1/auth/mfa/verify', { method: 'POST', body: JSON.stringify({ token }) });
}

// ─── Users ────────────────────────────────────────────────────────

export async function updateProfile(data: { displayName?: string; bio?: string; avatarUrl?: string; bannerUrl?: string; username?: string; isPrivate?: boolean }) {
  const updated = mapUser(await request<any>('/api/v1/users/me', { method: 'PUT', body: JSON.stringify(data) }));
  const session = loadSession();
  if (session?.user) {
    saveSession({ ...session, user: updated });
  }
  return updated;
}

export async function getUserProfile(username: string) {
  return mapUser(await request<any>(`/api/v1/users/${encodeURIComponent(username)}`));
}

export async function searchUsers(query: string): Promise<BackendUser[]> {
  const items = await request<any[]>(`/api/v1/users/search?q=${encodeURIComponent(query)}&limit=10`);
  return Array.isArray(items) ? items.map(mapUser) : [];
}

export async function getBidirectionalOnlineStatus(userId: string): Promise<BidirectionalOnlineStatus> {
  return request<BidirectionalOnlineStatus>(`/api/v1/users/${encodeURIComponent(userId)}/online`);
}

/**
 * Lista global de IDs de usuarios online (si tu backend lo soporta).
 * Útil para hidratar el set de presencia al montar pantallas como Messages.
 */
export async function getOnlineUsers(): Promise<string[]> {
  try {
    const res = await request<any>('/api/v1/users/online');
    if (Array.isArray(res)) return res as string[];
    if (Array.isArray(res?.userIds)) return res.userIds as string[];
    if (Array.isArray(res?.items)) return res.items.map((u: any) => u?.id).filter(Boolean);
    return [];
  } catch {
    return [];
  }
}

// ─── Follow ───────────────────────────────────────────────────────

export async function followUser(userId: string) {
  return request<any>(`/api/v1/follow/${encodeURIComponent(userId)}`, { method: 'POST' });
}

export async function unfollowUser(userId: string) {
  return request<any>(`/api/v1/follow/${encodeURIComponent(userId)}`, { method: 'DELETE' });
}

export async function getFollowers(userId: string): Promise<BackendFollower[]> {
  const items = await request<any[]>(`/api/v1/follow/${encodeURIComponent(userId)}/followers?limit=50`);
  return Array.isArray(items)
    ? items.map((u) => ({
        id: u?.follower?.id ?? u?.id ?? '',
        displayName: u?.follower?.displayName ?? u?.displayName ?? 'Unknown',
        username: u?.follower?.username ?? u?.username ?? '',
        avatarUrl: u?.follower?.avatarUrl ?? u?.avatarUrl ?? null,
        isVerified: Boolean(u?.follower?.isVerified ?? u?.isVerified)
      }))
    : [];
}

export async function getFollowing(userId: string): Promise<BackendFollower[]> {
  const items = await request<any[]>(`/api/v1/follow/${encodeURIComponent(userId)}/following?limit=50`);
  return Array.isArray(items)
    ? items.map((u) => ({
        id: u?.following?.id ?? u?.id ?? '',
        displayName: u?.following?.displayName ?? u?.displayName ?? 'Unknown',
        username: u?.following?.username ?? u?.username ?? '',
        avatarUrl: u?.following?.avatarUrl ?? u?.avatarUrl ?? null,
        isVerified: Boolean(u?.following?.isVerified ?? u?.isVerified)
      }))
    : [];
}

export async function getFollowRequests(): Promise<BackendFollower[]> {
  const items = await request<any[]>('/api/v1/follow/requests?limit=50');
  return Array.isArray(items)
    ? items.map((u) => ({
        id: u?.follower?.id ?? u?.id ?? '',
        displayName: u?.follower?.displayName ?? u?.displayName ?? 'Unknown',
        username: u?.follower?.username ?? u?.username ?? '',
        avatarUrl: u?.follower?.avatarUrl ?? u?.avatarUrl ?? null,
        isVerified: Boolean(u?.follower?.isVerified ?? u?.isVerified)
      }))
    : [];
}

export async function respondToFollowRequest(userId: string, accepted: boolean) {
  return request<any>(`/api/v1/follow/requests/${encodeURIComponent(userId)}`, {
    method: 'POST',
    body: JSON.stringify({ accepted })
  });
}

export async function removeFollower(userId: string) {
  return request<any>(`/api/v1/follow/followers/${encodeURIComponent(userId)}`, { method: 'DELETE' });
}

// ─── Posts ────────────────────────────────────────────────────────

export async function getFeedPosts() {
  const posts = await request<any[]>('/api/v1/posts/feed?limit=20');
  return Array.isArray(posts) ? posts.map(mapPost) : [];
}

export async function getExplorePosts() {
  const posts = await request<any[]>('/api/v1/posts/explore?limit=20');
  return Array.isArray(posts) ? posts.map(mapPost) : [];
}

export async function getUserPosts(username: string) {
  const posts = await request<any[]>(`/api/v1/posts/user/${encodeURIComponent(username)}?limit=20`);
  return Array.isArray(posts) ? posts.map(mapPost) : [];
}

export async function getPost(postId: string | number) {
  return mapPost(await request<any>(`/api/v1/posts/${encodeURIComponent(String(postId))}`));
}

export async function getPostReplies(postId: string | number) {
  const post = await request<any>(`/api/v1/posts/${encodeURIComponent(String(postId))}`);
  if (Array.isArray(post?.comments) && post.comments.length > 0) {
    return post.comments.map(mapComment);
  }
  const replies = post?.replies ?? [];
  return Array.isArray(replies) ? replies.map(mapPost) : [];
}

export async function createPost(content: string, options: CreatePostOptions = {}) {
  // ✅ NEW: Handle file uploads with FormData
  if (options.files && options.files.length > 0) {
    const formData = new FormData();
    formData.append('content', content);
    formData.append('mood', options.mood ?? '');
    
    // Add files
    options.files.forEach((file) => {
      formData.append('images', file);
    });
    
    // Add poll if present
    if (options.poll) {
      formData.append('poll[question]', options.poll.question);
      options.poll.options.forEach((opt, idx) => {
        formData.append(`poll[options][${idx}]`, opt);
      });
    }
    
    if (options.parentId) {
      formData.append('parentId', String(options.parentId));
    }

    // Use fetch directly for FormData (multipart/form-data)
    const session = loadSession();
    const response = await fetch(absoluteUrl('/api/v1/posts'), {
      method: 'POST',
      headers: {
        ...(session?.accessToken ? { 'Authorization': `Bearer ${session.accessToken}` } : {})
      },
      body: formData,
      credentials: 'include'
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.message ?? `Failed to create post (${response.status})`);
    }

    const body = await response.json().catch(() => null);
    const data = body?.data ?? body;
    return mapPost(data);
  }

  // ✅ FALLBACK: Original JSON method for posts without files
  return mapPost(await request<any>('/api/v1/posts', {
    method: 'POST',
    body: JSON.stringify({
      content,
      mediaUrls: options.mediaUrls ?? [],
      mood: options.mood ?? null,
      poll: options.poll ?? null,
      ...(options.parentId ? { parentId: String(options.parentId) } : {})
    })
  }));
}

export async function likePost(postId: string | number): Promise<{ liked: boolean; likesCount: number }> {
  return request<any>(`/api/v1/posts/${encodeURIComponent(String(postId))}/like`, { method: 'POST' });
}

export async function repostPost(postId: string | number): Promise<{ reposted: boolean; repostsCount: number }> {
  return request<any>(`/api/v1/posts/${encodeURIComponent(String(postId))}/repost`, { method: 'POST' });
}

export async function searchPosts(query: string): Promise<FrontPost[]> {
  const posts = await getExplorePosts();
  const q = query.toLowerCase();
  return posts.filter((p) => p.content.toLowerCase().includes(q) || p.author.toLowerCase().includes(q));
}

// ─── Comments ─────────────────────────────────────────────────────

export async function createComment(postId: string | number, content: string) {
  return mapComment(await request<any>(`/api/v1/comments/${encodeURIComponent(String(postId))}`, {
    method: 'POST',
    body: JSON.stringify({ content })
  }));
}

export async function likeComment(commentId: string): Promise<{ liked: boolean; likesCount: number }> {
  return request<any>(`/api/v1/comments/${encodeURIComponent(commentId)}/like`, { method: 'POST' });
}

// ─── Notifications ────────────────────────────────────────────────

export async function getNotifications() {
  const response = await request<any>('/api/v1/notifications?limit=20');

  let items: any[] = [];
  if (Array.isArray(response)) {
    items = response;
  } else if (Array.isArray(response?.items)) {
    items = response.items;
  } else if (Array.isArray(response?.data)) {
    items = response.data;
  } else if (Array.isArray(response?.data?.items)) {
    items = response.data.items;
  }

  return items.map(mapNotification);
}

export async function getUnreadNotificationsCount(): Promise<number> {
  try {
    const res = await request<any>('/api/v1/notifications/unread-count');
    return res?.count ?? res?.data?.count ?? Number(res) ?? 0;
  } catch {
    return 0;
  }
}

export async function markAllNotificationsRead() {
  // Backend: POST /api/v1/notifications/read-all → 204
  await request<void>('/api/v1/notifications/read-all', { method: 'POST' });
}

export async function markNotificationRead(id: string) {
  // Backend: POST /api/v1/notifications/:id/read → 204
  await request<void>(`/api/v1/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
}

// ─── Messages ─────────────────────────────────────────────────────

export async function getConversations(): Promise<ConversationCard[]> {
  const session = loadSession();
  const conversations = await request<any[]>('/api/v1/messages/conversations');
  if (!Array.isArray(conversations) || !session?.user?.id) return [];

  return conversations.map((entry) => {
    const conversation = entry?.conversation ?? entry;
    const peer = getConversationPeer(conversation, session.user.id);
    const lastMessage = conversation?.messages?.[0];
    const lastReadAt = entry?.lastReadAt ? new Date(entry.lastReadAt).getTime() : 0;

    // Unread: si el backend ya provee unreadCount/unread úsalo; si no, calcúlalo.
    const backendUnread =
      typeof entry?.unreadCount === 'number' ? entry.unreadCount
      : typeof entry?.unread === 'number' ? entry.unread
      : typeof conversation?.unreadCount === 'number' ? conversation.unreadCount
      : null;

    const unread = backendUnread ?? (
      lastMessage?.createdAt && new Date(lastMessage.createdAt).getTime() > lastReadAt ? 1 : 0
    );

    // Online: si el backend lo provee (peer.isOnline / entry.online), úsalo
    const online = Boolean(
      entry?.online ?? entry?.peer?.isOnline ?? conversation?.peer?.isOnline ?? (peer as any)?.isOnline ?? false
    );

    const lastPreview = lastMessage?.content?.trim()
      || (lastMessage?.mediaUrl ? (lastMessage?.messageType === 'IMAGE' ? '📷 Imagen' : 'Adjunto') : 'No messages yet');

    return {
      id: conversation?.id ?? crypto.randomUUID(),
      peerId: peer.id,
      name: conversation?.name ?? peer.displayName,
      handle: `@${peer.username}`,
      last: lastPreview,
      timestamp: formatRelativeTime(lastMessage?.createdAt ?? conversation?.createdAt),
      unread,
      online,
      verified: Boolean(peer.isVerified),
      avatar: peer.avatarUrl ?? ''
    } satisfies ConversationCard;
  });
}

export async function createConversation(otherUserId: string) {
  return request<any>('/api/v1/messages/conversations', {
    method: 'POST',
    body: JSON.stringify({ otherUserId })
  });
}

export async function getConversationMessages(conversationId: string): Promise<ChatMessageCard[]> {
  const session = loadSession();
  const messages = await request<any[]>(`/api/v1/messages/conversations/${encodeURIComponent(conversationId)}/messages?limit=50`);
  if (!Array.isArray(messages)) return [];
  return messages.map((message) => {
    const senderId = message?.senderId ?? message?.userId ?? message?.sender?.id;
    return {
      id: message?.id ?? crypto.randomUUID(),
      content: message?.content ?? '',
      timestamp: formatRelativeTime(message?.createdAt),
      createdAt: message?.createdAt,
      isMine: senderId === session?.user?.id,
      mediaUrl: message?.mediaUrl ?? null,
      messageType: message?.messageType ?? 'TEXT'
    } satisfies ChatMessageCard;
  });
}

export async function sendConversationMessage(
  conversationId: string,
  input: { content?: string; mediaUrl?: string | null; messageType?: 'TEXT' | 'IMAGE' | 'VIDEO'; file?: File | null }
) {
  if (input.file) {
    const session = loadSession();
    const formData = new FormData();
    formData.append('content', input.content ?? '');
    formData.append('images', input.file);
    formData.append('messageType', input.messageType ?? 'IMAGE');

    const response = await fetch(absoluteUrl(`/api/v1/messages/conversations/${encodeURIComponent(conversationId)}/messages`), {
      method: 'POST',
      headers: {
        ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {})
      },
      body: formData,
      credentials: 'include'
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(body?.message ?? body?.error ?? `Failed to send message (${response.status})`);
    }
    return body?.data ?? body;
  }

  return request<any>(`/api/v1/messages/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      content: input.content ?? '',
      mediaUrl: input.mediaUrl ?? undefined,
      messageType: input.messageType ?? (input.mediaUrl ? 'IMAGE' : 'TEXT')
    })
  });
}

export async function markConversationRead(conversationId: string) {
  return request<void>(
    `/api/v1/messages/conversations/${encodeURIComponent(conversationId)}/messages/read`,
    { method: 'PUT' }
  );
}