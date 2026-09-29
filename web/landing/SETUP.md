# Aperçu Voyaj

Les animations utilisent les vidéos Higgsfield de `generated/scenes.json`.
Le bouton pause arrête les vidéos et les animations décoratives. Le réglage système de réduction des animations est respecté.

## Expérience interactive

L’ouverture propose six chapitres pilotés par le défilement, avec navigation directe et deux points de vue (Jo ou Léa). Le choix frais partagés / trajet offert adapte la suite du récit et le téléphone de démonstration. Les vidéos avancent et reculent avec le défilement ; aucune génération supplémentaire n’est nécessaire.

La simulation par commune est une illustration locale, sans recherche de conducteur ni calcul de distance. Son bouton d’inscription préremplit uniquement les champs commune et rôle encore vides. Elle ne transmet rien avant l’envoi explicite du formulaire.

## Formulaire d’inscription

Le formulaire appelle `POST /api/inscription`. L’envoi serveur utilise Resend et ne stocke aucune inscription dans une base de données.

Configurer sur le serveur les trois variables décrites dans `.env.example` :

- `REGISTRATION_TO` : adresse destinataire choisie par le propriétaire.
- `MAIL_FROM` : expéditeur autorisé sur un domaine vérifié auprès de Resend.
- `RESEND_API_KEY` : clé d’envoi, à conserver uniquement côté serveur.

En local, ajouter ces variables à `.env.local`, sans supprimer `HF_CREDENTIALS`, puis redémarrer le serveur. Ne pas publier ce fichier.
Sans cette configuration, le formulaire indique que les inscriptions ne sont pas encore ouvertes. Il ne confirme jamais un envoi fictif.
Une réponse positive signifie que le prestataire a accepté le message, pas qu’il est déjà livré dans la boîte du destinataire.
Avant une mise en production publique, configurer aussi la limitation des requêtes auprès de l’hébergeur ; le champ anti-robot ne remplace pas une protection contre les envois automatisés.

Documentation de l’envoi : https://resend.com/docs/api-reference/emails/send-email

## Améliorations vidéo

Trois variantes ont été préparées : ouverture, conductrice à l’arrêt, trajet à deux.
Le 29 septembre 2026, les trois requêtes ont échoué pour solde API Higgsfield insuffisant. Les vidéos actives n’ont pas été remplacées.
Le journal `generated/video-improvements.json` garde les prompts et les identifiants de requête.

Après recharge et demande de reprise :

```powershell
node --use-system-ca improve-scenes.mjs submit --retry-failed
node --use-system-ca improve-scenes.mjs status
```

Une soumission de statut inconnu n’est jamais relancée automatiquement. Les résultats doivent être examinés avant d’actualiser `generated/scenes.json`.

## Vérifications

```powershell
node --import tsx --test tests/journey.test.ts tests/registration.test.ts
npx tsc --noEmit --incremental false
```

Les tests du formulaire simulent le prestataire ; aucun message réel n’est expédié.
`VOYAJ_BUILD_DIR` permet de séparer les aperçus locaux simultanés (`.next-codex`) des vérifications de production (`.next-check`).
