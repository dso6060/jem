# Judiciary Entity Map (India) - JEM — Master Build & Deployment Checklist
# Generated: April 25 2026
# Last full repo audit: **May 19 2026** (see PROGRESS & REPO AUDIT below)
# Current build: **494 entities**, **499 relationships**, **~1.87 MB** `graph.json`
# ============================================================
# HOW TO USE THIS FILE
# - Work top to bottom
# - Check each box [x] as you complete it
# - Never edit `jem/data/derived/` manually; do not hand-edit `graph.json` — rebuild via scripts
# - After ANY data change: `validate.py` → `derive.py` → `build.py` → spot-check
# - NJDG snapshot merge: `jem/scripts/merge_njdg_snapshot.py` (see Part 3.5)
# ============================================================

---

## REPO AUDIT (May 19 2026)

| Metric | Value |
|--------|--------|
| Entity YAML files | 494 |
| Relationship files | 11 packs (~499 edges in `graph.json`) |
| `graph.json` size | ~1.87 MB |
| `validate.py` | **0 errors** (505 files checked) |
| Entities with `case_volume` in YAML | 186 |
| Entities tagged `NJDG snapshot case_volume merged` | 139 |
| State packs (entity YAML count) | MH 51 · DL 22 · KA 43 · TN 49 · PY 6 |
| TN district lattice | 38 per-district courts + `tn_district_courts_generic` (collapse proxy) |
| NJDG snapshot source | `/Users/user/Documents/jem_add1405/graph.json` (216 entities with `_detail.case_volume`) |
| Merge plan | [`jem/docs/NJDG_MERGE_PLAN.md`](jem/docs/NJDG_MERGE_PLAN.md) — 139 mergeable rows applied |

**Recent commits (main):** IIAC rename + state commissions; NJDG bulk merge; TN generic lattice; CVC consolidation; ERC enrichment (DERC/KERC/MERC).

**Not in repo / optional cleanup:** `.patch-extract/` (patch source bundles only — not runtime data).

---

## PROGRESS & STATUS (May 19 2026)

**Living schedule:** [`jem/docs/GANTT_AND_V1_PLAN.md`](jem/docs/GANTT_AND_V1_PLAN.md) · **Restore procedure:** [`jem/docs/V1_DATA_RESTORE.md`](jem/docs/V1_DATA_RESTORE.md) · **v2 schema:** [`jem/docs/V2_DATA_MODEL.md`](jem/docs/V2_DATA_MODEL.md)

### Done (verified this audit)

- [x] **Full YAML corpus** under `jem/data/entities/` (hand-curated + `_generated/`) — `build.py` reproduces the large graph intentionally.
- [x] **Phase 1 state packs:** MH, DL, KA, TN (38-district lattice), PY — see Part 3.
- [x] **NJDG snapshot merge (state / HC / tribunal rollups):** `merge_njdg_snapshot.py --apply` — 139 entities; see Part 3.5.
- [x] **TN collapsed + expanded district model:** `tn_district_courts_generic` + per-district YAML; map uses `districtAggregates.js` (+/− on Madras HC).
- [x] **v2 partial (data + UI):** HC bench entities, `judge_strength` blocks, district lattice collapse, IIAC (ex-NDIAC), state SCDRC/NHRC, CVC consolidation.
- [x] **Toolchain:** `validate.py`, `derive.py`, `build.py`, `generate_v1_states_bundle.py`, `merge_njdg_snapshot.py`, `bootstrap_tn_district_lattice.py`.
- [x] **CI scaffold:** `.github/workflows/validate.yml`.
- [x] **Docs:** `DATA_MODEL.md`, `CONTRIBUTING.md`, `NJDG_MERGE_PLAN.md`, `V2_DATA_MODEL.md`.

### Parked (scheduled later — do not block v1.0.0 tag)

- [ ] **District-level NJDG exports** — per-district `pending_cases` / filed / disposed for TN (37/38 districts), MH/KA bootstrap districts (45 placeholders), and other states — see **Part 3.5 § PARKED**.
- [ ] **Live NJDG API** (`fetch_njdg.py`) — Part 4; static snapshot remains canonical until then.
- [ ] **Production deploy & GitHub remote QA** — Part 1.2–1.3 (operator tasks).

### Still outstanding (backlog)

- [ ] **Gap registry entities** — Part 5 (CESTAT benches, AFT benches, tax chain, etc.).
- [ ] **Remaining 22 states + UTs** — Part 5.6 community batches.
- [ ] **v2 Canvas / Sankey / journey mode** — Part 4 (renderer remains SVG for L1/L2).
- [ ] **`docs/CURSOR_PHASE1_BRIEF.md`**, **`docs/V2_SESSION_SPEC.md`** — not in tree; restore from canonical export if needed.

---

