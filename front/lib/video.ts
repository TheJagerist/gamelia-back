// Seuls YouTube et Vimeo sont acceptés pour l'affichage (cahier des charges, section 6).
export type VideoRef = { provider: 'youtube' | 'vimeo'; id: string };

export function parseVideo(url?: string): VideoRef | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^(www\.|m\.)/, '');
  if (host === 'youtube.com') {
    const v = u.searchParams.get('v') || u.pathname.match(/^\/(?:shorts|embed)\/([\w-]{6,})/)?.[1];
    return v && /^[\w-]{6,20}$/.test(v) ? { provider: 'youtube', id: v } : null;
  }
  if (host === 'youtu.be') {
    const v = u.pathname.slice(1);
    return /^[\w-]{6,20}$/.test(v) ? { provider: 'youtube', id: v } : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const v = u.pathname.match(/(\d{5,})/)?.[1];
    return v ? { provider: 'vimeo', id: v } : null;
  }
  return null;
}

export function embedUrl(v: VideoRef) {
  return v.provider === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`
    : `https://player.vimeo.com/video/${v.id}?autoplay=1&dnt=1`;
}

export function thumbUrl(v: VideoRef) {
  return v.provider === 'youtube' ? `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg` : null;
}
