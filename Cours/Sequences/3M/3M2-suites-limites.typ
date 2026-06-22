#import "../../_template/cours-eg.typ": *

#show: cours.with(
  titre: "Suites et limites",
  niveau: "3M",
  annee: "modele reutilisable",
  mode: "prof",
  title-style: "notes",
  frame-style: "boxed",
  break-after-seance: true,
)

#sequence("Suites et limites", code: "3M2")[
  #sommaire-seances((
    (<s-lim-intro>, "Entrer dans l'idee de limite", "45 min"),
    (<s-lim-formaliser>, "Formaliser une limite finie", "45 min"),
  ))

  #seance(
    "Entrer dans l'idee de limite",
    duree: "45 min",
    intention: "Faire emerger une notion intuitive avant les notations.",
    objectifs: [
      - Lire une tendance dans un tableau de valeurs.
      - Distinguer valeur calculee et comportement a long terme.
      - Introduire une phrase du type "quand $n$ devient grand...".
    ],
  )[
    #prof[
      Commencer sans notation formelle. Demander ce que l'on peut prevoir apres
      beaucoup d'etapes, puis seulement ensuite introduire le langage de limite.
    ]

    #eleves[
      On observe la suite definie par $u_n = 1 + 1 / n$.

      #exercices(columns: 2)[
        + Calculer $u_1$, $u_2$, $u_5$ et $u_10$.
        + Placer ces valeurs sur un axe.
        + Expliquer pourquoi les valeurs se rapprochent de $1$.
        + Proposer une phrase commencant par "Quand $n$ devient grand...".
      ]
    ]

    #activite(title: "Visualiser une tendance")[
      #graphe-rationnel(
        x => 1 + 1 / x,
        xmin: 1,
        xmax: 12,
        ymin: 0,
        ymax: 3,
        width: 8,
        height: 4.5,
      )
    ]

    #relance[
      Si la classe bloque, revenir a une question concrete: "est-ce que la
      fraction $1 / n$ peut devenir negative ? peut-elle devenir nulle ?"
    ]

    #vigilance[
      Ne pas laisser croire que la suite atteint sa limite. Insister sur
      "se rapproche de" plutot que "devient egal a".
    ]

    #ressource(
      "Image d'appui",
      "assets/limite-schema.svg",
      note: "Schema local stocke avec la sequence.",
    )

    #image-ressource(
      "/Cours/Sequences/3M/assets/limite-schema.svg",
      caption: [Schema reutilisable pour l'introduction.],
    )

    #bilan[
      Apres la seance: noter ici ce qui a fonctionne, les formulations a garder,
      les erreurs recurrentes et les exercices a deplacer l'annee suivante.
    ]
  ] <s-lim-intro>

  #seance(
    "Formaliser une limite finie",
    duree: "45 min",
    intention: "Passer de l'intuition a une definition utilisable.",
    objectifs: [
      - Utiliser correctement la notation $lim_(n -> oo) u_n = l$.
      - Reconnaitre graphiquement une limite finie.
      - Produire une justification courte sur un exemple simple.
    ],
  )[
    #prof[
      Faire reformuler la seance precedente. Ecrire la notation seulement apres
      deux exemples oraux, puis demander aux eleves ce que chaque symbole encode.
    ]

    #eleves[
      On ecrit $lim_(n -> oo) u_n = l$ pour dire que les termes de la suite
      $u_n$ se rapprochent de $l$ quand $n$ devient tres grand.

      #exercices(columns: 2, label: "a)")[
        + $u_n = 3 + 2 / n$
        + $v_n = -1 + 5 / n$
        + $w_n = 4 - 1 / n$
        + $t_n = 2 + 1 / (n + 1)$
      ]
    ]

    #relance[
      Demander: "quelle partie de l'expression disparait quand $n$ grandit ?"
    ]

    #remarque[
      Prevoir une trace courte: une phrase, une notation, deux exemples.
    ]

    #bilan[
      A completer apres usage en classe.
    ]
  ] <s-lim-formaliser>
]
