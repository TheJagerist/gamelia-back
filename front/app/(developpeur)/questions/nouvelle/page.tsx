'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { PageHeader, SelectField, TagPicker, TextArea, TextField } from '@/components/ui';
import { api, ApiError, messageFor } from '@/lib/api';
import { CODE_LANGS, TAGS } from '@/lib/constants';
import { useDraft } from '@/lib/hooks';

const EMPTY = { title: '', body: '', lang: 'javascript', code: '', tags: [] as string[] };

export default function NewQuestionPage() {
  const router = useRouter();
  const toast = useToast();
  const draft = useDraft('question', EMPTY);
  const v = draft.value;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const local = () => {
    const e: Record<string, string> = {};
    if (v.title.trim().length < 10) e.title = 'Le titre doit faire au moins 10 caractères.';
    if (v.body.trim().length < 20) e.body = 'Décrivez votre problème en au moins 20 caractères.';
    if (!v.tags.length) e.tags = 'Choisissez au moins un tag.';
    return e;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = local();
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const r = await api.questions.create({ title: v.title, body: v.body, tags: v.tags, code: v.code.trim() ? { lang: v.lang, content: v.code } : undefined });
      draft.clear();
      toast('Question publiée. Vous serez prévenu dès la première réponse.');
      router.push(`/questions/${r.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      toast(messageFor(err), 'error');
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader back={{ href: '/questions', label: 'Questions' }} title="Poser une question" description="Une question claire reçoit une réponse plus vite. Votre brouillon est enregistré automatiquement sur cet appareil." />
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <form onSubmit={submit} className="panel space-y-5 p-5 sm:p-6" noValidate>
          {draft.restored && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded bg-accent-soft px-3 py-2 text-sm">
              <span>Brouillon retrouvé.</span>
              <button type="button" className="font-semibold text-accent-ink underline" onClick={draft.clear}>
                Repartir de zéro
              </button>
            </div>
          )}
          <TextField
            label="Titre"
            hint="Résumez le problème en une phrase, par exemple : « Laravel : erreur 419 après la mise en ligne »."
            value={v.title}
            maxLength={140}
            onChange={(e) => draft.setValue({ ...v, title: e.target.value })}
            onBlur={() => v.title && setErrors({ ...errors, title: local().title || '' })}
            error={errors.title}
          />
          <TextArea
            label="Description"
            hint="Ce que vous essayez de faire, ce qui se passe, ce que vous avez déjà essayé."
            rows={7}
            value={v.body}
            onChange={(e) => draft.setValue({ ...v, body: e.target.value })}
            onBlur={() => v.body && setErrors({ ...errors, body: local().body || '' })}
            error={errors.body}
          />
          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <SelectField label="Langage du code" value={v.lang} onChange={(e) => draft.setValue({ ...v, lang: e.target.value })}>
              {CODE_LANGS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </SelectField>
            <TextArea label="Code" optional hint="Collez seulement la partie utile. Retirez mots de passe et clés." rows={7} spellCheck={false} className="font-mono" value={v.code} onChange={(e) => draft.setValue({ ...v, code: e.target.value })} />
          </div>
          <TagPicker label="Tags" options={TAGS} value={v.tags} onChange={(tags) => draft.setValue({ ...v, tags })} error={errors.tags} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <span className="text-[13px] text-muted" aria-live="polite">
              {draft.savedAt ? `Brouillon enregistré à ${draft.savedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}
            </span>
            <button className="btn" disabled={busy}>
              {busy ? 'Publication…' : 'Publier la question'}
            </button>
          </div>
        </form>
        <aside className="h-fit rounded-lg bg-sunken p-5 text-sm">
          <h2 className="text-base">Une bonne question</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
            <li>dit ce que vous voulez obtenir ;</li>
            <li>montre le message d&apos;erreur exact ;</li>
            <li>contient le plus petit bout de code qui reproduit le problème ;</li>
            <li>précise ce que vous avez déjà essayé.</li>
          </ul>
          <p className="mt-4 text-muted">Quand une réponse vous aide, choisissez-la comme meilleure réponse : son auteur gagne 25 points.</p>
        </aside>
      </div>
    </>
  );
}
