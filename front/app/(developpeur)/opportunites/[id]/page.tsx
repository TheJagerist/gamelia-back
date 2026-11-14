'use client';
import { useState } from 'react';
import { Building2, CalendarClock, Gift } from 'lucide-react';
import { PlainText } from '@/components/social';
import { useToast } from '@/components/toast';
import { Async, ExternalLink, PageHeader, Stars, StatusPill, Tag, TextArea, TextField } from '@/components/ui';
import { api, ApiError, messageFor } from '@/lib/api';
import { daysLeft, dateLong } from '@/lib/format';
import { useResource } from '@/lib/hooks';
import type { RecruiterChallenge } from '@/lib/types';

const STATUS_LABEL = { recue: 'Reçue', evaluee: 'Évaluée', retenue: 'Retenue', non_retenue: 'Non retenue' } as const;

export default function OpportunitePage({ params }: { params: { id: string } }) {
  const res = useResource(() => api.opportunities.get(params.id), [params.id]);
  return <Async res={res}>{(c) => <View c={c} reload={res.reload} />}</Async>;
}

function View({ c, reload }: { c: RecruiterChallenge; reload: () => void }) {
  const a = c.myApplication;
  const closed = c.status !== 'publie' || Date.parse(c.deadline) < Date.now();
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0">
        <PageHeader back={{ href: '/opportunites', label: 'Défis recruteurs' }} title={c.title} description={c.summary} />
        <div className="mb-6 flex flex-wrap gap-1.5">
          {c.skills.map((s) => (
            <Tag key={s} name={s} />
          ))}
        </div>
        <PlainText text={c.brief} className="max-w-prose text-[1.05rem] leading-relaxed" />

        <section className="mt-8 border-t border-line pt-8" aria-labelledby="cand">
          <h2 id="cand" className="mb-5 text-xl">
            {a ? 'Ma candidature' : 'Candidater'}
          </h2>
          {a ? (
            <div className="panel space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusPill tone={a.status === 'retenue' ? 'success' : a.status === 'non_retenue' ? 'neutral' : 'primary'}>{STATUS_LABEL[a.status]}</StatusPill>
                <span className="text-[13px] text-muted">Envoyée le {dateLong(a.createdAt)}</span>
              </div>
              <p className="text-[15px]">{a.message}</p>
              <ExternalLink href={a.codeUrl} className="link text-sm">
                Code envoyé
              </ExternalLink>
              {a.score && (
                <div className="rounded-lg bg-sunken p-4">
                  <p className="text-sm font-semibold">
                    Évaluation de {c.company} : <Stars value={a.score} />
                  </p>
                  {a.feedback && <p className="mt-1 text-[15px]">{a.feedback}</p>}
                </div>
              )}
              {a.proposal && (
                <div className="rounded-lg border-2 border-success bg-success-soft p-4">
                  <p className="font-semibold">Proposition de collaboration</p>
                  <p className="mt-1">{a.proposal}</p>
                  <p className="mt-2 text-sm text-muted">{c.recruiter.name} va vous écrire pour la suite.</p>
                </div>
              )}
            </div>
          ) : closed ? (
            <p className="rounded-lg bg-sunken p-4">Ce défi est clôturé.</p>
          ) : (
            <ApplyForm id={c.id} onDone={reload} />
          )}
        </section>
      </div>
      <aside className="space-y-3 lg:pt-14">
        <div className="panel space-y-3 p-5 text-[15px]">
          <p className="flex items-start gap-2">
            <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden />
            <span>
              <span className="font-semibold">{c.company}</span>
              <br />
              {c.country}
              {c.remote ? ', travail à distance possible' : ''}
            </span>
          </p>
          <p className="flex items-start gap-2">
            <Gift className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" aria-hidden />
            {c.reward}
          </p>
          <p className="flex items-start gap-2">
            <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden />
            <span>
              Jusqu&apos;au {dateLong(c.deadline)}
              <br />
              <span className="text-muted">{daysLeft(c.deadline)}</span>
            </span>
          </p>
          <p className="text-[13px] text-muted">{c.applicationCount} candidature(s) reçue(s)</p>
        </div>
      </aside>
    </div>
  );
}

function ApplyForm({ id, onDone }: { id: string; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ codeUrl: '', demoUrl: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  return (
    <form
      noValidate
      className="panel space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErrors({});
        try {
          await api.opportunities.apply(id, { codeUrl: f.codeUrl.trim(), demoUrl: f.demoUrl.trim() || undefined, message: f.message });
          toast('Candidature envoyée. Vous serez prévenu de son évaluation.');
          onDone();
        } catch (err) {
          if (err instanceof ApiError && err.fields) setErrors(err.fields);
          toast(messageFor(err), 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      <TextField label="Lien vers le code" type="url" inputMode="url" placeholder="https://github.com/vous/solution" value={f.codeUrl} onChange={(e) => setF({ ...f, codeUrl: e.target.value })} error={errors.codeUrl} />
      <TextField label="Lien de la démo" optional type="url" inputMode="url" placeholder="Vidéo YouTube, Vimeo ou site en ligne" value={f.demoUrl} onChange={(e) => setF({ ...f, demoUrl: e.target.value })} error={errors.demoUrl} />
      <TextArea label="Présentation de votre solution" hint="Vos choix techniques, ce qui marche, ce qui reste à faire." rows={5} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} error={errors.message} counter={1000} />
      <button className="btn" disabled={busy}>
        {busy ? 'Envoi…' : 'Envoyer ma candidature'}
      </button>
    </form>
  );
}
