# Judiciary Entity Map (India) - JEM — Master Build & Deployment Checklist
# Generated: April 25 2026
# Status at generation: v1 complete, 147 entities, 163 relationships, 818 KB graph.json
# Last progress audit: May 11 2026 (see PROGRESS & TBD below)
# ============================================================
# HOW TO USE THIS FILE
# - Work top to bottom
# - Check each box [x] as you complete it
# - Never edit jem/data/derived/ manually; do not hand-edit jem/web/public/graph.json (symlink → repo-root graph.json — rebuild via scripts)
# - After ANY data change: validate → derive → build → spot-check
# ============================================================

---

## PROGRESS & TBD (May 11 2026)

**Living schedule (Threads 1–2):** [`jem/docs/GANTT_AND_V1_PLAN.md`](jem/docs/GANTT_AND_V1_PLAN.md) (day-by-day table + flowchart; v1.0.0 gates). **Restore procedure:** [`jem/docs/V1_DATA_RESTORE.md`](jem/docs/V1_DATA_RESTORE.md). **Safe staging build:** `jem/scripts/build_safe.sh` → writes `jem/build/graph.staging.json` only.

**Completed (verified in workspace or prior baseline)**

- V1 backbone narrative (header): original drop was complete at generation (147 entities, 163 relationships, 818 KB `graph.json`).
- **Canonical v1 viewer dataset (pre–May 11 local build):** `web/public/graph.json` symlinked to repo-root `graph.json` had ~157 entities, 163 relationships, ~946 KB, including TN + PY sample state entities (`tn_*`, `py_*` ids). *If you still have that file, keep it as the reference build.*
- **Toolchain:** `scripts/validate.py`, `derive.py`, `build.py`, `requirements.txt` present; `validate.py` runs clean on the current YAML set (0 errors).
- **CI scaffold:** `.github/workflows/validate.yml` present.
- **Docs in tree:** `docs/DATA_MODEL.md`, `docs/CONTRIBUTING.md` present.
- **Web app:** `web/` tree (`index.html`, `src/*.js`, `styles/main.css`) present; renderer is **SVG-based** (not the Part 4 Canvas rewrite).

**TBD / not verified here**

- **Restore full `graph.json` (urgent if overwritten):** `web/public/graph.json` → `../../../graph.json`. Running `build.py` while only a **small YAML subset** exists replaces the viewer graph with a tiny build (e.g. ~13 entities). **TBD:** copy back the full ~946 KB `graph.json` from backup, another machine, or the canonical jem export before trusting local spot-checks or deploy.
- **Full export inventory:** Checklist originally expected ~49 top-level deliverables; this tree may be a partial copy — reconcile file list when syncing from canonical source.
- **`docs/CURSOR_PHASE1_BRIEF.md`**, **`docs/V2_SESSION_SPEC.md`:** not present under `jem/docs/` in this workspace — restore from canonical export if needed.
- **Production deploy (friedso.com) & live QA (Part 1.2):** set README live URL to your public path; re-run rsync + on-site checks after each release.
- **Git remote & Actions (Part 1.3):** no `.git` in this workspace snapshot — confirm repo on GitHub and that `validate.yml` passes on push.
- **MH / DL / KA state packs (Part 3):** not present as dedicated state entity packs in the canonical graph baseline reviewed for this audit — still outstanding vs checklist.
- **V2 build (Part 4):** no `fetch_njdg.py`, `sankey.js`, Canvas L1/L2 renderer per spec — outstanding.
- **Gap registry entities (Part 5) onward:** unchanged vs checklist; treat as backlog until scheduled.
- **Authoring vs prebuilt graph:** only a small set of entity YAML files exists here. After full YAML is restored, `build.py` can reproduce the large graph; until then, **do not** run `build.py` for “verification” unless you intend to overwrite `graph.json` or pass `--output` to a scratch path.

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
- [x] Run validate.py — confirm clean *(May 11 2026: 0 errors on current YAML set; entity file count smaller than v1 full export)*
- [ ] Read docs/CURSOR_PHASE1_BRIEF.md fully before starting *(TBD: file not in `jem/docs/` — restore from canonical export)*
- [ ] Read docs/DATA_MODEL.md sections on structural_gap and case_volume *(doc present; mark when read)*

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

