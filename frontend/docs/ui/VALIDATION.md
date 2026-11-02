# MediBrief — Refonte de l’interface et validation

Date : 2 novembre 2026 · Branche : `feat/clinical-interface`

## Résultat

Le frontend conserve son thème sombre et adopte une direction de dossier clinique : surfaces graphite, IBM Plex Sans auto-hébergée, hiérarchie typographique mesurée, repères bleus et chronologie verticale. Les espaces clinique et patient conservent leurs parcours distincts.

Aucun fichier du backend, de `lib/auth.ts`, de `lib/api.ts` ou de `lib/pdf-report.ts` n’a été modifié. Les routes applicatives, les règles de rôle, les requêtes de mutation et les mécanismes de stockage des sessions sont préservés. Les données de démonstration sont isolées dans les tests Playwright ; aucune donnée métier réelle n’a été créée ou modifiée.

## Corrections et changements

### Fondations

- Les cartes d’authentification utilisent la largeur disponible dans leur parent, avec 20 px de marge latérale sur mobile. Le débordement n’est plus dissimulé par un `overflow-x: hidden` global.
- Les usages de variables de surface et d’accent sont ramenés aux tokens communs. Aucun usage actif de variable CSS non définie ne subsiste.
- IBM Plex Sans est fournie par `@fontsource/ibm-plex-sans`, en graisses 400, 500 et 600. Les boutons natifs héritent désormais de la même famille que les autres contrôles.
- Les dégradés de teinte, halos, ombres colorées et déplacements décoratifs au survol ont été retirés.
- Les espacements des panneaux, champs, boutons et cartes sont harmonisés. La règle générale `.panel + .panel`, qui décalait les cartes KPI, a été remplacée par un espacement limité aux sections du contenu.
- Le bouton principal est blanc cassé, les contrôles ont un rayon de 8 px et les panneaux un rayon de 12 px.

### Données et analytics

- Toutes les séries numériques de remplacement ont été supprimées. Les graphiques lisent les mesures datées via le contrat existant `GET /vitals/:patientId` ; les anomalies et statistiques restent issues des endpoints existants d’analytics.
- Les points suivent leurs dates réelles. Les valeurs et unités d’origine sont accessibles dans des tableaux dépliables, y compris au clavier.
- Absence de données, mesure unique, données non numériques et unités incompatibles produisent des messages explicites ; aucune courbe n’est inventée pour remplir l’écran.
- Les réponses d’un ancien patient ne sont plus affichées comme le contexte du patient nouvellement sélectionné.
- Le tableau des anomalies distingue la valeur mesurée du Z-score effectivement retourné par le serveur.
- Un échec de chargement est présenté comme une erreur, sans être transformé en zéro ou en résultat rassurant « aucune anomalie ».
- Le dashboard indique un décompte partiel avec `+` lorsque l’API signale une page suivante. Le pourcentage de couverture est indisponible tant que le décompte total nécessaire ne peut pas être établi.
- Les mentions statiques « System Healthy » et « Portal Active » ont été retirées : elles n’étaient reliées à aucun contrôle de santé.

### Écrans et accessibilité

- L’accueil présente le fonctionnement réel du dossier et de la synthèse, sans patient, mesure ou statistique de démonstration dans le code de production.
- Connexion clinique, inscription de clinique, connexion patient et activation par invitation sont conservées ; les sélecteurs de mode se distinguent du bouton de soumission.
- Les tableaux restent défilants dans leur propre région, accessible au clavier ; les liens de dossier et actions existantes sont conservés.
- Les icônes utilisent Lucide, à 18 px et avec un trait de 1,5 px, à la place des emojis décoratifs.
- La navigation mobile déplace le focus dans le menu à l’ouverture, contient la tabulation, se ferme avec Échap et restitue le focus au bouton d’ouverture. Le contenu situé derrière le menu ouvert devient inerte.
- Les onglets existants acceptent les flèches gauche/droite ainsi que Début/Fin. Les synthèses du portail se déplient avec un bouton natif.
- Les synthèses Markdown sont composées comme des documents lisibles, sans titres en dégradé. Les exports TXT/PDF et la génération via file d’attente/SSE sont conservés.
- Les préférences de réduction du mouvement désactivent les transitions et montrent immédiatement le texte des synthèses.
- La page 404 utilise aussi la charte sombre de MediBrief, avec des liens vers les accès existants.

