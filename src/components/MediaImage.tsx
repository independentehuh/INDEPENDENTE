import React, { useState } from 'react';
import { Newspaper } from 'lucide-react';

interface MediaImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export const MediaImage: React.FC<MediaImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-cover',
  fallbackLabel,
}) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 p-6 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Newspaper className="w-8 h-8 mb-2 opacity-60" aria-hidden="true" />
        <span className="text-xs font-medium tracking-wide max-w-[22ch] line-clamp-2">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
