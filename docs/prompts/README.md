# Prompt engineering workflow (for agent sessions on this repo)

Goal: every future session starts from a short brief, reads a fixed set of files, and ends with a verifiable result — fewer tokens, fewer re-explorations.

## 1. Session start (agent)
1. Read `AGENTS.md` (commands, map, invariants). Read `docs/ARCHITECTURE.md` only if the task touches sim/render/data.
2. Read the task brief below. If a field is missing, ask **one** batched question, not several.
3. Locate code with `grep -n`; read only the symbol ranges you change.
4. Run the relevant gate (typecheck, `test:sim`, build) before reporting done.

## 2. Task brief template (copy, fill, keep under ~25 lines)
```
TASK BRIEF v1
Goal:        <one sentence, user-visible outcome>
Scope files: <explicit list, e.g. src/sim/engine.ts, scripts/generate-voxel-bot.mjs>
Out of scope:<what must NOT change, e.g. "no new dependencies", "keep schema v2 rows">
Behaviour:   <bullet list, numbers in seconds/metres/percent — no adjectives like "nicer">
Assets:      <new props/clips with name, tris/duration, footprint — or "none">
Acceptance:  - npx tsc --noEmit -p .  → 0 errors
             - npm run test:sim       → PASS
             - npm run build          → dist/index.html produced
Report:      <what to state, e.g. "list files changed; say 'not visually verified'">
```
Precision rules (from the prompt standards): define every quantity; state the output format; name the success check; never write "make it better".

## 3. Session end (agent)
- Update `docs/prompts/README.md` changelog if a prompt/brief/budget changed.
- Update `AGENTS.md` "Current feature state" if behaviour changed.
- Commit to the working branch only.

## 4. Token-saving rules
- Prefer one scripted multi-edit (`python3`, assert `count == 1`) over many small tool calls.
- Don't `cat` large files; use `grep -n` + `read_file` ranges.
- Don't re-run `npm ci` if `node_modules/` exists; regenerate the GLB only via `npm run gen:bot`.
- Keep reports short: a file list, the gate results, and anything unverified.

## 5. Changelog (prompt / brief / budget versions)
| Version | Date | Change |
|---|---|---|
| brief v1 | 2026-11-22 | First brief template. Session-efficiency files added: `AGENTS.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/ART_BUDGET.md`, this file. |
| schema v2 | 2026-11-22 | Parking Lot + Sport Area areas, 6 new props, 7 new bot clips (11 total), `scripts/sim-smoke.mjs`. Budgets recorded in `docs/ART_BUDGET.md`. |
| budget v1 | 2026-11-22 | Bot ≤600 tris / ≤12 draws / ≤12 clips; props ≤120 pieces / ≤15 000 tris; bot GLB ≤150 KB. |
| schema v3 | 2026-11-22 | `bots.body` column (male / female); existing bots set to male. Migration `migrateBodies()`. |
| budget v2 | 2026-11-22 | Bot model: rounded-voxel "realistic cartoon" detail. Male 16 368 tris, female 21 384 tris (each ≤24 000); draws ≤14; GLB ≤1 MB each. Old ≤600 tris / ≤150 KB limits retired. Open conflict: female-heavy scenes exceed the 300 k on-screen triangle budget. |

## 6. Worked example (what v1 looked like in practice)
Brief: "Add Parking Lot and Sport Area; bots enter/exit four vehicle types; bots run in football and basketball areas."
Resolved into: 2 room types, 6 catalog entries (4 vehicles, 2 surfaces), 7 GLB clips (Run, KickRun, DribbleRun, Enter/Exit Car, Enter/Exit Bike), 2 idle activity families (sport 10 %, commute 6 %), 1 migration, 1 headless test.