### STATUS: TN and PY already done in **canonical v1 graph** (restore full `graph.json` if local file was rebuilt from partial YAML). Remaining: MH, DL, KA.

---

### 3.1 Maharashtra (MH) — Cursor, ~140 entities

**New file:** `data/entities/subordinate_courts/mh_state_entities.yaml`
**New file:** `data/relationships/mh_relationships.yaml`

#### 3.1.1 State-level regulators
- [ ] `merc` — Maharashtra Electricity Regulatory Commission
  - Source: merc.gov.in | Appellate: APTEL | Gap: MSEDCL (state-owned) is primary regulated entity
- [ ] `mh_rera` — MahaRERA
  - Source: maharera.maharashtra.gov.in | Gap: jurisdictional overlap with MH Housing Board
- [ ] `mh_bar_council` — Bar Council of Maharashtra and Goa
  - Note: covers Goa also (Bombay HC jurisdiction)

#### 3.1.2 Oversight / training / ADR
- [ ] `mh_lokayukta` — established 1971, oldest active Lokayukta in India
  - Source: lokayukta.maharashtra.gov.in | Note: document appointment delays post-2019
- [ ] `mh_sja` — Maharashtra State Judicial Academy (Aurangabad)
- [ ] `mh_slsa` — Maharashtra State Legal Services Authority

#### 3.1.3 Prosecution
- [ ] `mh_advocate_general`

#### 3.1.4 Consumer
- [ ] `mh_state_cdrc`
- [ ] `mh_cdrc_mumbai` (Mumbai DCDRC — highest volume in state)
- [ ] `mh_cdrc_pune`
- [ ] `mh_cdrc_nagpur`
- [ ] `mh_cdrc_aurangabad`

#### 3.1.5 City civil courts
- [ ] `city_civil_court_mumbai`
  - CRITICAL: ~900,000 pending — largest civil court by volume in India
  - Gap: critical clog, infrastructure strain, commercial dispute surge
  - Source: Bombay HC Annual Report; NJDG

#### 3.1.6 District courts — individual entries (priority 10)
- [ ] `mh_district_court_mumbai_city`
- [ ] `mh_district_court_thane`
- [ ] `mh_district_court_pune`
- [ ] `mh_district_court_nashik`
- [ ] `mh_district_court_aurangabad`
- [ ] `mh_district_court_nagpur`
- [ ] `mh_district_court_solapur`
- [ ] `mh_district_court_kolhapur`
- [ ] `mh_district_court_nanded`
- [ ] `mh_district_court_amravati`
- [ ] `mh_district_courts_generic` — generic for remaining 26 districts

#### 3.1.7 Special courts
- [ ] `mh_special_courts` — PMLA, POCSO, NIA, SC/ST, CBI courts

#### 3.1.8 MH relationships
- [ ] Appellate: all MH district courts → hc_bombay
- [ ] Appellate: mh_state_cdrc → ncdrc
- [ ] Appellate: city_civil_court_mumbai → hc_bombay
- [ ] Appellate: merc → aptel
- [ ] Supervisory: hc_bombay → all MH district courts (Article 235)
- [ ] Funding: MH govt → merc, mh_rera, mh_slsa
- [ ] Training: mh_sja → mh district courts
- [ ] Circularity: merc appointer-litigant (state → MSEDCL)
- [ ] ADR: mh_slsa → lok_adalat_generic
- [ ] Tension: hc_bombay ↔ e-Committee (Bombay HC custom CMS already in repo)

#### 3.1.9 MH clog data to look up (NJDG)
- Mumbai City District: ~280,000 pending
- Thane: ~210,000 pending
- Pune: ~190,000 pending
- MH aggregate: ~6.2M pending district courts
- City Civil Court Mumbai: ~900,000 pending (separate from district)

