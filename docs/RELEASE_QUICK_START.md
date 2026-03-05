# 🚀 Release Automation Quick Start

## 30-Second Overview

Your repository now has **fully automated release management**:

1. **Update `package.json` version** → Auto-release triggered
2. **Backup branches created** automatically (`release/v1.0.0`)
3. **Git tags** created automatically (`v1.0.0`)
4. **GitHub Release** published with changelog
5. **Main branch** stays up-to-date

---

## Three Workflows You Have

### 1️⃣ **Auto-Release** (Fully Automatic)
**When:** You update version in `package.json` and push to `main`  
**What happens:**
- ✅ Changelog generated with diffs
- ✅ Backup branch created (release/vX.X.X)
- ✅ Git tag created (vX.X.X)
- ✅ GitHub Release published
- ⏱️ Takes ~2 minutes

**Example:**
```bash
# 1. Edit package.json: "version": "1.0.1"
git add package.json
git commit -m "chore: Bump to 1.0.1"
git push origin main

# 2. Wait 2 minutes
# 3. Release appears at: github.com/dvntone/wifisentry/releases/tag/v1.0.1
```

---

### 2️⃣ **Version Bump** (Manual Click)
**When:** You want automatic version calculation  
**How:**
1. Go to: `https://github.com/dvntone/wifisentry/actions`
2. Click: "Version Management" workflow
3. Click: "Run workflow" button
4. Select: `major` / `minor` / `patch`
5. Select: `dry-run: false`
6. Click: "Run workflow"

**What happens:**
- ✅ Calculates next version automatically
- ✅ Updates `package.json`
- ✅ Creates commit
- ✅ Pushes to main
- ✅ Auto-release workflow triggers

---

### 3️⃣ **Emergency Rollback** (For Critical Bugs)
**When:** Critical bug in production, need to revert ASAP  
**How:**
1. Go to: `https://github.com/dvntone/wifisentry/actions`
2. Click: "Emergency Rollback" workflow
3. Click: "Run workflow" button
4. Enter: Version to rollback to (e.g., `1.0.0`)
5. Enter: Reason (e.g., "Critical memory leak")
6. Click: "Run workflow"

**What happens:**
- ✅ Validates version exists
- ✅ Resets main to that version
- ✅ Creates hotfix release tag
- ✅ All old versions still accessible

---

## Your Version Folders

| Location | Purpose |
|----------|---------|
| **main** | Always latest code (production) |
| **release/v1.0.0** | Backup of v1.0.0 (recoverable) |
| **release/v1.0.1** | Backup of v1.0.1 (recoverable) |
| **v1.0.0** tag | Points to v1.0.0 release |
| **Release page** | GitHub releases with changelog |

Access them:
```bash
git checkout release/v1.0.0     # Get old version code
git log v1.0.0                  # See v1.0.0 commits
git diff v1.0.0..main          # Compare versions
```

---

## Test It Now

### Easy Test (2 minutes)

```bash
# 1. Open package.json
nano package.json

# 2. Change version (example: 1.0.0 → 1.0.1)
# "version": "1.0.1"

# 3. Push
git add package.json
git commit -m "test: Bump version to 1.0.1"
git push origin main

# 4. Watch it happen
# Go to https://github.com/dvntone/wifisentry/actions
# See auto-release workflow run
# Release appears in 2 minutes at /releases

# 5. Check your release
https://github.com/dvntone/wifisentry/releases/tag/v1.0.1
# You'll see:
# - Changelog with all commits
# - File changes
# - Categorized features/fixes
```

---

## What Each Release Includes

Automatically generated for every release:

```
📝 Release Title
  WiFi Sentry v1.0.1

📋 Changelog
  ✨ Features
  🐛 Bug Fixes  
  📚 Documentation

📊 Commits
  - Commit 1 (Author)
  - Commit 2 (Author)

📁 Files Changed
  - file1.js (5 insertions, 2 deletions)
  - file2.tsx (10 insertions, 5 deletions)

🏷️ Tags
  - v1.0.1 (git tag)

💿 Source Code
  - Download as zip
  - Download as tar.gz
```

