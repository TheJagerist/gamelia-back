'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Flag, MessageSquare } from 'lucide-react';
import { api, messageFor } from '@/lib/api';
import { useSession } from '@/lib/session';
import { timeAgo } from '@/lib/format';
import type { Comment, Report } from '@/lib/types';
import { useToast } from './toast';
import { Dialog, TextArea, UserLine, cx } from './ui';

/** Texte saisi par un utilisateur : affiché comme texte, jamais comme HTML. */
export function PlainText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cx('space-y-3 break-words', className)}>
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
}

const REASONS = ['Contenu offensant', 'Spam ou publicité', 'Doublon', 'Lien cassé', 'Hors sujet', 'Autre'];

/** Bouton « Signaler » présent sur chaque question, réponse et projet. */
export function ReportButton({ targetType, targetId, label = 'Signaler' }: { targetType: Report['targetType']; targetId: string; label?: string }) {
  const { user } = useSession();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user) return null;
  const send = async () => {
    if (!reason) return toast('Choisissez un motif.', 'error');
    setBusy(true);
    try {
      await api.report({ targetType, targetId, reason, details: details.trim() || undefined });
      toast("Signalement envoyé. L'équipe le traite rapidement.");
      setOpen(false);
      setReason('');
      setDetails('');
    } catch (e) {
      toast(messageFor(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex min-h-[36px] items-center gap-1.5 rounded px-2 text-sm font-semibold text-muted hover:bg-sunken hover:text-danger">
        <Flag className="h-4 w-4" aria-hidden />
        {label}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Signaler ce contenu"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>
              Annuler
            </button>
            <button className="btn btn-danger" onClick={send} disabled={busy}>
              {busy ? 'Envoi…' : 'Envoyer le signalement'}
            </button>
          </>
        }
      >
        <fieldset>
          <legend className="field-label">Motif</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {REASONS.map((r) => (
              <label key={r} className={cx('flex min-h-[44px] cursor-pointer items-center gap-2 rounded border px-3 text-sm', reason === r ? 'border-primary bg-primary-soft' : 'border-line')}>
                <input type="radio" name="motif" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[var(--primary)]" />
                {r}
              </label>
            ))}
          </div>
        </fieldset>
        <TextArea className="mt-4" label="Précisions" optional value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={300} />
      </Dialog>
    </>
  );
}

/** Liste de commentaires réutilisée pour les réponses et les projets. */
export function CommentList({ comments, onSend, canComment, compact = false }: { comments: Comment[]; onSend: (body: string) => Promise<void>; canComment: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (body.trim().length < 2) return;
    setBusy(true);
    try {
      await onSend(body);
      setBody('');
      setOpen(false);
      toast('Commentaire publié.');
    } catch (err) {
      toast(messageFor(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cx(compact ? 'mt-3' : 'mt-4')}>
      {comments.length > 0 && (
        <ul className="space-y-2 border-l-2 border-line pl-4">
          {comments.map((c) => (
            <li key={c.id} className="text-sm">
              <span className="text-ink">{c.body}</span>
              <span className="text-muted">
                {' '}
                ({c.author.role === 'developpeur' ? (
                  <Link href={`/u/${c.author.username}`} className="font-semibold hover:underline">
                    {c.author.name}
                  </Link>
                ) : (
                  c.author.name
                )}
                , {timeAgo(c.createdAt)})
              </span>
            </li>
          ))}
        </ul>
      )}
      {canComment &&
        (open ? (
          <form onSubmit={send} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
            <label className="sr-only" htmlFor="comment-input">
              Votre commentaire
            </label>
            <input id="comment-input" autoFocus className="field flex-1" value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} placeholder="Un commentaire court et utile" />
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                Annuler
              </button>
              <button className="btn" disabled={busy || body.trim().length < 2}>
                {busy ? 'Envoi…' : 'Commenter'}
              </button>
            </div>
          </form>
        ) : (
          <button onClick={() => setOpen(true)} className="mt-2 inline-flex min-h-[36px] items-center gap-1.5 rounded px-2 text-sm font-semibold text-muted hover:bg-sunken hover:text-ink">
            <MessageSquare className="h-4 w-4" aria-hidden />
            Ajouter un commentaire
          </button>
        ))}
    </div>
  );
}