## PART 1 — DOWNLOAD & FIRST DEPLOY (do today, April 25)

### 1.1 Download from Claude

Download this repository (or the packaged output that contains the layout below).
It contains everything. Structure (this repository):

  <repo root>/
  ├── .github/workflows/validate.yml    ← CI config
  ├── README.md
  ├── MASTER_CHECKLIST.md
  ├── entity_schema.yaml
  ├── graph.json
  └── jem/                                ← app + data + scripts
      ├── README.md
      ├── .gitignore
      ├── data/
      │   ├── schema/                       ← entity_schema.yaml, relationship_schema.yaml
      │   ├── entities/                     ← all entity YAML files
      │   ├── relationships/                ← all relationship YAML files
      │   └── derived/                      ← auto-generated, do not edit
      ├── docs/
      │   ├── DATA_MODEL.md
      │   ├── CONTRIBUTING.md
      │   ├── CURSOR_PHASE1_BRIEF.md        ← Cursor task brief for MH/DL/KA
      │   └── V2_SESSION_SPEC.md            ← Paste into Claude on April 27
      ├── scripts/
      │   ├── validate.py
      │   ├── derive.py
      │   ├── build.py
      │   └── requirements.txt
      └── web/
          ├── index.html
          ├── public/graph.json             ← symlink → repo-root graph.json
          ├── src/                          ← main.js, state.js, renderer.js, panel.js, timeline.js
          └── styles/main.css

- [x] Repository present in workspace *(app in `jem/`, CI at repo root)*
- [ ] Unzip / confirm all 49 files present *(TBD: full inventory vs April 25 spec — partial tree possible)*

---

### 1.2 Deploy v1 to production (friedso.com)

The `jem/web/` tree is static (HTML/CSS/JS + `public/` assets). `graph.json` is loaded from the repo-root file via `jem/web/public/graph.json` symlink — no app server beyond your normal static hosting (match your existing friedso.com site layout).

```bash
# From repo root — adjust user and remote path to your friedso.com host (same pattern as your other apps):
rsync -avz --delete jem/web/ you@friedso.com:~/path/to/site/apps/jem/

# Confirm public URL loads, e.g. https://friedso.com/apps/jem/ (exact URL depends on your vhost / path)
```

- [ ] rsync `jem/web/` to friedso.com deploy target
- [ ] Open public URL — confirm it loads
- [ ] Confirm search works (type "Supreme Court")
- [ ] Confirm appellate chain arcs visible by default
- [ ] Confirm L0 cluster view shows 14 cluster rectangles
- [ ] Confirm L3 panel opens on entity click
- [ ] Confirm timeline scroller drag works
- [ ] Confirm impact bar shows 5 Not_Constituted, 98 gap entities

---

### 1.3 Push to GitHub

```bash
cd jem
git init
git remote add origin https://github.com/YOUR-ORG/jem.git
git add .
git commit -m "feat: v1 complete — 147 entities, 163 relationships, TN+PY sample"
git push -u origin main
```

- [ ] Create GitHub repo (public, CC0 data / MIT code)
- [ ] Push full repo
- [ ] Confirm GitHub Actions validate.yml runs on push
- [ ] Confirm Actions pass (0 errors)
- [ ] Add topics: india, judiciary, open-data, d3js, legal-tech
- [ ] Add description: "Open-source structural map of the Indian judicial ecosystem"

---

## PART 2 — CURSOR SETUP (from April 28)

### 2.1 Open project in Cursor

```bash
# In Cursor terminal:
cd jem
pip install -r scripts/requirements.txt
python scripts/validate.py     # should show: 0 errors, 0 warnings
python scripts/build.py        # should show: 147 entities, 818 KB
```

- [x] Open jem/ as Cursor project
- [x] Run validate.py — confirm clean *(May 19 2026: 0 errors, 494 entity files)*
- [ ] Read docs/CURSOR_PHASE1_BRIEF.md fully before starting *(file not in `jem/docs/` — restore from canonical export if needed)*
- [x] Read docs/DATA_MODEL.md sections on structural_gap and case_volume *(also `V2_DATA_MODEL.md` for judge_strength / HC benches)*

### 2.2 Cursor workflow (repeat for every data session)

Every session, in this exact order:
```bash
1. python scripts/validate.py --strict   # before starting
2. [make YAML changes]
3. python scripts/validate.py --strict   # after changes — fix all errors
4. python scripts/derive.py              # recompute scores + gaps
5. python scripts/build.py              # recompile graph.json
6. python scripts/derive.py --clog-report   # spot-check
7. git add . && git commit -m "data(STATE): description"
8. rsync -avz --delete web/ you@friedso.com:~/path/to/site/apps/jem/    # deploy (from `jem/`; adjust remote path)
```

- [ ] Bookmark this workflow — run it in full every session

