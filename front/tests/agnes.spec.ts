import { expect, test, type Page } from '@playwright/test';

// Parcours Agnès en mode démonstration (réponses simulées, même contrat que l'API).
async function login(page: Page, email: string) {
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill('demo1234');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).not.toHaveURL(/\/connexion/);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/questions');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test('un visiteur voit l’espace Agnès sur une question et est invité à se connecter', async ({ page }) => {
  await page.goto('/questions/q1');
  const panel = page.getByRole('region', { name: /La piste d'Agnès/ });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('link', { name: 'Se connecter' })).toBeVisible();
});

test('un développeur demande la piste d’Agnès, qui reste affichée pour tous', async ({ page }) => {
  await login(page, 'awa@demo.gamelia');
  await page.goto('/questions/q2');
  const panel = page.getByRole('region', { name: /La piste d'Agnès/ });
  await panel.getByRole('button', { name: 'Demander à Agnès' }).click();
  await expect(panel.getByText('Voici une première piste')).toBeVisible();
  await expect(panel.getByText('@csrf')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: /La piste d'Agnès/ }).getByText('Voici une première piste')).toBeVisible();
});

test('discussion privée avec Agnès, puis nouvelle discussion', async ({ page }) => {
  await login(page, 'awa@demo.gamelia');
  await page.goto('/agnes');
  await expect(page.getByRole('heading', { name: 'Agnès', level: 1 })).toBeVisible();
  await page.getByLabel('Votre message à Agnès').fill('Comment centrer une div en CSS ?');
  await page.getByRole('button', { name: 'Envoyer à Agnès' }).click();
  const log = page.getByRole('log', { name: 'Discussion avec Agnès' });
  await expect(log.getByText('Comment centrer une div en CSS ?')).toBeVisible();
  await expect(log.getByText('justify-content: center;')).toBeVisible();
  await page.getByRole('button', { name: 'Nouvelle discussion' }).click();
  await expect(log.getByText('Comment centrer une div en CSS ?')).toHaveCount(0);
});

test('« Approfondir avec Agnès » ouvre la discussion avec le contexte de la question', async ({ page }) => {
  await login(page, 'awa@demo.gamelia');
  await page.goto('/questions/q4');
  await page.getByRole('button', { name: 'Demander à Agnès' }).click();
  await page.getByRole('link', { name: 'Approfondir avec Agnès' }).click();
  await expect(page).toHaveURL(/\/agnes\?question=q4/);
  await expect(page.getByText('À propos de :')).toBeVisible();
});

test('Agnès est accessible depuis l’en-tête (ou le menu sur téléphone) pour un recruteur', async ({ page, isMobile }) => {
  await login(page, 'recruteur@demo.gamelia');
  if (isMobile) {
    await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
    await page.getByRole('link', { name: /Demander à Agnès/ }).click();
  } else {
    await page.getByRole('link', { name: "Agnès, l'assistante IA" }).first().click();
  }
  await expect(page).toHaveURL(/\/agnes/);
  await expect(page.getByRole('heading', { name: 'Agnès', level: 1 })).toBeVisible();
});
