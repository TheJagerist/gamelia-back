'use client';
import { useState } from 'react';
import { Award, Check, RotateCcw, X } from 'lucide-react';
import { messageFor } from '@/lib/api';
import type { QuizQuestion, QuizResult } from '@/lib/types';
import { useToast } from './toast';
import { cx } from './ui';

/** Quiz réutilisé pour les leçons et les défis : résultat immédiat et correction question par question. */
export function Quiz({ questions, onSubmit, passLabel, canSubmit = true, onPassed }: { questions: QuizQuestion[]; onSubmit: (answers: number[]) => Promise<QuizResult>; passLabel: string; canSubmit?: boolean; onPassed?: (r: QuizResult) => void }) {
  const [answers, setAnswers] = useState<(number | undefined)[]>(() => questions.map(() => undefined));
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const complete = answers.every((a) => a !== undefined);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complete) return toast('Répondez à toutes les questions avant de valider.', 'info');
    setBusy(true);
    try {
      const r = await onSubmit(answers as number[]);
      setResult(r);
      if (r.passed) onPassed?.(r);
      requestAnimationFrame(() => document.getElementById('quiz-result')?.focus());
    } catch (err) {
      toast(messageFor(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const retry = () => {
    setResult(null);
    setAnswers(questions.map(() => undefined));
  };

  return (
    <form onSubmit={submit} noValidate>
      {result && (
        <div id="quiz-result" tabIndex={-1} className={cx('rise mb-6 rounded-lg p-5 outline-none', result.passed ? 'bg-success-soft' : 'bg-danger-soft')} role="status">
          <p className="text-2xl font-bold tabular-nums">
            {result.score} / {result.total}
          </p>
          <p className="mt-1 font-semibold">{result.passed ? passLabel : 'Pas tout à fait. Lisez les corrections puis réessayez.'}</p>
          {result.pointsEarned > 0 && <p className="mt-2 inline-flex rounded-full bg-accent px-3 py-1 text-sm font-bold text-[#2a1730]">+{result.pointsEarned} points</p>}
          {result.passed && result.pointsEarned === 0 && <p className="mt-2 text-sm text-muted">Déjà réussi auparavant : pas de nouveaux points.</p>}
          {result.badge && (
            <div className="mt-4 flex items-center gap-3 rounded-lg bg-surface p-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent font-bold text-[#2a1730]">
                <Award className="h-5 w-5" aria-hidden />
              </span>
              <span>
                <span className="block text-sm text-muted">Nouveau badge</span>
                <span className="font-semibold">{result.badge.name}</span>
              </span>
            </div>
          )}
        </div>
      )}

      <ol className="space-y-6">
        {questions.map((q, i) => {
          const c = result?.corrections[i];
          return (
            <li key={q.id}>
              <fieldset disabled={!!result}>
                <legend className="mb-3 font-semibold">
                  <span className="mr-2 text-muted tabular-nums">{i + 1}.</span>
                  {q.prompt}
                </legend>
                <div className="grid gap-2">
                  {q.options.map((o, j) => {
                    const chosen = answers[i] === j;
                    const isRight = c && c.answer === j;
                    const isWrong = c && chosen && !c.correct;
                    return (
                      <label
                        key={j}
                        className={cx(
                          'flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg border px-4 py-2 transition-colors',
                          !c && (chosen ? 'border-primary bg-primary-soft' : 'border-line bg-surface hover:border-muted'),
                          isRight && 'border-success bg-success-soft',
                          isWrong && 'border-danger bg-danger-soft',
                          c && !isRight && !isWrong && 'border-line opacity-70',
                        )}
                      >
                        <input type="radio" name={q.id} checked={chosen} onChange={() => setAnswers(answers.map((a, k) => (k === i ? j : a)))} className="h-4 w-4 accent-[var(--primary)]" />
                        <span className="flex-1">{o}</span>
                        {isRight && <Check className="h-5 w-5 text-success" aria-label="Bonne réponse" />}
                        {isWrong && <X className="h-5 w-5 text-danger" aria-label="Votre réponse, incorrecte" />}
                      </label>
                    );
                  })}
                </div>
                {c && <p className={cx('mt-2 text-sm', c.correct ? 'text-success' : 'text-ink')}>{c.explanation}</p>}
              </fieldset>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {result ? (
          !result.passed && (
            <button type="button" className="btn" onClick={retry}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              Réessayer
            </button>
          )
        ) : (
          <button className="btn" disabled={busy || !canSubmit}>
            {busy ? 'Correction…' : 'Valider mes réponses'}
          </button>
        )}
        {!result && <span className="text-sm text-muted tabular-nums">{answers.filter((a) => a !== undefined).length} / {questions.length} répondues</span>}
      </div>
    </form>
  );
}
