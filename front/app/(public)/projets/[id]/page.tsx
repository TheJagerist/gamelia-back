'use client';
import Link from 'next/link';
import { useState } from 'react';
import { BadgeCheck, Code2, Users } from 'lucide-react';
import { CommentList, PlainText, ReportButton } from '@/components/social';
import { useToast } from '@/components/toast';
import { Async, Dialog, ExternalLink, PageHeader, Skeleton, Stars, StatusPill, Tag, TextArea, TextField, UserLine } from '@/components/ui';
import { VideoEmbed } from '@/components/video';
import { api, messageFor } from '@/lib/api';
import { dateLong, plural, timeAgo } from '@/lib/format';
import { useResource } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import type { Project } from '@/lib/types';

export default function ProjectPage({ params }: { params: { id: string } }) {
  const res = useResource(() => api.projects.get(params.id), [params.id]);
  return (
    <Async
      res={res}
      skeleton={
        <div className="space-y-4">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="aspect-video w-full max-w-3xl" />
        </div>
      }
    >
      {(p) => <ProjectView p={p} reload={res.reload} />}
    </Async>
  );
}

function ProjectView({ p, reload }: { p: Project; reload: () => void }) {
  const { user } = useSession();
  const toast = useToast();
  const isDev = user?.role === 'developpeur';
  const isOwner = user?.id === p.owner.id;
  const alreadyReviewed = p.reviews.some((r) => r.author.id === user?.id);
  const avg = p.reviews.length ? p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length : 0;

  const act = async (fn: () => Promise<void>, ok: string) => {
    try {
      await fn();
      toast(ok);
      reload();
    } catch (e) {
      toast(messageFor(e), 'error');
    }
  };

  return (
    <>
      <PageHeader back={{ href: '/projets', label: 'Projets' }} title={p.title} description={p.summary} />
      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-8">
          {p.videoUrl ? (
            <VideoEmbed url={p.videoUrl} title={p.title} />
          ) : (
            <div className="flex aspect-[21/9] items-center justify-center rounded-lg border border-dashed border-line text-sm text-muted">Pas de vidéo de démonstration pour ce projet.</div>
          )}

          {p.description && (
            <section aria-labelledby="desc">
              <h2 id="desc" className="mb-3 text-xl">
                Le projet
              </h2>
              <PlainText text={p.description} className="max-w-prose leading-relaxed" />
            </section>
          )}

          {isOwner && p.collabRequests.length > 0 && (
            <section aria-labelledby="collabs" className="panel p-5">
              <h2 id="collabs" className="mb-3 text-lg">
                Demandes de collaboration
              </h2>
              <ul className="divide-y divide-line">
                {p.collabRequests.map((c) => (
                  <li key={c.id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <UserLine user={c.from} extra={<span>propose : {c.role}</span>} />
                      {c.status !== 'en_attente' && <StatusPill tone={c.status === 'acceptee' ? 'success' : 'neutral'}>{c.status === 'acceptee' ? 'Acceptée' : 'Refusée'}</StatusPill>}
                    </div>
                    <p className="mt-2 text-[15px]">{c.message}</p>
                    {c.status === 'en_attente' && (
                      <div className="mt-3 flex gap-2">
                        <button className="btn btn-sm" onClick={() => act(() => api.projects.answerCollab(p.id, c.id, true), `Demande de ${c.from.name} acceptée.`)}>
                          Accepter
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => act(() => api.projects.answerCollab(p.id, c.id, false), 'Demande refusée.')}>
                          Refuser
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="revues">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id="revues" className="text-xl">
                Revues des pairs
              </h2>
              {p.reviews.length > 0 && (
                <span className="text-sm text-muted">
                  <Stars value={Math.round(avg)} /> {avg.toFixed(1).replace('.', ',')} sur 5, {plural(p.reviews.length, 'revue', 'revues')}
                </span>
              )}
            </div>
            <p className="mb-4 text-sm text-muted">Une revue validée par le propriétaire rend le projet « vérifié » sur son portfolio et rapporte 10 points à son auteur.</p>
            {p.reviews.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line p-5 text-sm text-muted">Pas encore de revue. {isDev && !isOwner ? 'Soyez le premier à donner un retour.' : ''}</p>
            ) : (
              <ul className="space-y-3">
                {p.reviews.map((r) => (
                  <li key={r.id} className="panel p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <UserLine user={r.author} extra={<span>{timeAgo(r.createdAt)}</span>} />
                      <Stars value={r.rating} />
                    </div>
                    <p className="mt-2">{r.body}</p>
                    <div className="mt-3">
                      {r.validatedByOwner ? (
                        <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary">
                          <BadgeCheck className="h-4 w-4" aria-hidden />
                          Validée par le propriétaire
                        </span>
                      ) : isOwner ? (
                        <button className="btn btn-secondary btn-sm" onClick={() => act(() => api.projects.validateReview(p.id, r.id), `Revue validée. ${r.author.name} gagne 10 points.`)}>
                          Valider cette revue
                        </button>
                      ) : (
                        <span className="text-[13px] text-muted">En attente de validation par le propriétaire</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {isDev && !isOwner && !alreadyReviewed && <ReviewForm pid={p.id} onDone={reload} />}
          </section>

          <section aria-labelledby="comms">
            <h2 id="comms" className="text-xl">
              Commentaires
            </h2>
            {p.comments.length === 0 && <p className="mt-2 text-sm text-muted">Aucun commentaire pour l&apos;instant.</p>}
            <CommentList comments={p.comments} canComment={isDev} onSend={async (b) => { await api.projects.comment(p.id, b); reload(); }} />
            {!user && (
              <p className="mt-3 text-sm">
                <Link href={`/connexion?suite=/projets/${p.id}`} className="link">
                  Connectez-vous
                </Link>{' '}
                pour commenter ou évaluer ce projet.
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="panel space-y-4 p-5">
            <UserLine user={p.owner} size="md" />
            <ExternalLink href={p.codeUrl} className="btn btn-secondary w-full">
              <Code2 className="h-4 w-4" aria-hidden />
              Voir le code
            </ExternalLink>
            <div className="flex flex-wrap gap-1.5">
              {p.techs.map((t) => (
                <Tag key={t} name={t} href={`/projets?tech=${encodeURIComponent(t)}`} />
              ))}
            </div>
            <p className="text-[13px] text-muted">Publié le {dateLong(p.createdAt)}</p>
            {p.validatedReviews > 0 ? (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                <BadgeCheck className="h-4 w-4" aria-hidden />
                Projet relu par des pairs
              </p>
            ) : (
              <p className="text-sm text-muted">Pas encore relu par des pairs.</p>
            )}
          </div>
          {p.seekingCollaborators && (
            <div className="rounded-lg bg-accent-soft p-5">
              <p className="flex items-center gap-2 font-semibold">
                <Users className="h-5 w-5 text-accent-ink" aria-hidden />
                Cherche des collaborateurs
              </p>
              {isDev && !isOwner ? <CollabButton pid={p.id} onDone={reload} /> : !user && <p className="mt-2 text-sm">Connectez-vous pour proposer votre aide.</p>}
            </div>
          )}
          <div className="flex justify-end">
            <ReportButton targetType="projet" targetId={p.id} label="Signaler ce projet" />
          </div>
        </aside>
      </div>
    </>
  );
}

function ReviewForm({ pid, onDone }: { pid: string; onDone: () => void }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="panel mt-4 space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!rating) return toast('Choisissez une note.', 'info');
        setBusy(true);
        try {
          await api.projects.review(pid, rating, body);
          toast('Revue envoyée. Le propriétaire peut maintenant la valider.');
          onDone();
        } catch (err) {
          toast(messageFor(err), 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3 className="font-semibold">Donner une revue</h3>
      <Stars value={rating} onChange={setRating} label="Note du projet" />
      <TextArea label="Votre retour" hint="Ce qui marche bien, ce qui pourrait être amélioré. Soyez précis et bienveillant." rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      <button className="btn" disabled={busy || body.trim().length < 10}>
        {busy ? 'Envoi…' : 'Envoyer la revue'}
      </button>
    </form>
  );
}

function CollabButton({ pid, onDone }: { pid: string; onDone: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await api.projects.requestCollab(pid, role, message);
      toast('Demande envoyée. Le porteur du projet vous répondra dans vos notifications.');
      setOpen(false);
      onDone();
    } catch (e) {
      toast(messageFor(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button className="btn btn-sm mt-3" onClick={() => setOpen(true)}>
        Proposer ma collaboration
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Proposer ma collaboration"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>
              Annuler
            </button>
            <button className="btn" onClick={send} disabled={busy || !role.trim() || message.trim().length < 10}>
              {busy ? 'Envoi…' : 'Envoyer la demande'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <TextField label="Rôle proposé" placeholder="Interface, API, tests, design…" value={role} onChange={(e) => setRole(e.target.value)} maxLength={40} />
          <TextArea label="Message" hint="Ce que vous pouvez apporter et votre disponibilité." rows={4} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} />
        </div>
      </Dialog>
    </>
  );
}
