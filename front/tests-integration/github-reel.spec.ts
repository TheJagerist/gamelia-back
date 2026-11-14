import { expect, test } from '@playwright/test';

// Connexion avec GitHub, de bout en bout dans un navigateur : front réel + API + PostgreSQL + FAUX GitHub.
// Ce test ne tourne que si FAKE_GITHUB_URL est défini (voir back/tests/helpers.js, startFakeGithub) : sur le site en
// ligne, GitHub ne peut pas être simulé, donc il est ignoré.
const FAKE = process.env.FAKE_GITHUB_URL;
test.skip(!FAKE, 'FAKE_GITHUB_URL non défini : faux GitHub absent');
test.describe.configure({ mode: 'serial' });

const tag = Date.now().toString(36);
const profile = { id: Date.now(), login: `octo-${tag}`, name: 'Awa GitHub', emails: [{ email: `awa.${tag}@exemple.test`, primary: true, verified: true }] };
const approve = (p: unknown) => fetch(`${FAKE}/__approve-next`, { method: 'POST', body: JSON.stringify(p) });

test('le bouton « Continuer avec GitHub » apparaît quand GitHub est configuré', async ({ page }) => {
  await page.goto('/connexion');
  await expect(page.getByRole('link', { name: 'Continuer avec GitHub' })).toBeVisible();
  await expect(page.getByText('Bientôt : connexion rapide')).toHaveCount(0);
  await page.goto('/inscription');
  await expect(page.getByRole('link', { name: "S'inscrire avec GitHub" })).toBeVisible();
});

test('annuler sur GitHub ramène à la connexion avec un message clair, sans compte créé', async ({ page }) => {
  await approve(null);
  await page.goto('/connexion');
  await page.getByRole('link', { name: 'Continuer avec GitHub' }).click();
  await expect(page).toHaveURL(/\/connexion/);
  await expect(page.locator('[role=alert]:not(#__next-route-announcer__)')).toContainText('annulé la connexion sur GitHub');
});

test('première connexion : choix du pays puis compte créé avec le badge « vérifié »', async ({ page }) => {
  await approve(profile);
  await page.goto('/connexion');
  await page.getByRole('link', { name: 'Continuer avec GitHub' }).click();
  await expect(page).toHaveURL(/\/inscription\/github/);
  await expect(page.getByText(profile.login, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(profile.emails[0].email)).toBeVisible();

  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByText('Choisissez votre pays.')).toBeVisible();
  await expect(page.getByText('Cochez la case pour accepter')).toBeVisible();
  await page.getByLabel('Pays').selectOption('Gabon');
  await page.getByRole('checkbox', { name: /J'accepte les conditions/ }).check();
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page).toHaveURL(/\/profil/);
  await expect(page.getByText('Compte GitHub confirmé')).toBeVisible();
});

test('connexion suivante depuis un autre navigateur : direct dans son espace', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await approve(profile);
  await page.goto('/connexion');
  await page.getByRole('link', { name: 'Continuer avec GitHub' }).click();
  await expect(page).toHaveURL(/\/fil/);
});

test('un compte créé avec GitHub définit un mot de passe sans « mot de passe actuel », puis se connecte par e-mail', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await approve(profile);
  await page.goto('/connexion');
  await page.getByRole('link', { name: 'Continuer avec GitHub' }).click();
  await expect(page).toHaveURL(/\/fil/);

  await page.goto('/parametres');
  await expect(page.getByLabel('Mot de passe actuel')).toHaveCount(0);
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill('Premier-Mot-De-Passe-1');
  await page.getByLabel('Confirmer le nouveau mot de passe').fill('Premier-Mot-De-Passe-1');
  await page.getByRole('button', { name: 'Définir un mot de passe' }).click();
  await expect(page.getByText('Mot de passe défini.')).toBeVisible();

  const other = await (await browser.newContext()).newPage();
  await other.goto('/connexion');
  await other.getByLabel('Adresse e-mail').fill(profile.emails[0].email);
  await other.getByLabel('Mot de passe', { exact: true }).fill('Premier-Mot-De-Passe-1');
  await other.getByRole('button', { name: 'Se connecter' }).click();
  await expect(other).toHaveURL(/\/fil/);
});

test('une adresse e-mail déjà inscrite n’est pas reliée automatiquement', async ({ page }) => {
  await approve({ id: Date.now() + 1, login: `usurpateur-${tag}`, name: 'Autre', emails: profile.emails });
  await page.goto('/connexion');
  await page.getByRole('link', { name: 'Continuer avec GitHub' }).click();
  await expect(page).toHaveURL(/\/connexion/);
  await expect(page.locator('[role=alert]:not(#__next-route-announcer__)')).toContainText('Un compte Gamelia existe déjà');
});
