import { expect, test, type Browser, type Page } from '@playwright/test';

// Parcours réels de bout en bout (front + API + base de données). Les données de démo du back
// (npm run seed:demo) doivent être fraîches : relancez seed:demo avant chaque exécution.
// Agnès : fonctionne avec une vraie clé (AGNES_API_KEY) ou un serveur compatible OpenAI de test.
test.describe.configure({ mode: 'serial' });

const PASSWORD = 'Demo2026!';
let dev: Page;
let rec: Page;
const title = `Intégration ${Date.now().toString(36)} : comment lire un JSON ?`;

async function session(browser: Browser, email: string) {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).not.toHaveURL(/\/connexion/);
  return page;
}

test.beforeAll(async ({ browser }) => {
  dev = await session(browser, 'dev@demo.gamelia');
  rec = await session(browser, 'recruteur@demo.gamelia');
});

test('une développeuse publie une question', async () => {
  await dev.goto('/questions/nouvelle');
  await dev.getByLabel('Titre').fill(title);
  await dev.getByLabel('Description').fill('Je reçois une réponse 200 mais je ne sais pas lire le JSON côté client.');
  await dev.getByRole('button', { name: 'JavaScript', exact: true }).click();
  await dev.getByRole('button', { name: 'Publier la question' }).click();
  await expect(dev.getByRole('heading', { name: title })).toBeVisible();
});

test('elle obtient la piste d’Agnès, enregistrée pour tous', async () => {
  const panel = dev.getByRole('region', { name: /La piste d'Agnès/ });
  await panel.getByRole('button', { name: 'Demander à Agnès' }).click();
  await expect(panel.getByRole('link', { name: 'Approfondir avec Agnès' })).toBeVisible({ timeout: 45_000 });
  await dev.reload();
  await expect(dev.getByRole('region', { name: /La piste d'Agnès/ }).getByText(/Proposée le/)).toBeVisible();
});

test('elle approfondit avec Agnès, avec le contexte de la question', async () => {
  await dev.getByRole('link', { name: 'Approfondir avec Agnès' }).click();
  await expect(dev.getByText('À propos de :')).toBeVisible();
  await dev.getByLabel('Votre message à Agnès').fill('Donne-moi un exemple court.');
  await dev.getByRole('button', { name: 'Envoyer à Agnès' }).click();
  await expect(dev.getByRole('log').getByRole('button', { name: 'Copier' }).last()).toBeVisible({ timeout: 45_000 });
});

test('elle répond dans une conversation existante', async () => {
  await dev.goto('/messages');
  await dev.getByRole('link', { name: /Landry Kabongo/ }).click();
  await dev.getByLabel('Votre message').fill('Oui, envoie-moi ta configuration Nginx, merci !');
  await dev.getByRole('button', { name: 'Envoyer le message' }).click();
  await expect(dev.getByRole('log').getByText('envoie-moi ta configuration Nginx')).toBeVisible();
});

test('elle écrit à un nouveau membre depuis son profil public', async () => {
  await dev.goto('/u/moussa.fall');
  await dev.getByRole('link', { name: 'Écrire', exact: true }).click();
  await dev.getByLabel('Votre message').fill('Salut Moussa, ton tableau de bord avance ?');
  await dev.getByRole('button', { name: 'Envoyer le message' }).click();
  await expect(dev).toHaveURL(/\/messages\?c=/);
  await expect(dev.getByRole('log').getByText('ton tableau de bord avance')).toBeVisible();
});

test('une recruteuse la contacte ; le message arrive dans sa messagerie', async () => {
  await rec.goto('/recruteur/talents');
  await rec.locator('li, article').filter({ hasText: 'Fatou Diop' }).first().getByRole('button', { name: 'Contacter' }).click();
  await rec.getByRole('dialog').getByLabel('Votre message').fill('Bonjour Fatou, nous aimerions vous proposer un second échange technique.');
  await rec.getByRole('dialog').getByRole('button', { name: 'Envoyer le message' }).click();
  await expect(rec.getByText('Message envoyé à Fatou Diop.')).toBeVisible();
  await dev.goto('/messages');
  await dev.getByRole('link', { name: /Aïssatou Ndiaye/ }).click();
  await expect(dev.getByRole('log').getByText('second échange technique')).toBeVisible();
});

test('bloquer puis débloquer un membre', async () => {
  await dev.goto('/messages');
  await dev.getByRole('link', { name: /Omar Benali/ }).click();
  await dev.getByRole('button', { name: /^Bloquer/ }).click();
  await dev.getByRole('dialog').getByRole('button', { name: 'Bloquer', exact: true }).click();
  await expect(dev.getByText('Vous avez bloqué Omar Benali')).toBeVisible();
  await dev.getByRole('button', { name: 'Débloquer' }).click();
  await expect(dev.getByLabel('Votre message')).toBeVisible();
});

test('se déconnecter depuis une page protégée ramène à l’accueil', async () => {
  await dev.locator('summary[aria-label="Menu du compte"]').click();
  await dev.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(dev).toHaveURL(/\/$/);
  await dev.goto('/messages');
  await expect(dev).toHaveURL(/\/connexion\?suite=%2Fmessages/);
});
