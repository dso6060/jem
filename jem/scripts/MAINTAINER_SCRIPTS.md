# Maintainer scripts (local only)

These shell helpers are **not** in the public GitHub repository. Keep copies on maintainer machines under `jem/scripts/`:

| Script | Purpose |
|--------|---------|
| `build_friedso_deploy_bundle.sh` | Validate, build `graph.json`, write `_deploy_bundle/jem-web-*` |
| `publish_github.sh` | Validate, stage, commit, optional push to `dso6060/jem_prototype` |

They are listed in `.gitignore`. If you clone from GitHub and need them, copy from another maintainer or restore from your local backup.

**Production bundle (local):**

```bash
./jem/scripts/build_friedso_deploy_bundle.sh
```

**Public GitHub:**

```bash
./jem/scripts/publish_github.sh -m "data(scope): …" --branch your/branch --push
```

Public repo workflow without these scripts: `deploy_prep.sh`, `safe_pipeline.sh`, and manual `git add` / `git commit` / `git push` per [`SESSION_WORKFLOW.md`](../docs/SESSION_WORKFLOW.md).
