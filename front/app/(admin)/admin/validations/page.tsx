'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { Async, Avatar, EmptyState, ExternalLink, PageHeader, Tag, UserLine, cx } from '@/components/ui';
import { api, messageFor } from '@/lib/api';
import { dateLong, timeAgo } from '@/lib/format';
import { useQueryState, useResource } from '@/lib/hooks';

type Tab = 'recruteurs' | 'defis' | 'solutions';

export default function ValidationsPage() {
  const qs = useQueryState();
  const tab = (qs.get('onglet') as Tab) || 'recruteurs';
  const counts = useResource(() => api.admin.counts(), [tab]);
  const c = counts.data;
  const tabs: { v: Tab; label: string; n?: number }[] = [
    { v: 'recruteurs', label: 'Comptes recruteurs', n: c?.recruiters },
    { v: 'defis', label: 'Défis recruteurs', n: c?.challenges },
    { v: 'solutions', label: 'Défis pratiques à corriger', n: c?.submissions },
  ];
  return (
    <>
      <PageHeader title="Validations" description="Ce qui attend une décision de l'équipe. Les développeurs et recruteurs sont prévenus automatiquement." />
      <div role="tablist" aria-label="Type de validation" className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        {tabs.map((t) => (
          <button key={t.v} role="tab" aria-selected={tab === t.v} onClick={() => qs.set({ onglet: t.v === 'recruteurs' ? null : t.v })} className={cx('-mb-px inline-flex min-h-[44px] shrink-0 items-center gap-2 border-b-[3px] px-3 text-[15px] font-semibold', tab === t.v ? 'border-primary text-ink' : 'border-transparent text-muted hover:text-ink')}>
            {t.label}
            {!!t.n && <span className="rounded-full bg-accent px-2 text-[12px] font-bold text-[#2a1730]">{t.n}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'recruteurs' && <Recruiters onChange={counts.reload} />}
        {tab === 'defis' && <Challenges onChange={counts.reload} />}
        {tab === 'solutions' && <Submissions onChange={counts.reload} />}
      </div>
    </>
  );
}

function useAct(reload: () => void, onChange: () => void) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (id: string, fn: () => Promise<void>, ok: string) => {
    setBusy(id);
    try {
      await fn();
      toast(ok);
      reload();
      onChange();
    } catch (e) {
      toast(messageFor(e), 'error');
    } finally {
      setBusy(null);
    }
  };
  return { busy, act };
}

function Recruiters({ onChange }: { onChange: () => void }) {
  const res = useResource(() => api.admin.pendingRecruiters(), []);
  const { busy, act } = useAct(res.reload, onChange);
  return (
    <Async res={res} isEmpty={(d) => d.length === 0} empty={<EmptyState title="Aucun compte recruteur en attente." text="Tout est à jour." />}>
      {(list) => (
        <ul className="space-y-3">
          {list.map((u) => (
            <li key={u.id} className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <Avatar user={u} size="lg" />
                <div className="min-w-0">
                  <p className="break-words text-lg font-semibold">{u.company}</p>
                  <p className="break-words text-sm text-muted [overflow-wrap:anywhere]">
                    {u.name}, {u.email}
                  </p>
                  <p className="text-sm text-muted">
                    {u.city ? `${u.city}, ` : ''}
                    {u.country}. Inscrit {timeAgo(u.joinedAt)}
                  </p>
                  {u.bio && <p className="mt-1 text-[15px]">{u.bio}</p>}
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-secondary" disabled={busy === u.id} onClick={() => act(u.id, () => api.admin.decideRecruiter(u.id, false), `Compte ${u.company} refusé.`)}>
                  Refuser
                </button>
                <button className="btn" disabled={busy === u.id} onClick={() => act(u.id, () => api.admin.decideRecruiter(u.id, true), `Compte ${u.company} validé.`)}>
                  Valider le compte
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Async>
  );
}

function Challenges({ onChange }: { onChange: () => void }) {
  const res = useResource(() => api.admin.pendingChallenges(), []);
  const { busy, act } = useAct(res.reload, onChange);
  return (
    <Async res={res} isEmpty={(d) => d.length === 0} empty={<EmptyState title="Aucun défi recruteur en attente." />}>
      {(list) => (
        <ul className="space-y-3">
          {list.map((c) => (
            <li key={c.id} className="panel p-5">
              <p className="text-sm text-muted">
                {c.company}, jusqu&apos;au {dateLong(c.deadline)}
              </p>
              <h3 className="mt-1 text-lg font-semibold">{c.title}</h3>
              <p className="mt-1">{c.summary}</p>
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-semibold text-primary">Lire l&apos;énoncé complet</summary>
                <p className="mt-2 whitespace-pre-line text-[15px]">{c.brief}</p>
              </details>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.skills.map((s) => <Tag key={s} name={s} />)}
              </div>
              <div className="mt-4 flex gap-2">
                <button className="btn btn-secondary" disabled={busy === c.id} onClick={() => act(c.id, () => api.admin.decideChallenge(c.id, false), 'Défi refusé. Le recruteur est prévenu.')}>
                  Refuser
                </button>
                <button className="btn" disabled={busy === c.id} onClick={() => act(c.id, () => api.admin.decideChallenge(c.id, true), 'Défi publié.')}>
                  Publier le défi
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Async>
  );
}

function Submissions({ onChange }: { onChange: () => void }) {
  const res = useResource(() => api.admin.submissions(), []);
  const { busy, act } = useAct(res.reload, onChange);
  return (
    <Async res={res} isEmpty={(d) => d.length === 0} empty={<EmptyState title="Aucune solution à corriger." />}>
      {(list) => (
        <ul className="space-y-3">
          {list.map((s) => (
            <li key={s.id} className="panel p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <UserLine user={s.dev} size="md" extra={<span>{timeAgo(s.date)}</span>} />
                <Link href={`/defis/${s.challenge.id}`} className="text-sm font-semibold text-primary hover:underline">
                  {s.challenge.title} ({s.challenge.points} pts)
                </Link>
              </div>
              {s.note && <p className="mt-3">{s.note}</p>}
              <ExternalLink href={s.codeUrl} className="link mt-2 inline-block text-sm">
                {s.codeUrl.replace('https://', '')}
              </ExternalLink>
              <div className="mt-4 flex gap-2">
                <button className="btn btn-secondary" disabled={busy === s.id} onClick={() => act(s.id, () => api.admin.decideSubmission(s.id, false), 'Solution à revoir : le développeur est prévenu.')}>
                  À revoir
                </button>
                <button className="btn" disabled={busy === s.id} onClick={() => act(s.id, () => api.admin.decideSubmission(s.id, true), `Solution validée. ${s.dev.name} gagne ${s.challenge.points} points.`)}>
                  Valider la solution
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Async>
  );
}
