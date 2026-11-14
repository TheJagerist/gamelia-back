import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, email: string) {
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill('demo1234');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).not.toHaveURL(/\/connexion/);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/questions');
  await page.evaluate(() => localStorage.clear());
});

test('la messagerie est protégée : un visiteur est renvoyé vers la connexion', async ({ page }) => {
  await page.goto('/messages');
  await expect(page).toHaveURL(/\/connexion\?suite=%2Fmessages/);
});

test('un développeur lit un message reçu puis répond', async ({ page }) => {
  await login(page, 'awa@demo.gamelia');
  await page.goto('/messages');
  await expect(page.getByRole('heading', { name: 'Messages', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: /Koffi Mensah/ }).click();
  // Sur téléphone, la liste (masquée) contient aussi l'aperçu du dernier message : on vise le fil.
  await expect(page.getByRole('log').getByText("Tu peux m'envoyer l'adresse que tu appelles ?")).toBeVisible();
  await page.getByLabel('Votre message').fill("Voici l'adresse : /api/taches");
  await page.getByRole('button', { name: 'Envoyer le message' }).click();
  await expect(page.getByRole('log').getByText("Voici l'adresse : /api/taches")).toBeVisible();
});

test('un développeur écrit pour la première fois à un autre membre depuis son profil', async ({ page }) => {
  await login(page, 'awa@demo.gamelia');
  await page.goto('/u/jean.kabila');
  await page.getByRole('link', { name: 'Écrire', exact: true }).click();
  await expect(page).toHaveURL(/\/messages\?avec=jean\.kabila/);
  await page.getByLabel('Votre message').fill('Bonjour Jean, as-tu déjà utilisé Laravel avec une API ?');
  await page.getByRole('button', { name: 'Envoyer le message' }).click();
  await expect(page).toHaveURL(/\/messages\?c=/);
  await expect(page.getByRole('log').getByText('as-tu déjà utilisé Laravel')).toBeVisible();
});

test('bloquer un membre désactive la zone d’écriture', async ({ page }) => {
  await login(page, 'awa@demo.gamelia');
  await page.goto('/messages?c=c1');
  await page.getByRole('button', { name: /^Bloquer/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Bloquer', exact: true }).click();
  await expect(page.getByText('Vous avez bloqué Koffi Mensah')).toBeVisible();
  await expect(page.getByLabel('Votre message')).toHaveCount(0);
});

test('un admin n’a pas de messagerie', async ({ page }) => {
  await login(page, 'admin@demo.gamelia');
  await expect(page.getByRole('link', { name: /^Messages/ })).toHaveCount(0);
});

