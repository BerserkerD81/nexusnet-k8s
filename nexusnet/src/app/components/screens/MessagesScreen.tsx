import { useEffect, useRef, useState, useMemo, useCallback, type ChangeEvent } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  Lock,
  Search,
  Star,
  ChevronLeft,
  X,
} from 'lucide-react';
import { io, type Socket } from 'socket.io-client';
import {
  getConversations,
  getConversationMessages,
  formatRelativeTime,
  getSessionUser,
  loadSession,
  markConversationRead,
  sendConversationMessage,
  createConversation,
  getUserProfile,
  getBidirectionalOnlineStatus,
  type ChatMessageCard,
  type ConversationCard,
} from '../../lib/backend';

function HexAvatar({ size = 44, alt }: { size?: number; alt: string }) {
  const initials = (alt || 'U')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const fontSize = size <= 32 ? 11 : size <= 40 ? 13 : 15;
  const strokeWidth = Math.max(2, Math.round(size * 0.08));
  const inset = strokeWidth / 2;
  const points = `50,${inset} ${100 - inset},${25 + inset / 2} ${100 - inset},${75 - inset / 2} 50,${100 - inset} ${inset},${75 - inset / 2} ${inset},${25 + inset / 2}`;

  return (
    <div className="phreak-hex shrink-0 relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0" aria-hidden="true">
        <polygon points={points} fill="#1A0000" stroke="#E8002D" strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span
          className="phreak-headline select-none"
          style={{
            color: '#F5F0E8',
            fontSize,
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
}

// ─── ReplyPreview strip ──────────────────────────────────────────────────
function ReplyPreview({ msg, onCancel }: { msg: ChatMessageCard; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2" style={{ background: '#0d0000', borderTop: '2px solid #E8002D', borderBottom: '1px solid #333' }}>
      <div style={{ width: 3, background: '#E8002D', alignSelf: 'stretch', borderRadius: 2, flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <div className="phreak-mono-label" style={{ color: '#E8002D', fontSize: 10 }}>
          {msg.isMine ? 'RePLyiNG To YoURSeLF' : 'RePLyiNG'}
        </div>
        <div className="truncate" style={{ fontFamily: 'Archivo, sans-serif', color: '#888', fontSize: 12 }}>{msg.content}</div>
      </div>
      <button onClick={onCancel} style={{ color: '#666', flexShrink: 0 }}><X className="w-4 h-4" /></button>
    </div>
  );
}

// ─── ChatMessage ─────────────────────────────────────────────────────────
function ChatMessage({
  msg,
  peerName,
  onReply,
  replyTo,
}: {
  msg: ChatMessageCard;
  peerName: string;
  onReply?: (msg: ChatMessageCard) => void;
  replyTo?: ChatMessageCard | null;
}) {
  const isPending = msg.id.startsWith('temp-');
  const isFailed = msg.content.endsWith(' (failed)');
  const hasImage = Boolean(msg.mediaUrl);
  return (
    <div className={`group flex ${msg.isMine ? 'justify-end' : 'justify-start'} items-end gap-3 py-1.5`}>
      {msg.isMine && (
        <span className="phreak-mono-label opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#666', writingMode: 'vertical-rl', fontSize: 9 }}>
          {isPending ? '...' : msg.timestamp}
        </span>
      )}
      {!msg.isMine && <HexAvatar size={28} alt={peerName} />}

      <div className="flex flex-col max-w-[72%]" style={{ alignItems: msg.isMine ? 'flex-end' : 'flex-start' }}>
        {/* Reply context */}
        {replyTo && (
          <div
            className="mb-2 px-2 py-1 truncate"
            style={{
              maxWidth: '100%',
              background: '#0d0000',
              borderLeft: '3px solid #E8002D',
              fontFamily: 'Archivo, sans-serif',
              fontSize: 11,
              color: '#888',
              borderRadius: 0,
            }}
          >
            ↩ {replyTo.content}
          </div>
        )}
        <div
          style={{
            background: msg.isMine ? (isFailed ? '#5c0000' : '#E8002D') : '#1E1E1E',
            color: msg.isMine ? '#FFFFFF' : '#F5F0E8',
            fontWeight: msg.isMine ? 600 : 400,
            padding: '12px 18px',
            border: msg.isMine ? '1px solid #FF4444' : '2px solid #333333',
            boxShadow: msg.isMine ? 'inset -3px -3px 0 rgba(0,0,0,0.4), 3px 3px 0 #000' : '3px 3px 0 #000',
            clipPath: msg.isMine
              ? 'polygon(0 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%)'
              : 'polygon(0 0, 100% 0, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
            fontFamily: msg.isMine ? '"Archivo Black", sans-serif' : 'Archivo, sans-serif',
            fontSize: 14,
            lineHeight: 1.6,
            opacity: isPending ? 0.7 : 1,
            transition: 'opacity 200ms',
          }}
        >
          {msg.content && <div style={{ marginBottom: hasImage ? 10 : 0 }}>{isFailed ? msg.content.replace(' (failed)', '') : msg.content}</div>}
          {hasImage && msg.mediaUrl && (
            <div className={msg.content ? 'mt-1' : ''}>
              <img
                src={msg.mediaUrl}
                alt="Message attachment"
                style={{
                  maxWidth: '100%',
                  border: '2px solid #000',
                  boxShadow: '3px 3px 0 #000',
                  borderRadius: 4,
                  display: 'block'
                }}
              />
            </div>
          )}
          {isFailed && <span style={{ fontSize: 10, color: '#ffaaaa', display: 'block', marginTop: 4 }}>⚠ FaLLeD – TaP To ReTRy</span>}
        </div>
      </div>

      {!msg.isMine && (
        <span className="phreak-mono-label opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#666', writingMode: 'vertical-rl', fontSize: 9 }}>
          {msg.timestamp}
        </span>
      )}

      {onReply && (
        <button
          onClick={() => onReply(msg)}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          title="Reply"
          style={{ color: '#E8002D', flexShrink: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 17 4 12 9 7" />
            <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
          </svg>
        </button>
      )}
    </div>
  );
}

interface MessagesScreenProps {
  initialConversationId?: string | null;
  pendingPeerUsername?: string;
}

export function MessagesScreen({ initialConversationId, pendingPeerUsername }: MessagesScreenProps) {
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [conversations, setConversations] = useState<ConversationCard[]>([]);
  const [messages, setMessages] = useState<ChatMessageCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [isTyping, setIsTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [bidirectionalOnline, setBidirectionalOnline] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessageCard | null>(null);
  const [replyMap, setReplyMap] = useState<Map<string, ChatMessageCard>>(new Map());
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{ name: string; file: File; previewUrl: string } | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const typingActiveRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  // Para hacer scroll instantáneo al cambiar de chat (sin animación)
  const justSwitchedChatRef = useRef(true);
  // Para trackear pendingPeerUsername ya procesado
  const processedUsernamesRef = useRef<Set<string>>(new Set());
  // Ref para que socket handlers accedan al chat seleccionado actual
  const selectedChatRef = useRef<string | null>(null);

  // Keep selectedChatRef in sync so socket handlers have current value
  useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);

  const sessionUser = getSessionUser();
  const socketUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

  const activeConv = conversations.find((conversation) => conversation.id === selectedChat) ?? null;
  const activeOnline = activeConv?.peerId ? onlineUserIds.has(activeConv.peerId) || bidirectionalOnline : false;
  const emojiOptions = ['😀', '😂', '😍', '🥳', '🔥', '❤️', '👍', '🙏', '🎉', '😎', '😭', '🤝'];

  useEffect(() => {
    return () => {
      if (attachedImage?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(attachedImage.previewUrl);
      }
    };
  }, [attachedImage]);

  const messageGroups = useMemo(() => {
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const getDateGroupLabel = (date: Date) => {
      const today = startOfDay(new Date());
      const target = startOfDay(date);
      const diff = Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);

      if (diff === 0) return '◆ Hoy ◆';
      if (diff === 1) return '◆ Mañana ◆';
      if (diff === -1) return '◆ Ayer ◆';

      return `◆ ${date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })} ◆`;
    };

    return messages.reduce(
      (groups, messageItem) => {
        const date = messageItem.createdAt ? new Date(messageItem.createdAt) : new Date();
        const groupKey = startOfDay(date).toISOString();
        const existing = groups.find((group) => group.key === groupKey);
        if (existing) {
          existing.messages.push(messageItem);
        } else {
          groups.push({ key: groupKey, label: getDateGroupLabel(date), messages: [messageItem] });
        }
        return groups;
      },
      [] as { key: string; label: string; messages: ChatMessageCard[] }[]
    );
  }, [messages]);

  const filtered = conversations.filter((conversation) =>
    conversation.name.toLowerCase().includes(search.toLowerCase()) ||
    conversation.handle.toLowerCase().includes(search.toLowerCase())
  );

  // ── Auto-scroll al final cuando llegan/se envían mensajes ──────────
  useEffect(() => {
    if (!messagesEndRef.current) return;
    const behavior: ScrollBehavior = justSwitchedChatRef.current ? 'auto' : 'smooth';
    messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
    justSwitchedChatRef.current = false;
  }, [messages, isTyping]);

  // ── Incoming message handler (shared between socket events) ──────
  const handleIncomingMessage = useCallback(
    (payload: { conversationId?: string; message?: any } | any) => {
      const conversationId = payload?.conversationId ?? payload?.message?.conversationId;
      const incoming = payload?.message ?? payload;
      if (!conversationId || !incoming?.id) return;

      const isMine = incoming?.senderId === sessionUser?.id;

      const nextMsg: ChatMessageCard = {
        id: incoming.id,
        content: incoming.content ?? '',
        timestamp: formatRelativeTime(incoming.createdAt),
        createdAt: incoming.createdAt,
        isMine,
        mediaUrl: incoming.mediaUrl ?? null,
        messageType: incoming.messageType ?? 'TEXT'
      };
      const preview = nextMsg.content.trim() || (nextMsg.mediaUrl ? '📷 Imagen' : '');

      // Update conversation list sidebar
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          const unread = isMine ? c.unread : selectedChatRef.current === conversationId ? 0 : c.unread + 1;
          return { ...c, last: preview, timestamp: nextMsg.timestamp, unread };
        })
      );

      // Append to message list if this conversation is open
      if (selectedChatRef.current === conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === nextMsg.id)) return prev;
          // Replace optimistic placeholder if it's ours
          if (isMine) {
            const tempIdx = prev.findIndex((m) => m.isMine && m.content === nextMsg.content && m.id.startsWith('temp-'));
            if (tempIdx >= 0) {
              const next = [...prev];
              next[tempIdx] = nextMsg;
              return next;
            }
          }
          return [...prev, nextMsg];
        });
      }
    },
    [sessionUser?.id]
  );

  // ── Socket setup ──────────────────────────────────────────────────
  useEffect(() => {
    const session = loadSession();
    if (!session?.accessToken || !session?.user?.id) return;

    const socket = io(socketUrl, {
      auth: {
        token: session.accessToken,
        userId: session.user.id,
      },
      // CRÍTICO para Kubernetes/Traefik:
      // Forzar WebSocket puro desde el inicio. Si se permite "polling" primero,
      // Socket.IO hace múltiples requests HTTP y el upgrade puede fallar cuando
      // el Ingress enruta cada request a un pod distinto (sin sticky session).
      transports: ['websocket'],
      // Asegurar que el path coincida con lo que expone el Ingress (/socket.io)
      path: '/socket.io',
    });

    // Al conectar, pedir lista de usuarios online (si el backend lo soporta)
    socket.on('connect', () => {
      socket.emit('get_online_users');
    });

    // Backend puede responder con lista completa
    socket.on('online_users', (payload: { userIds?: string[] } | string[]) => {
      const ids = Array.isArray(payload) ? payload : payload?.userIds ?? [];
      setOnlineUserIds(new Set(ids));
    });

    const handleUserOnline = (userId: string) => {
      if (!userId) return;
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        next.add(userId);
        return next;
      });
      if (userId === activeConv?.peerId) {
        setBidirectionalOnline(true);
      }
    };

    const handleUserOffline = (userId: string) => {
      if (!userId) return;
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      if (userId === activeConv?.peerId) {
        setBidirectionalOnline(false);
      }
    };

    socket.on('user_online', ({ userId }: { userId: string }) => {
      handleUserOnline(userId);
    });
    socket.on('user_offline', ({ userId }: { userId: string }) => {
      handleUserOffline(userId);
    });
    socket.on('user_online_in_conversation', ({ userId }: { userId: string }) => {
      handleUserOnline(userId);
    });
    socket.on('user_offline_in_conversation', ({ userId }: { userId: string }) => {
      handleUserOffline(userId);
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Messages] socket disconnected:', reason);
      setBidirectionalOnline(false);
      setOnlineUserIds(new Set());
    });

    socket.on('reconnect', () => {
      socket.emit('get_online_users');
    });

    socket.on('typing_start', ({ userId }: { userId?: string }) => {
      if (!userId || userId === sessionUser?.id) return;
      setIsTyping(true);
    });

    socket.on('typing_stop', ({ userId }: { userId?: string }) => {
      if (!userId || userId === sessionUser?.id) return;
      setIsTyping(false);
    });

    socket.on('new_message', handleIncomingMessage);
    socket.on('new_message_sent', handleIncomingMessage);

    socket.on('message_deleted', ({ messageId }: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    });

    socket.on('connect_error', (err) => {
      console.warn('[Messages] socket connect_error:', err.message);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionUser?.id, socketUrl, handleIncomingMessage]);

  // ── Cleanup typing timer ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // ── Carga inicial de conversaciones ───────────────────────────────
  useEffect(() => {
    let active = true;

    const loadConversations = async () => {
      setLoading(true);
      try {
        const items = await getConversations();
        if (!active) return;

        setConversations(items);

        // Inicializa el set de online a partir del backend (si conv.online === true)
        const onlineFromBackend = new Set<string>();
        items.forEach((c) => {
          if (c.online && c.peerId) onlineFromBackend.add(c.peerId);
        });
        setOnlineUserIds((prev) => {
          // Mezclamos con lo que ya tengamos del socket
          const merged = new Set(prev);
          onlineFromBackend.forEach((id) => merged.add(id));
          return merged;
        });

        if (initialConversationId && items.some((c) => c.id === initialConversationId)) {
          setSelectedChat(initialConversationId);
        } else if (!pendingPeerUsername) {
          setSelectedChat((previous) => previous ?? items[0]?.id ?? null);
        }
      } catch (err) {
        console.error('[Messages] load conversations failed:', err);
        if (active) setConversations([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadConversations();

    return () => {
      active = false;
    };
  }, [initialConversationId, pendingPeerUsername]);

  // ✅ NEW: Listen for real-time message and conversation updates
  useEffect(() => {
    const handleMessagesRefresh = async () => {
      if (!selectedChat) return;
      try {
        const items = await getConversationMessages(selectedChat);
        setMessages([...items].reverse());
      } catch {
        console.warn('Failed to refresh messages');
      }
    };

    const handleConversationsRefresh = async () => {
      try {
        const items = await getConversations();
        setConversations(items);
      } catch {
        console.warn('Failed to refresh conversations');
      }
    };

    window.addEventListener('messages-refresh', handleMessagesRefresh);
    window.addEventListener('conversations-refresh', handleConversationsRefresh);
    return () => {
      window.removeEventListener('messages-refresh', handleMessagesRefresh);
      window.removeEventListener('conversations-refresh', handleConversationsRefresh);
    };
  }, [selectedChat]);

  // ── Si llega pendingPeerUsername desde una notificación, abre/crea chat ──
  useEffect(() => {
    if (!pendingPeerUsername) return;
    
    // Evitar procesar el mismo username múltiples veces
    if (processedUsernamesRef.current.has(pendingPeerUsername)) return;
    processedUsernamesRef.current.add(pendingPeerUsername);

    let active = true;

    const openOrCreate = async () => {
      try {
        // 1) ¿Ya existe conversación con ese handle?
        const existing = conversations.find(
          (c) => c.handle.replace(/^@/, '').toLowerCase() === pendingPeerUsername.toLowerCase()
        );
        if (existing) {
          if (active) setSelectedChat(existing.id);
          return;
        }

        // 2) Si no, obtenemos el userId y creamos
        const profile = await getUserProfile(pendingPeerUsername);
        if (!profile?.id) return;

        const conv = await createConversation(profile.id);
        const newConvId = conv?.id ?? conv?.conversation?.id ?? conv?.data?.id;
        if (!newConvId) return;

        // Refrescar lista para que aparezca
        const refreshed = await getConversations();
        if (!active) return;
        setConversations(refreshed);
        setSelectedChat(newConvId);
      } catch (err) {
        console.error('[Messages] open/create chat from username failed:', err);
      }
    };

    openOrCreate();
    return () => { active = false; };
  }, [pendingPeerUsername, conversations]);

  // ── Cargar mensajes del chat seleccionado ─────────────────────────
  useEffect(() => {
    if (!selectedChat) {
      setIsTyping(false);
      return;
    }

    const peerId = conversations.find((c) => c.id === selectedChat)?.peerId;
    justSwitchedChatRef.current = true;
    socketRef.current?.emit('join_conversation', selectedChat);

    let active = true;

    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        // Cargar mensajes al instante
        const items = await getConversationMessages(selectedChat);
        if (!active) return;
        setMessages([...items].reverse());
        setIsTyping(false);

        // Parallelizar marcado como leído (sin esperar)
        markConversationRead(selectedChat).catch((err) =>
          console.error('[Messages] mark read failed:', err)
        );

        // Solo hacer una llamada a online status
        if (peerId) {
          getBidirectionalOnlineStatus(peerId)
            .then((status) => {
              if (!active) return;
              const online = status.bidirectional ?? status.isOnline ?? status.otherOnline ?? false;
              setBidirectionalOnline(Boolean(online));
              if (online) {
                setOnlineUserIds((prev) => {
                  const next = new Set(prev);
                  next.add(peerId);
                  return next;
                });
              }
            })
            .catch(() => setBidirectionalOnline(false));
        }
      } catch (err) {
        console.error('[Messages] load messages failed:', err);
      } finally {
        if (active) setLoadingMessages(false);
      }
    };

    loadMessages();

    return () => {
      socketRef.current?.emit('leave_conversation', selectedChat);
      active = false;
    };
  }, [selectedChat, conversations]);

  // ── Debounced online status refresh (solo en cambios de peerId de socket) ──
  useEffect(() => {
    const peerId = activeConv?.peerId;
    if (!peerId) {
      setBidirectionalOnline(false);
      return;
    }

    // Refresh solo si el último status cambió hace más de 10 segundos
    const timer = setTimeout(() => {
      getBidirectionalOnlineStatus(peerId)
        .then((status) => {
          const online = status.bidirectional ?? status.isOnline ?? status.otherOnline ?? false;
          setBidirectionalOnline(Boolean(online));
        })
        .catch(() => {});
    }, 10000);

    return () => clearTimeout(timer);
  }, [activeConv?.peerId]);

  // ── Typing emit helper ────────────────────────────────────────────
  const emitTyping = (state: boolean) => {
    if (!socketRef.current || !selectedChat) return;
    if (typingActiveRef.current === state) return;
    socketRef.current.emit(state ? 'typing_start' : 'typing_stop', selectedChat);
    typingActiveRef.current = state;
  };

  // ── Envío con OPTIMISTIC UPDATE ───────────────────────────────────
  const handleSendMessage = async () => {
    const content = message.trim();
    if (!selectedChat || (!content && !attachedImage) || sending) return;
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const optimistic: ChatMessageCard = {
      id: tempId,
      content,
      timestamp: 'ahora',
      createdAt: now,
      isMine: true,
      mediaUrl: attachedImage?.previewUrl ?? null,
      messageType: attachedImage ? 'IMAGE' : 'TEXT'
    };

    const currentReplyTo = replyingTo;
    const messagePayload = {
      content,
      mediaUrl: attachedImage?.previewUrl ?? undefined,
      messageType: attachedImage ? 'IMAGE' as const : 'TEXT' as const,
      file: attachedImage?.file ?? null
    };

    setMessages((prev) => [...prev, optimistic]);
    if (currentReplyTo) setReplyMap((prev) => { const m = new Map(prev); m.set(tempId, currentReplyTo); return m; });
    setMessage('');
    setReplyingTo(null);
    setEmojiPickerOpen(false);
    emitTyping(false);
    setConversations((prev) => prev.map((c) => c.id === selectedChat ? { ...c, last: content || (attachedImage ? '📷 Imagen' : ''), timestamp: 'ahora' } : c));

    setSending(true);
    try {
      const sent = await sendConversationMessage(selectedChat, messagePayload);
      const realMsg: ChatMessageCard = {
        id: sent?.id ?? sent?.data?.id ?? tempId,
        content: sent?.content ?? content,
        timestamp: formatRelativeTime(sent?.createdAt ?? now),
        createdAt: sent?.createdAt ?? now,
        isMine: true,
        mediaUrl: sent?.mediaUrl ?? attachedImage?.previewUrl ?? null,
        messageType: sent?.messageType ?? messagePayload.messageType,
      };
      setMessages((prev) => prev.map((m) => (m.id === tempId ? realMsg : m)));
      if (currentReplyTo) {
        setReplyMap((prev) => {
          const m = new Map(prev);
          m.delete(tempId);
          m.set(realMsg.id, currentReplyTo);
          return m;
        });
      }
      if (socketRef.current && sent) {
        socketRef.current.emit('send_message', { conversationId: selectedChat, message: sent });
      }
      setAttachedImage(null);
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, content: m.content + ' (failed)' } : m)));
    } finally {
      setSending(false);
    }
  };

  const handlePickImage = () => {
    imageInputRef.current?.click();
  };

  const handleImageSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setAttachedImage({ name: file.name, file, previewUrl });
    setEmojiPickerOpen(false);
  };

  const appendEmoji = (emoji: string) => {
    setMessage((prev) => prev + emoji);
    setEmojiPickerOpen(false);
  };

  const handleMessageChange = (value: string) => {
    setMessage(value);
    if (!selectedChat) return;
    if (value.trim().length === 0) {
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      emitTyping(false);
      return;
    }

    emitTyping(true);
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => emitTyping(false), 1200);
  };

  const hasConversations = conversations.length > 0;
  const mobileChatOpen = selectedChat !== null && hasConversations;

  return (
    <div className="min-h-screen flex bg-black" style={{ height: '100vh' }}>
      <div
        className={`${mobileChatOpen ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-[280px]`}
        style={{ background: '#0A0000', borderRight: '2px solid #E8002D' }}
      >
        <div className="p-4" style={{ background: '#000', borderBottom: '2px dashed #E8002D' }}>
          <h2 style={{ margin: 0, fontSize: '1.75rem', color: '#FFFFFF', textShadow: '3px 3px 0 #E8002D', fontStyle: 'normal', letterSpacing: '0.04em', fontFamily: 'Bebas Neue' }}>
            ★ MeSsAGeS <span className="phreak-jp" style={{ color: '#FF4444', fontSize: 12, letterSpacing: '0.4em' }}>// メッセージ</span>
          </h2>
          <div className="phreak-jp mt-1" style={{ color: '#00FFE5', letterSpacing: '0.2em', fontSize: 9 }}>
            // エンド・ツー・エンド暗号化
          </div>
        </div>

        <div className="p-3" style={{ borderBottom: '1px solid #1A0000' }}>
          <div
            className="flex items-center gap-2 px-2"
            style={{
              height: 36,
              background: '#111111',
              borderTop: '0',
              borderLeft: '0',
              borderRight: '0',
              borderBottom: `2px solid ${searchFocus ? '#E8002D' : '#E8002D'}`,
              boxShadow: searchFocus ? '0 2px 8px rgba(232,0,45,0.4)' : 'none',
              transition: 'box-shadow 120ms steps(2)',
            }}
          >
            <Search className="w-4 h-4" style={{ color: '#E8002D' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setSearchFocus(false)}
              placeholder="SeaRCH CoNTaCTS..."
              className="flex-1 bg-transparent focus:outline-none"
              style={{ color: '#FFFFFF', fontFamily: 'Space Mono', fontSize: 12, letterSpacing: '0.1em' }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && filtered.length === 0 ? (
            <div className="p-4 phreak-mono-label" style={{ color: '#FFE600' }}>LoaDiNG...</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 phreak-mono-label" style={{ color: '#666' }}>No conversations yet.</div>
          ) : (
            filtered.map((conversation) => {
              const active = selectedChat === conversation.id;
              const unread = conversation.unread > 0;
              const isOnline = conversation.peerId ? onlineUserIds.has(conversation.peerId) : false;
              return (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedChat(conversation.id)}
                  className="w-full p-3 flex gap-3 text-left relative group"
                  style={{
                    background: active ? '#1A0000' : unread ? '#180000' : '#0A0000',
                    borderTop: '0',
                    borderRight: '0',
                    borderBottom: '1px solid #1A0000',
                    borderLeft: active ? '5px solid #E8002D' : unread ? '5px solid #FFE600' : '5px solid transparent',
                    boxShadow: active ? 'inset -3px 0 12px rgba(232,0,45,0.25)' : 'none',
                    transition: 'background 120ms steps(2), border-color 120ms steps(2)',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = '#140000';
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = unread ? '#180000' : '#0A0000';
                  }}
                >
                  <div className="relative">
                    <HexAvatar size={44} alt={conversation.name} />
                    {isOnline && (
                      <span
                        className="absolute"
                        style={{
                          bottom: 0,
                          right: 0,
                          width: 10,
                          height: 10,
                          background: '#FFE600',
                          border: '2px solid #000',
                          boxShadow: '0 0 6px #FFE600',
                        }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="phreak-headline truncate flex items-center gap-1"
                        style={{
                          color: unread || active ? '#FFFFFF' : '#CCCCCC',
                          fontSize: '1.05rem',
                          textShadow: unread ? '2px 2px 0 #E8002D' : 'none',
                        }}
                      >
                        {conversation.name}
                        {conversation.verified && <Star className="w-3 h-3 inline" fill="#FFE600" stroke="#FFE600" />}
                      </span>
                      <span className="phreak-mono-label" style={{ color: unread ? '#FFE600' : '#888888', fontSize: 10 }}>
                        ◆ {conversation.timestamp}
                      </span>
                    </div>
                    <div className="phreak-handle truncate" style={{ fontSize: 11 }}>{conversation.handle}</div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span
                        className="truncate"
                        style={{
                          fontFamily: 'Space Mono',
                          fontSize: 11,
                          color: unread ? '#FFFFFF' : '#AAAAAA',
                          fontWeight: unread ? 700 : 400,
                        }}
                      >
                        {conversation.last}
                      </span>
                      {unread && (
                        <span
                          className="phreak-headline"
                          style={{
                            background: '#FFE600', color: '#000',
                            padding: '0 7px', fontSize: '0.85rem',
                            border: '2px solid #000', boxShadow: '2px 2px 0 #E8002D',
                            transform: 'rotate(-3deg)',
                          }}
                        >
                          {conversation.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className={`${mobileChatOpen ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-black relative`}>
        <div className="absolute inset-0 phreak-halftone pointer-events-none" style={{ opacity: 0.04 }} />

        <div
          className="sticky top-0 z-10 flex items-center justify-between gap-3 p-3 relative"
          style={{ background: '#000', borderBottom: '2px dashed #E8002D' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSelectedChat(null)}
              className="md:hidden flex items-center"
              style={{ color: '#E8002D', fontFamily: 'Bebas Neue', fontSize: 16 }}
            >
              <ChevronLeft className="w-5 h-5" /> BaCK
            </button>
            {activeConv ? (
              <div className="relative">
                <HexAvatar size={48} alt={activeConv.name} />
                {activeOnline && (
                  <span
                    className="absolute"
                    style={{
                      bottom: 0,
                      right: 0,
                      width: 12,
                      height: 12,
                      background: '#FFE600',
                      border: '2px solid #000',
                      boxShadow: '0 0 8px #FFE600',
                    }}
                  />
                )}
              </div>
            ) : null}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="phreak-headline truncate" style={{ fontSize: '1.4rem', color: '#FFFFFF', textShadow: '2px 2px 0 #E8002D' }}>
                  {activeConv?.name ?? 'No conversation'}
                </div>
                {activeConv?.verified && <Star className="w-3 h-3" fill="#FFE600" stroke="#FFE600" />}
              </div>
              <div className="flex items-center gap-2">
                <span className="phreak-handle">{activeConv?.handle ?? ''}</span>
                {activeOnline && (
                  <span className="phreak-mono-label flex items-center gap-1" style={{ color: '#FFE600', fontSize: 10 }}>
                    <span className="phreak-blink" style={{ width: 6, height: 6, background: '#FFE600', display: 'inline-block' }} /> oNLiNe
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="phreak-sticker phreak-tilt-r flex items-center gap-1 hidden lg:flex"
              style={{ background: '#FFE600', color: '#000', padding: '4px 10px', border: '2px solid #000', boxShadow: '3px 3px 0 #000' }}
            >
              <Lock className="w-3 h-3" />
              <span className="phreak-headline" style={{ fontSize: '0.85rem' }}>E2E eNCRiPTeD</span>
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 md:space-y-6 relative">
          {loadingMessages && (
            <div className="sticky top-0 z-10 flex justify-end mb-2">
              <span
                className="phreak-mono-label"
                style={{
                  color: '#FFE600',
                  background: '#0A0000',
                  border: '1px dashed #E8002D',
                  padding: '4px 10px',
                  fontSize: 10,
                }}
              >
                SiNCRoNiZiNG...
              </span>
            </div>
          )}
          {messages.length === 0 ? (
            <div className="phreak-mono-label" style={{ color: '#666' }}>No messages yet.</div>
          ) : (
            messageGroups.map((group) => (
              <div key={group.key}>
                <div className="text-center my-2">
                  <span
                    className="phreak-mono-label inline-block"
                    style={{
                      color: '#666', padding: '4px 12px',
                      background: '#0A0000', border: '1px dashed #E8002D',
                    }}
                  >
                    {group.label}
                  </span>
                </div>
                {group.messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    msg={msg}
                    peerName={activeConv?.name ?? 'User'}
                    onReply={setReplyingTo}
                    replyTo={replyMap.get(msg.id) ?? null}
                  />
                ))}
              </div>
            ))
          )}

          {activeConv && isTyping && (
            <div className="flex items-end gap-2">
              <HexAvatar size={28} alt={activeConv.name} />
              <div
                style={{
                  background: '#1E1E1E', padding: '8px 14px',
                  borderTop: '2px solid #333333',
                  borderRight: '2px solid #333333',
                  borderBottom: '2px solid #333333',
                  borderLeft: '2px solid #333333',
                  boxShadow: '3px 3px 0 #000',
                }}
              >
                <span className="flex items-center gap-1">
                  <span className="phreak-mono-label" style={{ color: '#666', fontSize: 10 }}>TyPiNG</span>
                  {[0, 200, 400].map((delay) => (
                    <span
                      key={delay}
                      className="phreak-blink"
                      style={{ width: 6, height: 6, background: '#E8002D', display: 'inline-block', animationDelay: `${delay}ms` }}
                    />
                  ))}
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Reply preview */}
        {replyingTo && <ReplyPreview msg={replyingTo} onCancel={() => setReplyingTo(null)} />}

        {/* Input bar */}
        <div className="p-3 relative" style={{ borderTop: replyingTo ? 'none' : '2px dashed #E8002D', background: '#0A0000' }}>
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleImageSelected(e)} />
          {emojiPickerOpen && (
            <div
              className="absolute left-3 bottom-full mb-2 p-2"
              style={{ background: '#0A0000', border: '2px solid #E8002D', boxShadow: '3px 3px 0 #000', zIndex: 20 }}
            >
              <div className="grid grid-cols-6 gap-1">
                {emojiOptions.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => appendEmoji(emoji)}
                    className="w-8 h-8"
                    style={{ background: '#111', border: '1px solid #333', fontSize: 18 }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {attachedImage && (
            <div className="mb-2 flex items-center gap-2" style={{ color: '#FFE600' }}>
              <span className="phreak-mono-label" style={{ fontSize: 10 }}>Imagen lista: {attachedImage.name}</span>
              <button
                onClick={() => setAttachedImage(null)}
                style={{ color: '#FF8080', border: 'none', background: 'transparent', cursor: 'pointer' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button className="phreak-sticker p-2" style={{ background: '#000' }} onClick={handlePickImage} aria-label="Attach image">
              <Paperclip className="w-4 h-4 text-[#00FFE5]" />
            </button>
            <button className="phreak-sticker p-2" style={{ background: '#000' }} onClick={() => setEmojiPickerOpen((current) => !current)} aria-label="Emoji picker">
              <Smile className="w-4 h-4 text-[#FFE600]" />
            </button>
            <input
              value={message}
              onChange={(e) => handleMessageChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSendMessage();
                }
              }}
              placeholder={replyingTo ? 'EsCRiBe Tu ReSPueSta...' : 'TyPe Yr MaNiFeSTo...'}
              className="flex-1 px-3 py-2 focus:outline-none"
              disabled={!activeConv}
              style={{
                background: '#111111',
                borderTop: '2px solid #333333',
                borderRight: '2px solid #333333',
                borderBottom: '2px solid #333333',
                borderLeft: '2px solid #333333',
                color: '#FFFFFF', fontFamily: 'Archivo, sans-serif',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderTopColor = '#E8002D';
                e.currentTarget.style.borderRightColor = '#E8002D';
                e.currentTarget.style.borderBottomColor = '#E8002D';
                e.currentTarget.style.borderLeftColor = '#E8002D';
              }}
              onBlur={(e) => {
                emitTyping(false);
                e.currentTarget.style.borderTopColor = '#333333';
                e.currentTarget.style.borderRightColor = '#333333';
                e.currentTarget.style.borderBottomColor = '#333333';
                e.currentTarget.style.borderLeftColor = '#333333';
              }}
            />
            <button
              onClick={() => void handleSendMessage()}
              disabled={!activeConv || (!message.trim() && !attachedImage) || sending}
              className="phreak-btn"
              style={{
                padding: '8px 14px',
                opacity: !activeConv || (!message.trim() && !attachedImage) || sending ? 0.4 : 1,
              }}
            >
              <Send className="w-4 h-4" /> SeND
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}