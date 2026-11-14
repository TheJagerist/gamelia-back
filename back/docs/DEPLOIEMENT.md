# Déploiement

Le guide complet, pas à pas, est à la racine du projet : [`DEPLOIEMENT-VPS.md`](../../DEPLOIEMENT-VPS.md).

Fichiers utilisés, dans `back/deploy/` :

| Fichier | Rôle |
|---|---|
| `installer-vps.sh` | Installe tout sur un Ubuntu vierge, en une commande. Relançable sans risque. |
| `definir-cle-agnes.sh` | Enregistre la clé Agnès sans l'afficher, redémarre l'API, vérifie la clé. |
| `nginx-gamelia.conf` | Un seul domaine : `/` vers le site, `/api/` vers l'API. |
| `gamelia-api.service`, `gamelia-front.service` | Services systemd (utilisateur non root, redémarrage automatique). |
