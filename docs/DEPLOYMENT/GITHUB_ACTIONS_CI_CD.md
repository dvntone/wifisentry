# GitHub Actions CI/CD Documentation

This document explains WiFi Sentry's continuous integration and continuous deployment (CI/CD) pipeline using GitHub Actions.

## Overview

WiFi Sentry uses GitHub Actions to automatically:

1. **Test** code on every commit
2. **Build** cross-platform applications (Windows, Android, Web)
3. **Release** versioned builds to GitHub and users
4. **Monitor** dependencies and security vulnerabilities

## Workflows

### 1. CI/CD Pipeline (`.github/workflows/ci-cd.yml`)

Runs on every push and pull request.

**Triggers**:
```yaml
- Pushes to main, develop branches
- Files: *.js, *.ts, *.tsx, package.json
- Pull requests to main, develop
- Manual workflow dispatch
```

**Jobs**:

#### Test & Lint
- **Runs on**: Ubuntu (LTS)
- **Node versions**: 18.x, 20.x
- **Tasks**:
  - Install dependencies
  - Run ESLint
  - Run Jest tests
  - Security audit

```yaml
npm run lint              # Check code style
npm test                  # Run unit tests
npm audit --audit-level=moderate  # Check vulnerabilities
```

#### Build Web Application
- **Runs on**: Ubuntu
- **Tasks**:
  - Build Next.js web app to static files
  - Upload to GitHub artifacts
  - Path: `web-app/out/`

#### Build Windows Desktop (Electron)
- **Runs on**: Windows
- **Tasks**:
  - Build Electron app
  - Create Windows installers (.exe, portable)
  - Sign if certificate available
  - Upload to artifacts

```bash
npm run desktop:build-win
# Outputs: dist/*.exe, dist/*.nsis
```

#### Build Android
- **Runs on**: Ubuntu with Android SDK
- **Tasks**:
  - Setup Java & Android SDK
  - Build React/Capacitor
  - Compile Android APK
  - Upload to artifacts

```bash
npm run mobile:build
./android/gradlew assembleDebug
# Outputs: android/app/build/outputs/apk/*.apk
```

#### Quality Gate
- Checks all jobs pass
- Fails if critical jobs fail (tests, lint)
- Allows builds to fail (continue-on-error)

### 2. Release Workflow (`.github/workflows/release.yml`)

Runs when a git tag is created (`v*`).

**Triggers**:
```yaml
- Git tags matching v* (e.g., v1.0.0)
- Manual workflow dispatch with version input
```

**Process**:

1. **Create Release**
   - Generate release notes from commits
   - Create GitHub Release page
   - Add installation instructions

2. **Build Windows Release**
   - Build Electron app
   - Create installers
   - Upload to GitHub Release

3. **Build Android Release**
   - Build release APK (unsigned)
   - Upload to GitHub Release

4. **Build Web Release**
   - Build optimized web app
   - Create `.tar.gz` and `.zip` archives
   - Upload to GitHub Release

5. **Notification**
   - Post release summary
   - Verify all platforms built successfully

### 3. Dependency Updates (`.github/workflows/dependencies.yml`)

Scheduled weekly + manual trigger.

**Triggers**:
```yaml
- Schedule: Every Monday at 9 AM UTC
- Manual workflow dispatch
```

**Tasks**:

- **Check Outdated**: List outdated packages
- **Update**: Run `npm update`
- **Verify**: Test builds still work
- **Create PR**: Automated pull request with changes
- **Security Audit**: Check for vulnerabilities

### 4. Gemini AI Workflows (Existing)

- `gemini-dispatch.yml` - Route events to AI handlers
- `gemini-triage.yml` - Automated issue triage
- `gemini-review.yml` - Automated PR review
- `gemini-invoke.yml` - General-purpose AI agent

## Usage

### Running Tests Locally

Before pushing, test locally:

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run linter
npm run lint

# Build all platforms (takes time)
npm run build:all

# Build specific platform
npm run web:build
npm run desktop:build
npm run mobile:build
```

### Making a Release

To create a new release:

1. **Update version locally** (optional):
   ```bash
   npm version patch    # 1.0.0 → 1.0.1
   npm version minor    # 1.0.0 → 1.1.0
   npm version major    # 1.0.0 → 2.0.0
   ```

2. **Push tag to GitHub**:
   ```bash
   git tag v1.0.1
   git push origin main --tags
   ```

3. **GitHub Actions automatically**:
   - Creates release page
   - Builds all platforms
   - Uploads binaries
   - Sends notifications

### Monitoring Builds

View build status at:
- Actions tab: `github.com/dvntone/wifisentry/actions`
- Individual workflows: Click workflow name
- Build logs: Click job name then step

### Fixing Build Failures

Common issues and solutions:

#### Tests Fail
```bash
# Debug locally
npm test -- --verbose

# Update snapshots if expected
npm test -- -u

# Push fix
git commit -am "fix: address test failures"
git push
```

#### Build Fails on Windows
```bash
# Check Windows build locally
npm run desktop:build

# Common issues:
# - Missing files in electron-builder config
# - Node version mismatch
# - Long file paths (Windows 260 char limit)
```

#### Build Fails on Android
```bash
# Check Android build locally
npm run mobile:compile

