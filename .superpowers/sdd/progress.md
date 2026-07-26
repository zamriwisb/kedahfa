# Kedah FA website — SDD progress

Plan: docs/superpowers/plans/2026-07-26-kedahfa-website.md
Branch: feat/club-website
Pre-flight: fixed two plan self-inconsistencies (src/lib purity constraint vs
content.ts; @plugin placement in global.css) in commit below.

## Minor findings deferred to final review
- validate.test.ts: assertUniqueSquadNumbers tests only use ADJACENT duplicate
  numbers, so an adjacent-only implementation would pass. Origin: the plan's
  test fixture, not the implementer. Add a non-adjacent duplicate case.
- HeroPanel.astro hardcodes /images/news/placeholder.svg for every hero. The
  Match model has no image field, so a real match photo cannot be sourced.
  Needs a schema field + wiring before real content lands. Origin: the plan.
- index.astro hides the Partners section entirely when sponsors is empty,
  rather than rendering empty-state copy like the other four sections.
  Inconsistent with the stated constraint. Origin: the plan.

## Tasks
Task 1: complete (commits 293d828..3c1224d, review clean — reviewer mutation-tested TZ handling)
Task 2: complete (commit 39fb5cd) — content.config.ts + placeholder data for
club/season/teams/fixtures/standings/squad/sponsors/news. Step 11 negative
test confirmed Astro's top-level Zod .refine() fires on build (exact
expected error message observed); no fallback to src/lib/validate.ts needed.
Task 2: code complete (commits 3c1224d..13785c9)
  Review found CRITICAL: Astro reference() does not check existence.
  RESOLVED by relocation, not by dismissal:
    - plan/spec corrected; Task 2 owns shape validation only
    - Task 5 MUST implement assertReferencesResolve + wire into loadSiteData
    - Task 5 Step 9 verifies a dangling team ref fails the build
  If Task 5 ships without assertReferencesResolve, this gap is live.
Task 3: complete (commits e7a50df..3e545f6, review clean — 3 mutations caught)
Task 4: complete (commits 3e545f6..65614b8, review clean after 2 fixes)
  - implementer had excluded tests/ from tsconfig to dodge a type error;
    reverted, root cause fixed (Partial<Match> & {date:string} -> never)
  - review found groupByMonth UTC test asserted heading only, not key;
    strengthened + selectHero boundary tests added, both mutation-verified
Task 5: complete (commits 50828a9..6f6369b, review clean)
  assertReferencesResolve wired for fixture home/away/report + standings team.
  NOTE: Steps 7 & 9 negative build tests did NOT fail, because no page calls
  loadSiteData() yet. MUST be re-run at end of Task 8 as its verification.
Task 6: complete (commits 5d63fca..856905b, review clean after 1 fix)
  MILESTONE: negative tests now BITE. Duplicate squad number -> exit 1;
  dangling team ref -> exit 1. Task 2's Critical finding verified closed.
  Also fixed latent Task 5 bug (PUBLIC_DIR via import.meta.url broke once
  Astro bundled the module) and Tailwind scanning docs/ (26KB -> 13.7KB CSS).
Task 7: complete (commits f91b68c..4bc3d37, review clean after 1 fix — WCAG 1.4.1 colour-only club row + no-JS countdown state)
Task 8: complete (commits a18b6fe..e8110f5, review clean, 2 minor deferred)
Task 9: complete (commits e6f8bb7..2ceb36f, review clean — pagination proven at scale with 13 articles)
Task 10: complete (commits df8a00b..914ee29, review clean)
Task 11: complete (commits 2051b22..1362dae, review clean)
Task 12: complete (commits 945727c..8a6d704, review clean, 1 minor)
  MINOR: site domain duplicated in astro.config.mjs and public/robots.txt;
  can drift. FOLDED INTO TASK 14 as a robots.txt endpoint using Astro.site.
Task 13: complete (commits 98802bc..a1d91f4, review clean after 1 fix)
  E2E suite found 2 real site defects from earlier tasks, both fixed:
   - 6 index routes had NO h1 (SectionHeading hardcoded h2) -> level prop
   - axe scrollable-region-focusable (WCAG 2.1.1) on standings scroll wrapper
  Final: 59 e2e passed / 0 failed / 1 intentional skip; 76 unit tests.
