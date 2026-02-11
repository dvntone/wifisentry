**Security & Secrets Guide**

- **Do not commit secrets.** Keep `.env` in `.gitignore` and use `.env.example` for placeholders.
- **Repository scanning:** A GitHub Action (`.github/workflows/secret-scan.yml`) runs `gitleaks` on pushes and PRs and will fail the check if secrets are detected.
- **Local scanning:** Enable the included hook with `git config core.hooksPath .githooks` and install `gitleaks` locally.
- **Add GitHub secrets:** Use the `gh` CLI or the repository Settings → Secrets to add required values.

Example `gh` commands (run locally with an authenticated `gh`):

```bash
gh secret set MONGO_URI --body "$(cat .env | sed -n 's/^MONGO_URI=//p')"
gh secret set MONGODB_URI_TEST --body "<your-test-uri>"
gh secret set GOOGLE_GEMINI_API_KEY --body "<your-gemini-key>"
gh secret set GOOGLE_MAPS_API_KEY --body "<your-maps-key>"
```

After adding secrets, verify workflows reference them via `${{ secrets.NAME }}` (they should not contain literal values).
