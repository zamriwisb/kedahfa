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