---

## PART 3 — V1 COMPLETION: 4 STATES + 1 UT

### STATUS (May 19 2026): **MH, DL, KA, TN, PY complete** in `jem/data/entities/_generated/states/{mh,dl,ka,tn,py}/` with relationship packs. TN uses full 38-district lattice + `tn_district_courts_generic`. Rebuild: `python3 jem/scripts/build.py` → ~494 entities.

---

### 3.1 Maharashtra (MH) — ~51 entity YAML files ✅

**Paths:** `jem/data/entities/_generated/states/mh/*.yaml` · `jem/data/relationships/mh_relationships.yaml`

#### 3.1.1 State-level regulators
- [x] `merc` — enriched; NJDG `case_volume` merged
- [x] `mh_rera`
- [x] `mh_bar_council`

#### 3.1.2 Oversight / training / ADR
- [x] `mh_lokayukta`
- [x] `mh_sja`
- [x] `mh_slsa` — NJDG merged

#### 3.1.3 Prosecution
- [x] `mh_advocate_general`

#### 3.1.4 Consumer
- [x] `mh_state_cdrc`
- [x] `mh_cdrc_mumbai` · `mh_cdrc_pune` · `mh_cdrc_nagpur` · `mh_cdrc_aurangabad`

#### 3.1.5 City civil courts
- [x] `city_civil_court_mumbai` — NJDG rollup merged *(verify ~900k pending against Bombay HC annual report)*

#### 3.1.6 District courts
- [x] Priority 10 named districts (mumbai_city, thane, pune, nashik, aurangabad, nagpur, solapur, kolhapur, nanded, amravati)
- [x] `mh_district_courts_generic` — collapsed-lattice proxy + NJDG state rollup
- [x] **+26 bootstrap districts** (`mh_district_court_jalgaon`, …) — structural YAML + HC edges; **per-district NJDG parked** (Part 3.5)

#### 3.1.7 Special courts
- [x] `mh_special_courts`

#### 3.1.8 MH relationships
- [x] Appellate / supervisory / ADR edges in `mh_relationships.yaml`

#### 3.1.9 MH clog data (NJDG snapshot Dec 2024)
- [x] State rollup + named courts merged via `merge_njdg_snapshot.py`
- [ ] **Per-district dashboard pull** for 26 bootstrap districts — **PARKED** (Part 3.5)

- [x] MH validate + derive + build passes 0 errors
- [x] Committed on main
- [ ] rsync `jem/web/` to friedso.com

---

### 3.2 Delhi (DL) — ~22 entity YAML files ✅

**Paths:** `jem/data/entities/_generated/states/dl/*.yaml` · `jem/data/relationships/dl_relationships.yaml`

#### 3.2.1 Delhi-specific constitutional entity
- [x] `dl_lieutenant_governor` — NJDG merged; gap notes for LG/MHA tension remain valid

#### 3.2.2 Regulators
- [x] `derc` — enriched statutory detail + `case_volume` (verify vs DERC annual reports)
- [x] `dl_rera`

#### 3.2.3 Oversight / training / ADR
- [x] `dl_lokayukta` · `dl_sja` · `dl_slsa`

#### 3.2.4 Prosecution
- [x] `dl_advocate_general`

#### 3.2.5 Consumer
- [x] `dl_state_cdrc` + zone forums (`dl_cdrc_north`, `south`, `east`, `west`, `central`, `northwest`)

#### 3.2.6 District courts
- [x] Six named complexes (saket, tis_hazari, rohini, patiala_house, dwarka, karkardooma) — NJDG merged
- [x] `dl_district_courts_generic` — collapsed proxy + NJDG rollup

#### 3.2.7 Special courts
- [x] `dl_special_courts`

#### 3.2.8 DL relationships
- [x] `dl_relationships.yaml` (appellate, supervisory, ADR)

- [x] DL validate + derive + build passes 0 errors
- [x] Committed on main
- [ ] rsync `jem/web/` to friedso.com

---

### 3.3 Karnataka (KA) — ~43 entity YAML files ✅

**Paths:** `jem/data/entities/_generated/states/ka/*.yaml` · `jem/data/relationships/ka_relationships.yaml`

#### 3.3.1–3.3.8 (summary)
- [x] `kerc` (enriched) · `ka_rera` · `ka_lokayukta` · `ka_sja` · `ka_slsa` · `ka_advocate_general`
- [x] `ka_state_cdrc` · `ka_cdrc_bengaluru` · `city_civil_court_bangalore` (NJDG merged)
- [x] Priority 10 districts + `ka_district_courts_generic`
- [x] **+19 bootstrap districts** — structural only; **per-district NJDG parked** (Part 3.5)
- [x] `ka_special_courts` · `ka_relationships.yaml`

