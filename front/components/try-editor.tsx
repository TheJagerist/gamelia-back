'use client';
// Éditeur « Essayer » des leçons (comme sur W3Schools) : on modifie le HTML, le CSS ou le JavaScript, puis on voit le résultat.
// Sécurité : le code s'exécute dans un cadre isolé (iframe sandbox="allow-scripts", sans allow-same-origin). Il n'a donc
// accès ni aux cookies, ni à la session, ni au reste de Gamelia ; une règle CSP dans le cadre bloque aussi tout appel réseau.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Play, RotateCcw } from 'lucide-react';

type Lang = 'html' | 'css' | 'js';
const LABEL: Record<Lang, string> = { html: 'HTML', css: 'CSS', js: 'JavaScript' };
const CSP = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:";

function buildDoc(id: string, html: string, css: string, js: string): string {
  // Le script d'erreur passe en premier : il transmet au parent le message d'une erreur JavaScript pour l'afficher.
  const report = `window.addEventListener('error',function(e){parent.postMessage({gameliaTry:'${id}',error:String(e.message)},'*')});window.addEventListener('unhandledrejection',function(e){parent.postMessage({gameliaTry:'${id}',error:String(e.reason)},'*')});`;
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${CSP}"><style>body{font-family:system-ui,sans-serif;margin:12px;color:#222}${css}</style></head><body>${html}<script>${report}<\/script><script>${js}<\/script></body></html>`;
}

export function TryEditor({ title, html, css, js, hint }: { title: string; html: string; css: string; js: string; hint?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const initial = useMemo(() => ({ html, css, js }), [html, css, js]);
  // Seuls les onglets utiles à l'exemple sont proposés (HTML seul pour la première leçon, par exemple).
  const tabs = useMemo(() => (['html', 'css', 'js'] as Lang[]).filter((l) => l === 'html' || initial[l].trim() !== ''), [initial]);
  const [tab, setTab] = useState<Lang>('html');
  const [src, setSrc] = useState(initial);
  const [doc, setDoc] = useState(() => buildDoc(id, html, css, js));
  const [error, setError] = useState('');
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const d = e.data as { gameliaTry?: string; error?: string } | null;
      if (d && d.gameliaTry === id && typeof d.error === 'string') setError(d.error.slice(0, 300));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [id]);

  const run = (s = src) => {
    setError('');
    setDoc(buildDoc(id, s.html, s.css, s.js));
  };
  const reset = () => {
    setSrc(initial);
    run(initial);
  };

  return (
    <section className="my-6 overflow-hidden rounded-lg border border-line bg-surface" aria-label={title}>
      <h3 className="border-b border-line bg-sunken px-4 py-2.5 text-[15px] font-semibold">{title}</h3>
      <div className="p-4">
        {tabs.length > 1 && (
          <div role="tablist" aria-label="Fichier à modifier" className="mb-2 flex gap-1">
            {tabs.map((l) => (
              <button
                key={l}
                role="tab"
                type="button"
                aria-selected={tab === l}
                onClick={() => setTab(l)}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold ${tab === l ? 'bg-primary text-primary-ink' : 'bg-sunken text-muted hover:text-ink'}`}
              >
                {LABEL[l]}
              </button>
            ))}
          </div>
        )}
        <label htmlFor={`${id}-code`} className="sr-only">
          Code {LABEL[tab]} à modifier
        </label>
        <textarea
          id={`${id}-code`}
          value={src[tab]}
          onChange={(e) => setSrc({ ...src, [tab]: e.target.value })}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          rows={Math.min(14, Math.max(6, src[tab].split('\n').length + 1))}
          className="block w-full resize-y rounded-md border border-line bg-[#2a1730] p-3 text-[13.5px] leading-relaxed text-[#f6ecf3]"
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', tabSize: 2 }}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-sm" onClick={() => run()}>
            <Play className="h-4 w-4" aria-hidden />
            Exécuter
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={reset}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            Rétablir
          </button>
          {hint && <p className="text-sm text-muted">{hint}</p>}
        </div>
        <p className="mb-1 mt-4 text-sm font-semibold">Résultat</p>
        <iframe ref={frame} title={`Résultat : ${title}`} sandbox="allow-scripts" srcDoc={doc} className="h-52 w-full rounded-md border border-line bg-white" />
        <p role="status" className="mt-2 min-h-[1.25rem] text-sm font-semibold text-danger">
          {error && `Erreur dans votre code : ${error}`}
        </p>
      </div>
    </section>
  );
}
