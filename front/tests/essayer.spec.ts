import { expect, test, type Page } from '@playwright/test';

// Éditeur « Essayer » des leçons (démonstration) : modifier le code, exécuter, rétablir, erreurs, isolation.
async function connecter(page: Page) {
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill('awa@demo.gamelia');
  await page.getByLabel('Mot de passe', { exact: true }).fill('demo1234');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).not.toHaveURL(/\/connexion/);
}
async function ouvrir(page: Page, chemin: string) {
  await connecter(page);
  await page.goto(chemin);
}
const resultat = (page: Page) => page.frameLocator('iframe[title^="Résultat"]');

test('les leçons affichent leur texte et leurs exemples', async ({ page }) => {
  await ouvrir(page, '/apprendre/web/web-1');
  await expect(page.getByText('Une page web est un document texte.')).toBeVisible();
  await expect(page.getByText('Les balises les plus utilisées')).toBeVisible();
  await page.goto('/apprendre/git/git-3');
  await expect(page.getByText('Nginx se place devant l')).toBeVisible();
});

test('première leçon : modifier le HTML, exécuter, puis rétablir', async ({ page }) => {
  await ouvrir(page, '/apprendre/web/web-1');
  await expect(resultat(page).getByRole('heading', { name: 'Bonjour Dakar' })).toBeVisible();
  // Un seul onglet (HTML) : pas de choix de langage inutile.
  await expect(page.getByRole('tab')).toHaveCount(0);
  const zone = page.getByLabel('Code HTML à modifier');
  await zone.fill('<h1>Salut Libreville</h1>');
  await page.getByRole('button', { name: 'Exécuter' }).click();
  await expect(resultat(page).getByRole('heading', { name: 'Salut Libreville' })).toBeVisible();
  await page.getByRole('button', { name: 'Rétablir' }).click();
  await expect(resultat(page).getByRole('heading', { name: 'Bonjour Dakar' })).toBeVisible();
  await expect(zone).toHaveValue(/Bonjour Dakar/);
});

test('leçon CSS : onglets HTML et CSS, la couleur change dans le résultat', async ({ page }) => {
  await ouvrir(page, '/apprendre/web/web-2');
  await expect(page.getByRole('tab')).toHaveCount(2);
  await page.getByRole('tab', { name: 'CSS' }).click();
  await page.getByLabel('Code CSS à modifier').fill('h1 { color: rgb(255, 0, 0); }');
  await page.getByRole('button', { name: 'Exécuter' }).click();
  await expect(resultat(page).getByRole('heading', { name: 'Mon profil' })).toHaveCSS('color', 'rgb(255, 0, 0)');
});

test('leçon JavaScript : le compteur réagit aux clics, une erreur est expliquée', async ({ page }) => {
  await ouvrir(page, '/apprendre/web/web-3');
  await expect(page.getByRole('tab')).toHaveCount(3);
  await expect(resultat(page).getByText('0 clic')).toBeVisible();
  await resultat(page).getByRole('button', { name: 'Cliquez-moi' }).click();
  await resultat(page).getByRole('button', { name: 'Cliquez-moi' }).click();
  await expect(resultat(page).getByText('2 clic(s)')).toBeVisible();

  await page.getByRole('tab', { name: 'JavaScript' }).click();
  await page.getByLabel('Code JavaScript à modifier').fill('nExistePas();');
  await page.getByRole('button', { name: 'Exécuter' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Erreur dans votre code' })).toContainText('nExistePas');
});

test('le code des apprenants est isolé du site (cadre sandbox, sans accès au parent)', async ({ page }) => {
  await ouvrir(page, '/apprendre/web/web-3');
  const sandbox = await page.locator('iframe[title^="Résultat"]').getAttribute('sandbox');
  expect(sandbox).toBe('allow-scripts');
  await page.getByRole('tab', { name: 'JavaScript' }).click();
  await page
    .getByLabel('Code JavaScript à modifier')
    .fill("let a = 'accessible'; try { parent.document.title; } catch (e) { a = 'bloque'; } let c = 'lisible'; try { document.cookie; } catch (e) { c = 'sans cookie'; } document.body.textContent = a + '|' + c;");
  await page.getByRole('button', { name: 'Exécuter' }).click();
  await expect(resultat(page).getByText('bloque|sans cookie')).toBeVisible();
});
