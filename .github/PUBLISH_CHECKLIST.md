# GitHub publish checklist

Run once when creating the public repository.

## 1. Create repository

- [ ] Create public repo (name TBD on call) under `@dso6060` or an org
- [ ] Push `main` with this `.github/` scaffolding
- [ ] Description: *Open structural map of India's judicial ecosystem — institutional capacity, relationships, and systemic gaps.*
- [ ] Topics: `india`, `judiciary`, `open-data`, `legal-tech`, `d3js`
- [ ] Licence: MIT (code) — note in README that `jem/data/` is CC0

## 2. Replace placeholders

Search repo for `REPO_NAME` and replace with actual repo name (e.g. `jem-india`):

- [ ] `.github/ISSUE_TEMPLATE/config.yml`
- [ ] `.github/ISSUE_TEMPLATE/data_correction.yml`
- [ ] `.github/ISSUE_TEMPLATE/contested_fact.yml`
- [ ] `.github/SUPPORT.md`

Search for `@[CO_MAINTAINER_GITHUB_USERNAME]`:

- [ ] `.github/CODEOWNERS` — uncomment co-maintainer lines
- [ ] `jem/docs/TEAM.md`

## 3. Repository settings

- [ ] **Settings → General → Features:** enable **Issues** and **Discussions**
- [ ] **Discussions → Categories:** ensure `Q&A` and `Disputes` (or map templates to existing categories)
- [ ] **Settings → Branches → `main`:** require PR, require status checks (`Validate JEM Data`), require CODEOWNERS review
- [ ] Invite co-maintainer as **Admin**; update CODEOWNERS

## 4. Labels (create if not auto-created)

| Label | Color suggestion | Use |
|-------|------------------|-----|
| `data` | green | Data corrections |
| `community` | blue | Community-submitted |
| `needs-source` | yellow | Source requests |
| `contested` | orange | Conflicting sources |
| `expert-review` | purple | Think-tank / legal review |
| `triage` | gray | Needs maintainer routing |
| `bug` | red | Bugs |

## 5. Verify CI

- [ ] Open a test PR touching `jem/data/` — workflow `Validate JEM Data` passes
- [ ] Confirm `validate_graph_refs.py` runs in CI

## 6. Announce

- [ ] Link live demo: https://friedso.com/apps/jem/
- [ ] Point contributors to `jem/docs/CONTRIBUTING.md` and data-correction template
