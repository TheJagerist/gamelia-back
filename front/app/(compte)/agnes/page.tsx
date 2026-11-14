'use client';
// /agnes : discussion avec Agnès, l'assistante IA de Gamelia (tous les membres connectés).
// /agnes?question=ID : la discussion démarre avec le contexte d'une question du forum.
// La discussion reste dans l'onglet (sessionStorage) : rien n'est enregistré sur nos serveurs.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Lightbulb, MessagesSquare, RotateCcw, Send, SquarePen, X } from 'lucide-react';
import { AgnesMark, AgnesText, AiBadge, Thinking } from '@/components/agnes';
import { useToast } from '@/components/toast';
import { cx } from '@/components/ui';
import { api, messageFor } from '@/lib/api';
import { useQueryState } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import type { AgnesTurn } from '@/lib/types';

const STORAGE_KEY = 'gamelia-agnes-discussion-v1';
const MAX = 4000;
const HISTORY = 12; // messages transmis à Agnès au maximum

type Turn = AgnesTurn & { id: number; shown?: string; error?: boolean };
type Context = { id: string; title: string; text: string };

const SUGGESTIONS = [
  { title: 'Comprendre une erreur', text: 'Que veut dire l’erreur « CORS policy: No Access-Control-Allow-Origin » et comment la corriger avec Express ?' },
  { title: 'Apprendre une notion', text: 'Explique-moi simplement la différence entre une requête GET et une requête POST, avec un exemple.' },
  { title: 'Relire mon code', text: 'Comment rendre ce code JavaScript plus lisible ?\n\nfunction f(a){let r=[];for(let i=0;i<a.length;i++){if(a[i]%2==0)r.push(a[i]*2)}return r}' },
  { title: 'Préparer ma carrière', text: 'Quels projets mettre dans mon portfolio pour décrocher un premier stage de développeur web ?' },
];

function contextPrompt(c: Context) {
  return `Contexte : je consulte la question « ${c.title} » sur le forum Gamelia.\n\n${c.text}\n\nMa demande :`;
}

