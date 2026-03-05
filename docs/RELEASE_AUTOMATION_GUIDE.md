# 🚀 GitHub Release Automation Guide

## Overview

This repository uses automated GitHub Actions workflows to manage versioning, releases, and backups. When you update the version in `package.json`, everything else happens automatically!

## How It Works

### 🔄 Release Flow

```
1. Update package.json version
   ↓
2. Push to main branch
   ↓
3. Auto-Release Workflow Triggers
   ├─ Detects version change
   ├─ Generates changelog with diffs
   ├─ Creates backup branch (release/v1.0.0)
   ├─ Creates git tag (v1.0.0)
   └─ Publishes GitHub Release
   ↓
4. Main branch stays updated with latest code
5. Old versions accessible via backup branches
```

## 📋 Available Workflows

### 1. **Auto Release** (`auto-release.yml`) ⭐ Automatic
**Triggers:** When `package.json` version changes on `main` branch

**What it does:**
- ✅ Detects version changes automatically
- ✅ Generates changelog from commits with full diffs
- ✅ Creates backup branch `release/v1.0.0`
- ✅ Creates git tag `v1.0.0`
- ✅ Publishes GitHub Release with:
  - Commit list
  - File changes
  - Categorized commits (features, fixes, docs)
  - Deployment info

**Usage:**
```bash
# 1. Update version in package.json
nano package.json
# Change "version": "1.0.0" to "1.0.1"

# 2. Commit and push
git add package.json
git commit -m "chore: Bump version to 1.0.1"
git push origin main

# 3. Watch GitHub Actions
# Go to Actions tab → Auto Release Workflow → See release published in ~2 min
```

**Result:**
```
✅ Release created: https://github.com/dvntone/wifisentry/releases/tag/v1.0.1
✅ Backup branch: release/v1.0.1
✅ Git tag: v1.0.1
✅ Changelog with diffs included
```

---

### 2. **Version Bump** (`version-bump.yml`) Manual

**How to use:** GitHub Actions UI → Click "Run workflow" button

**What it does:**
- ✅ Automatically calculates next version (major/minor/patch)
- ✅ Updates `package.json`
- ✅ Creates commit with version bump
- ✅ Pushes to main (triggers auto-release)
- ✅ Option for dry-run to see changes first

**Usage:**

**Option A: Bump from GitHub UI (Recommended)**
```
1. Go to https://github.com/dvntone/wifisentry/actions
2. Select "Version Management" workflow
3. Click "Run workflow" button
4. Choose bump type: major / minor / patch
5. Choose dry-run: true (to preview) or false (to apply)
6. Click "Run workflow"
7. Check workflow output for results
```

**Option B: Bump from Command Line**
```bash
# Using GitHub CLI (if installed)
gh workflow run version-bump.yml -f bump-type=patch -f dry-run=false
```

**Examples:**

```bash
# Current version: 1.0.0

# Patch bump (1.0.0 → 1.0.1)
# For bug fixes and small patches
Bump Type: patch

# Minor bump (1.0.0 → 1.1.0)
# For new features (backwards compatible)
Bump Type: minor

# Major bump (1.0.0 → 2.0.0)
# For breaking changes
Bump Type: major
```

---

### 3. **Emergency Rollback** (`emergency-rollback.yml`) Manual

**When to use:** Critical bug in production, need to revert immediately

**What it does:**
- ✅ Validates requested version exists
- ✅ Resets main branch to previous version
- ✅ Updates `package.json`
- ✅ Creates rollback commit
- ✅ Creates hotfix release tag
- ✅ Publishes emergency release with reason

**Usage:**

```
1. Go to https://github.com/dvntone/wifisentry/actions
2. Select "Emergency Rollback" workflow
3. Click "Run workflow" button
4. Enter version to rollback to (e.g., 1.0.0)
5. Enter reason for rollback (e.g., "Critical security bug")
6. Click "Run workflow"
7. Check the hotfix release created
```

**Example Workflow Run:**

**Input:**
- Rollback version: `1.0.0`
- Reason: `Critical memory leak in dependency scanner`

**Results:**
```
✅ Main branch reset to v1.0.0
✅ Release created: v1.0.0-hotfix
✅ Commit tagged and pushed
✅ All backup branches preserved (for recovery if needed)
```

**Finding old versions:**
```bash
# List all versions
git branch -r | grep release/

# Checkout specific version
git checkout release/v1.0.0

# View specific release
https://github.com/dvntone/wifisentry/releases/tag/v1.0.0
```

---

## 📊 Organizational Structure

### Main Branch
- **Always:** Latest production-ready code
- **Version:** From `package.json`
- **Protection:** Cannot force-push