# Common issues:
# - Missing Android SDK
# - Java version mismatch
# - Gradlew permissions on Linux

# Fix:
chmod +x android/gradlew
```

## Configuration

### Environment Variables

Set in GitHub repository settings (Settings → Secrets and variables):

```
SIGNING_CERTIFICATE_P12_BASE64    # For code signing
SIGNING_CERTIFICATE_PASSWORD      # Certificate password
SLACK_WEBHOOK                     # For notifications
```

### Branch Protection Rules

Configured in Settings → Branches:

```
Require status checks to pass:
- ci-cd / test (Node 18.x)
- ci-cd / test (Node 20.x)
- ci-cd / build-web
- ci-cd / build-desktop-win
- ci-cd / build-android
```

### Custom Jobs

Add new workflows in `.github/workflows/`:

```yaml
name: Custom Job
on: [push, pull_request]

jobs:
  custom:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v3
        with:
          node-version: '20.x'
      - run: echo "Running custom job"
```

## Best Practices

### 1. Keep Tests Fast

```javascript
// Create focused tests, not massive suites
describe('AdapterSettings', () => {
  it('should load adapters', () => {
    // Test one thing
  });
});
```

### 2. Use Matrix Strategy

Test multiple versions in parallel:

```yaml
strategy:
  matrix:
    node-version: [18.x, 20.x]
    os: [ubuntu-latest, windows-latest]
```

### 3. Cache Dependencies

```yaml
- uses: actions/setup-node@v3
  with:
    node-version: '20.x'
    cache: 'npm'  # Caches node_modules
```

### 4. Conditional Steps

```yaml
- name: Deploy
  if: github.ref == 'refs/heads/main'
  run: npm run deploy

- name: Upload artifacts
  if: always()  # Run even if previous step fails
  uses: actions/upload-artifact@v3
```

### 5. Artifact Management

```yaml
- uses: actions/upload-artifact@v3
  with:
    name: build-${{ matrix.os }}
    path: dist/
    retention-days: 30  # Clean up after 30 days
```

## Troubleshooting

### Workflow Not Triggering

**Problem**: Push but workflow doesn't run

**Solutions**:
1. Check branch matches trigger (main, develop)
2. Check files modified match `paths`
3. Check for syntax errors in YAML
4. Manually trigger: Actions → Run workflow

### Build Succeeds Locally But Fails in CI

**Problem**: Works on machine but not GitHub Actions

**Solutions**:
1. Use same Node version: `node -v`
2. Check environment variables: `github.ref`, `secrets`
3. Check file paths (case-sensitive on Linux)
4. Clear cache if needed: Settings → Clear all caches

### Artifacts Too Large

**Problem**: Artifact upload fails or takes too long

**Solutions**:
1. Compress: `tar -czf build.tar.gz dist/`
2. Exclude files: `if-no-files-found: ignore`
3. Reduce retention: `retention-days: 7`
4. Upload only final build, not intermediate

### Timeout Issues

**Problem**: Job exceeds max time (360 minutes)

**Solutions**:
1. Optimize build: Remove unnecessary steps
2. Use matrix for parallelization
3. Cache aggressively
4. Profile slow steps: Add `time` commands

## Integration with Tools

### Slack Notifications

```yaml
- name: Notify Slack
  if: failure()
  uses: association/notify-slack@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}
    message: "Build failed in ${{ github.repository }}"
```

### Code Coverage

```yaml
- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
```

### Release Notes

```yaml
- name: Generate changelog
  run: |
    npx standard-version --infile CHANGELOG.md
```

## Performance Optimization

### Current Pipeline Status

| Workflow | Duration | Parallel Jobs |
|----------|----------|---------------|
| CI/CD | 15-30 min | 4 (test, web, desktop, android) |
| Release | 45-60 min | 3 (windows, android, web) |
| Dependencies | 10-15 min | 2 (update, audit) |

### Optimization Strategies

1. **Use caching**
   - Node modules cache
   - Docker layer cache
   - Build tool cache

2. **Parallelize jobs**
   - Test on multiple versions simultaneously
   - Build platforms in parallel (already done)

3. **Reduce build scope**
   - Only build changed packages
   - Skip unchanged platforms

4. **Use self-hosted runners** (advanced)
   - Faster builds for repetitive tasks
   - No cold start time

## Security

### Secrets Management

Never commit secrets. Use GitHub Secrets:

```yaml
env:
  SECRET: ${{ secrets.MY_SECRET }}
```

### Code Signing

For production releases:

```yaml
- name: Sign Windows App
  env:
    CERT_FILE: ${{ secrets.SIGNING_CERTIFICATE }}
    CERT_PASSWORD: ${{ secrets.SIGNING_CERTIFICATE_PASSWORD }}
  run: |
    # Code signing commands
```

### Dependency Scanning

Automated via GitHub's dependency graph:
- Settings → Code security and analysis
- Enable "Dependabot alerts"
- Enable "Dependabot security updates"

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Available Actions](https://github.com/actions)
- [Contexts and Expressions](https://docs.github.com/en/actions/learn-github-actions/contexts)

---

**Version**: 1.0.0
**Last Updated**: 2024
**Maintainer**: WiFi Sentry Team
