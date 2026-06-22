// Template de cours reutilisable pour Typst for Obsidian.
// Import:
//   #import "../../_template/cours-eg.typ": *
// Usage:
//   #show: cours.with(titre: "Suites", niveau: "3M", mode: "prof")

#import "@preview/beautitled:0.2.6": beautitled-setup, beautitled-init
#import "@preview/beautiframe:0.1.0": beautiframe-setup, definition, example
#import "@preview/taskize:0.2.0": tasks, tasks-setup
#import "@preview/simple-plot:0.1.0": plot-fn

#let _accent = rgb("#2f6f9f")
#let _accent-dark = rgb("#1f4c6d")
#let _muted = luma(42%)
#let _soft-blue = rgb("#edf6fb")
#let _soft-amber = rgb("#fff5df")
#let _soft-green = rgb("#eef8ef")
#let _soft-red = rgb("#fff0f0")

#let cours-mode = state("cours-mode", "prof")
#let cours-theme = state("cours-theme", "light")
#let cours-break-after-seance = state("cours-break-after-seance", true)

#let _is-prof() = context cours-mode.get() == "prof"

#let _palette(theme) = {
  if theme == "dark" {
    (
      text: rgb("#d9e2ec"),
      background: rgb("#111418"),
      accent: rgb("#7db7df"),
      accent-dark: rgb("#9ccbea"),
      muted: rgb("#9aa8b5"),
      border: rgb("#3a4550"),
      soft-blue: rgb("#102534"),
      soft-amber: rgb("#332711"),
      soft-green: rgb("#142918"),
      soft-red: rgb("#35191c"),
      soft-neutral: rgb("#1d2228"),
    )
  } else if theme == "obsidian" {
    (
      text: rgb("%TEXTCOLOR%"),
      background: rgb("%BGCOLOR%"),
      accent: rgb("%ACCENTCOLOR%"),
      accent-dark: rgb("%HEADINGCOLOR-1%"),
      muted: rgb("%MUTEDCOLOR%"),
      border: rgb("%BORDERCOLOR%"),
      soft-blue: rgb("%BGCOLOR-SECONDARY%"),
      soft-amber: rgb("%BGCOLOR-SECONDARY%"),
      soft-green: rgb("%BGCOLOR-SECONDARY%"),
      soft-red: rgb("%BGCOLOR-SECONDARY%"),
      soft-neutral: rgb("%BGCOLOR-ALT%"),
    )
  } else {
    (
      text: black,
      background: white,
      accent: _accent,
      accent-dark: _accent-dark,
      muted: _muted,
      border: luma(82%),
      soft-blue: _soft-blue,
      soft-amber: _soft-amber,
      soft-green: _soft-green,
      soft-red: _soft-red,
      soft-neutral: luma(96%),
    )
  }
}

#let _callout(title, fill-color, stroke-color, body) = {
  block(
    width: 100%,
    inset: (x: 0.85em, y: 0.65em),
    radius: 4pt,
    fill: fill-color,
    stroke: stroke-color + 0.8pt,
    breakable: true,
  )[
    #text(weight: "bold", fill: stroke-color)[#title]
    #v(0.35em)
    #body
  ]
}

#let cours(
  titre: "Cours",
  niveau: "",
  annee: "",
  mode: "prof",
  theme: "light",
  title-style: "notes",
  frame-style: "boxed",
  break-after-seance: true,
  auteur: none,
  body,
) = {
  cours-mode.update(mode)
  cours-theme.update(theme)
  cours-break-after-seance.update(break-after-seance)
  let colors = _palette(theme)

  set page(
    width: 17cm,
    height: auto,
    margin: (x: 1cm, y: 0.85cm),
    fill: colors.background,
  )
  set text(font: "New Computer Modern", size: 10.5pt, lang: "fr", fill: colors.text)
  set par(justify: true, leading: 0.55em)
  set list(indent: 1.1em, body-indent: 0.35em)
  set enum(indent: 1.1em, body-indent: 0.35em)

  beautitled-setup(
    style: title-style,
    primary-color: colors.accent-dark,
    secondary-color: colors.muted,
    accent-color: colors.accent,
    background-color: colors.background,
    chapter-prefix: "Sequence",
    section-prefix: "Seance",
    show-chapter-number: false,
    show-section-number: false,
    chapter-pagebreak: false,
    chapter-size: 18pt,
    section-size: 13pt,
  )

  beautiframe-setup(
    style: frame-style,
    color-mode: "color",
    definition-label: "Objectifs",
    example-label: "Activite",
    remark-label: "Remarque",
    primary-color: colors.text,
    secondary-color: colors.muted,
    background-color: colors.background,
    accent-color: colors.accent,
    definition-color: colors.accent,
    example-color: rgb("#397e48"),
    remark-color: colors.muted,
  )

  tasks-setup(columns: 2, label-format: "1)", column-gutter: 1.2em)

  show: beautitled-init

  align(center)[
    #text(size: 20pt, weight: "bold", fill: colors.accent-dark)[#titre]
    #if niveau != "" [#linebreak()#text(size: 11pt, fill: colors.muted)[#niveau]]
    #if annee != "" [#text(size: 11pt, fill: colors.muted)[ #sym.dot.op #annee]]
    #if auteur != none [#linebreak()#text(size: 9pt, fill: colors.muted)[#auteur]]
  ]
  v(0.8em)
  line(length: 100%, stroke: colors.accent + 0.7pt)
  v(0.8em)

  body
}