Task 14: complete (commits 105e5e6..0274f1a, review clean after 1 fix — CI artifact upload was a silent no-op)

## FINAL WHOLE-BRANCH REVIEW (opus) — blocked merge, 2 CRITICAL
  C1: fixture date accepted with no +08:00 offset -> under UTC rendered 04:45
      instead of 20:45, wrong day. Exactly the spec's headline timezone risk.
      FIXED 5087893 (custom YAML parser + regex-guarded schema).
  C2: Astro's file() loader dedupes by id BEFORE getCollection, so
      assertUniqueIds could never throw — dead code reading as coverage.
      Duplicate id dropped JDT from 1st/29pts to 6th/4pts, build exit 0.
      FIXED c8667b5 (raw-YAML dup detection); assertUniqueIds removed.
  Plus 3dbbcd4 build-level negative tests (the spec's least-delivered item).
  I3 badge contrast 3.09/3.10:1 -> 5.93/6.71/5.46:1  FIXED 4dacdab
  I4 past scheduled match vanished from site -> Awaiting Result  FIXED de7e2e5
  I5 countdown maths duplicated in island -> imports tested fn  FIXED 2f4313d
  Verified by me: both criticals now exit 1. 89 unit + 59 e2e green.
  RE-REVIEW round 2 found round 1 INCOMPLETE:
   - dup-id check covered 5 of 7 files; club.yaml + season.yaml uncovered
     (duplicate id rendered "WRONG CLUB NAME" sitewide, exit 0)
   - offset guard was fixtures-only; news/squad/season dates same hazard
   - TDZ ReferenceError in countdown island (clearInterval before init)
  FIXED fc3e26a (list now DERIVED from readdirSync src/data), 4439984, 05e889f
  Verified by me: all 3 now exit 1. 90 unit + 59 e2e green, tree clean.
  ROUND 3 review found 2 more of the same class:
   - news ids from glob() collide via github-slugger ("Kedah Edge Selangor.md"
     vs "kedah-edge-selangor.md") -> silent overwrite, exit 0, unstable winner
   - dateOnly guard checked the COERCED Date, so under TZ=UTC (i.e. CI)
     "11/03/1995" passed and rendered "3 November 1995"
  FIXED 96979d2 (id collision, uses Astro's own github-slugger),
        61ea4a1 (validate raw input pre-coercion; all 8 schemas .strict())
  Verified by me: both now exit 1. 94 unit + 59 e2e green, tree clean.

# Hero slider — SDD progress
Plan: docs/superpowers/plans/2026-07-26-hero-slider.md
Branch: feat/slask-inspired-redesign  Base: 02deec9
Task 1: complete (commit 794912a, review clean — no findings)
Task 2: complete (commit 2339d3b, review clean — approved)
  Deviation from plan, reviewer-confirmed correct: only the FIRST slide's title
  renders <h1> (rest <h2>). Deleting HeroPanel left the homepage with no h1 and
  broke the pre-existing navigation.spec.ts one-h1-per-route check.
  MINOR deferred: HeroSlider dot .map((slide, index)) never uses `slide` ->
  astro check emits 1 hint. Folded into Task 3 dispatch (same file).
  MINOR deferred: rgb(255 255 255 / 45%) dash colour is a raw literal outside
  tokens.css; matches existing global.css idiom, candidate for a token later.
Task 3: complete (commits 2339d3b..77f3912, review clean after 1 fix round)
  Two Important findings, BOTH plan-mandated, escalated to owner, both fixed:
   - wheel listener stopped autoplay on ANY wheel -> vertical page scroll over
     the hero killed autoplay for most desktop visitors. Now horizontal only.
   - "autoplay stops on interaction" e2e could not tell stop() from pause()
     (mouse rested on the dash, pointerleave never fired). Now moves mouse off.
  Controller verified full suite after fix round: 95 unit, 73 e2e, 1 pre-existing skip.
  MINOR deferred: no test for the wheel horizontal-vs-vertical distinction itself.
  MINOR deferred: no coverage of prefers-reduced-motion or single-slide paths.
Task 4: complete (commit 503daec, README slides section verified by controller)

## FINAL WHOLE-BRANCH REVIEW (opus) — "merge with fixes", 5 Important, 0 Critical
  Owner approved 4 of 5; all applied in 5e1c130, re-reviewed (opus) -> Ready: Yes.
  I1 scrim calibrated for the flat dark placeholder; over a real daytime photo
     the headline measured ~3.2:1. axe CANNOT see it (resolves background from
     the section background-color, never the image). Now flat /40 + /80 ramp.
  I2 homepage h1 was whichever promo sorted first, and [] slides left / with no
     h1 while the build still passed. Now sr-only h1 in index.astro, slides h2.
  I3 href schema rejected external ticketing links (BUILD FAILURE for editors)
     while letting //evil.com and /\evil.com through. Now relative-or-https,
     both bypasses closed + build-negative case.
  I4 WCAG 2.2.2: no discoverable pause control. Added pause/play toggle, hidden
     until the script actually starts autoplay so it never lies (no-JS, reduced
     motion). Spec had never mentioned 2.2.2 — plan-level omission.
  I5 /news/* slide hrefs get no referential validation -> DEFERRED by owner.
  Re-review minor fixed by controller in cb20236: pause toggle was inside the
  group labelled "Choose a slide".
  Open minors: tab/newline href bypass ("/<TAB>/evil.com"); rel="noopener" is
  inert without target=_blank; no test for reduced-motion / single-slide /
  wheel-direction paths; README doesn't say the flat layer darkens the WHOLE
  frame 40%; Number(dot.dataset.slideTo) unguarded -> NaN if attribute dropped.

# A1 Semi-Pro league teams — SDD progress
Plan: docs/superpowers/plans/2026-07-26-a1-league-teams.md
Spec: docs/superpowers/specs/2026-07-26-a1-league-teams-design.md
Branch: feat/a1-league-teams  Base: e9025e0
Pre-flight: plan already corrected twice during authoring — fixtures.yaml needs
an explicit [] (comments-only parses to null, which parseFixturesYaml and
assertNoDuplicateIds both reject), and build-negative cases must swap that []
marker rather than append after it (invalid YAML).
OWNER-APPROVED, not implementer drift: Task 2 deletes two e2e cases (kickoff
time, match report link) because no fixture exists to assert against. Owner
chose this explicitly over seeding invented fixtures. If a reviewer flags the
coverage loss, it is adjudicated, not a defect.
Task 1: complete (commit e9025e0..b5e36ae, spec ✅, quality approved)
  Data swap + 11 monogram crests + tests/unit/league-data.test.ts + the 4
  build-negative cases decoupled from demo matches. 105 unit tests, build exit 0.
  IMPLEMENTER DEVIATION, accepted by controller: added fileParallelism:false to
  vitest.config.ts (not in brief). The race is real and pre-existing —
  build-negative.test.ts mutates src/data/*.yaml in place for the duration of a
  real astro build, and league-data.test.ts reads those files off disk. Fix is
  well-commented and costs nothing today (build-negative already dominates
  wall-time). MINOR deferred to final review: it serializes ALL test files
  forever for a two-file conflict. Narrower fix = have withMutatedFile build
  against a temp copy instead of the real working tree, or split
  build-negative into its own serialized vitest project.
  MINOR deferred: 3 of league-data.test.ts's 9 cases (shortName length, crest
  exists, id===team) duplicate checks the build already fails on. Cheap and
  harmless; the other 6 cover genuinely uncovered invariants.
Task 2: complete (commits b5e36ae..557c23d, spec ✅, quality approved after 1 fix round)
  3 e2e cases rewritten to pre-season assertions, 2 deleted (owner-approved).
  Reviewer verified the rewrites bite: rowheader vs columnheader roles are
  distinct so getByRole('rowheader') is exactly 12, and the non-compact table's
  last cell genuinely is points.
  FIX 557c23d: reviewer caught an overstated claim in the Task 2 commit message
  — deleting the report-link case left ZERO coverage of /news/[slug]; the
  news-filter case only counts cards on the listing. New case clicks through
  [data-category] a to an article and asserts the h1 renders. Deliberate-failure
  check confirmed it bites. Re-review: approved, no findings.
  ENVIRONMENT NOTE: the Task 2 implementer ran `npx astro dev stop` to kill a
  stray dev server on 4321 that was making Playwright reuse it (Astro Dev
  Toolbar injects its own "Menu" button -> 11 spurious navigation.spec failures).
  If the owner had that server running deliberately, it needs restarting.
