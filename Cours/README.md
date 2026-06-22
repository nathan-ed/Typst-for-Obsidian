# Systeme de cours Typst

Ce dossier est un modele de travail pour preparer des cours dans Obsidian avec
Typst for Obsidian.

## Organisation

- `_template/cours-eg.typ` contient les fonctions reutilisables.
- `Sequences/` contient les contenus canoniques, sans dates.
- `Index/` contient les vues rapides par classe/annee.
- `Planning/` contient le suivi manuel de progression.
- Les ressources propres a une sequence vont dans un dossier `assets/` voisin.

## Mode professeur / eleve

Dans un fichier de sequence, changer le mode ici :

```typst
#show: cours.with(
  titre: "Suites et limites",
  niveau: "3M",
  mode: "prof",
  theme: "light",
  title-style: "notes",
  frame-style: "boxed",
  break-after-seance: true,
)
```

- `mode: "prof"` affiche tout : script, relances, vigilances, bilans.
- `mode: "eleve"` masque les blocs prof et garde le contenu distribuable.

Themes disponibles :

- `theme: "light"` : rendu clair, compatible avec Typst CLI.
- `theme: "dark"` : rendu sombre fixe, compatible avec Typst CLI.
- `theme: "obsidian"` : utilise les couleurs du theme Obsidian courant via
  les variables de Typst for Obsidian. A utiliser dans l'extension pour que
  l'export suive le dark mode Obsidian.

Styles configurables :

- `title-style`: style `beautitled`. Exemples utiles : `"notes"`, `"clean"`,
  `"schoolbook"`, `"educational"`, `"textbook"`, `"structured"`.
- `frame-style`: style `beautiframe`. Exemples utiles : `"boxed"`, `"cours"`,
  `"modern"`, `"minimal"`, `"academic"`, `"bw"`.
- `break-after-seance`: `true` ajoute un saut de page apres chaque seance.
  Mettre `false` pour les index ou plannings compacts.

## Structure conseillee d'une seance

Les objectifs sont volontairement dans l'appel a `#seance(...)` pour rester
visibles et obligatoires dans la preparation :

```typst
#seance(
  "Entrer dans l'idee de limite",
  duree: "45 min",
  intention: "Faire emerger une notion intuitive avant les notations.",
  objectifs: [
    - Lire une tendance dans un tableau.
    - Distinguer valeur calculee et comportement a long terme.
  ],
)[
  #prof[
    Script, gestes, questions a poser.
  ]

  #eleves[
    Contenu visible en version eleve.
  ]
]
```

En `mode: "prof"`, une seance sans `objectifs:` affiche un rappel.

## Snippet rapide

Le fichier `Cours/snippets.json` contient un snippet pret a coller dans
`Settings > Typst for Obsidian > Custom snippets`.

Prefixe :

```text
sea
```

Il insere une nouvelle seance complete avec objectifs, script prof, contenu
eleves, activite, relance, vigilance, ressource et bilan.

## Chemins de ressources

Les liens simples peuvent rester relatifs :

```typst
#ressource("Image d'appui", "assets/schema.svg")
```

Pour afficher une image via `#image-ressource(...)`, utiliser un chemin depuis
la racine du coffre, car l'appel `image()` est defini dans le template :

```typst
#image-ressource("/Cours/Sequences/3M/assets/schema.svg")
```

## Packages utilises

Le template importe les packages Typst Universe suivants :

- `@preview/beautitled:0.2.6`
- `@preview/beautiframe:0.1.0`
- `@preview/taskize:0.2.0`
- `@preview/simple-plot:0.1.0`

Ils peuvent etre telecharges par Typst for Obsidian si l'option
`Auto-download packages` est active.
