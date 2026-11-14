'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { PageHeader, TagPicker, TextArea, TextField } from '@/components/ui';
import { VideoEmbed } from '@/components/video';
import { api, ApiError, messageFor } from '@/lib/api';
import { TAGS } from '@/lib/constants';
import { useDraft } from '@/lib/hooks';
import { parseVideo } from '@/lib/video';

const EMPTY = { title: '', summary: '', description: '', techs: [] as string[], videoUrl: '', codeUrl: '', seeking: false };

export default function NewProjectPage() {
  const router = useRouter();
  const toast = useToast();
  const draft = useDraft('projet', EMPTY);
  const v = draft.value;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const videoOk = !v.videoUrl || !!parseVideo(v.videoUrl);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (v.title.trim().length < 5) errs.title = 'Au moins 5 caractères.';
    if (v.summary.trim().length < 10) errs.summary = 'Résumez le projet en une phrase.';
    if (!v.techs.length) errs.techs = 'Choisissez au moins une technologie.';
    if (!videoOk) errs.videoUrl = 'Seuls les liens YouTube ou Vimeo sont acceptés.';
    if (!/^https:\/\//.test(v.codeUrl)) errs.codeUrl = 'Indiquez un lien https vers le code.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const r = await api.projects.create({ title: v.title, summary: v.summary, description: v.description, techs: v.techs, videoUrl: v.videoUrl || undefined, codeUrl: v.codeUrl, seekingCollaborators: v.seeking });
      draft.clear();
      toast(r.points ? `Projet publié. +${r.points} points.` : 'Projet publié.');
      router.push(`/projets/${r.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      toast(messageFor(err), 'error');
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader back={{ href: '/projets', label: 'Projets' }} title="Publier un projet" description="Montrez ce que vous avez construit. Une courte vidéo de démonstration aide les autres à comprendre en 30 secondes." />
      <form onSubmit={submit} className="panel max-w-3xl space-y-5 p-5 sm:p-6" noValidate>
        {draft.restored && <p className="rounded bg-accent-soft px-3 py-2 text-sm">Brouillon retrouvé.</p>}
        <TextField label="Titre" maxLength={90} value={v.title} onChange={(e) => draft.setValue({ ...v, title: e.target.value })} error={errors.title} />
        <TextField label="Résumé en une phrase" hint="Ce que fait le projet et pour qui." maxLength={160} value={v.summary} onChange={(e) => draft.setValue({ ...v, summary: e.target.value })} error={errors.summary} />
        <TextArea label="Description" optional hint="Le problème, votre solution, ce qui reste à faire." rows={6} value={v.description} onChange={(e) => draft.setValue({ ...v, description: e.target.value })} />
        <TagPicker label="Technologies" options={TAGS} value={v.techs} onChange={(techs) => draft.setValue({ ...v, techs })} max={5} error={errors.techs} />
        <TextField label="Lien de la vidéo de démo" optional type="url" inputMode="url" placeholder="https://www.youtube.com/watch?v=…" hint="YouTube ou Vimeo uniquement. Gamelia n'héberge aucune vidéo." value={v.videoUrl} onChange={(e) => draft.setValue({ ...v, videoUrl: e.target.value.trim() })} error={errors.videoUrl || (!videoOk ? 'Lien non reconnu : seuls YouTube et Vimeo sont acceptés.' : undefined)} />
        {v.videoUrl && videoOk && (
          <div className="max-w-md">
            <p className="field-label">Aperçu</p>
            <VideoEmbed url={v.videoUrl} title={v.title || 'votre projet'} />
          </div>
        )}
        <TextField label="Lien vers le code" type="url" inputMode="url" placeholder="https://github.com/vous/projet" value={v.codeUrl} onChange={(e) => draft.setValue({ ...v, codeUrl: e.target.value.trim() })} error={errors.codeUrl} />
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-4">
          <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--primary)]" checked={v.seeking} onChange={(e) => draft.setValue({ ...v, seeking: e.target.checked })} />
          <span>
            <span className="block font-semibold">Je cherche des collaborateurs</span>
            <span className="text-sm text-muted">Les membres pourront vous proposer de rejoindre le projet. Vous acceptez ou refusez chaque demande.</span>
          </span>
        </label>
        <div className="flex justify-end border-t border-line pt-5">
          <button className="btn" disabled={busy}>
            {busy ? 'Publication…' : 'Publier le projet'}
          </button>
        </div>
      </form>
    </>
  );
}