- [x] KA validate + derive + build passes 0 errors
- [x] Committed on main
- [ ] rsync `jem/web/` to friedso.com

---

### 3.3a Tamil Nadu (TN) + Puducherry (PY) — ✅

**TN paths:** `jem/data/entities/_generated/states/tn/` (49 YAML) · `jem/data/relationships/tn_relationships.yaml`

- [x] Full **38-district lattice** (`tn_district_court_*`) with bench-aware appellate edges (Madras / Madurai)
- [x] **`tn_district_courts_generic`** — consolidated collapsed view (3.2M pending state rollup from NJDG)
- [x] Map collapse/expand via `jem/web/src/districtAggregates.js` + `PRINCIPAL_HC_BY_STATE_CODE.tn`
- [x] TN regulators, SLSA, SJA, CDRC, RERA, special courts — NJDG merged where in snapshot
- [ ] **37/38 districts** without per-district `pending_cases` in YAML — **PARKED** (only Chennai + generic in Dec 2024 snapshot)

**PY:** `jem/data/entities/_generated/states/py/` (6 entities) · `py_relationships.yaml` — ✅ in graph

---

### 3.4 V1 Completion Checklist

- [x] Run full validate: `python3 jem/scripts/validate.py` — **0 errors** (May 19 2026)
- [x] Run full build: `python3 jem/scripts/build.py` — **494 entities**, **~1.87 MB** `graph.json`
- [x] State packs MH, DL, KA, TN, PY in repo and graph
- [x] NJDG snapshot merge applied (139 entities) — Part 3.5
- [ ] Deploy: `rsync -avz --delete jem/web/ you@friedso.com:~/path/to/site/apps/jem/`
- [ ] Open live site — confirm state filter + TN district collapse/expand on Madras HC
- [ ] Tag GitHub release: `git tag v1.0.0 && git push --tags` *(after deploy QA)*

---

## PART 3.5 — NJDG DATA (snapshot merge + parked district work)

### 3.5.1 Snapshot merge — ✅ DONE (May 19 2026)

| Item | Status |
|------|--------|
| Source snapshot | `/Users/user/Documents/jem_add1405/graph.json` (216 entities with `_detail.case_volume`) |
| Tool | `jem/scripts/merge_njdg_snapshot.py` |
| Plan | [`jem/docs/NJDG_MERGE_PLAN.md`](jem/docs/NJDG_MERGE_PLAN.md) — **139** mergeable rows applied |
| Re-apply after YAML changes | `python3 jem/scripts/merge_njdg_snapshot.py --snapshot /Users/user/Documents/jem_add1405/graph.json --apply` |
| Rebuild graph | `python3 jem/scripts/build.py` |
| ID remaps in script | `mh_district_court_mumbai` → `mh_district_court_mumbai_city`; `hc_guwahati` → `hc_gauhati` |

**Merged coverage:** all 24 mergeable HCs, DL/MH/KA/TN/PY state entities in plan, backbone tribunals/regulators, hand-curated SC/CBI/ACI/eCommittee, etc.

### 3.5.2 PARKED — District-level NJDG exports ⏸️

> **Do not start until scheduled.** State/HC rollup merge is complete; this tranche is per-district dashboard pulls.

| Scope | Count | Current data | When un-parked |
|-------|-------|----------------|----------------|
| **TN per-district courts** | 38 nodes | 1 with `pending_cases` (Chennai); 37 placeholders | New NJDG district export or TN e-Courts district dashboard scrape |
| **TN collapsed generic** | 1 | ✅ `tn_district_courts_generic` (state rollup) | Refresh when new state snapshot available |
| **MH bootstrap districts** | 26 | `avg_disposal_days` placeholder only | Per-district NJDG for each `mh_district_court_*` slug |
| **KA bootstrap districts** | 19 | same | same |
| **Other states (v1 bundle)** | varies | principal + `*_district_courts_generic` often have rollup only | Phase 2 / community passes |

**Acceptance criteria (when un-parked):**

- [ ] Each targeted `*_district_court_*` YAML has `case_volume.pending_cases`, `filed_last_year`, `disposed_last_year` (or explicit null + `data_quality_notes`)
- [ ] `data_quality_notes` cites NJDG district URL and `data_as_of`
- [ ] Re-run `merge_njdg_snapshot.py --apply` **only if** new snapshot includes per-district `_detail.case_volume`
- [ ] `validate.py` → `build.py` → spot-check expanded TN lattice on map

**Tracking command (audit):**

```bash
python3 -c "
import yaml
from pathlib import Path
tn = Path('jem/data/entities/_generated/states/tn')
dist = list(tn.glob('tn_district_court_*.yaml'))
with_p = sum(1 for f in dist if (yaml.safe_load(f.read_text()).get('case_volume') or {}).get('pending_cases'))
print(f'TN districts with pending_cases: {with_p}/{len(dist)}')
"
```

