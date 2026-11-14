'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Code2, PlayCircle } from 'lucide-react';
import { api, messageFor } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import type { Application } from '@/lib/types';
import { useToast } from './toast';
import { Dialog, ExternalLink, Stars, StatusPill, TextArea, UserLine } from './ui';

export const CHALLENGE_STATUS = {
  en_attente: { label: "En attente de validation par l'équipe", tone: 'accent' },
  publie: { label: 'Publié', tone: 'success' },
  cloture: { label: 'Clôturé', tone: 'neutral' },
  refuse: { label: 'Refusé', tone: 'danger' },
} as const;

export const APP_STATUS = {
  recue: { label: 'À évaluer', tone: 'accent' },
  evaluee: { label: 'Évaluée', tone: 'primary' },
  retenue: { label: 'Retenue', tone: 'success' },
  non_retenue: { label: 'Non retenue', tone: 'neutral' },
} as const;

/** Candidature : lecture, évaluation, choix du candidat et proposition de collaboration. */
export function ApplicationCard({ a, onChange, showChallenge = false }: { a: Application; onChange: () => void; showChallenge?: boolean }) {
  const toast = useToast();
  const [score, setScore] = useState(a.score || 0);
  const [feedback, setFeedback] = useState(a.feedback || '');
  const [busy, setBusy] = useState(false);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposal, setProposal] = useState('');
  const s = APP_STATUS[a.status];
  const decided = a.status === 'retenue' || a.status === 'non_retenue';

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      onChange();
    } catch (e) {
      toast(messageFor(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <UserLine user={a.dev} size="md" extra={<span>{timeAgo(a.createdAt)}</span>} />
        <StatusPill tone={s.tone}>{s.label}</StatusPill>
      </div>
      {showChallenge && (
        <p className="mt-2 text-sm text-muted">
          Défi :{' '}
          <Link href={`/recruteur/defis/${a.challengeId}`} className="font-semibold text-primary hover:underline">
            {a.challengeTitle}
          </Link>
        </p>
      )}
      <p className="mt-3">{a.message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <ExternalLink href={a.codeUrl} className="btn btn-secondary btn-sm">
          <Code2 className="h-4 w-4" aria-hidden />
          Code
        </ExternalLink>
        {a.demoUrl && (
          <ExternalLink href={a.demoUrl} className="btn btn-secondary btn-sm">
            <PlayCircle className="h-4 w-4" aria-hidden />
            Démo
          </ExternalLink>
        )}
        <Link href={`/u/${a.dev.username}`} className="btn btn-ghost btn-sm">
          Profil vérifiable
        </Link>
      </div>

      {a.proposal && (
        <div className="mt-4 rounded-lg bg-success-soft p-4 text-[15px]">
          <p className="font-semibold">Proposition envoyée</p>
          <p className="mt-1">{a.proposal}</p>
        </div>
      )}

      {!decided && (
        <div className="mt-5 space-y-3 border-t border-line pt-4">
          <p className="field-label mb-0">Évaluation</p>
          <Stars value={score} onChange={setScore} label="Note de la solution" />
          <TextArea label="Retour au candidat" optional rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={500} />
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-secondary btn-sm" disabled={busy || !score} onClick={() => run(() => api.recruiter.evaluate(a.id, score, feedback), 'Évaluation enregistrée. Le candidat est prévenu.')}>
              Enregistrer l&apos;évaluation
            </button>
            <button className="btn btn-sm" disabled={busy} onClick={() => setProposeOpen(true)}>
              Retenir et proposer une collaboration
            </button>
            <button className="btn btn-ghost btn-sm text-muted" disabled={busy} onClick={() => run(() => api.recruiter.decide(a.id, false), 'Candidature marquée comme non retenue.')}>
              Ne pas retenir
            </button>
          </div>
        </div>
      )}
      {decided && a.score && (
        <p className="mt-4 text-sm text-muted">
          Note donnée : <Stars value={a.score} />
        </p>
      )}

      <Dialog
        open={proposeOpen}
        onClose={() => setProposeOpen(false)}
        title={`Proposer une collaboration à ${a.dev.name}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setProposeOpen(false)}>
              Annuler
            </button>
            <button
              className="btn"
              disabled={busy || proposal.trim().length < 20}
              onClick={() =>
                run(async () => {
                  await api.recruiter.decide(a.id, true, proposal);
                  setProposeOpen(false);
                }, `Proposition envoyée à ${a.dev.name}.`)
              }
            >
              Envoyer la proposition
            </button>
          </>
        }
      >
        <TextArea label="Votre proposition" hint="Le type de collaboration, la durée, la rémunération et la prochaine étape (appel, entretien)." rows={5} value={proposal} onChange={(e) => setProposal(e.target.value)} counter={800} />
      </Dialog>
    </article>
  );
}
