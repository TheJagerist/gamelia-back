import { expect, test } from '@playwright/test';

// Connexion avec Google, de bout en bout dans un navigateur : front réel + API + PostgreSQL + FAUX Google.
// Ne tourne que si FAKE_GOOGLE_URL est défini (voir back/tests/helpers.js, startFakeGoogle) : le vrai Google ne peut
// pas être simulé sur le site en ligne, donc ce test est ignoré là-bas.
const FAKE = process.env.FAKE_GOOGLE_URL;
test.skip(!FAKE, 'FAKE_GOOGLE_URL non défini : faux Google absent');
test.describe.configure({ mode: 'serial' });

const tag = Date.now().toString(36);
const profile = { sub: `${Date.now()}`, email: `awa.g.${tag}@exemple.test`, email_verified: true, name: 'Awa Google' };
const approve = (p: unknown) => fetch(`${FAKE}/__approve-next`, { method: 'POST', body: JSON.stringify(p) });

test('le bouton « Continuer avec Google » apparaît quand Google est configuré', async ({ page }) => {
  await page.goto('/connexion');
  await expect(page.getByRole('link', { name: 'Continuer avec Google' })).toBeVisible();
  await page.goto('/inscription');
  await expect(page.getByRole('link', { name: "S'inscrire avec Google" })).toBeVisible();
});

test('annuler sur Google ramène à la connexion avec un message clair, sans compte créé', async ({ page }) => {
  await approve(null);
  await page.goto('/connexion');
  await page.getByRole('link', { name: 'Continuer avec Google' }).click();
  await expect(page).toHaveURL(/\/connexion/);
  await expect(page.locator('[role=alert]:not(#__next-route-announcer__)')).toContainText('annulé la connexion sur Google');
});

test('première connexion : choix du pays puis compte créé', async ({ page }) => {
  await approve(profile);
  await page.goto('/connexion');
  await page.getByRole('link', { name: 'Continuer avec Google' }).click();
  await expect(page).toHaveURL(/\/inscription\/google/);
  await expect(page.getByText(profile.email, { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByText('Choisissez votre pays.')).toBeVisible();
  await expect(page.getByText('Cochez la case pour accepter')).toBeVisible();
  await page.getByLabel('Pays').selectOption('Gabon');
  await page.getByRole('checkbox', { name: /J'accepte les conditions/ }).check();
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page).toHaveURL(/\/profil/);
});

test('connexion suivante depuis un autre navigateur : direct dans son espace, et le compte apparaît relié', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await approve(profile);
  await page.goto('/connexion');
  await page.getByRole('link', { name: 'Continuer avec Google' }).click();
  await expect(page).toHaveURL(/\/fil/);
  await page.goto('/parametres');
  await expect(page.getByText('Un compte Google est relié')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Relier mon compte Google' })).toHaveCount(0);
});

test('une adresse e-mail déjà inscrite n’est pas reliée automatiquement', async ({ page }) => {
  await approve({ sub: `${Date.now()}9`, email: profile.email, email_verified: true, name: 'Autre' });
  await page.goto('/connexion');
  await page.getByRole('link', { name: 'Continuer avec Google' }).click();
  await expect(page).toHaveURL(/\/connexion/);
  await expect(page.locator('[role=alert]:not(#__next-route-announcer__)')).toContainText('compte Gamelia existe déjà');
});

test('un compte avec mot de passe relie Google depuis les paramètres', async ({ page }) => {
  const email = `lie.${tag}@exemple.test`;
  await page.goto('/inscription');
  await page.getByLabel('Nom complet').fill('Membre Lié Google');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('Mot-De-Passe-Test-1');
  await page.getByLabel('Pays').selectOption('Gabon');
  await page.getByRole('checkbox', { name: /J'accepte les conditions/ }).check();
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page).toHaveURL(/\/(profil|fil|bienvenue)/);

  await approve({ sub: `${Date.now()}7`, email: `autre.${tag}@exemple.test`, email_verified: true, name: 'Lié' });
  await page.goto('/parametres');
  await page.getByRole('link', { name: 'Relier mon compte Google' }).click();
  await expect(page).toHaveURL(/\/parametres/);
  await expect(page.getByText('Compte Google relié')).toBeVisible();
  await expect(page.getByText('Un compte Google est relié')).toBeVisible();
});