---

## PART 4 — V2 BUILD (April 27 Claude session)

**Status (May 19 2026):** **Partial.** Data model + map UX advances below; full Canvas/Sankey/journey spec still outstanding.

**Done in repo (v2 partial):**

- [x] `jem/docs/V2_DATA_MODEL.md` — HC benches, `judge_strength`, district lattice
- [x] HC bench YAML under `jem/data/entities/_generated/high_courts/benches/`
- [x] `jem/web/src/districtAggregates.js` — collapse/expand per state; TN generic proxy
- [x] `jem/web/src/nodeShapes.js` — crescent bench shapes
- [x] `generate_v1_states_bundle.py`, `hc_benches_config.py`, `bootstrap_tn_district_lattice.py`
- [x] NJDG **static** snapshot merge (not live API) — Part 3.5

### 4.1 Preparation (do before next v2 session)

- [ ] Read docs/V2_SESSION_SPEC.md fully *(restore to `jem/docs/` if missing)*
- [ ] Open fresh Claude session for remaining v2 items
- [ ] Do NOT mix research/essay writing in build sessions

### 4.2 V2 feature checklist

#### Priority 1 — Canvas renderer
- [ ] `web/src/renderer.js` rewritten — L1/L2 on Canvas, L0 stays SVG *(still SVG — acceptable at ~500 entities)*
- [ ] D3 quadtree hit detection implemented
- [ ] Canvas arrowheads implemented
- [ ] Gap asterisk `*` renders on Canvas
- [ ] Circularity icon `⟳` renders on Canvas
- [ ] IR heat ring renders on Canvas
- [ ] Role layer rectangles render on Canvas
- [ ] Performance test: smooth pan/zoom at 142 entities
- [ ] Performance test: smooth at 500 entities (test with duplicated data if needed)

#### Priority 2 — NJDG live fetch
- [x] **Static snapshot path** — `merge_njdg_snapshot.py` + `jem_add1405/graph.json` *(May 2026)*
- [ ] **District-level exports** — **PARKED** (Part 3.5.2)
- [ ] `scripts/fetch_njdg.py` created (live API)
- [ ] Rate limiting (1 req / 2 seconds) implemented
- [ ] Cache layer (`data/cache/njdg/`) implemented
- [ ] Test: fetch live data for hc_delhi, hc_madras — confirm fields update
- [ ] build.py `--live` flag added
- [ ] Staleness indicator in graph.json meta
- [ ] `⚠ Data may be stale` UI indicator when snapshot > 90 days old

#### Priority 3 — Major litigant nodes
- [ ] entity_schema.yaml: `MajorLitigant` type, `diamond` node_shape, `litigant_tier` field
- [ ] relationship_schema.yaml: `FrequentLitigantIn` type, `major_litigant` category
- [ ] New entities: `union_of_india`, `state_govt_tn`, `state_govt_mh`, `state_govt_dl`, `state_govt_ka`, `state_govt_generic`
- [ ] Diamond rendering on Canvas
- [ ] Major Litigants lens toggle (gold, off by default)
- [ ] FrequentLitigantIn relationships from DoJ Annual Report data

#### Priority 4 — Case flow Sankey
- [ ] `web/src/sankey.js` created
- [ ] build.py: `sankey_data` object added to graph.json
- [ ] Slide-up Sankey panel in index.html
- [ ] Case Flow button in toolbar
- [ ] Sankey nodes: District → HC → SC (+ major tribunal tiers)
- [ ] Arc widths proportional to case volume

#### Priority 5 — Appointment delay pipeline
- [ ] derive.py: `appointment_health_score` formula implemented
- [ ] schema: `avg_days_vacancy_unfilled`, `vacancy_data_as_of` fields added
- [ ] data/derived/appointment_health.yaml output
- [ ] Appointment Health overlay toggle in renderer
- [ ] HC vacancy duration data from DoJ quarterly report populated for 5 HCs

#### Priority 6 — Litigant journey mode
- [ ] `web/src/journey.js` created
- [ ] Journey mode UI scaffold — breadcrumb trail, dimming, path highlight
- [ ] Journey button in toolbar
- [ ] `filing_cost_range`, `appeal_cost_range` added to schema (empty — community task)
- [ ] avg_disposal_days used as wait time proxy

#### V2 validation & deploy
- [ ] `python scripts/validate.py --strict` — 0 errors
- [ ] `python scripts/build.py`
- [ ] Graph.json size check: target <1.5 MB
- [ ] Canvas performance: open devtools, confirm <16ms render at current entity count
- [ ] Sankey displays correctly
- [ ] Journey mode breadcrumb works for District → HC → SC path
- [ ] `rsync -avz --delete jem/web/ you@friedso.com:~/path/to/site/apps/jem/`
- [ ] Tag: `git tag v2.0.0 && git push --tags`

