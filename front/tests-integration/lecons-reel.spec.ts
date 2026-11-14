import { expect, test } from '@playwright/test';

// Site réel : les leçons affichent leur contenu (venu de la base) et l'éditeur « Essayer » fonctionne.
// Régression : sur le site réel, les leçons n'affichaient que le quiz car leur texte n'était pas dans la base.
test.describe.configure({ mode: 'serial' });

const email = `lecons.${Date.now().toString(36)}@exemple.test`;
const password = 'MotDePasse-Lecons1';

test("une personne s'inscrit", async ({ page }) => {
  await page.goto('/inscription');
  await page.getByLabel('Nom complet').fill('Apprenante Réelle');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByLabel('Pays').selectOption('Gabon');
  await page.getByRole('checkbox', { name: /J'accepte les conditions/ }).check();
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page).toHaveURL(/\/profil/);
});

test('chaque leçon affiche son texte (pas seulement le quiz)', async ({ page }) => {
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/fil/);
  for (const [piste, id, texte] of [
    ['web', 'web-1', 'Les balises les plus utilisées'],
    ['web', 'web-2', "padding = à l'intérieur de la boîte"],
    ['web', 'web-3', 'Trois étapes à retenir'],
    ['api', 'api-1', 'Les méthodes courantes'],
    ['api', 'api-2', 'Une promesse est une valeur'],
    ['api', 'api-3', 'try / catch attrape une erreur'],
    ['git', 'git-1', 'git init démarre le suivi'],
    ['git', 'git-2', 'Une branche est une copie de travail isolée'],
    ['git', 'git-3', 'Nginx se place devant'],
  ]) {
    await page.goto(`/apprendre/${piste}/${id}`);
    await expect(page.getByText(texte)).toBeVisible();
  }
});

test('l’éditeur « Essayer » exécute le code dans la leçon JavaScript', async ({ page }) => {
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/fil/);
  await page.goto('/apprendre/web/web-3');
  const cadre = page.frameLocator('iframe[title^="Résultat"]');
  await cadre.getByRole('button', { name: 'Cliquez-moi' }).click();
  await expect(cadre.getByText('1 clic(s)')).toBeVisible();
});
