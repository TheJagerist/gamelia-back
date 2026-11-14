# Mettre Gamelia en ligne sur le VPS Datacloud

Guide pas à pas pour une personne qui ne l'a jamais fait. Comptez 30 à 45 minutes.
À la fin : `https://votre-domaine` affiche le site réel, branché sur PostgreSQL, avec Agnès.

Ce que fait l'installation, sans rien vous demander de technique : PostgreSQL, l'API, le site, nginx, le certificat HTTPS, le pare-feu, le redémarrage automatique et une sauvegarde quotidienne de la base.

## Avant de commencer

Il vous faut quatre choses.

1. **Le serveur cloud Datacloud** (Ubuntu 22.04 ou 24.04, 2 Go de mémoire au moins) et son **adresse IP**, par exemple `203.0.113.10`.
2. **Un nom de domaine qui pointe vers cette adresse IP.** Le HTTPS est obligatoire (sans lui, la connexion au site ne fonctionne pas), et un certificat HTTPS s'obtient pour un nom, pas pour une adresse IP seule. Deux possibilités :
   - un domaine acheté (sur Datacloud ou ailleurs) : créez un enregistrement DNS de type **A** vers l'adresse IP du serveur ;
   - gratuit et immédiat : le service `sslip.io`. Si l'adresse IP est `203.0.113.10`, le nom `203-0-113-10.sslip.io` (les points remplacés par des tirets) pointe déjà vers votre serveur, sans rien configurer.
3. **L'adresse e-mail de l'équipe.** Elle sera affichée sur les pages Confidentialité, Conditions et Mot de passe oublié.
4. **La clé Agnès**, à portée de main. Vous ne la collerez qu'une fois, à l'étape 5, dans une saisie masquée.

## Étape 1 : envoyer le projet sur le serveur

> **Windows** : si PowerShell répond « `scp` n'est pas reconnu », utilisez celui de Git : `& "C:\Program Files\Git\usr\bin\scp.exe" ...` (et `ssh.exe` dans le même dossier). Si le serveur répond « Permission denied (publickey) », il n'accepte que la **clé SSH** fournie par l'hébergeur : ajoutez `-i "chemin\vers\la_cle.pem"` aux commandes `scp` et `ssh`.