---

## PART 5 — GAPS REGISTRY: ALL MISSING ENTITIES

Complete task list drawn from README.md Gap Registry Section B.
Each item: entity_id to create, source URL, which Cursor session.

### 5.1 Tax / Revenue tribunal stack (high priority)

- [ ] `cestat_chennai` — CESTAT Chennai bench (covers TN, KA, KE, PY, AP, TS, AN)
  Source: cestat.gov.in/bench-detail/chennai
- [ ] `cestat_mumbai` — covers MH, GA
- [ ] `cestat_kolkata`
- [ ] `cestat_bangalore`
- [ ] `cestat_ahmedabad` — covers GJ, RJ
- [ ] `cestat_hyderabad` — covers TS, AP
- [ ] `cestat_allahabad` — covers UP, UK
- [ ] `cestat_chandigarh` — covers PB, HR, HP, JK, LA, CH
- [ ] `gstat_bench_generic` — 31 planned benches, Not_Constituted, state variations
- [ ] `aar_income_tax` — Authority for Advance Rulings (IT)
  Source: cbic.gov.in | Gap: delays, backlog
- [ ] `caar_customs` — Customs Authority for Advance Rulings (reconstituted 2021)
  Source: cbic.gov.in/caar

**Tax adjudication chain (pre-ITAT):**
- [ ] `cit_appeals_generic` — Commissioner of Income Tax (Appeals). Pre-ITAT appellate body.
  This is the highest-volume judicial body in India that nobody talks about.
  ~500,000 pending appeals. Gap: No NJDG, no public data, CBDT-controlled.
- [ ] `ao_income_tax_generic` — Assessing Officer (Income Tax). Source of all ITAT chain.

**State sales tax / VAT:**
- [ ] `state_vat_tribunal_generic` — generic, ~28 states
  Gap: Pre-GST legacy cases still pending. No national data. NJDG not integrated.

### 5.2 Labour / Employment (medium priority)

- [ ] `cgit_delhi` — CGIT Delhi bench (principal + largest)
- [ ] `cgit_mumbai` — CGIT Mumbai bench
- [ ] `cgit_kolkata`
- [ ] `epfo` — Employees' Provident Fund Organisation (quasi-judicial enforcement)
  Source: epfindia.gov.in | Gap: EPFAT one-member crisis
- [ ] `esi_court_generic` — Employees' State Insurance Court (state-level, ~150 courts)
  Source: esic.gov.in | Statutory basis: ESI Act 1948, Section 75
- [ ] `state_labour_court_generic` — state labour courts (distinct from SIT)
  ~200 bodies nationally. Industrial Disputes Act Section 7.

### 5.3 Defence (medium priority)

- [ ] `aft_chandigarh` — covers PB, HR, HP, JK, LA
- [ ] `aft_lucknow` — covers UP, UK
- [ ] `aft_kolkata` — covers WB, BR, JH, OD, NE states
- [ ] `aft_guwahati` — covers NE states
- [ ] `aft_chennai` — covers TN, KE, PY, AP, TS
- [ ] `aft_kochi` — covers KE, Lakshadweep
- [ ] `aft_jaipur` — covers RJ, GJ
- [ ] `aft_mumbai` — covers MH, GA
- [ ] `aft_hyderabad` — covers TS, AP
- [ ] `court_martial_generic` — Army/Navy/Air Force court martial (generic)
  Source: Army Act 1950, Navy Act 1957, Air Force Act 1950
  Gap: No external appeal until AFT. Accused has no right to civilian counsel in summary CM.

### 5.4 Specialised regulators (medium priority)

- [ ] `pfrda` — Pension Fund Regulatory and Development Authority
  Source: pfrda.org.in | Statutory: PFRDA Act 2013
- [ ] `fssai` — Food Safety and Standards Authority of India
  Source: fssai.gov.in | Quasi-judicial functions, appellate → HC
- [ ] `aera` — Airport Economic Regulatory Authority
  Source: aera.gov.in | Appellate → TDSAT (confirmed by SC)
- [ ] `icadr` — International Centre for ADR, Delhi
  Source: icadr.in | GoI-funded, domestic + international arbitration
- [ ] `press_council_india` — Press Council of India
  Source: presscouncil.nic.in | Quasi-judicial media complaints, no enforcement
- [ ] `state_election_commission_generic` — 28 state SECs
  Source: varies by state | Distinct from ECI. Electoral dispute adjudication.
- [ ] `insurance_appellate_generic` — IRDAI Insurance Appellate
  Source: irdai.gov.in | Appeals from Insurance Ombudsman above Rs 50L

### 5.5 Intellectual Property (lower priority)

