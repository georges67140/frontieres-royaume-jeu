# Les Rangs du Nord — Bataille Babylon 0.2

Développement direct en JavaScript / Babylon.js 8.26.0. Aucun agent Replit.

Cette scène ajoute une bataille 3D séparée. Elle ne remplace ni l’Atelier du guerrier, ni le jeu précédent, ni les anciens assets. `Soldier` hérite du véritable `RDNMotion.Controller` de `../atelier-babylon/motion-core.js` : le calcul des articulations et les poses du guerrier restent la base. Les pièces du guerrier sont adaptées en géométries partagées et instanciées dans une seule scène.

## Jouer

La scène est visible dès que le moteur est chargé. La bataille attend le premier ordre : toucher/glisser sur le terrain ou bouton tactique. Mode paysage sur téléphone. Boucliers ne change jamais la formation. Formation alterne Ligne / Mur / Pointe / Écartée. Charge consomme 30 de courage. Volée comporte une préparation et une recharge de cinq secondes. Recrues ajoute six hommes, une seule fois par bataille. Sans ordre pendant cinq secondes, l’armée recule. Pause et changement d’onglet suspendent le temps. Vue rapprochée, zoom et pincement permettent d’examiner les soldats.

## Périmètre livré

24 contre 24, dont six archers par camp. Guerriers 3D articulés, appuis au sol, protection frontale progressive, impacts de mêlée au contact de la lame, projectiles non guidés, pertes/moral/courage, IA simple, lignes de rupture et vagues. XP des survivants transmise à la vague suivante (pas encore de sauvegarde persistante). Terrain, herbe instanciée, pins, rochers, rivière/pont décoratifs, palissades et bannières. Les collisions fines avec le décor et la traversée tactique du pont ne sont pas encore implémentées. Pas encore d’arquebuses, de cavalerie ou de grande armée de 200 hommes.

## Code / StackBlitz

Le dépôt reste la source du code. `npm start` ouvre cette scène dans le serveur Node sans dépendance, compatible avec un projet StackBlitz importé de GitHub. GitHub Pages garde l’ancienne page d’accueil intacte ; cette scène est accessible au chemin `bataille-babylon/`.

- `battle-core.js` : simulation testable sans moteur graphique.
- `battle-view.js` : géométrie 3D, terrain, instances et rendu Babylon.
- `battle-app.js` : chargement, contrôles tactiles, affichage et pause.
- `battle-core.test.cjs` : tests unitaires.
- `browser-smoke.cjs` : vrais rendus Chromium et WebKit, commandes et panne CDN.

## Validation

`npm test` exécute les tests de simulation. La CI installe les dépendances de test, rend la scène dans Chromium et WebKit en format iPhone paysage, exerce les commandes et enregistre des captures. Ce n’est pas un test de performance sur un iPhone physique. Vérifier le résultat de la CI avant d’affirmer que la passe graphique est validée.

Le moteur est épinglé à 8.26.0, avec deux fournisseurs CDN et un message de récupération en cas d’échec. Aucune API plein écran ou verrouillage d’orientation n’est nécessaire.