- [ ] MH validate + derive + build passes 0 errors
- [ ] Commit: `data(MH): add Maharashtra state entities`
- [ ] rsync `jem/web/` to friedso.com

---

### 3.2 Delhi (DL) — Cursor, ~80 entities

**New file:** `data/entities/subordinate_courts/dl_state_entities.yaml`
**New file:** `data/relationships/dl_relationships.yaml`

#### 3.2.1 Delhi-specific constitutional entity
- [ ] `dl_lieutenant_governor` — LG Delhi (Article 239AA — different from state Governor)
  - Gap: LG vs elected govt tension — Govt of NCT v Union (2018, 2023 Constitution Bench)
  - Gap: Delhi Police under MHA, not state — distinct Security_Gap pattern from other HCs
  - Circularity: MHA controls Delhi Police which secures Delhi HC

#### 3.2.2 Regulators
- [ ] `derc` — Delhi Electricity Regulatory Commission
  - Source: derc.gov.in | Gap: DISCOMS are state-linked entities
- [ ] `dl_rera` — Delhi RERA
  - Source: rera.delhi.gov.in

#### 3.2.3 Oversight / training / ADR
- [ ] `dl_lokayukta` — active, frequently in news
  - Source: delhilokayukta.gov.in
  - Gap: UT status limits Lokayukta powers vs LG
- [ ] `dl_sja` — Delhi State Judicial Academy (Delhi Judicial Academy)
- [ ] `dl_slsa` — Delhi State Legal Services Authority (DSLSA)
  - Note: one of India's most active SLSAs by settlement count

#### 3.2.4 Prosecution
- [ ] `dl_advocate_general`
  - Note: complex status — Delhi is UT, AG appointment via LG not Governor

#### 3.2.5 Consumer
- [ ] `dl_state_cdrc`
- [ ] `dl_cdrc_north`
- [ ] `dl_cdrc_south`
- [ ] `dl_cdrc_east`
- [ ] `dl_cdrc_west`
- [ ] `dl_cdrc_central`
- [ ] `dl_cdrc_northwest`

#### 3.2.6 District courts (11 districts)
- [ ] `dl_district_court_saket` — ~280,000 pending, most active in Delhi
- [ ] `dl_district_court_tis_hazari`
  - Gap: Tis Hazari is largest court complex in Asia by area; 2019 police-lawyer violence;
  - chronic infrastructure issues worth a specific gap marker
- [ ] `dl_district_court_rohini`
- [ ] `dl_district_court_patiala_house`
- [ ] `dl_district_court_dwarka`
- [ ] `dl_district_court_karkardooma`
- [ ] `dl_district_courts_generic` — generic for remaining 5

#### 3.2.7 Special courts
- [ ] `dl_special_courts` — PMLA, POCSO, NIA, ACB courts
  - Note: Delhi has the highest density of special courts in India per capita

#### 3.2.8 DL relationships
- [ ] Appellate: all DL district courts → hc_delhi
- [ ] Appellate: dl_state_cdrc → ncdrc
- [ ] Appellate: derc → aptel
- [ ] Supervisory: hc_delhi → all DL district courts
- [ ] Tension: dl_lieutenant_governor ↔ elected government (AdministrativeTension)
- [ ] Security: MHA → CISF/Delhi Police → hc_delhi (security without obligation arc)
- [ ] Circularity: MHA controls Delhi Police, is also party before Delhi HC
- [ ] Training: dl_sja → DL district courts
- [ ] ADR: dl_slsa → lok_adalat_generic

- [ ] DL validate + derive + build passes 0 errors
- [ ] Commit: `data(DL): add Delhi state entities`
- [ ] rsync `jem/web/` to friedso.com

---

### 3.3 Karnataka (KA) — Cursor, ~120 entities