## Vérifications exécutées

| Vérification | Résultat final |
| --- | --- |
| `npm run lint` | Réussi, aucune erreur ni alerte ESLint |
| `npm run typecheck` | Réussi |
| `npm run build` | Réussi, toutes les routes compilées |
| Playwright sur la version de production | **43 tests réussis**, aucun échec ni test ignoré, 55,0 s |
| Responsive | Les 15 pages applicatives et la page 404 examinées à **390, 768 et 1440 px**, sans débordement global ni erreur JavaScript |
| Accessibilité automatisée | Axe, règles WCAG 2 A/AA et WCAG 2.1 AA, sur les 16 pages à 390 et 1440 px : aucune violation détectée dans les états examinés |
| Clavier | Menus mobiles, Échap, restitution du focus, onglets et dépliage des synthèses vérifiés |
| États de données | Chargement, vide, erreur, succès, changement de patient, mesure unique et unités incompatibles vérifiés |
| Parcours et contrats | Connexions, inscription, activation, création patient, consultation, saisie de constantes et d’analyses, chat et mise à jour du téléphone vérifiés avec API simulées |
| Synthèses et exports | File d’attente, fin de traitement SSE, erreur de génération, historique, exports TXT et PDF vérifiés ; signature PDF et contenu TXT contrôlés |
| Cohérence CSS | Aucune variable active non définie ; alignement des KPI vérifié |
| Préservation du périmètre | Diff vide sur le backend, `lib/auth.ts`, `lib/api.ts` et `lib/pdf-report.ts` |
| `git diff --check` | Réussi |

Contrastes calculés : texte principal sur panneau **15,00:1**, texte discret sur surface surélevée **5,08:1**, accent bleu sur panneau **7,62:1**, texte du bouton principal **15,31:1**, bordure de contrôle sur fond **3,04:1**.

La CI GitHub exécute maintenant `npm run test:ui` après l’installation de Chromium. Le job backend existant et le scénario historique d’intégration nécessitant un environnement complet restent inchangés. La capture des images est volontairement optionnelle en CI ; elle était activée pour la campagne locale finale.

### Reproduire les vérifications

Depuis `frontend/` :

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm run test:ui
```

Pour exécuter la même campagne sur un serveur de production et exporter les captures :

```bash
# Terminal 1, après le build
npm run start -- --hostname 127.0.0.1 --port 3100

