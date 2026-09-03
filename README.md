# IUBAT SGPA Calculator

A standalone, premium-styled semester GPA calculator built for IUBAT students.

## What's inside

```
iubat-sgpa/
├── index.html        Page structure — hero, calculator, grading scale, footer
├── css/style.css      All styling (design tokens, layout, responsive rules)
├── js/app.js          Calculator logic, validation, localStorage persistence
├── assets/logo.svg    Wordmark icon
├── assets/favicon.svg Browser tab icon
└── README.md
```

No build step and no dependencies beyond two CDN font families (Google Fonts)
and Font Awesome-free icon set (icons are inline SVG, no external icon font).
Everything else is plain HTML/CSS/JS.

## Running it

Just open `index.html` in a browser — or serve the folder with any static
file server, e.g.:

```
npx serve .
```

## How grades are calculated

**Theory course**
`Mid × 25% + Class Test × 10% + Quiz/Presentation (direct) + Final × 50%`

**1-credit lab course**
`Class Participation (direct) + Viva × 20% + Lab Test × 20% + Lab Report × 50%`

Each course total is mapped to a letter grade and grade point using the
scale shown on the page (A+ = 80+ → 4.00, down to F = below 40 → 0.00),
then weighted by credit hour to produce the overall SGPA.

## Downloadable reports

Below the summary, two buttons export a styled JPG snapshot (rendered via
[html2canvas](https://html2canvas.hertzen.com/), loaded from a CDN):

- **Result report** — course name, credit, and grade for every course,
  plus the overall SGPA.
- **Target report** — for each course, pick a target grade ("Aiming for")
  in its output panel. The report shows the marks still needed on the
  Final Exam (or Lab Report, for lab courses) to hit that target, using
  the marks already entered for the other components — plus the SGPA
  you'd land on if every target were met.

Both are generated entirely client-side and download straight to the
student's device.

## Notes

- Course entries — including each course's target grade — are saved to
  the browser's `localStorage` automatically, so a student's in-progress
  semester survives a page refresh. Nothing is sent to a server — this is
  a fully client-side tool.
- To rebrand: colors and type live at the top of `css/style.css` as CSS
  custom properties (`--ink`, `--gold`, `--paper`, etc.) and fonts are
  loaded from Google Fonts in `index.html`.
- Swap `assets/logo.svg` / `assets/favicon.svg` to change the mark.
