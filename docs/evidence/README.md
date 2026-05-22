# Frontend evidence

| Artifact | Description |
|----------|-------------|
| [`../../artifacts/lighthouse-report.report.json`](../../artifacts/lighthouse-report.report.json) | Lighthouse **after** (full run, nginx) |
| [`../../artifacts/lighthouse-before.json`](../../artifacts/lighthouse-before.json) | Lighthouse **before** (curated; regenerate with `capture-lighthouse.sh`) |
| [`../../artifacts/lighthouse-report.report.html`](../../artifacts/lighthouse-report.report.html) | HTML report for screenshots |

Capture:

```bash
cd ../../bidmart-infrastructure
./scripts/capture-lighthouse.sh http://localhost:5173/ ../bidmart-frontend/artifacts lighthouse-before
```
