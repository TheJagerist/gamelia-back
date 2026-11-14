'use client';
import { useState } from 'react';
import { Play } from 'lucide-react';
import { embedUrl, parseVideo, thumbUrl } from '@/lib/video';

/** Vidéo YouTube ou Vimeo : seule une vignette est chargée, le lecteur ne se charge qu'au clic. */
export function VideoEmbed({ url, title }: { url?: string; title: string }) {
  const [play, setPlay] = useState(false);
  const v = parseVideo(url);
  if (!v) return null;
  const thumb = thumbUrl(v);
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-line bg-[#2a1730]">
      {play ? (
        <iframe
          src={embedUrl(v)}
          title={`Démo vidéo : ${title}`}
          className="absolute inset-0 h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button onClick={() => setPlay(true)} className="group absolute inset-0 flex h-full w-full items-center justify-center" aria-label={`Lire la démo vidéo de ${title}`}>
          {thumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" loading="lazy" decoding="async" width={320} height={180} className="absolute inset-0 h-full w-full object-cover opacity-80" onError={(e) => (e.currentTarget.style.display = 'none')} />
          )}
          <span className="relative flex items-center gap-2 rounded-full bg-accent px-5 py-3 font-bold text-[#2a1730] shadow-lg transition-transform group-hover:scale-105">
            <Play className="h-5 w-5 fill-current" aria-hidden />
            Lire la démo
          </span>
          <span className="absolute bottom-2 right-3 text-xs font-semibold text-white/80">{v.provider === 'youtube' ? 'YouTube' : 'Vimeo'}, chargée au clic</span>
        </button>
      )}
    </div>
  );
}