- [ ] `ipab_abolished` — IPAB (IP Appellate Board) — Abolished 2021
  Type: CentralTribunal, operational_status: Abolished, abolished_year: 2021
  Gap: Abolition without adequate transition — HC hearing IP appeals without specialist benches
  Source: The Tribunal Reforms Act 2021
- [ ] `patent_controller` — Office of the Controller General of Patents, Designs and Trade Marks
  Source: ipindia.gov.in | Pre-grant/post-grant opposition (adjudicatory functions)
  Gap: Backlog in post-grant opposition proceedings
- [ ] `trade_marks_registry` — Trade Marks Registry (adjudicatory on opposition, cancellation)

### 5.6 State-level — remaining 22 states + 5 UTs (community / Phase 2)

Priority order based on case volume and structural significance:

**Batch A — Community (high volume states):**
- [ ] Uttar Pradesh (UP) — 21M+ pending district courts, Board of Revenue 800K+
- [ ] Andhra Pradesh (AP)
- [ ] Telangana (TS)
- [ ] Rajasthan (RJ)
- [ ] Madhya Pradesh (MP)
- [ ] Bihar (BR) — Patna HC 47% vacancy documented

**Batch B — Community (medium volume):**
- [ ] West Bengal (WB)
- [ ] Gujarat (GJ)
- [ ] Odisha (OD)
- [ ] Kerala (KL)
- [ ] Punjab (PB)
- [ ] Haryana (HR)

**Batch C — Community (smaller states):**
- [ ] Jharkhand (JH)
- [ ] Chhattisgarh (CG)
- [ ] Assam (AS)
- [ ] Himachal Pradesh (HP)
- [ ] Uttarakhand (UK)

**Batch D — Community (NE states + small UTs):**
- [ ] Manipur, Meghalaya, Tripura, Nagaland, Mizoram, Arunachal Pradesh, Sikkim
- [ ] Goa (GA)
- [ ] UTs: CH (Chandigarh), AN (A&N Islands), DN (D&NH), DD (Daman & Diu), LD (Lakshadweep)
- [ ] Jammu & Kashmir (JK) + Ladakh (LA) — post-2019 reorganisation entities

**For each state, entities to create (same template as MH/DL/KA):**
- [ ] `{state}_state_erc` or reference serc_generic with state_data variation
- [ ] `{state}_rera` or reference rera_generic with state_data variation
- [ ] `{state}_bar_council`
- [ ] `{state}_sja`
- [ ] `{state}_slsa`
- [ ] `{state}_lokayukta` (or Not_Constituted gap if applicable)
- [ ] `{state}_advocate_general`
- [ ] `{state}_state_cdrc`
- [ ] `{state}_district_courts_generic`
- [ ] 5-10 individual high-volume district court entries
- [ ] `{state}_special_courts`
- [ ] Board of Revenue variation in board_of_revenue_generic.state_data
- [ ] State Industrial Tribunal variation in state_industrial_tribunal_generic.state_data

### 5.7 Data quality upgrades (ongoing)

These entities are in the repo but at partial/unverified quality. Any contributor can upgrade:

- [ ] **District-level NJDG pendency** — **PARKED** (Part 3.5.2); do not duplicate state rollup into every district YAML
- [ ] All 10 northeast HCs: upgrade from `unverified` to `partial`
  Task: verify sanctioned/working strength from HC websites or DoJ data
- [ ] `state_bar_council_generic`: add enrollment count, working strength
- [ ] `district_cdrc_generic`: add per-district pendency from consumerhelpline.gov.in
- [ ] `rera_generic`: verify appellate tribunal operational status per state
- [ ] `serc_generic`: verify APTEL appeal statistics per SERC
- [ ] `gram_nyayalaya_generic`: update state-wise operational count (2025 data)
- [ ] All entities with `scores_validated: false`: domain reviewer to check derive.py output
  Command: `python3 jem/scripts/derive.py --explain {entity_id}` for each

---

## PART 6 — V3 PLANNING (post-V2, timing TBD)

Not a Cursor or Claude session task — plan only.

### 6.1 Performance infrastructure

- [ ] Chunk graph.json into cluster tiles (required at 1500+ entities)
  Plan: `graph_meta.json` (50KB, clusters + impact) + `graph_{cluster}.json` per cluster
  Loader: main.js fetches meta first, then fetches cluster chunks on zoom
- [ ] Service worker for offline caching of pre-built tiles
- [ ] CDN for graph.json delivery (CloudFlare free tier sufficient)

### 6.2 Data infrastructure

