# Limites connues

- « Mot de passe oublié » : l'API répond `{ "sent": true }` mais **n'envoie pas d'e-mail** (pas de service SMTP configuré).
- Le score « semaine » du classement est la vraie somme des points sur 7 jours (le mock du front utilisait une estimation).
- Un signalement sur un contenu inexistant est refusé (404) ; le mock l'acceptait.
- Front et API doivent partager un domaine parent (`COOKIE_DOMAIN`) et être en HTTPS en production.
- Pas d'upload de fichiers : les avatars et démos sont des liens externes (vidéos limitées aux hébergeurs autorisés).
- Pas de test automatisé bout-en-bout avec le vrai front (les tests couvrent l'API directement).
- Les sessions expirées sont purgées au démarrage puis chaque heure.
