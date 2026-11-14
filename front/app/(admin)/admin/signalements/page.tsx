'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { Async, Dialog, EmptyState, FilterChips, PageHeader, StatusPill } from '@/components/ui';
import { api, messageFor } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useQueryState, useResource } from '@/lib/hooks';
import type { Report } from '@/lib/types';

type S = 'ouvert' | 'traite' | 'rejete';
const TYPE = { question: 'Question', reponse: 'Réponse', projet: 'Projet', commentaire: 'Commentaire' };

export default function SignalementsPage() {
  const qs = useQueryState();
  const status = (qs.get('statut') as S) || 'ouvert';
  const res = useResource(() => api.admin.reports(status), [status], qs.ready);
  const toast = useToast();
  const [confirm, setConfirm] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);

  const decide = async (r: Report, action: 'retirer' | 'rejeter') => {
    setBusy(true);
    try {
      await api.admin.decideReport(r.id, action);
      toast(action === 'retirer' ? `${TYPE[r.targetType]} retiré(e) de Gamelia.` : 'Signalement rejeté : le contenu reste en ligne.');
      setConfirm(null);
      res.reload();
    } catch (e) {
      toast(messageFor(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Signalements" description="Contenus signalés par les membres. Retirez ce qui enfreint les règles, rejetez le reste." />
      <div className="mb-5">
        <FilterChips label="Statut" value={status} onChange={(v) => qs.set({ statut: v === 'ouvert' ? null : v })} options={[{ value: 'ouvert', label: 'À traiter' }, { value: 'traite', label: 'Contenus retirés' }, { value: 'rejete', label: 'Rejetés' }]} />
      </div>
      <Async res={res} isEmpty={(d) => d.length === 0} empty={<EmptyState title={status === 'ouvert' ? 'Aucun signalement à traiter.' : 'Rien dans cette catégorie.'} />}>
        {(list) => (
          <ul className="space-y-3">
            {list.map((r) => (
              <li key={r.id} className="panel p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <StatusPill tone="danger">{r.reason}</StatusPill>
                    <span className="text-sm text-muted">{TYPE[r.targetType]}</span>
                  </span>
                  <span className="text-[13px] text-muted">
                    Signalé par {r.reporter.name}, {timeAgo(r.date)}
                  </span>
                </div>
                <Link href={r.targetHref} className="mt-2 block text-lg font-semibold hover:underline">
                  {r.targetTitle}
                </Link>
                {r.details && <p className="mt-1 text-[15px] text-muted">« {r.details} »</p>}
                {r.status === 'ouvert' && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button className="btn btn-secondary" disabled={busy} onClick={() => decide(r, 'rejeter')}>
                      Rejeter le signalement
                    </button>
                    <button className="btn btn-danger" disabled={busy} onClick={() => setConfirm(r)}>
                      Retirer le contenu
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Async>
      <Dialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Retirer ce contenu ?"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setConfirm(null)}>
              Annuler
            </button>
            <button className="btn btn-danger" disabled={busy} onClick={() => confirm && decide(confirm, 'retirer')}>
              Retirer « {confirm?.targetTitle.slice(0, 30)}{(confirm?.targetTitle.length ?? 0) > 30 ? '…' : ''} »
            </button>
          </>
        }
      >
        <p>
          {confirm && TYPE[confirm.targetType]} « {confirm?.targetTitle} » ne sera plus visible sur Gamelia. Cette action ne peut pas être annulée depuis l&apos;interface.
        </p>
      </Dialog>
    </>
  );
}
