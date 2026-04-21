# Synthesis Hallucination Baseline — Experiment v1.4

Measures the base hallucination rate of Fase B synthesis posts before implementing the full CEP architecture.

Spec: `experiments/experimiento-spec.md` v1.4.

## Prerequisites

Set these env vars in `../../.env.local`:

```
ANTHROPIC_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
REPOS_ROOT=/Users/Lilicurl/Documents/git   # optional; defaults to ~/Documents/git
```

Edit `config/authors.json` to declare which authors to include/exclude.

**No writes to Supabase production.** All Supabase queries are SELECT-only.
**No git fetch.** Local repo state is the baseline; manifest records HEAD sha per repo.

## Execution order

```bash
npm install
npm run preflight           # verify credentials, local repos, author emails
npm run resample            # populate commit_cache + simulated_signals from git local
npm run resample:stats      # sanity check distribution (does not write)
npm run select              # build organic + adversarial + control groups
npm run generate            # call Haiku (signal extract) + Sonnet (synthesis)
npm run prelabel            # pre-label claims with Haiku
npm run export              # write out/for-labeling/post-XXX.md for human review
```

After Liliana labels all markdown files:

```bash
npm run analyze             # parse labels → compute metrics → emit out/analysis-report.md
```

## Cost cap

Hard cap of $5 USD. Each script aborts if exceeded.

## Flags

`--dry-run` on any script: prints what it would do without calling APIs or writing DB.
`--stats` on `resample`: print signal distribution without persisting.

## Output

- `out/for-labeling/post-*.md` — one file per group, for human labeling
- `out/analysis-report.md` — metrics + SHIP / ANCHOR / REDESIGN recommendation
- `db/experiment.db` — all raw data (auditable)
