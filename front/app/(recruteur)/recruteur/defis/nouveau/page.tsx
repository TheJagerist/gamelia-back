'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { PageHeader, SelectField, TagPicker, TextArea, TextField } from '@/components/ui';
import { api, ApiError, messageFor } from '@/lib/api';
import { COUNTRIES, TAGS } from '@/lib/constants';
import { useDraft } from '@/lib/hooks';
import { useSession } from '@/lib/session';

export default function NewRecruiterChallenge() {
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const draft = useDraft('defi-recruteur', { title: '', summary: '', brief: '', skills: [] as string[], country: user?.country || '', remote: true, deadline: '', reward: '' });
  const v = draft.value;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const minDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  return (
    <>
      <PageHeader back={{ href: '/recruteur/defis', label: 'Mes défis' }} title="Publier un défi" description="Décrivez un problème réel et ce que vous attendez. L'équipe Gamelia relit le défi avant de le publier." />
      <form
        noValidate
        className="panel max-w-3xl space-y-5 p-5 sm:p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErrors({});
          try {
            const r = await api.recruiter.create({ ...v, deadline: v.deadline ? `${v.deadline}T17:00:00Z` : '' });
            draft.clear();
            toast("Défi envoyé. Il sera publié après validation par l'équipe.");
            router.push(`/recruteur/defis/${r.id}`);
          } catch (err) {
            if (err instanceof ApiError && err.fields) setErrors(err.fields);
            toast(messageFor(err), 'error');
            setBusy(false);
          }
        }}
      >
        <TextField label="Titre du défi" placeholder="Module de facturation pour une PME" value={v.title} onChange={(e) => draft.setValue({ ...v, title: e.target.value })} error={errors.title} maxLength={100} />
        <TextField label="Résumé en une phrase" value={v.summary} onChange={(e) => draft.setValue({ ...v, summary: e.target.value })} error={errors.summary} maxLength={160} />
        <TextArea label="Énoncé" hint="Le contexte, le travail attendu, les livrables (dépôt, démo) et comment vous évaluerez." rows={8} value={v.brief} onChange={(e) => draft.setValue({ ...v, brief: e.target.value })} error={errors.brief} />
        <TagPicker label="Compétences recherchées" options={TAGS} value={v.skills} onChange={(skills) => draft.setValue({ ...v, skills })} error={errors.skills} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Pays" value={v.country} onChange={(e) => draft.setValue({ ...v, country: e.target.value })}>
            {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
          </SelectField>
          <TextField label="Date limite" type="date" min={minDate} value={v.deadline} onChange={(e) => draft.setValue({ ...v, deadline: e.target.value })} error={errors.deadline} />
        </div>
        <TextField label="Ce que gagnent les meilleurs" placeholder="Stage, mission rémunérée, CDI…" value={v.reward} onChange={(e) => draft.setValue({ ...v, reward: e.target.value })} />
        <label className="flex min-h-[44px] items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-[var(--primary)]" checked={v.remote} onChange={(e) => draft.setValue({ ...v, remote: e.target.checked })} />
          Travail à distance possible
        </label>
        <div className="flex justify-end border-t border-line pt-5">
          <button className="btn" disabled={busy}>
            {busy ? 'Envoi…' : 'Envoyer pour validation'}
          </button>
        </div>
      </form>
    </>
  );
}
