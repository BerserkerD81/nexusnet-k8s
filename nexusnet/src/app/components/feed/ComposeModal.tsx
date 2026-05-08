import { useRef, useState } from 'react';
import { Camera, Vote, Zap, X } from 'lucide-react';
import { Avatar } from '../ui/Avatar';

export type ComposePayload = {
  content: string;
  mediaUrls: string[];
  files?: File[]; // ✅ NEW: for file uploads
  mood?: string | null;
  poll?: {
    question: string;
    options: string[];
  } | null;
};

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: { name: string; avatar?: string };
  onSubmit?: (payload: ComposePayload) => Promise<void> | void;
}

const commandOptions = [
  { id: 'photo', icon: Camera, label: 'PHoTo', jp: '写真' },
  { id: 'poll', icon: Vote, label: 'PoLL', jp: '投票' },
  { id: 'mood', icon: Zap, label: 'MooD', jp: '気分' },
];

export function ComposeModal({ isOpen, onClose, currentUser, onSubmit }: ComposeModalProps) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]); // ✅ NEW: store File objects
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]); // ✅ NEW: store data URLs for preview
  const [moodPrefix, setMoodPrefix] = useState('');
  const [pollActive, setPollActive] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const maxChars = 280;
  const pct = Math.min(content.length / maxChars, 1);
  const isWarn = content.length > maxChars * 0.9;

  if (!isOpen) return null;

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Unable to read file'));
      reader.readAsDataURL(file);
    });

  const handlePost = async () => {
    const poll = pollActive
      ? {
          question: pollQuestion.trim(),
          options: pollOptions.map((option) => option.trim()).filter(Boolean),
        }
      : null;
    const finalContent = content.trim();
    if (!finalContent && mediaFiles.length === 0 && !moodPrefix && !poll?.question && !poll?.options?.length) return;
    setSubmitting(true);
    try {
      await onSubmit?.({
        content: finalContent,
        mediaUrls: [], // Empty, files will be uploaded by backend
        files: mediaFiles, // ✅ NEW: send actual files to backend
        mood: moodPrefix || null,
        poll: poll && poll.question && poll.options.length >= 2 ? poll : null,
      });
      setContent('');
      setMediaFiles([]);
      setMediaPreviews([]);
      setMoodPrefix('');
      setPollActive(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    
    try {
      // Limit to 4 images
      const newFiles = Array.from(files).slice(0, 4 - mediaFiles.length);
      
      // Generate previews for UI
      const previews = await Promise.all(newFiles.map(readFileAsDataUrl));
      
      setMediaFiles((prev) => [...prev, ...newFiles]);
      setMediaPreviews((prev) => [...prev, ...previews]);
    } finally {
      event.target.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, idx) => idx !== index));
    setMediaPreviews((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleMoodClick = () => {
    const moods = ['⚡', '🔥', '🕶️', '🌙'];
    const nextMood = moods[(moods.indexOf(moodPrefix) + 1) % moods.length] ?? moods[0];
    setMoodPrefix(nextMood);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'rgba(0,0,0,0.85)',
        backgroundImage: 'repeating-linear-gradient(-45deg, transparent 0 12px, rgba(232,0,45,0.07) 12px 24px)',
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl phreak-card-tex relative phreak-slide-in"
        style={{ borderLeft: '4px solid #E8002D', border: '2px solid #F5F0E8', boxShadow: '8px 8px 0 #E8002D' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '2px dashed #E8002D' }}>
          <div>
            <div className="phreak-headline" style={{ fontSize: '1.6rem', color: '#E8002D' }}>◆ SToRm THe FeED</div>
            <div className="phreak-jp" style={{ color: '#E8002D' }}>// 投稿する</div>
          </div>
          <div className="flex items-center gap-2">
            <Avatar src={currentUser.avatar ?? ''} alt={currentUser.name} size="sm" />
          </div>
          <button onClick={onClose} className="phreak-sticker p-1" style={{ background: '#000' }}>
            <X className="w-4 h-4 text-[#F5F0E8]" />
          </button>
        </div>

        <div className="p-4">
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoChange} className="hidden" />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, maxChars))}
            placeholder="WHaT's YoUr MaNiFeSTo?"
            autoFocus
            className="w-full min-h-[140px] bg-transparent resize-none focus:outline-none"
            style={{
              borderBottom: '2px solid #F5F0E8',
              color: '#F5F0E8',
              fontFamily: 'Archivo, sans-serif',
              fontSize: '1.1rem', lineHeight: 1.6, padding: '8px 4px',
            }}
          />

          <div className="mt-4 space-y-2">
            {commandOptions.map((opt, i) => {
              const Icon = opt.icon;
              const isActive =
                (opt.id === 'poll' && pollActive) ||
                (opt.id === 'mood' && Boolean(moodPrefix)) ||
                (opt.id === 'photo' && mediaFiles.length > 0);
              return (
                <button
                  key={opt.id}
                  className="w-full text-left phreak-parallelogram phreak-slide-in group"
                  style={{
                    background: isActive ? '#1A0000' : '#000',
                    border: '2px solid #E8002D',
                    padding: '8px 14px',
                    animationDelay: `${i * 60}ms`,
                    transition: 'background 80ms steps(2)',
                  }}
                  onClick={() => {
                    if (opt.id === 'photo') {
                      if (mediaFiles.length < 4) {
                        handlePhotoClick();
                      }
                      return;
                    }
                    if (opt.id === 'poll') {
                      setPollActive((value) => !value);
                      return;
                    }
                    if (opt.id === 'mood') {
                      handleMoodClick();
                    }
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = isActive ? '#1A0000' : '#E8002D')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = isActive ? '#1A0000' : '#000')}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-[#F5F0E8]" />
                    <div className="phreak-headline" style={{ color: '#F5F0E8', fontSize: '1.15rem' }}>{opt.label}</div>
                    <div className="phreak-jp ml-auto">// {opt.jp}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {mediaPreviews.length > 0 && (
            <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}>
              {mediaPreviews.map((preview, index) => (
                <button
                  key={`${preview.slice(0, 24)}-${index}`}
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  className="relative overflow-hidden"
                  style={{ border: '2px solid #E8002D', minHeight: 96, background: '#000' }}
                  title="Click to remove"
                >
                  <img src={preview} alt={`attachment-${index}`} className="w-full h-24 object-cover" />
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0 }} className="hover:opacity-100 transition-opacity">
                    <span style={{ color: '#E8002D', fontSize: '24px' }}>✕</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {pollActive && (
            <div className="mt-4 p-3" style={{ border: '2px solid #E8002D', background: '#0A0000' }}>
              <div className="phreak-headline" style={{ color: '#FFE600', fontSize: '1rem' }}>PoLL MoDe</div>
              <input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="Poll question" className="w-full mt-2 bg-transparent focus:outline-none" style={{ color: '#F5F0E8', borderBottom: '1px solid #333' }} />
              {pollOptions.map((option, index) => (
                <input
                  key={index}
                  value={option}
                  onChange={(e) => setPollOptions((prev) => prev.map((item, itemIndex) => (itemIndex === index ? e.target.value : item)))}
                  placeholder={`Option ${index + 1}`}
                  className="w-full mt-2 bg-transparent focus:outline-none"
                  style={{ color: '#F5F0E8', borderBottom: '1px solid #333' }}
                />
              ))}
              <button
                type="button"
                className="mt-2 phreak-mono-label"
                style={{ color: '#00FFE5' }}
                onClick={() => setPollOptions((prev) => [...prev, ''])}
              >
                + Add option
              </button>
            </div>
          )}

          {moodPrefix && (
            <div className="mt-4 phreak-mono-label" style={{ color: '#FFE600' }}>
              MooD: {moodPrefix}
            </div>
          )}

          <div className="flex items-center justify-between mt-5 pt-3" style={{ borderTop: '2px dashed #E8002D' }}>
            <svg width="40" height="40" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="16" fill="none" stroke="#1a0000" strokeWidth="3" />
              <circle
                cx="20" cy="20" r="16" fill="none"
                stroke={isWarn ? '#E8002D' : '#FFE600'} strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 16}`}
                strokeDashoffset={`${2 * Math.PI * 16 * (1 - pct)}`}
                transform="rotate(-90 20 20)"
              />
              <text x="20" y="24" textAnchor="middle" fontFamily="Space Mono" fontSize="9" fill="#F5F0E8">
                {maxChars - content.length}
              </text>
            </svg>

            <button
              onClick={handlePost}
              disabled={submitting || (!content.trim() && mediaFiles.length === 0 && !moodPrefix && !(pollActive && pollQuestion.trim() && pollOptions.filter((option) => option.trim()).length >= 2))}
              className="phreak-btn"
              style={{ opacity: submitting ? 0.4 : 1 }}
            >
              <Zap className="w-4 h-4" /> {submitting ? 'SeNDiNG...' : 'EXeCuTe'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