# Terminal 2
CAPTURE_UI=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npm run test:ui -- --workers=2 --reporter=list
```

Sans `CAPTURE_UI=1`, seul le scénario d’export des captures est ignoré ; les 42 autres tests restent exécutés.

## Captures

- [Galerie de toutes les pages](index.html)
- [Archive ZIP](../medibrief-captures.zip)
- [Planche ordinateur](overview-1440.jpg)
- [Planche mobile](overview-390.jpg)
- [Inventaire détaillé des images](manifest.json)

Les **56 PNG en pleine page** couvrent les 15 pages applicatives, la page 404 et les principaux modes : inscription clinique, activation patient, invitation, les six onglets du dossier, analyses du portail, sécurité du compte et lecture de synthèses. Chaque vue est disponible à **1440 px et 390 px**.

Les captures proviennent du frontend compilé en production et de réponses API synthétiques confinées aux tests. Elles ne montrent aucun dossier patient réel. L’archive contient la galerie autonome et ses images ; l’extraire avant d’ouvrir `index.html`.

## Fichiers concernés

### Fondations et composants

- [Styles communs](../../app/globals.css)
- [Layout racine et chargement de la police](../../app/layout.tsx)
- [Identité MediBrief](../../components/ui/brand.tsx)
- [Navigation mobile accessible](../../components/ui/use-mobile-navigation.ts)
- [Navigation clavier des onglets](../../components/ui/tab-keyboard.ts)
- [États vides](../../components/ui/empty-state.tsx)
- [Formulaire d’accès clinique](../../components/auth/auth-card.tsx)
- [Graphiques datés](../../components/charts/sparkline.tsx)
- [État de préparation des synthèses](../../components/ai/skeleton-loader.tsx)
- [Lecture des synthèses et réduction du mouvement](../../components/ai/streaming-markdown.tsx)

### Écrans

- [Accueil](../../app/page.tsx)
- [Page 404](../../app/not-found.tsx)
- [Accès patient](../../app/patient-auth/page.tsx)
- [Layout clinique](../../app/dashboard/layout.tsx)
- [Dashboard](../../app/dashboard/page.tsx)
- [Registre patient](../../app/dashboard/patients/page.tsx)
- [Dossier patient](../../app/dashboard/patients/[id]/page.tsx)
- [Consultations](../../app/dashboard/consultations/page.tsx)
- [Analytics](../../app/dashboard/analytics/page.tsx)
- [Synthèses cliniques](../../app/dashboard/ai-summary/page.tsx)
- [Audit](../../app/dashboard/security/page.tsx)
- [Layout du portail](../../app/portal/layout.tsx)
- [Vue d’ensemble du portail](../../app/portal/page.tsx)
- [Données de santé](../../app/portal/records/page.tsx)
- [Rendez-vous](../../app/portal/appointments/page.tsx)
- [Synthèses partagées](../../app/portal/summaries/page.tsx)
- [Paramètres du patient](../../app/portal/settings/page.tsx)

### Validation, dépendances et livraison

- [Tests de régression UI](../../tests/clinical-ui.spec.ts)
- [Scripts et dépendances npm](../../package.json), [lockfile](../../package-lock.json)
- [CI GitHub](../../../.github/workflows/ci.yml)
- [Documentation frontend](../../README.md)
- Ce rapport, la galerie, l’inventaire JSON, les 56 captures et les deux planches de présentation

## Limites et recommandations

Aucune régression n’a été détectée dans les parcours couverts. Les tests navigateur utilisent le vrai frontend et des API simulées : ils vérifient les contrats émis et les comportements de l’interface, mais ne valident pas les autorisations côté serveur ni un échange réel frontend/backend/PostgreSQL/Redis/fournisseur d’IA. Les anciens tests `auth-and-dashboard.spec.ts`, qui nécessitent cette stack et des comptes de test, n’ont pas été exécutés localement. Aucun appel à un fournisseur d’IA réel n’a été lancé.

Les vérifications ont été exécutées dans Chromium. Firefox, Safari, les appareils physiques et un lecteur d’écran réel n’ont pas été vérifiés. L’audit automatisé ne constitue pas une certification exhaustive d’accessibilité ; les contenus médicaux renvoyés ultérieurement peuvent varier.

Les limites de données du backend restent conservées : l’analytics patient examine au plus 200 constantes et la vue de risque s’appuie sur au plus 500 synthèses. Les libellés distinguent les dernières valeurs analysées de l’historique enregistré ; les seuils et calculs métier n’ont pas été modifiés.

Avant une mise en production, effectuer une recette intégrée avec des comptes ADMIN, DOCTOR et PATIENT et un jeu de données dédié ; exécuter le scénario historique d’intégration dans cet environnement. Compléter ensuite la vérification clavier avec un lecteur d’écran et les navigateurs réellement utilisés par les équipes et les patients.

## Crédit

Processus de design inspiré d’**unslop**, par [Damir Sokolovsky / @heydamir](https://x.com/heydamir), sous licence CC BY 4.0. Aucun visuel généré par IA n’a été utilisé.