**New file:** `data/entities/subordinate_courts/ka_state_entities.yaml`
**New file:** `data/relationships/ka_relationships.yaml`

#### 3.3.1 Regulators
- [ ] `kerc` — Karnataka Electricity Regulatory Commission
  - Source: kerc.gov.in | Gap: BESCOM (state-owned) is primary regulated entity
- [ ] `ka_rera` — Karnataka RERA (K-RERA)
  - Source: rera.karnataka.gov.in | Status: Active, functional appellate tribunal

#### 3.3.2 Oversight / training / ADR
- [ ] `ka_lokayukta` — established 1984, historically India's most active
  - Source: lokayukta.karnataka.gov.in
  - Gap: 2023 amendment reduced independence — document as Independence_Gap
  - Source for gap: Rajamohan Reddy v State of Karnataka (2023)
- [ ] `ka_sja` — Karnataka State Judicial Academy
  - Note: runs one of India's most structured judicial training programs
- [ ] `ka_slsa` — Karnataka State Legal Services Authority

#### 3.3.3 Prosecution
- [ ] `ka_advocate_general`

#### 3.3.4 Consumer
- [ ] `ka_state_cdrc`
- [ ] `ka_cdrc_bengaluru`
- [ ] `ka_cdrc_mysuru`
- [ ] `ka_cdrc_hubballi`
- [ ] `ka_cdrc_mangaluru`

#### 3.3.5 City courts
- [ ] `city_civil_court_bangalore` — Bengaluru City Civil Court
  - ~500,000 pending — commercial tech-sector disputes driving surge
  - Source: Bangalore City Civil Court; NJDG

#### 3.3.6 District courts (31 districts — priority 10)
- [ ] `ka_district_court_bengaluru_urban`
- [ ] `ka_district_court_bengaluru_rural`
- [ ] `ka_district_court_mysuru`
- [ ] `ka_district_court_belagavi`
- [ ] `ka_district_court_kalaburagi`
- [ ] `ka_district_court_dharwad`
- [ ] `ka_district_court_tumkuru`
- [ ] `ka_district_court_shivamogga`
- [ ] `ka_district_court_mangaluru`
- [ ] `ka_district_court_ballari`
- [ ] `ka_district_courts_generic` — generic for remaining 21

#### 3.3.7 Special courts
- [ ] `ka_special_courts` — PMLA, POCSO, NIA, SC/ST, CBI courts

#### 3.3.8 KA relationships
- [ ] Appellate: all KA district courts → hc_karnataka
- [ ] Appellate: ka_state_cdrc → ncdrc
- [ ] Appellate: city_civil_court_bangalore → hc_karnataka
- [ ] Appellate: kerc → aptel
- [ ] Supervisory: hc_karnataka → all KA district courts
- [ ] Circularity: kerc appointer-litigant (state → BESCOM)
- [ ] Training: ka_sja → KA district courts
- [ ] ADR: ka_slsa → lok_adalat_generic
- [ ] Tension: ka_lokayukta independence reduced (PolicyConflict arc with state govt)

- [ ] KA validate + derive + build passes 0 errors
- [ ] Commit: `data(KA): add Karnataka state entities`
- [ ] rsync `jem/web/` to friedso.com

---

### 3.4 V1 Completion Checklist

After MH, DL, KA are committed:

- [ ] Run full validate: `python scripts/validate.py --strict` — 0 errors
- [ ] Run full build: `python scripts/build.py`
- [ ] Check entity count: should be ~390-420 entities
- [ ] Check graph.json: should be ~2.0-2.5 MB
- [ ] Check clog report: City Civil Court Mumbai and Tis Hazari should appear
- [ ] Deploy: `rsync -avz --delete jem/web/ you@friedso.com:~/path/to/site/apps/jem/` (from repo root; adjust path)
- [ ] Open live site — confirm state filter works for MH, DL, KA, TN, PY
- [ ] Confirm new gap markers visible (MH Lokayukta appointment delay, KA Lokayukta amendment)
- [ ] Tag GitHub release: `git tag v1.0.0 && git push --tags`

