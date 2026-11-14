'use client';
// Comptes de démonstration, pour le développement local uniquement : ceux du mode simulé (lib/mock) ou ceux du
// back (npm run seed:demo, refusé en production). Ce fichier n'est chargé par la page de connexion que si
// NEXT_PUBLIC_API_MOCK=true ou NEXT_PUBLIC_SHOW_DEMO=true : il ne fait pas partie du site en ligne.
const DEMO =
  process.env.NEXT_PUBLIC_API_MOCK === 'true'
    ? {
        password: 'demo1234',
        accounts: [
          { label: 'Développeuse', who: 'Awa Diop, Sénégal', email: 'awa@demo.gamelia' },
          { label: 'Recruteuse validée', who: 'Nadia, Kivu Tech', email: 'recruteur@demo.gamelia' },
          { label: 'Recruteur en attente', who: 'Samuel, Baobab Pay', email: 'samuel@demo.gamelia' },
          { label: 'Admin', who: 'Équipe Gamelia', email: 'admin@demo.gamelia' },
        ],
      }
    : {
        password: 'Demo2026!',
        accounts: [
          { label: 'Développeuse', who: 'Fatou Diop, Sénégal', email: 'dev@demo.gamelia' },
          { label: 'Recruteuse validée', who: 'Aïssatou, Baobab Tech', email: 'recruteur@demo.gamelia' },
          { label: 'Recruteur en attente', who: 'Éric, Tsiky Digital', email: 'recruteur.attente@demo.gamelia' },
          { label: 'Admin', who: 'Équipe Gamelia', email: 'admin@demo.gamelia' },
        ],
      };

export function DemoAccounts({ onPick }: { onPick: (email: string, password: string) => void }) {
  return (
    <aside className="rounded-lg border border-dashed border-line p-5" aria-labelledby="demo-title">
      <h2 id="demo-title" className="text-base">
        Comptes de démonstration
      </h2>
      <p className="mt-1 text-sm text-muted">Mot de passe : {DEMO.password}. Choisissez un compte pour remplir le formulaire.</p>
      <ul className="mt-3 space-y-2">
        {DEMO.accounts.map((d) => (
          <li key={d.email}>
            <button type="button" onClick={() => onPick(d.email, DEMO.password)} className="w-full rounded border border-line bg-surface px-3 py-2 text-left hover:border-primary">
              <span className="block text-sm font-semibold">{d.label}</span>
              <span className="block text-[13px] text-muted">{d.who}</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