### Release Branches (Backup)
- `release/v1.0.0` - First release
- `release/v1.0.1` - Patch release
- `release/v1.1.0` - Minor release
- `release/v2.0.0` - Major release

**Use for:** Emergency recovery, comparing versions

### Git Tags
- `v1.0.0` - Production release
- `v1.0.1-rollback-12345` - Rollback commit
- `v1.0.0-hotfix` - Emergency fix

**Use for:** GitHub releases, deployment references

### Release Page
- URL: https://github.com/dvntone/wifisentry/releases
- Contains: Full changelog, diffs, deployment info
- Searchable by version (`v1.0.0`, `v1.1.0`, etc.)

---

## 🔍 Version Format

**Semantic Versioning:** `MAJOR.MINOR.PATCH`

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features (backwards compatible)
- **PATCH** (1.0.0 → 1.0.1): Bug fixes

Example progression:
```
1.0.0 (Initial release)
1.0.1 (Bug fix)
1.0.2 (Bug fix)
1.1.0 (New feature)
1.1.1 (Bug fix)
2.0.0 (Breaking change)
2.1.0 (New feature)
```

---

## 📖 Release Information

### What's Included in Release

Each release includes:
- ✅ **Changelog:** All commits since last release
- ✅ **Categorized:** Features, fixes, docs
- ✅ **File Changes:** Which files modified, lines changed
- ✅ **Diffs:** Detailed what changed in each file
- ✅ **Metadata:** Version numbers, dates, platforms
- ✅ **Source Code:** Linked to commit/tag

**Example Release Page:**
```markdown
## 📝 Changes in WiFi Sentry v1.0.1
Previous version: v1.0.0

### 📋 Commits
- a1b2c3d - Fix memory leak in dependency scanner (John Smith)
- b2c3d4e - Update documentation (Jane Doe)

### 📁 Files Changed
- dependency-checker.js (25 insertions, 5 deletions)
- DEPENDENCY_MANAGEMENT.md (10 insertions, 2 deletions)

### ✨ Features
(none in this patch)

### 🐛 Bug Fixes
- Fix memory leak when checking 100+ tools

### 📚 Documentation
- Update DEPENDENCY_MANAGEMENT.md with new examples
```

---

## 🎯 Common Workflows

### Scenario 1: Regular Feature Release

```bash
# 1. Develop features on branches
git checkout -b feature/new-tool
# ... write code ...
git push origin feature/new-tool

# 2. Create PR and merge
# (Pull Request review/merge via GitHub UI)

# 3. Bump version from GitHub Actions UI
# - Go to Actions → Version Management
# - Choice: minor (new feature)
# - Workflow automatically:
#   - Updates package.json to 1.1.0
#   - Creates commit
#   - Pushes to main
#   - Auto-release triggers
#   - Release published with changelog

# Done! Release at https://github.com/dvntone/wifisentry/releases/tag/v1.1.0
```

### Scenario 2: Urgent Bug Fix

```bash
# 1. Fix bug on main branch
git pull origin main
git checkout -b hotfix/critical-bug
# ... fix code ...
git add .
git commit -m "fix: Critical security bug in WiFi scan"
git push origin hotfix/critical-bug

# 2. Create PR, merge to main

# 3. Bump version (patch)
# - Go to Actions → Version Management
# - Choice: patch (bug fix)
# - Click "Run workflow"
# - Version bumps to 1.0.1
# - Release published with bug fix details
```

### Scenario 3: Emergency Rollback

```bash
# Problem: v1.2.0 has critical bug

# 1. Go to Actions → Emergency Rollback
# 2. Enter: rollback-version = 1.1.0
# 3. Enter: reason = "Critical memory crash"
# 4. Click "Run workflow"

# Results:
# - Main branch reset to v1.1.0
# - package.json updated
# - Rollback release created
# - All old versions still accessible
# - Users can downgrade immediately

# 5. Fix the issue in a branch
# 6. Test thoroughly
# 7. Merge and bump to v1.2.1
```

### Scenario 4: Comparing Versions

```bash
# View what changed between versions
https://github.com/dvntone/wifisentry/compare/v1.0.0...v1.1.0

# Download specific version
git checkout release/v1.0.0
npm install
npm start

# View release notes
https://github.com/dvntone/wifisentry/releases/tag/v1.0.0
```

---

## 📈 Tracking Releases

### Via GitHub UI

**Releases Page:**
```
https://github.com/dvntone/wifisentry/releases
```
Shows all versions, changelogs, download links

**Timeline/Commits:**
```
https://github.com/dvntone/wifisentry/commits/main
```
Shows all commits and which release they belong to

