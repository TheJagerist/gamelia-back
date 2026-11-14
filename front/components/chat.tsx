'use client';
// Messagerie privée : liste des conversations, fil de discussion et zone d'écriture.
// Le texte des messages est toujours affiché comme du texte (jamais comme du HTML) et les adresses
// ne sont pas transformées en liens cliquables : cela limite les arnaques par message.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Ban, ChevronLeft, Send, ShieldAlert } from 'lucide-react';
import { api, messageFor } from '@/lib/api';
import { dateLong, timeAgo } from '@/lib/format';
import type { Conversation, ConversationSummary, PublicUser } from '@/lib/types';
import { useToast } from './toast';
import { Avatar, Dialog, ErrorState, Skeleton, cx } from './ui';

const MAX = 1000;
const POLL_MS = 10000; // sans temps réel, on relit la conversation toutes les 10 secondes

const hour = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/* ---------- Liste des conversations ---------- */

export function ConversationList({ items, activeId }: { items: ConversationSummary[]; activeId?: string }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((c) => (
        <li key={c.id}>
          <Link
            href={`/messages?c=${c.id}`}
            aria-current={c.id === activeId ? 'true' : undefined}
            className={cx('flex min-h-[72px] items-center gap-3 px-4 py-3 hover:bg-sunken', c.id === activeId && 'bg-primary-soft')}
          >
            <Avatar user={c.with} size="md" />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className={cx('truncate', c.unread > 0 ? 'font-bold' : 'font-semibold')}>{c.with.name}</span>
                {c.lastMessage && <span className="shrink-0 text-xs text-muted">{timeAgo(c.lastMessage.createdAt)}</span>}
              </span>
              <span className={cx('block truncate text-sm', c.unread > 0 ? 'text-ink' : 'text-muted')}>
                {c.lastMessage ? `${c.lastMessage.mine ? 'Vous : ' : ''}${c.lastMessage.body}` : 'Aucun message'}
              </span>
            </span>
            {c.unread > 0 && (
              <span
                className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-[#2a1730]"
                aria-label={`${c.unread} message${c.unread > 1 ? 's' : ''} non lu${c.unread > 1 ? 's' : ''}`}
              >
                {c.unread}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Zone d'écriture ---------- */

function Composer({ onSend }: { onSend: (body: string) => Promise<boolean> }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const trimmed = text.trim();
  const canSend = !busy && trimmed.length > 0 && text.length <= MAX;

  async function submit() {
    if (!canSend) return;
    setBusy(true);
    const ok = await onSend(trimmed);
    setBusy(false);
    if (ok) {
      setText('');
      ref.current?.focus();
    }
  }

  return (
    <form
      className="border-t border-line p-3 sm:p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label htmlFor="message-texte" className="sr-only">
        Votre message
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id="message-texte"
          ref={ref}
          rows={2}
          maxLength={MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Entrée envoie sur ordinateur ; sur téléphone, Entrée va à la ligne et le bouton envoie.
            if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Écrivez votre message…"
          className="field min-h-[44px] flex-1 resize-none leading-relaxed"
        />
        <button type="submit" className="btn shrink-0" disabled={!canSend} aria-label="Envoyer le message">
          <Send className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Envoyer</span>
        </button>
      </div>
      <p className="mt-2 flex justify-between gap-3 text-xs text-muted">
        <span>Ne partagez jamais votre mot de passe ni vos codes de confirmation.</span>
        {text.length >= 800 && <span className="tabular-nums">{text.length}/{MAX}</span>}
      </p>
    </form>
  );
}

/* ---------- En-tête d'une discussion ---------- */

function ThreadHeader({ person, action }: { person: PublicUser; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-line px-3 py-3 sm:px-4">
      <Link href="/messages" className="-ml-1 inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-sunken hover:text-ink lg:hidden" aria-label="Retour aux conversations">
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </Link>
      <Avatar user={person} size="md" />
      <div className="min-w-0 flex-1">
        {person.role === 'developpeur' ? (
          <Link href={`/u/${person.username}`} className="block truncate font-semibold hover:underline">
            {person.name}
          </Link>
        ) : (
          <p className="truncate font-semibold">{person.name}</p>
        )}
        <p className="truncate text-sm text-muted">{person.company || [person.city, person.country].filter(Boolean).join(', ')}</p>
      </div>
      {action}
    </div>
  );
}

const LOADING = (
  <div className="space-y-3 p-4" aria-busy="true" aria-label="Chargement de la conversation">
    <Skeleton className="h-12 w-2/3" />
    <Skeleton className="ml-auto h-12 w-1/2" />
    <Skeleton className="h-12 w-3/5" />
  </div>
);

/* ---------- Discussion ouverte ---------- */

export function ThreadView({ id, onChanged }: { id: string; onChanged: () => void }) {
  const toast = useToast();
  const [conv, setConv] = useState<Conversation>();
  const [error, setError] = useState<unknown>();
  const [tick, setTick] = useState(0);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const changed = useRef(onChanged);
  changed.current = onChanged;

  useEffect(() => {
    let alive = true;
    setConv(undefined);
    setError(undefined);
    const load = async (silent: boolean) => {
      try {
        const c = await api.messages.thread(id);
        if (!alive) return;
        setConv(c);
        if (c.unread > 0) {
          await api.messages.markRead(id);
          if (alive) changed.current();
        }
      } catch (e) {
        if (alive && !silent) setError(e);
      }
    };
    void load(false);
    const timer = setInterval(() => void load(true), POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [id, tick]);

  // Le fil défile jusqu'au dernier message quand il change.
  const count = conv?.messages.length ?? 0;
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [count, id]);

  async function send(body: string): Promise<boolean> {
    try {
      const m = await api.messages.send(id, body);
      setConv((c) => (c ? { ...c, messages: [...c.messages, m], lastMessage: { body: m.body, createdAt: m.createdAt, mine: true } } : c));
      changed.current();
      return true;
    } catch (e) {
      toast(messageFor(e), 'error');
      return false;
    }
  }

  async function setBlocked(person: PublicUser, blocked: boolean) {
    try {
      if (blocked) await api.messages.block(person.username);
      else await api.messages.unblock(person.username);
      setConv((c) => (c ? { ...c, blockedByMe: blocked } : c));
      setConfirmBlock(false);
      toast(blocked ? `${person.name} est bloqué.` : `${person.name} est débloqué.`);
      changed.current();
    } catch (e) {
      toast(messageFor(e), 'error');
    }
  }

  if (error) {
    return (
      <div className="p-4">
        <ErrorState error={error} onRetry={() => setTick((t) => t + 1)} />
      </div>
    );
  }
  if (!conv) return LOADING;

  return (
    <div className="flex h-[min(70vh,640px)] flex-col">
      <ThreadHeader
        person={conv.with}
        action={
          !conv.blockedByMe && (
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmBlock(true)}>
              <Ban className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Bloquer</span>
              <span className="sr-only sm:hidden">Bloquer {conv.with.name}</span>
            </button>
          )
        }
      />

      <div ref={box} role="log" aria-live="polite" aria-label={`Conversation avec ${conv.with.name}`} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {conv.messages.map((m, i) => {
          const prev = conv.messages[i - 1];
          const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
          return (
            <div key={m.id}>
              {newDay && <p className="my-3 text-center text-xs font-semibold text-muted">{dateLong(m.createdAt)}</p>}
              <div className={cx('flex', m.mine ? 'justify-end' : 'justify-start')}>
                <div className={cx('max-w-[85%] rounded-lg px-3.5 py-2 sm:max-w-[75%]', m.mine ? 'bg-primary text-primary-ink' : 'bg-sunken text-ink')}>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={cx('mt-1 text-right text-[11px]', m.mine ? 'text-primary-ink/80' : 'text-muted')}>
                    <span className="sr-only">{m.mine ? 'Envoyé à ' : 'Reçu à '}</span>
                    {hour(m.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {conv.blockedByMe ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4">
          <p className="text-sm text-muted">Vous avez bloqué {conv.with.name}. Vous ne pouvez plus vous écrire.</p>
          <button className="btn btn-secondary btn-sm" onClick={() => setBlocked(conv.with, false)}>
            Débloquer
          </button>
        </div>
      ) : (
        <Composer onSend={send} />
      )}

      <Dialog
        open={confirmBlock}
        onClose={() => setConfirmBlock(false)}
        title={`Bloquer ${conv.with.name} ?`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setConfirmBlock(false)}>
              Annuler
            </button>
            <button className="btn btn-danger" onClick={() => setBlocked(conv.with, true)}>
              Bloquer
            </button>
          </>
        }
      >
        <p className="flex gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden />
          <span>Cette personne ne pourra plus vous écrire, et vous ne pourrez plus lui écrire tant que vous ne l&apos;aurez pas débloquée.</span>
        </p>
      </Dialog>
    </div>
  );
}

/* ---------- Première conversation avec un membre ---------- */

export function NewConversation({ username, onCreated }: { username: string; onCreated: (id: string) => void }) {
  const toast = useToast();
  const [person, setPerson] = useState<PublicUser>();
  const [error, setError] = useState<unknown>();

  useEffect(() => {
    let alive = true;
    setPerson(undefined);
    setError(undefined);
    api.publicProfile(username).then(
      (p) => alive && setPerson(p.user),
      (e) => alive && setError(e),
    );
    return () => {
      alive = false;
    };
  }, [username]);

  async function send(body: string): Promise<boolean> {
    try {
      const r = await api.messages.start(username, body);
      onCreated(r.id);
      return true;
    } catch (e) {
      toast(messageFor(e), 'error');
      return false;
    }
  }

  if (error) {
    return (
      <div className="p-4">
        <ErrorState error={error} />
      </div>
    );
  }
  if (!person) return LOADING;

  return (
    <div className="flex h-[min(70vh,640px)] flex-col">
      <ThreadHeader person={person} />
      <div className="flex flex-1 items-center justify-center px-6 text-center text-muted">
        <p>Écrivez votre premier message à {person.name}. Présentez-vous en une phrase et dites pourquoi vous écrivez.</p>
      </div>
      <Composer onSend={send} />
    </div>
  );
}