#let pagebreak-after-seance() = context if cours-break-after-seance.get() {
  pagebreak()
}

#let _title(level, body, style: "notes") = context {
  let colors = _palette(cours-theme.get())
  let size = if level == 1 { 18pt } else { 13pt }
  let below = if level == 1 { 0.9em } else { 0.55em }
  if style == "boxed" or style == "structured" {
    block(width: 100%, inset: (x: 0.7em, y: 0.45em), fill: colors.soft-neutral, stroke: colors.accent + 0.8pt, radius: 3pt)[
      #text(size: size, weight: "bold", fill: colors.accent-dark)[#body]
    ]
  } else if style == "clean" {
    text(size: size, weight: "bold", fill: colors.accent-dark)[#body]
  } else {
    text(size: size, weight: "bold", fill: colors.accent-dark)[#body]
    v(-0.15em)
    line(length: if level == 1 { 100% } else { 2.3cm }, stroke: colors.accent + 0.55pt)
  }
  v(below)
}

#let sequence(titre, code: none, body) = {
  let label = if code == none { titre } else { code + " - " + titre }
  heading(level: 1)[#label]
  body
}

#let sommaire-seances(items) = {
  context {
    let colors = _palette(cours-theme.get())
    block(
      width: 100%,
      inset: (x: 0.75em, y: 0.6em),
      fill: colors.soft-neutral,
      stroke: colors.border + 0.5pt,
      radius: 3pt,
    )[
      #text(weight: "bold")[Sommaire des seances]
      #v(0.35em)
      #for item in items {
        let target = item.at(0)
        let title = item.at(1)
        let details = if item.len() > 2 { item.at(2) } else { none }
        [- #link(target)[#title]#if details != none [ #text(fill: colors.muted)[-- #details]]]
      }
    ]
  }
}

#let seance(titre, duree: none, intention: none, objectifs: none, body) = {
  heading(level: 2)[#titre]
  if duree != none or intention != none {
    context {
      let colors = _palette(cours-theme.get())
      block(
        width: 100%,
        inset: (x: 0.75em, y: 0.45em),
        fill: colors.soft-neutral,
        stroke: colors.border + 0.5pt,
        radius: 3pt,
      )[
        #if duree != none [#text(weight: "bold")[Duree :] #duree]
        #if duree != none and intention != none [#h(1em)]
        #if intention != none [#text(weight: "bold")[Intention :] #intention]
      ]
      v(0.5em)
    }
  }
  context if objectifs == none and cours-mode.get() == "prof" {
    let colors = _palette(cours-theme.get())
    _callout(
      "Objectifs a definir",
      colors.soft-red,
      rgb("#a43f3f"),
      [Ajouter les objectifs essentiels de cette seance dans `objectifs: [...]`.],
    )
    v(0.5em)
  } else if objectifs != none {
    definition(number: none)[#objectifs]
  }
  body
  pagebreak-after-seance()
}

#let objectifs(body) = definition(number: none)[#body]
#let activite(title: none, body) = example(name: title, number: none)[#body]
#let remarque(body) = context if cours-mode.get() == "prof" {
  let colors = _palette(cours-theme.get())
  _callout("Remarque prof", colors.soft-amber, rgb("#d08a00"), body)
}
#let prof(body) = context if cours-mode.get() == "prof" {
  let colors = _palette(cours-theme.get())
  _callout("Script / gestes prof", colors.soft-blue, colors.accent, body)
}
#let relance(body) = context if cours-mode.get() == "prof" {
  let colors = _palette(cours-theme.get())
  _callout("Relance possible", colors.soft-green, rgb("#4f9b5f"), body)
}
#let vigilance(body) = context if cours-mode.get() == "prof" {
  let colors = _palette(cours-theme.get())
  _callout("Point de vigilance", colors.soft-red, rgb("#d05a5a"), body)
}
#let bilan(body) = context if cours-mode.get() == "prof" {
  let colors = _palette(cours-theme.get())
  _callout("Bilan apres seance", colors.soft-neutral, colors.muted, body)
}
#let eleves(body) = body

#let exercices(columns: 2, label: "1)", body) = tasks(columns: columns, label: label, body)

#let ressource(titre, cible, note: none) = {
  context {
    let colors = _palette(cours-theme.get())
    block(
      width: 100%,
      inset: (x: 0.7em, y: 0.45em),
      fill: colors.soft-neutral,
      stroke: colors.border + 0.5pt,
      radius: 3pt,
    )[
      #text(weight: "bold")[Ressource :] #link(cible)[#titre]
      #if note != none [#linebreak()#text(size: 9pt, fill: colors.muted)[#note]]
    ]
  }
}

#let image-ressource(path, caption: none, width: 80%) = {
  figure(image(path, width: width), caption: caption)
}

#let graphe-rationnel(
  fn,
  xmin: -5,
  xmax: 5,
  ymin: -5,
  ymax: 5,
  width: 7,
  height: 5,
  vertical-asymptotes: (),
) = {
  plot-fn(
    fn,
    domain: (xmin, xmax),
    ymin: ymin,
    ymax: ymax,
    width: width,
    height: height,
    show-grid: true,
  )
}