Sur votre PC, dans le terminal de VS Code, placez-vous dans le dossier qui contient `gamelia-final.zip`, puis (remplacez l'adresse IP) :

```
scp gamelia-final.zip root@203.0.113.10:/root/
```

Si vous avez créé le serveur avec une clé SSH, la connexion se fait toute seule. Sinon, tapez le mot de passe fourni par Datacloud.

## Étape 2 : se connecter au serveur

```
ssh root@203.0.113.10
```

À la première connexion, répondez `yes`. Vous êtes maintenant « dans » le serveur : les commandes suivantes s'y exécutent.

## Étape 3 : lancer l'installation

Copiez ces lignes une par une. Remplacez le domaine et l'adresse e-mail par les vôtres.

```
apt-get update && apt-get install -y unzip
cd /root && unzip -o gamelia-final.zip
DOMAINE=203-0-113-10.sslip.io EMAIL_CONTACT=equipe@exemple.com bash /root/gamelia/back/deploy/installer-vps.sh
```

L'installation dure 5 à 10 minutes et affiche 14 étapes. À la fin, quatre vérifications doivent répondre :

```
API + base de données (en local) : {"ok":true,"database":true}
Site (en local)                  : 200
Site en ligne                    : 200
API en ligne                     : {"ok":true,"database":true}
```

`"database":true` est la preuve que le site est connecté à PostgreSQL.

**Si l'étape 12 (certificat HTTPS) échoue** : le nom de domaine ne pointe pas encore vers le serveur. Corrigez le DNS, attendez quelques minutes, puis relancez la commande que le script affiche. Le reste est déjà installé.

Le script peut être relancé autant de fois que nécessaire : il ne touche jamais aux données ni aux secrets déjà créés.

## Étape 4 : créer le compte administrateur

Choisissez un mot de passe d'au moins 12 caractères, que vous n'utilisez nulle part ailleurs.

```
cd /home/gamelia/gamelia/back
sudo -u gamelia ADMIN_EMAIL='equipe@exemple.com' ADMIN_PASSWORD='votre-mot-de-passe-admin' ADMIN_NAME='Équipe Gamelia' npm run create-admin
```

Ce compte valide les recruteurs, les défis et les solutions, et traite les signalements.

## Étape 5 : saisir la clé Agnès

```
sudo bash /home/gamelia/gamelia/back/deploy/definir-cle-agnes.sh
```

Collez la clé puis appuyez sur Entrée. **Rien ne s'affiche pendant la saisie, c'est voulu.** Le script enregistre la clé, redémarre l'API et teste la clé auprès d'Agnes AI. Vous devez lire :

```
État d'Agnès vu par l'API : {"available":true,"model":"agnes-2.0-flash"}
Test de la clé auprès d'Agnes AI : clé acceptée (réponse 200). Agnès est prête.
```

Si la clé est refusée, créez-en une nouvelle sur agnes-ai.com et relancez la commande.

**La clé ne doit exister nulle part ailleurs** : ni dans le code, ni sur GitHub, ni dans un message, ni dans une capture d'écran. Une clé qui a été collée dans une conversation doit être remplacée par une nouvelle.

## Étape 6 : vérifier dans le navigateur

Ouvrez `https://votre-domaine` et faites ce parcours :

1. Créez un compte développeur (la case des conditions est obligatoire).
2. Posez une question, puis cliquez sur « Demander à Agnès » : une piste doit s'afficher.
3. Ouvrez la page Agnès et posez-lui une question.
4. Déconnectez-vous, reconnectez-vous : la question est toujours là.
5. Connectez-vous avec le compte administrateur : l'espace d'administration s'ouvre.
6. Vérifiez qu'il n'y a **pas** de bandeau « Démonstration » en haut du site, ni de « Comptes de démonstration » sur la page de connexion.

C'est cette adresse `https://votre-domaine` que vous déposez sur la plateforme du concours.

## Étape 7 (facultative) : activer « Continuer avec GitHub »

Sans cette étape, le site fonctionne normalement avec l'e-mail et le mot de passe. Pour ajouter le bouton :

1. Sur GitHub : **Settings → Developer settings → OAuth Apps → New OAuth App**.
   - Application name : `Gamelia`
   - Homepage URL : `https://votre-domaine`
   - Authorization callback URL : `https://votre-domaine/api/auth/github/callback` (exactement, sans espace)
2. Cliquez **Register application**, copiez le **Client ID**, puis **Generate a new client secret** et gardez la page ouverte (le secret ne s'affiche qu'une fois).
3. Sur le serveur : `sudo bash /home/gamelia/gamelia/back/deploy/definir-github-oauth.sh`. Collez le Client ID, puis le secret (saisie masquée). Le script vérifie le couple auprès de GitHub, redémarre l'API et affiche `{"enabled":true}`.
4. Testez dans une fenêtre privée : page de connexion → « Continuer avec GitHub ».

Ne collez jamais le secret dans une conversation ou une capture d'écran.

## Étape 7 bis (facultative) : activer « Continuer avec Google »

À faire **après** que le site répond sur son vrai nom de domaine (voir plus bas), car Google exige une adresse de retour fixe en `https://`. Sans cette étape, le site fonctionne normalement avec l'e-mail, le mot de passe et GitHub.

1. Sur https://console.cloud.google.com : créer un projet (nom : `Gamelia`).
2. **API et services → Écran de consentement OAuth** : type « Externe », nom de l'application `Gamelia`, adresse d'assistance et adresse du développeur = votre e-mail. Domaine autorisé : le domaine principal du site (par exemple `ge-tech.site`). Droits demandés : seulement `openid`, `email` et `profile` (aucun droit sensible).
3. **Identifiants → Créer des identifiants → ID client OAuth** : type « Application Web ».
   - Origines JavaScript autorisées : `https://votre-domaine`
   - URI de redirection autorisés : `https://votre-domaine/api/auth/google/callback` (exactement, sans espace)
4. Copiez l'**ID client** et le **code secret** (la page peut rester ouverte).
5. Sur le serveur : `sudo bash /home/gamelia/gamelia/back/deploy/definir-google-oauth.sh`. Collez l'ID client, puis le secret (saisie masquée). Le script vérifie le couple auprès de Google, redémarre l'API et affiche `{"enabled":true}`.
6. Testez dans une fenêtre privée : page de connexion → « Continuer avec Google ».

À savoir, pour ne pas être surpris :
- **Mode « Test »** : tant que l'écran de consentement est en « Test », seules les adresses ajoutées dans « Utilisateurs test » (100 maximum) peuvent se connecter. Pour que tout le monde puisse, cliquez **Publier l'application** (« En production »). Avec uniquement les droits `openid`, `email` et `profile`, Google ne demande normalement pas de vérification longue ; il peut toutefois demander de prouver que vous possédez le domaine (Google Search Console, enregistrement DNS de type TXT à ajouter par la personne qui gère le domaine).
- Une personne ne peut pas être reliée automatiquement à un compte existant parce que son adresse e-mail est la même : elle doit d'abord se connecter avec son mot de passe, puis cliquer **Relier mon compte Google** dans Paramètres. C'est voulu (sécurité).
- Si le nom de domaine change : l'adresse de retour est recalculée toute seule par l'API, mais il faut **ajouter la nouvelle adresse** dans la console Google (étape 3).

Ne collez jamais le secret dans une conversation ou une capture d'écran.

## Étape 8 (recommandée) : activer les e-mails automatiques

Sans cette étape, le site fonctionne normalement, mais aucun e-mail n'est envoyé : ni bienvenue, ni information au recruteur quand l'admin valide ou refuse son compte (le message « votre identité a été vérifiée, votre compte est validé » part automatiquement dès que l'admin clique sur Valider), et « Mot de passe oublié » renvoie vers l'équipe au lieu d'envoyer un lien.

1. Procurez-vous un accès SMTP : le service d'e-mails de votre hébergeur ou de votre domaine, ou un service d'envoi (Brevo, Mailjet, etc.). Il vous donne un **serveur**, un **port** (587 ou 465), un **identifiant** et un **mot de passe**. Utilisez une adresse d'expéditeur que ce service autorise (idéalement une adresse de votre domaine).
2. Sur le serveur : `sudo bash /home/gamelia/gamelia/back/deploy/definir-smtp.sh`. Le script pose les questions, saisit le mot de passe en masqué, redémarre l'API et peut envoyer un e-mail d'essai.
3. Vérifiez : (a) créez un compte avec une adresse que vous pouvez lire : l'e-mail de bienvenue doit arriver ; (b) sur la page de connexion, « Mot de passe oublié ? » : le formulaire d'envoi de lien doit apparaître, et le lien reçu doit permettre de choisir un nouveau mot de passe ; (c) en admin, validez un recruteur de test. Contrôlez la boîte de réception, puis les courriers indésirables.
4. **Avec Brevo** : serveur `smtp-relay.brevo.com`, port `587`, identifiant = le champ « Connexion » de la page SMTP & API (de la forme `xxxxxxxx@smtp-brevo.com`), mot de passe = une **clé SMTP** (pas le mot de passe du compte). Authentifiez votre domaine dans Brevo (Expéditeurs, domaines : ajouter les entrées DKIM et le code Brevo dans la zone DNS, puis « Authentifier le domaine ») et utilisez comme expéditeur une adresse **de ce domaine** (`no-reply@votre-domaine`) : une adresse Gmail comme expéditeur est souvent refusée ou classée en indésirables. Mettez votre adresse de lecture dans « adresse de réponse ».
5. Si rien n'arrive : `sudo journalctl -u gamelia-api -n 50` (lignes `[mail]`). Les causes fréquentes : mot de passe ou port incorrect, adresse d'expéditeur non autorisée par le service.

Pour que les e-mails n'arrivent pas dans les courriers indésirables avec un vrai domaine, le service d'envoi demande en général d'ajouter des enregistrements DNS (SPF, DKIM) : suivez ses instructions.

## Changer le nom de domaine du site

À faire seulement quand le nouveau nom pointe déjà vers l'adresse IP du serveur (vérification : `nslookup nouveau.nom` affiche l'IP). Les comptes, questions et projets sont conservés ; les personnes connectées devront se reconnecter.

1. Envoyer le nouveau zip sur le serveur, puis `cd /root && unzip -o <zip>`.
2. `DOMAINE=nouveau.nom EMAIL_CONTACT=equipe@exemple.com ETAPES="code env dependances build services nginx https verification" bash /root/gamelia/back/deploy/installer-vps.sh`
3. Si la connexion GitHub est activée, mettre à jour l'adresse de retour :
   `sed -i 's#^GITHUB_CALLBACK_URL=.*#GITHUB_CALLBACK_URL=https://nouveau.nom/api/auth/github/callback#' /home/gamelia/gamelia/back/.env && systemctl restart gamelia-api`
   (Google n'a rien à changer côté serveur : son adresse de retour suit le nom de domaine.)
4. Sur github.com (application OAuth) : changer « Homepage URL » et ajouter `https://nouveau.nom/api/auth/github/callback` comme « Redirect URI ». Sur console.cloud.google.com (si Google est activé) : ajouter `https://nouveau.nom` en origine autorisée et `https://nouveau.nom/api/auth/google/callback` en URI de redirection.
5. Mettre à jour le lien de démo (CADEV) et tout lien partagé : l'ancienne adresse ne répond plus.

Retour en arrière : relancer la commande de l'étape 2 avec l'ancien nom.

## Les réglages, pour mémoire

L'installation crée ces deux fichiers. Vous n'avez pas à les écrire.

`/home/gamelia/gamelia/back/.env` (lisible seulement par l'utilisateur `gamelia`) :

| Variable | Valeur | Origine |
|---|---|---|
| `PORT`, `HOST` | `4000`, `127.0.0.1` | l'API n'est joignable que par nginx |
| `NODE_ENV` | `production` | cookies « Secure », contrôles stricts au démarrage |
| `FRONT_ORIGIN` | `https://votre-domaine` | votre domaine |
| `DATABASE_URL` | `postgres://gamelia_app:…@127.0.0.1:5432/gamelia` | mot de passe aléatoire créé par le script |
| `SESSION_SECRET`, `COOKIE_SECRET` | 64 caractères aléatoires chacun | créés par le script |
| `COOKIE_DOMAIN` | `localhost` | site et API sur le même domaine : rien à régler |
| `AGNES_API_KEY` | votre clé | saisie à l'étape 5 |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | application OAuth GitHub | facultatif, étape 7 |

`/home/gamelia/gamelia/front/.env.local` (aucun secret) :

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_API_URL` | `/api` |
| `NEXT_PUBLIC_SITE_URL` | `https://votre-domaine` |
| `NEXT_PUBLIC_CONTACT_EMAIL` | l'adresse e-mail de l'équipe |

`NEXT_PUBLIC_API_MOCK` et `NEXT_PUBLIC_SHOW_DEMO` sont absentes : c'est le site réel.

## Commandes utiles

| Besoin | Commande |
|---|---|
| Les services tournent-ils ? | `systemctl status gamelia-api gamelia-front nginx postgresql` |
| Voir les erreurs de l'API | `journalctl -u gamelia-api -n 50` |
| Voir les erreurs du site | `journalctl -u gamelia-front -n 50` |
| Redémarrer | `systemctl restart gamelia-api gamelia-front` |
| Santé (API + base) | `curl https://votre-domaine/api/sante` |
| Un membre a perdu son mot de passe | `cd /home/gamelia/gamelia/back && sudo -u gamelia RESET_EMAIL='membre@exemple.com' RESET_PASSWORD='Provisoire-2026' npm run reset-password` |
| Où sont les sauvegardes ? | `/var/backups/gamelia` (une par nuit, 7 jours) |

## Mettre à jour le site après une correction

Envoyez le nouveau zip (étape 1), puis sur le serveur :

```
cd /root && unzip -o gamelia-final.zip
DOMAINE=votre-domaine EMAIL_CONTACT=equipe@exemple.com ETAPES="code dependances build services verification" bash /root/gamelia/back/deploy/installer-vps.sh
```

Les données, les secrets, la clé Agnès et les réglages GitHub sont conservés. Les nouvelles migrations de base (par exemple `004_github_oauth.sql`) sont appliquées automatiquement par l'étape `dependances`.

## En cas de problème

| Ce que vous voyez | Cause probable | Solution |
|---|---|---|
| Le navigateur affiche « 502 Bad Gateway » | un service est arrêté | `systemctl restart gamelia-api gamelia-front`, puis `journalctl -u gamelia-api -n 50` |
| `"database":false` | PostgreSQL est arrêté | `systemctl restart postgresql` |
| « Configuration de production refusée » dans le journal de l'API | `back/.env` modifié à la main avec une valeur d'exemple | corrigez la ligne indiquée dans le message |
| Agnès « indisponible » | clé absente ou refusée | relancez l'étape 5 |
| L'inscription répond « Jeton de sécurité invalide » | site ouvert en `http://` ou par l'adresse IP | ouvrez toujours `https://votre-domaine` |
| Le build s'arrête : « Configuration incomplète » | `front/.env.local` supprimé | relancez l'installation complète |
