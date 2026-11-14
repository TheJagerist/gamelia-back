import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, email: string, ok = true) {
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill('demo1234');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  if (ok) await expect(page).not.toHaveURL(/\/connexion/);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/questions');
  await page.evaluate(() => localStorage.clear());
});

test('un visiteur lit les questions sans compte', async ({ page }) => {
  await page.goto('/questions');
  await expect(page.getByRole('heading', { name: 'Questions', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Comment connecter mon application à une API ?' }).click();
  await expect(page.getByText('Meilleure réponse').first()).toBeVisible();
});

test('une page protégée renvoie vers la connexion', async ({ page }) => {
  await page.goto('/progression');
  await expect(page).toHaveURL(/\/connexion\?suite=%2Fprogression/);
});

test('un développeur pose une question puis la retrouve', async ({ page }) => {
  await login(page, 'awa@demo.gamelia');
  await expect(page).toHaveURL(/\/fil/);
  await page.goto('/questions/nouvelle');
  await page.getByLabel('Titre').fill('Comment paginer une liste avec Django REST ?');
  await page.getByLabel('Description').fill('Ma liste renvoie 5 000 éléments et la page est très lente sur téléphone.');
  await page.getByRole('button', { name: 'Django' }).click();
  await page.getByRole('button', { name: 'Publier la question' }).click();
  await expect(page.getByRole('heading', { name: 'Comment paginer une liste avec Django REST ?' })).toBeVisible();
});

test('un développeur réussit une leçon et gagne des points', async ({ page }) => {
  await login(page, 'awa@demo.gamelia');
  await page.goto('/apprendre/api/api-2');
  await page.getByLabel('Que le code est entre 200 et 299').check();
  await page.getByLabel('Une promesse des données').check();
  await page.getByLabel('Non, il faut vérifier reponse.ok').check();
  await page.getByRole('button', { name: 'Valider mes réponses' }).click();
  await expect(page.getByText('Leçon validée !')).toBeVisible();
  await expect(page.getByText('+15 points')).toBeVisible();
});

test('un recruteur non validé voit un message clair', async ({ page }) => {
  await login(page, 'samuel@demo.gamelia', false);
  await expect(page.getByText("Votre compte recruteur n'est pas encore validé", { exact: false })).toBeVisible();
});

test("un développeur n'accède pas à l'espace admin", async ({ page }) => {
  await login(page, 'awa@demo.gamelia');
  await expect(page).toHaveURL(/\/fil/);
  await page.goto('/admin/validations');
  await expect(page).toHaveURL(/\/fil/);
});

test('un admin valide un compte recruteur', async ({ page }) => {
  await login(page, 'admin@demo.gamelia');
  await expect(page).toHaveURL(/\/admin\/validations/);
  await page.getByRole('button', { name: 'Valider le compte' }).first().click();
  await expect(page.getByText('Compte Baobab Pay validé.')).toBeVisible();
});

test('un recruteur validé évalue une candidature', async ({ page }) => {
  await login(page, 'recruteur@demo.gamelia');
  await expect(page).toHaveURL(/\/recruteur\/talents/);
  await page.goto('/recruteur/defis/rc2');
  const first = page.locator('article').filter({ hasText: 'Koffi Mensah' });
  await first.getByRole('radio', { name: '4 sur 5' }).click();
  await first.getByRole('button', { name: "Enregistrer l'évaluation" }).click();
  await expect(page.getByText('Évaluation enregistrée.', { exact: false })).toBeVisible();
});

test('un membre change son thème et son mot de passe dans les paramètres', async ({ page }) => {
  await login(page, 'awa@demo.gamelia');
  await page.goto('/parametres');
  await page.getByRole('radio', { name: 'Sombre' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByLabel('Mot de passe actuel').fill('demo1234');
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill('nouveau1234');
  await page.getByLabel('Confirmer le nouveau mot de passe').fill('nouveau1234');
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click();
  await expect(page.getByText('Mot de passe modifié.')).toBeVisible();
});
