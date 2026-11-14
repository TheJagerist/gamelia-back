import { expect, test } from '@playwright/test';

// Site réel (front + API + PostgreSQL) : inscription avec acceptation des conditions, données enregistrées
// en base (elles survivent à une nouvelle session), et aucune trace du mode démonstration.
test.describe.configure({ mode: 'serial' });

const email = `integration.${Date.now().toString(36)}@exemple.test`;
const password = 'MotDePasse-Integration1';

test('le site réel ne montre ni bandeau ni comptes de démonstration', async ({ page }) => {
  await page.goto('/connexion');
  await expect(page.getByRole('heading', { name: 'Se connecter', level: 1 })).toBeVisible();
  await expect(page.getByText('Comptes de démonstration')).toHaveCount(0);
  await expect(page.getByText('Démonstration : données simulées')).toHaveCount(0);
});

test("une personne s'inscrit après avoir accepté les conditions", async ({ page }) => {
  await page.goto('/inscription');
  await page.getByLabel('Nom complet').fill('Intégration Réelle');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByLabel('Pays').selectOption('Gabon');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByText('Cochez la case pour accepter les conditions')).toBeVisible();
  await page.getByRole('checkbox', { name: /J'accepte les conditions/ }).check();
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page).toHaveURL(/\/profil\?bienvenue=1/);

  await page.getByLabel('Ville').fill('Libreville');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Profil enregistré.')).toBeVisible();
});

test('son compte et son profil sont en base : elle se reconnecte depuis un autre navigateur', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/fil/);
  await page.goto('/profil');
  await expect(page.getByLabel('Ville')).toHaveValue('Libreville');
});

test('les pages légales et le mot de passe oublié affichent l’adresse de contact de l’équipe', async ({ page }) => {
  await page.goto('/confidentialite');
  await expect(page.getByRole('link', { name: /@/ }).first()).toHaveAttribute('href', /^mailto:.+@.+/);
  await page.goto('/mot-de-passe-oublie');
  await expect(page.getByRole('link', { name: /@/ })).toHaveAttribute('href', /^mailto:.+@.+/);
});