- [x] **One-time NJDG snapshot ingest** — `jem_add1405/graph.json` → entity YAML via `merge_njdg_snapshot.py` (May 2026)
- [ ] **District-level NJDG ingest pipeline** — **PARKED** until exports exist (Part 3.5.2)
- [ ] Scheduled NJDG fetch: cron on production host, weekly *(requires `fetch_njdg.py`)*
  `0 3 * * 0 cd /path/to/repo && python3 jem/scripts/fetch_njdg.py --all-hcs && python3 jem/scripts/derive.py && python3 jem/scripts/build.py && rsync …`
- [ ] Historical NJDG snapshots: store `data/cache/njdg/` in git-annex or S3
  (enables year-over-year clog trend in time scroller)
- [ ] Community contribution pipeline: GitHub Actions auto-builds on merge to main
  Requires: GitHub Actions deploy step (e.g. SSH/rsync to friedso.com) or webhook to your host

### 6.3 Remaining feature deferrals

- [ ] **Per-district NJDG metrics** — **PARKED** (Part 3.5.2)
- [ ] Year-over-year clog trend (needs 3+ NJDG snapshots)
- [ ] Time scroller annotation mode
- [ ] Funding flow Sankey (separate from case flow)
- [ ] AFT/CESTAT individual bench entities (9 + 8)
- [ ] State Board of Revenue individual entities (28)
- [ ] Full appointment delay pipeline (data from DoJ quarterly reports)
- [ ] COMPAT (abolished 2017) as historical entity
- [ ] IPAB (abolished 2021) as historical entity (after IPAB entity added in gap fill)
- [ ] Gram Nyayalaya per-state operational entities (Maharashtra ~450, others near zero)

### 6.4 Separate project candidates (from README)

These need their own repos. JEM's schema is a usable starting point.

- [ ] Revenue administration map (Patwari → Tehsildar → DM → Board of Revenue)
- [ ] Tax dispute chain map (AO → CIT(A) → ITAT → HC → SC)
- [ ] Military justice map (Summary CM → FGCM → AFT → SC)
- [ ] District Legal Services Authority map (650 DLSAs)
- [ ] State Vigilance / Anti-Corruption Bureau map

---

## PART 7 — MAINTENANCE SCHEDULE (recurring)

- [ ] Weekly: check NJDG for significant pendency changes (run fetch_njdg.py for HCs)
- [ ] Monthly: check DoJ quarterly vacancy report — update HC working_strength fields
- [ ] Quarterly: check SC Annual Report for SC pendency / disposal data
- [ ] Annually: update budget_figure_crore from Union Budget for ministry entities
- [ ] On SC judgment: add to amendment_history if structural change (e.g., new collegium ruling)
- [ ] On new legislation: add new entity or update operational_status (e.g., if GSTAT constituted)
- [ ] On HC appointment: update working_strength, rerun derive.py, check IR score change

---

## PART 8 — TOKEN BUDGET RULES

To keep Claude sessions available for research writing:

| Work type | Tool | Claude session needed? |
|---|---|---|
| YAML data entry (district courts, SERCs, RERAx34) | Cursor Pro | No |
| Running validate + derive + build | Cursor terminal | No |
| Schema changes (new fields, new enum values) | Claude | Yes — brief session |
| New derived metric formula design | Claude | Yes |
| Gap analysis + independence risk reasoning | Claude | Yes |
| Blog / essay / research paper writing | Claude | Yes — separate session, no code context |
| V2 build (Canvas, NJDG API, Sankey) | Claude | Yes — April 27 full day |
| Debugging validate.py errors in Cursor | Cursor AI | No |
| Adding amendment_history entries (BNS/BNSS) | Cursor | No — mechanical |
| Verifying data quality upgrades (partial → complete) | Cursor + primary sources | No |

Rule: If a task requires domain reasoning about Indian judicial structure or new code architecture, use Claude. If it requires writing more YAML from a known template, use Cursor.

---

## SUMMARY MILESTONES

| Milestone | Entities | graph.json | Date |
|---|---|---|---|
| V1 backbone | 147 | 818 KB | April 25 ✅ |
| V1 + TN + PY | ~157 | ~946 KB | May 2026 ✅ |
| V1 + MH + DL + KA + full corpus | **494** | **~1.87 MB** | **May 19 2026 ✅** |
| NJDG snapshot merge (rollup) | 494 | ~1.87 MB | May 19 2026 ✅ |
| TN generic + 38-district lattice | 494 | ~1.87 MB | May 19 2026 ✅ |
| **PARKED: district-level NJDG** | — | — | TBD |
| v1.0.0 tag + friedso deploy | 494 | ~1.87 MB | TBD |
| v2 complete (Canvas, live NJDG, Sankey) | ~500+ | ~2 MB | TBD |
| Gap fills (tax/labour/defence) | ~550 | ~2.2 MB | TBD |
| Phase 2 (remaining 22 states) | ~900 | ~4 MB | TBD |
| Phase 3 (district resolution) | ~1500+ | chunked | TBD |
