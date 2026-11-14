import { expect, test } from '@playwright/test';

// Inscription, pages légales, mot de passe oublié, vérification GitHub (mode démonstration).
test.beforeEach(async ({ page }) => {
  await page.goto('/questions');
  await page.evaluate(() => localStorage.clear());
});

test('le pied de page mène aux conditions et à la confidentialité', async ({ page }) => {
  await page.goto('/');
  const legal = page.getByRole('navigation', { name: 'Informations légales' });
  await legal.getByRole('link', { name: 'Confidentialité' }).click();
  await expect(page.getByRole('heading', { name: 'Politique de confidentialité', level: 1 })).toBeVisible();
  await expect(page.getByText('loi sénégalaise n° 2008-12')).toBeVisible();
  await page.getByRole('navigation', { name: 'Informations légales' }).getByRole('link', { name: "Conditions d'utilisation" }).click();
  await expect(page.getByRole('heading', { name: "Conditions d'utilisation", level: 1 })).toBeVisible();
});

test("l'inscription exige d'accepter les conditions", async ({ page }) => {
  await page.goto('/inscription');
  await page.getByLabel('Nom complet').fill('Mariam Test');
  await page.getByLabel('Adresse e-mail').fill(`mariam.${Date.now()}@exemple.test`);
  await page.getByLabel('Mot de passe').fill('MotDePasse-Test1');
  await page.getByLabel('Pays').selectOption('Togo');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByText('Cochez la case pour accepter les conditions')).toBeVisible();
  await expect(page).toHaveURL(/\/inscription/);

  await page.getByRole('checkbox', { name: /J'accepte les conditions/ }).check();
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page).toHaveURL(/\/profil\?bienvenue=1/);
});

test('mot de passe oublié : la page explique comment joindre l’équipe, sans promettre d’e-mail', async ({ page }) => {
  await page.goto('/connexion');
  await page.getByRole('link', { name: 'Mot de passe oublié ?' }).click();
  await expect(page.getByRole('heading', { name: 'Mot de passe oublié', level: 1 })).toBeVisible();
  await expect(page.getByText("Gamelia n'envoie pas d'e-mail automatique")).toBeVisible();
  await expect(page.getByRole('link', { name: /@/ })).toHaveAttribute('href', /^mailto:/);
});

test('un développeur fait vérifier son compte GitHub avec un code', async ({ page }) => {
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill('fatou@demo.gamelia'); // compte de démonstration non vérifié
  await page.getByLabel('Mot de passe', { exact: true }).fill('demo1234');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).not.toHaveURL(/\/connexion/);
  await page.goto('/profil');
  const section = page.getByRole('region', { name: 'Compte vérifié' });

  await section.getByLabel("Nom d'utilisateur GitHub").fill('https://github.com/awa');
  await section.getByRole('button', { name: 'Obtenir mon code' }).click();
  await expect(section.getByText('Indiquez votre nom d’utilisateur GitHub')).toBeVisible();

  await section.getByLabel("Nom d'utilisateur GitHub").fill('awa-diop');
  await section.getByRole('button', { name: 'Obtenir mon code' }).click();
  await expect(section.getByText(/gamelia-[0-9a-f]{10}/)).toBeVisible();
  await section.getByRole('button', { name: 'Vérifier mon compte' }).click();
  await expect(section.getByText('Compte GitHub confirmé')).toBeVisible();
});

test('le bandeau signale le mode démonstration', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('note')).toContainText('Démonstration : données simulées');
});