export default function AgnesPage() {
  const { user } = useSession();
  const toast = useToast();
  const qs = useQueryState();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [context, setContext] = useState<Context | null>(null);
  const [restored, setRestored] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const questionId = qs.get('question');

  // Disponibilité d'Agnès (clé configurée côté serveur).
  useEffect(() => {
    api.agnes.status().then(
      (s) => setAvailable(s.available),
      () => setAvailable(false),
    );
  }, []);

  // Discussion en cours dans cet onglet.
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) setTurns(JSON.parse(raw) as Turn[]);
    } catch {
      /* stockage indisponible */
    }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(turns.filter((t) => !t.error)));
    } catch {
      /* stockage indisponible */
    }
  }, [turns, restored]);

  // Contexte d'une question du forum (?question=ID).
  useEffect(() => {
    if (!qs.ready || !questionId) return;
    let alive = true;
    api.questions.get(questionId).then(
      (q) => {
        if (!alive) return;
        const code = q.code ? `\n\nCode (${q.code.lang}) :\n\`\`\`${q.code.lang}\n${q.code.content}\n\`\`\`` : '';
        setContext({ id: q.id, title: q.title, text: `${q.body}${code}`.slice(0, 2500) });
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [qs.ready, questionId]);

  // Défile jusqu'au dernier message ; l'écran d'accueil (aucun message) reste affiché depuis le haut.
  useEffect(() => {
    if (!box.current) return;
    box.current.scrollTop = turns.length || busy ? box.current.scrollHeight : 0;
  }, [turns.length, busy]);

  async function send(raw: string, base: Turn[] = turns) {
    const typed = raw.trim();
    if (!typed || busy || typed.length > MAX) return;
    const clean = base.filter((t) => !t.error);
    const content = clean.length === 0 && context ? `${contextPrompt(context)}\n${typed}`.slice(0, MAX) : typed;
    const mine: Turn = { id: Date.now(), role: 'user', content, shown: typed };
    const history = [...clean, mine];
    setTurns(history);
    setText('');
    setBusy(true);
    try {
      const r = await api.agnes.chat(history.slice(-HISTORY).map(({ role, content: c }) => ({ role, content: c })));
      setTurns((t) => [...t, { id: Date.now() + 1, role: 'assistant', content: r.reply }]);
    } catch (e) {
      setTurns((t) => [...t, { id: Date.now() + 1, role: 'assistant', content: messageFor(e), error: true }]);
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }

  function retry() {
    const lastUser = [...turns].reverse().find((t) => t.role === 'user');
    if (!lastUser) return;
    const keep = turns.filter((t) => !t.error && t.id !== lastUser.id);
    void send(lastUser.shown ?? lastUser.content, keep);
  }

  function reset() {
    setTurns([]);
    setContext(null);
    if (questionId) qs.set({ question: null });
    input.current?.focus();
  }

  const disabled = available === false;
  const canSend = !busy && !disabled && text.trim().length > 0 && text.length <= MAX;

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex flex-wrap items-center gap-4">
        <AgnesMark size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl sm:text-4xl">Agnès</h1>
            <AiBadge />
          </div>
          <p className="mt-1 text-muted">L&apos;assistante IA de Gamelia. Une erreur à comprendre, une notion à revoir, du code à relire : demandez-lui.</p>
        </div>
        {turns.length > 0 && (
          <button onClick={reset} className="btn btn-secondary btn-sm">
            <SquarePen className="h-4 w-4" aria-hidden />
            Nouvelle discussion
          </button>
        )}
      </header>

      <div className="panel flex h-[min(72vh,680px)] flex-col overflow-hidden">
        <div ref={box} role="log" aria-live="polite" aria-label="Discussion avec Agnès" className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          {turns.length === 0 && !busy ? (
            <div className="mx-auto flex max-w-2xl flex-col items-center py-4 text-center">
              <AgnesMark size="lg" className="floaty" />
              <p className="mt-4 text-lg font-semibold">Bonjour{user ? ` ${user.name.split(' ')[0]}` : ''}, que puis-je faire pour vous ?</p>
              <p className="mt-1 max-w-md text-sm text-muted">Je réponds en quelques secondes. Pour un échange entre humains, la communauté reste là : publiez votre question sur le forum.</p>
              {!disabled && (
                <ul className="mt-6 grid w-full gap-3 text-left sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <li key={s.title}>
                      <button
                        onClick={() => void send(s.text)}
                        className="group flex h-full w-full flex-col gap-1 rounded-lg border border-line bg-surface p-4 text-left transition-colors hover:border-primary hover:bg-primary-soft"
                      >
                        <span className="flex items-center gap-2 text-sm font-semibold text-primary">
                          <Lightbulb className="h-4 w-4" aria-hidden />
                          {s.title}
                        </span>
                        <span className="line-clamp-2 text-sm text-muted group-hover:text-ink">{s.text.split('\n')[0]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            turns.map((t) => (t.role === 'user' ? <UserBubble key={t.id} text={t.shown ?? t.content} /> : <AgnesBubble key={t.id} turn={t} onRetry={retry} toast={toast} />))
          )}
          {busy && (
            <div className="flex items-start gap-3">
              <AgnesMark size="sm" />
              <div className="rounded-lg rounded-tl-sm border border-line bg-sunken/60 px-4 py-3">
                <Thinking />
              </div>
            </div>
          )}
        </div>

        <form
          className="border-t border-line bg-surface p-3 sm:p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSend) void send(text);
          }}
        >
          {disabled && (
            <p className="mb-3 rounded bg-sunken px-3 py-2 text-sm text-muted" role="status">
              Agnès n&apos;est pas disponible pour le moment. Vous pouvez poser votre question à la communauté sur le forum.
            </p>
          )}
          {context && turns.length === 0 && (
            <p className="mb-3 flex items-center gap-2 rounded bg-accent-soft px-3 py-2 text-sm">
              <MessagesSquare className="h-4 w-4 shrink-0 text-accent-ink" aria-hidden />
              <span className="min-w-0 flex-1 truncate">
                À propos de : <strong>{context.title}</strong>
              </span>
              <button type="button" onClick={() => setContext(null)} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface" aria-label="Retirer le contexte de la question">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </p>
          )}
          <label htmlFor="agnes-texte" className="sr-only">
            Votre message à Agnès
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id="agnes-texte"
              ref={input}
              rows={2}
              maxLength={MAX}
              value={text}
              disabled={disabled}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                // Entrée envoie sur ordinateur ; Maj+Entrée va à la ligne. Sur téléphone, le bouton envoie.
                if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) {
                  e.preventDefault();
                  if (canSend) void send(text);
                }
              }}
              placeholder={context && turns.length === 0 ? 'Que voulez-vous savoir sur cette question ?' : 'Posez votre question à Agnès…'}
              className="field max-h-48 min-h-[48px] flex-1 resize-y leading-relaxed"
            />
            <button type="submit" className="btn shrink-0" disabled={!canSend} aria-label="Envoyer à Agnès">
              <Send className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Envoyer</span>
            </button>
          </div>
          <p className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted">
            <span>Agnès peut se tromper : vérifiez ses réponses. N&apos;y collez jamais de mot de passe ni de clé secrète.</span>
            {text.length >= 3500 && (
              <span className="tabular-nums">
                {text.length}/{MAX}
              </span>
            )}
          </p>
        </form>
      </div>

      {user?.role === 'developpeur' && (
        <p className="mt-4 text-center text-sm text-muted">
          Besoin d&apos;un avis humain ?{' '}
          <Link href="/questions/nouvelle" className="link">
            Posez votre question à la communauté
          </Link>
        </p>
      )}
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-lg rounded-tr-sm bg-primary px-4 py-2.5 text-primary-ink sm:max-w-[75%]">
        <span className="sr-only">Vous : </span>
        <p className="whitespace-pre-wrap break-words">{text}</p>
      </div>
    </div>
  );
}

function AgnesBubble({ turn, onRetry, toast }: { turn: Turn; onRetry: () => void; toast: (t: string, k?: 'success' | 'error' | 'info') => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(turn.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast('Copie impossible sur cet appareil.', 'error');
    }
  };
  return (
    <div className="flex items-start gap-3">
      <AgnesMark size="sm" className="mt-1" />
      <div className={cx('min-w-0 max-w-[92%] flex-1 rounded-lg rounded-tl-sm border px-4 py-3 sm:max-w-[85%]', turn.error ? 'border-danger/30 bg-danger-soft/50' : 'border-line bg-sunken/60')}>
        <span className="sr-only">Agnès : </span>
        {turn.error ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-danger">{turn.content}</p>
            <button onClick={onRetry} className="btn btn-secondary btn-sm">
              <RotateCcw className="h-4 w-4" aria-hidden />
              Réessayer
            </button>
          </div>
        ) : (
          <>
            <AgnesText text={turn.content} />
            <div className="mt-2 flex justify-end">
              <button onClick={copy} className="inline-flex min-h-[32px] items-center gap-1.5 rounded px-2 text-xs font-semibold text-muted hover:bg-surface hover:text-ink">
                {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                {copied ? 'Copié' : 'Copier'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
