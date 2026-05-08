import React from 'react';

interface AvatarProps {
  src?: string;
  alt: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Avatar({ src, alt, size = 'md', className = '' }: AvatarProps) {
  const sizes = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-20 h-20'
  };

  const initials = alt.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div
      className={`${sizes[size]} rounded-full overflow-hidden bg-[#1a0000] border border-[#E8002D] flex items-center justify-center ${className}`}
    >
      {src ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <span
          className="select-none text-[#F5F0E8] font-black text-sm leading-none tracking-[0.18em]"
          style={{ textShadow: '1px 1px 0 #000' }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
