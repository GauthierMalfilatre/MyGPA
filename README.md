# MyGPA

Extension Firefox/Chrome qui calcule et affiche en direct le GPA réel sur [my.epitech.eu](https://my.epitech.eu), basé sur les niveaux de compétences (XP) par module plutôt que sur le GPA officiel, qui n'est mis à jour qu'en fin de semestre.

## Fonctionnement

1. Un script intercepte les appels `fetch`/`XHR` de la page pour récupérer le token d'authentification déjà utilisé par le site (aucun identifiant n'est stocké par l'extension).
2. L'extension interroge `GET /api/evaluations/validations/me` avec ce token.
3. Pour chaque module (`block`), on ne prend en compte que ceux ayant au moins un point acquis sur une compétence (`acquiredPoints > 0`) — un module pas encore commencé n'est pas compté comme un échec.
4. Pour les modules retenus, on utilise le `projectedGrade` renvoyé par l'API (A/B/C/D/Fail) converti sur l'échelle US 4.0 (A=4, B=3, C=2, D=1, Fail=0).
5. Le GPA réel = moyenne des valeurs de grade pondérée par les crédits de chaque module.
6. Le résultat s'affiche dans un widget flottant, rafraîchi automatiquement toutes les 60 secondes.

## Installation (développement / test local)

1. Ouvrir Firefox et aller sur `about:debugging#/runtime/this-firefox`
2. Cliquer sur **Charger un module temporaire**
3. Sélectionner le fichier `extension/manifest.json`
4. Se rendre sur `https://my.epitech.eu/me/academic` en étant connecté

Le widget apparaît en bas à droite de la page dès qu'une requête vers l'API des validations est capturée.

## Tests

```bash
cd extension
node --test test/
```

## Structure du projet

```
extension/
  manifest.json       # Manifeste WebExtension (Manifest V3)
  src/
    inject.js          # Injecté dans le contexte de la page pour capturer le token d'auth
    content.js          # Orchestration : capture token, appelle l'API, déclenche le rendu
    gpa.js               # Logique pure de calcul du GPA
    widget.js            # Affichage du widget flottant
    widget.css
  test/
    gpa.test.js
    fixtures/
```
