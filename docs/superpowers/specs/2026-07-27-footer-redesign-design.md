# Footer redesign and Font Awesome social icons

Date: 2026-07-27

## Goal

Rebuild `SiteFooter.astro` to the three-band layout in the supplied reference
(partner logos, link columns, crest + social row + copyright), and replace the
hand-drawn social SVG paths with Font Awesome artwork.

## Decisions

### Font Awesome is a build-time icon source, not a webfont

`@fortawesome/free-brands-svg-icons` ships each icon as a definition object
whose `icon` tuple is `[width, height, ligatures, unicode, pathData]`. Importing
named exports lets Vite tree-shake to the six icons the site actually uses, so
the page carries those paths and nothing else — no webfont, no extra preload in
`BaseLayout.astro`, no third-party request. The alternative, the
`@fortawesome/fontawesome-free` CSS + woff2 bundle, would add a fourth
self-hosted font file (~100 KB) to render six glyphs.

`src/lib/social.ts` owns the platform → icon map and exports `socialIcon()`.
`src/components/SocialIcon.astro` renders it.

### An unknown platform fails the build

The old header mapped platform names to paths and fell back to a generic globe
glyph when the name was unrecognised, so a typo in `club.yaml` shipped a
meaningless circle. `socialIcon()` throws instead, naming the supported
platforms. This matches how the rest of the project treats bad content —
`assertReferencesResolve` and `assertPublicAssetsExist` both fail the build
rather than degrade — and the failure is loud at author time, not silent at
read time.

### Three bands

| Band     | Surface               | Content                                      |
| -------- | --------------------- | -------------------------------------------- |
| Partners | `--color-surface`     | Sponsor rows grouped by tier, hairline-ruled  |
| Links    | `--color-brand-deep`  | Three centred columns, yellow display headings |
| Base     | `--color-brand-ink`   | Crest, circular social row, copyright         |

The partner band is white rather than a fourth green. The sections above the
footer are already green, and a green band here made the bottom of the page
read as one undifferentiated block. White also keeps the brand yellow spent
only on the column headings — a yellow band directly above yellow headings
would have echoed the accent twice.

Columns:

- **Sport** — News, Squad, Fixtures, Standings
- **Our Club** — Club, Contact
- **Info** — Privacy Policy, Terms & Conditions

The contact block (three emails and a phone number) comes out. Those details
are on `/contact`, which the Our Club column links.

### Sponsor logos render as black silhouettes

`filter: brightness(0)`. One uniform treatment across sponsors who will supply
wildly different artwork. The direction is bound to the band's surface — on a
dark band it would need `invert(1)` after it to come out white instead. The
cost is real: a sponsor's brand colours are discarded. Accepted, because the
alternative is per-logo mono variants that the club would have to supply and
keep in sync.

`placeholder.svg` was rewritten with a transparent background. Its original
opaque background rect covered the whole viewBox, and the filter flattened that
to a solid block. Real sponsor artwork must arrive transparent for the same
reason.

### Tier labels go visually hidden, not away

The reference shows unlabelled rows separated by hairlines, which is tier
grouping without the captions. Keeping the captions as `sr-only` headings
matches the reference visually while leaving the grouping announced to screen
readers.

`SponsorGrid` stays a component but is now footer-only, restyled for a dark
surface. The standalone sponsor sections in `index.astro` and `club.astro` are
removed — the band is sitewide, so leaving them would render sponsors twice on
those two pages.

### Consequence worth recording

The partner band now appears on every page, including `/404`.

## New pages

`/privacy` and `/terms`, placeholder copy, carrying the same
"unverified, confirm before launch" note that `club.yaml` uses. Both are added
to the route lists in `tests/e2e/accessibility.spec.ts` and
`tests/e2e/layout.spec.ts`.

## Verification

- `tests/unit/social.test.ts` — every platform in `club.yaml` resolves; an
  unknown platform throws with the supported list in the message.
- `tests/e2e/footer.spec.ts` — the footer renders on every route, each social
  link has an accessible name, and the two new pages are reachable from it.
- Existing axe sweep covers contrast on the new surfaces. The social circles'
  border must clear the 3:1 non-text contrast floor (WCAG 1.4.11) that commit
  `bec2eac` raised the carousel controls to meet.