---

## PART 4 — V2 BUILD (April 27 Claude session)

**Status (May 11 2026):** Not started in this tree — renderer remains SVG; no NJDG fetch script, Sankey, or V2 session spec file in `docs/`.

### 4.1 Preparation (do before April 27)

- [ ] Read docs/V2_SESSION_SPEC.md fully
- [ ] Open fresh Claude session on April 27
- [ ] Paste entire contents of docs/V2_SESSION_SPEC.md as first message
- [ ] Say: "Execute v2 build per this spec. Start with Priority 1 (Canvas renderer)."
- [ ] Do NOT mix research/essay writing in this session — it is a full build day

### 4.2 V2 feature checklist (Claude builds these on April 27)

#### Priority 1 — Canvas renderer
- [ ] `web/src/renderer.js` rewritten — L1/L2 on Canvas, L0 stays SVG
- [ ] D3 quadtree hit detection implemented
- [ ] Canvas arrowheads implemented
- [ ] Gap asterisk `*` renders on Canvas
- [ ] Circularity icon `⟳` renders on Canvas
- [ ] IR heat ring renders on Canvas
- [ ] Role layer rectangles render on Canvas
- [ ] Performance test: smooth pan/zoom at 142 entities
- [ ] Performance test: smooth at 500 entities (test with duplicated data if needed)

#### Priority 2 — NJDG live fetch
- [ ] `scripts/fetch_njdg.py` created
- [ ] Rate limiting (1 req / 2 seconds) implemented
- [ ] Cache layer (data/cache/njdg/) implemented
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

- [ ] All 10 northeast HCs: upgrade from `unverified` to `partial`
  Task: verify sanctioned/working strength from HC websites or DoJ data
- [ ] `state_bar_council_generic`: add enrollment count, working strength
- [ ] `district_cdrc_generic`: add per-district pendency from consumerhelpline.gov.in
- [ ] `rera_generic`: verify appellate tribunal operational status per state
- [ ] `serc_generic`: verify APTEL appeal statistics per SERC
- [ ] `gram_nyayalaya_generic`: update state-wise operational count (2025 data)
- [ ] All entities with `scores_validated: false`: domain reviewer to check derive.py output
  Command: `python scripts/derive.py --explain {entity_id}` for each

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

- [ ] Scheduled NJDG fetch: cron on your production or build host (e.g. friedso.com), weekly
  `0 3 * * 0 cd /path/to/repo/jem && python3 scripts/fetch_njdg.py --all-hcs && python3 scripts/derive.py && python3 scripts/build.py && rsync -avz --delete web/ you@friedso.com:~/path/to/site/apps/jem/`
- [ ] Historical NJDG snapshots: store data/cache/njdg/ in git-annex or S3
  (enables year-over-year clog trend in time scroller)
- [ ] Community contribution pipeline: GitHub Actions auto-builds on merge to main
  Requires: GitHub Actions deploy step (e.g. SSH/rsync to friedso.com) or webhook to your host

### 6.3 Remaining feature deferrals

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
| V1 backbone | 147 | 818 KB | April 25 (done) |
| V1 + TN + PY (reference viewer build) | ~157 | ~946 KB | May 11 2026 *(seen before partial-YAML `build.py` overwrite; restore file if needed)* |
| V1 + MH | ~195 | ~1.1 MB | April 28-30 |
| V1 + MH + DL | ~240 | ~1.3 MB | April 30-May 2 |
| V1 + MH + DL + KA | ~335 | ~1.7 MB | May 2-5 |
| V2 complete | ~335 | ~1.5 MB (canvas, no size change) | April 27 |
| Gap fills (tax/labour/defence) | ~370 | ~1.9 MB | May-June |
| Phase 2 (remaining 22 states) | ~900 | ~4 MB | June-August |
| Phase 3 (district resolution) | ~1500+ | ~8 MB (chunked) | August onward |