### Via Git Commands

```bash
# List all versions
git tag

# List versions with descriptions
git tag -l --format='%(refname:short) - %(creatordate)'

# List backup branches
git branch -r | grep release/

# Show changelog between versions
git log v1.0.0..v1.1.0 --oneline

# Show diff between versions
git diff v1.0.0 v1.1.0

# Create comparison link
# https://github.com/dvntone/wifisentry/compare/v1.0.0...v1.1.0
```

---

## 🔒 Protection & Safety

### What's Protected
- ✅ `main` branch requires up-to-date before push
- ✅ Version tags are immutable (cannot delete)
- ✅ Backup branches preserved automatically
- ✅ All rollbacks are tracked (never lost)

### Recovery Options
1. **Use backup branch:** `git checkout release/v1.0.0`
2. **Download release:** From release page
3. **Roll forward:** Fix and bump version
4. **Full rollback:** Use emergency-rollback workflow
5. **View history:** Check git log or GitHub UI

---

## ⚙️ Configuration

### In package.json
```json
{
  "name": "wifi-sentry",
  "version": "1.0.0",  // ← Workflow watches this
  "description": "WiFi security monitoring",
  ...
}
```

### Workflow Triggers
- **Auto-Release:** Automatic on `package.json` change in main
- **Version Bump:** Manual via GitHub Actions UI
- **Emergency Rollback:** Manual via GitHub Actions UI

### No Additional Setup Needed!
The workflows:
- ✅ Use built-in GitHub Actions
- ✅ No external secrets required
- ✅ No additional tools/dependencies
- ✅ Work with default GITHUB_TOKEN

---

## 🚨 Troubleshooting

### "Version change not detected"
```bash
# Ensure package.json has correct JSON
jq . package.json  # Validate JSON

# Push to main (not another branch)
git push origin main

# Wait 5-10 seconds for GitHub Actions to trigger
# Check: https://github.com/dvntone/wifisentry/actions
```

### "Rollback failed - version not found"
```bash
# List available versions
git tag -l

# List backup branches
git branch -r | grep release/

# If version not found, create release from main first
```

### "Release not published"
```bash
# Check workflow logs
# https://github.com/dvntone/wifisentry/actions/workflows/auto-release.yml

# Verify package.json version is valid semantic version
# Valid: 1.0.0, 1.2.3, 2.0.0-beta
# Invalid: 1, v1.0.0 (remove v), 01.00.00

# Ensure previous version is valid
git tag -l  # Record list
```

---

## 📚 Reference

### Workflow Files
- `auto-release.yml` - Automatic release on version change
- `version-bump.yml` - Manual version bumping
- `emergency-rollback.yml` - Emergency version rollback

### Release Assets
All releases include:
- Source code (zip/tar.gz)
- Release notes (auto-generated)
- Changelog with diffs
- Commit history

### Links
- **Releases:** https://github.com/dvntone/wifisentry/releases
- **Tags:** https://github.com/dvntone/wifisentry/tags
- **Actions:** https://github.com/dvntone/wifisentry/actions
- **Branches:** https://github.com/dvntone/wifisentry/branches

---

## 🎓 Best Practices

1. **Always bump version before pushing**
   - Don't manually create releases
   - Let workflows automate everything

2. **Use semantic versioning**
   - Major: Breaking changes
   - Minor: New features
   - Patch: Bug fixes

3. **Include meaningful commit messages**
   - Used in changelog
   - Start with `feat:`, `fix:`, `docs:`, `chore:`

4. **Test before version bump**
   - Run all tests
   - Manual verification
   - Then update version

5. **Document breaking changes**
   - Include migration guide in release
   - Add to version bump commit

6. **Keep main branch stable**
   - Don't push untested code
   - All releases come from main

7. **Use rollback when needed**
   - Don't introduce new bugs fixing old ones
   - Rollback → fix → re-release

---

## ✅ Next Steps

1. **Try a patch update:**
   ```bash
   # In package.json, change 1.0.0 → 1.0.1
   git add package.json
   git commit -m "chore: Bump version to 1.0.1"
   git push origin main
   # Watch release appear in 2 minutes!
   ```

2. **View release:** https://github.com/dvntone/wifisentry/releases

3. **Try version bump workflow:**
   - Go to Actions tab
   - Select Version Management
   - Run with patch bump

4. **Test rollback (optional)**
   - Go to Actions tab
   - Select Emergency Rollback
   - Rollback to previous version

---

**You're all set! Your releases are now fully automated.** 🎉

Questions? Check the workflow files themselves for detailed comments.
