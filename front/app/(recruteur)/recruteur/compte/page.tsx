'use client';
import Link from 'next/link';
import { useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import { useToast } from '@/components/toast';
import { Avatar, PageHeader, SelectField, TextArea, TextField } from '@/components/ui';
import { api, messageFor } from '@/lib/api';
import { COUNTRIES } from '@/lib/constants';
import { useSession } from '@/lib/session';

export default function ComptePage() {
  const { user, setUser } = useSession();
  const toast = useToast();
  const [f, setF] = useState({ name: user!.name, bio: user!.bio, country: user!.country, city: user!.city || '' });
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  return (
    <>
      <PageHeader title="Mon compte" />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <form
          className="panel space-y-5 p-5 sm:p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              setUser(await api.auth.updateProfile(f));
              toast('Compte enregistré.');
            } catch (err) {
              toast(messageFor(err), 'error');
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="flex items-center gap-4">
            <Avatar user={user} size="lg" />
            <div>
              <p className="text-lg font-semibold">{user.company}</p>
              <p className="inline-flex items-center gap-1 text-sm font-semibold text-success">
                <BadgeCheck className="h-4 w-4" aria-hidden />
                Compte recruteur validé
              </p>
            </div>
          </div>
          <TextField label="Votre nom" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <TextArea label="Présentation de l'entreprise" hint="Visible par les développeurs sur vos défis." counter={280} rows={3} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Pays" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}>
              {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
            </SelectField>
            <TextField label="Ville" optional value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
          </div>
          <TextField label="Adresse e-mail" value={user.email} disabled hint="Pour la modifier, écrivez à l'équipe Gamelia." />
          <button className="btn" disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
        <aside className="h-fit rounded-lg bg-sunken p-5 text-sm">
          <h2 className="text-base">Bonnes pratiques</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
            <li>Un défi court (quelques heures de travail) reçoit plus de candidatures.</li>
            <li>Donnez un retour à chaque candidat, même non retenu.</li>
            <li>Précisez la rémunération dès la proposition.</li>
          </ul>
          <Link href="/notifications" className="link mt-4 inline-block">
            Voir mes notifications
          </Link>
        </aside>
      </div>
    </>
  );
}