---

## Use Cases

### 📦 Release New Features
```bash
# 1. Develop on feature branch
git checkout -b feature/new-tool
# ... code ...
git push origin feature/new-tool

# 2. Create PR, merge to main

# 3. Use Version Bump to bump minor version
# (new feature = minor bump per semantic versioning)
# - Go to Actions
# - Version Management
# - Choose "minor"
# - Done!

# Release created automatically with full changelog
```

### 🐛 Release Bug Fix
```bash
# 1. Fix bug
git checkout -b fix/memory-leak
# ... fix code ...
git push origin fix/memory-leak

# 2. Merge PR to main

# 3. Version Bump workflow → patch bump
# Release created automatically
```

### 🚨 Emergency Rollback
```bash
# Oh no! v1.2.0 has critical bug!

# 1. Go to Actions → Emergency Rollback
# 2. Rollback to v1.1.0
# 3. Reason: "Critical crash on startup"
# 4. Click Run

# Main branch is immediately reset to v1.1.0
# Old code is live
# Users can downgrade
# You can fix and re-release
```

---

## Key Files & Commands

### Workflow Files (GitHub Actions)
```
.github/workflows/
  ├── auto-release.yml         ← Automatic (don't touch)
  ├── version-bump.yml         ← Manual version calc
  └── emergency-rollback.yml   ← Emergency recovery
```

### Documentation
```
RELEASE_AUTOMATION_GUIDE.md    ← Full guide (detailed)
RELEASE_QUICK_START.md         ← This file (quick reference)
```

### View Releases
```bash
git tag -l                      # List all versions
git branch -r | grep release/   # List backup branches
git log --oneline -10           # See commits
```

### Links
- **Releases:** https://github.com/dvntone/wifisentry/releases
- **Actions:** https://github.com/dvntone/wifisentry/actions
- **Tags:** https://github.com/dvntone/wifisentry/tags
- **Compare:** https://github.com/dvntone/wifisentry/compare/v1.0.0...main

---

## Version Numbering

```
MAJOR.MINOR.PATCH
  ↓     ↓      ↓
  2  .  1  .   3

MAJOR (breaking changes)
  1.0.0 → 2.0.0
  
MINOR (new features, backwards compatible)
  1.0.0 → 1.1.0
  
PATCH (bug fixes)
  1.0.0 → 1.0.1
```

---

## Next 3 Steps

1. **Read full guide:**
   - Open: `RELEASE_AUTOMATION_GUIDE.md`
   - Time: 10 minutes
   - Covers: All scenarios, troubleshooting, best practices

2. **Do test release:**
   - Bump package.json version
   - Push to main
   - Watch release appear in 2 minutes

3. **Try all 3 workflows:**
   - Auto-release (just tested)
   - Version bump (run from Actions UI)
   - Emergency rollback (if you want to test)

---

## Troubleshooting

**"Release didn't appear"**
→ Check: Actions tab → auto-release workflow → logs

**"Version format error"**
→ Ensure: `"version": "1.0.0"` (valid semantic version)

**"Branch not found"**
→ Workflow automatically creates: `release/vX.X.X`

**"Need to rollback?"**
→ Use: Emergency Rollback workflow
→ Type: Version you want & reason

---

## Support

For detailed info on:
- **Release process:** See `RELEASE_AUTOMATION_GUIDE.md`
- **All workflows:** Check `.github/workflows/*.yml`
- **Version tracking:** Use `git` commands above
- **GitHub releases:** Visit `/releases` page

**Status:** ✅ Everything configured and ready to use!

---

*Created: Feb 11, 2026*  
*Last Updated: Feb 11, 2026*  
*System: Fully Automated*
