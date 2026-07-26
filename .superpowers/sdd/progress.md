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
