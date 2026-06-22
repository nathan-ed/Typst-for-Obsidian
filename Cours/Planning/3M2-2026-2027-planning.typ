#import "../_template/cours-eg.typ": *

#show: cours.with(
  titre: "3M2 - Planning manuel",
  niveau: "3M2",
  annee: "2026-2027",
  mode: "prof",
  break-after-seance: false,
)

= Principe

Ce fichier reste volontairement manuel. Les sequences reutilisables ne portent
pas de dates. Ici, on note seulement ou l'on en est dans l'annee.

#activite(title: "Planning")[
  #exercices(columns: 1, label: "none")[
    + Semaine 1 : installation, diagnostic, organisation.
    + Semaine 2 : #link("../Sequences/3M/3M2-suites-limites.typ")[Suites et limites], seance 1.
    + Semaine 3 : #link("../Sequences/3M/3M2-suites-limites.typ")[Suites et limites], seance 2.
    + Semaine suivante : a completer.
  ]
]

#bilan[
  Ce planning sert a savoir ce qui a ete fait. Les contenus restent dans les
  fichiers de sequence pour pouvoir etre repris l'annee suivante.
]
