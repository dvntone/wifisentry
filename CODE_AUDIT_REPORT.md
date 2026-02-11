# Code Audit Report: wifisentry
**Date:** 2026-02-11  
**Status:** ⚠️ Medium Priority Issues Found  
**Overall Risk:** Medium

---

## Executive Summary

The codebase has good architectural foundations but requires security hardening and cleanup:
- ✅ **No npm vulnerabilities** (npm audit: 0 vulnerabilities)
- ⚠️ **6 Security & Configuration Issues** (CORS, rate limiting, headers, input validation)
- ⚠️ **5 Structural Issues** (file organization, outdated dependency pins)
- ⚠️ **8 Obsolete/Todo Items** (incomplete features, commented code)

---

## 🔴 Critical Security Issues

### 1. **CORS Wide Open (Severity: HIGH)**
**Location:** `server.js:27`  
**Issue:** `app.use(cors());` allows any domain to access all endpoints.
```javascript
// Current (INSECURE)
app.use(cors());
```
**Recommendation:**
```javascript
// Fixed
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
}));
```
**Priority:** Fix before production.

---

### 2. **Missing Security Headers (Severity: HIGH)**
**Issue:** No helmet middleware for HTTP security headers.
**Recommendation:**
Add to `server.js`:
```javascript
const helmet = require('helmet');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Tighten if possible
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
}));
```
Add `helmet` to `package.json` dependencies.

---

### 3. **No Rate Limiting (Severity: MEDIUM)**
**Issue:** APIs are open to brute-force and DDoS attacks.
**Recommendation:**
Add to `server.js`:
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.'
});

// Apply to all routes
app.use(limiter);

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5 // 5 requests per 15 min
});
app.post('/api/auth/login', authLimiter, ...);
```
Add `express-rate-limit` to `package.json` dependencies.

---

### 4. **Input Validation Missing (Severity: MEDIUM)**
**Affected Files:** `server.js`, `api/adapters.js`, `/login`  
**Issue:** No validation on `req.body`, `req.params`, `req.query`.
**Recommendation:**
Add input validation library:
```bash
npm install joi
```
Example fix:
```javascript
const Joi = require('joi');

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().min(8).required()
});

app.post('/api/auth/login', (req, res) => {
  const { error, value } = loginSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  // proceed with validated data
});
```

---

### 5. **Credentials Exposure in Environment (Severity: MEDIUM)**
**Issue:** Even though `.env` is gitignored, exposure still occurs locally:
- MongoDB password visible: `CSPx1JXlso3W5Udy`
- Google API key visible: `AIzaSyCfEGvShC9R6UKkQ0o0FKwVkPzKfTrCc24`

**Actions Taken:** ✅
- Credentials rotated in GitHub Secrets
- History purged from git

**Recommendation:** 
- Use `.env.example` for all placeholders
- Add `.env*.local` to `.gitignore`
- Implement secret rotation policy

---

### 6. **XSS Risk via innerHTML (Severity: MEDIUM)**
**Locations:** `app.js:10`, `dashboard.js` (multiple)  
**Issue:** Using innerHTML with dynamic content risks XSS if user input is not escaped.
```javascript
// Current (potentially unsafe)
recentLogsContainer.innerHTML = '<p style="color:red">Error: ${data.message}</p>';
```
**Recommendation:**
```javascript
// Safe alternative
const p = document.createElement('p');
p.textContent = data.message;
p.style.color = 'red';
recentLogsContainer.appendChild(p);
```

---

## 🟡 Medium Priority Issues

### 7. **Child Process Execution Without Validation (Severity: MEDIUM)**
**Locations:** `desktop/main.js:41,48`, `desktop/windows-wsl2-adapter-manager.js:506`, `dependency-checker.js:344`  
**Issue:** `spawn()` and `exec()` used without input validation.
**Recommendation:**
- Use `spawn()` over `exec()` (prevents shell injection)
- Validate all command arguments
- Example:
```javascript
const { spawn } = require('child_process');
const command = sanitizeCommand(userInput);
spawn('npm', ['run', 'dev'], { cwd: process.cwd(), stdio: 'inherit' });
```

---

### 8. **Unpinned Dependency Versions (Severity: MEDIUM)**
**Location:** `package.json`  
**Issue:** Using `^latest` for `electron`, `@capacitor/core`, etc.
```json
"electron": "^latest",  // 🔴 Can break unexpectedly
"electron-builder": "^latest",
"electron-updater": "^latest"
```
**Recommendation:** Replace with specific versions:
```json
"electron": "^28.0.0",
"electron-builder": "^24.6.4",
"electron-updater": "^6.1.1"
```

---

## 🟠 Structural & Organization Issues

### 9. **Cluttered Root Directory**
**Issue:** Documentation and config files mixed with source code.
**Structure:**
```
wifisentry-1/          (root cluttered with docs)
├── *.md               (20+ markdown files in root) ❌
├── *.js              (multiple front-end files)
├── *.html            (multiple HTML files)
├── public/           (some static files)
├── src/              (none - files at root!)
└── docs/             (only some docs placed here)
```
**Recommendation:**
```
wifisentry-1/
├── src/              (source code)
│   ├── server.js
│   ├── config.js
│   ├── database.js
│   ├── modules/      (dependencies, adapters, etc.)
│   └── utils/
├── public/           (static files & frontend)
│   ├── html/
│   ├── js/
│   └── css/
├── docs/             (all markdown docs)
├── .github/          (workflows & config)
├── test/
└── desktop/          (electron app)
```

---

### 10. **Duplicate/Obsolete Files**
**Issue:** Multiple files for same purpose:
- `Gemini.yml` (root) vs `.github/gemini-dispatch.yml` (workflow)
- `GEMINI.md` (root) vs `Gemini.yml`
- `.firebaserc` & `firebase.json` (Firebase disabled, code commented)
- `dataconnect/` (DataConnect not actively used?)

**Recommendation:**
- Remove `.firebaserc`, `firebase.json`
- Remove commented Firebase code from `config.js`
- Consolidate Gemini docs to `.github/`
- Clarify DataConnect usage or remove

---

### 11. **Incomplete Features (TODOs in Code)**
**Locations:** `api/adapters.js` (6 TODOs), `desktop/main.js` (1 TODO)  
**Examples:**
```javascript
// api/adapters.js line 126
// TODO: Save to database using database module

// api/adapters.js line 238
// TODO: Enable monitor mode via native Android code
```
**Recommendation:**
- Convert TODOs to GitHub Issues
- Remove from code or add estimated completion
- Use `@since` tags for future features

---

### 12. **Mixed Module Systems**
**Issue:** Code uses both `require()` and occasional `import{}`  
**Recommendation:** Enforce CommonJS OR migrate to ESM. Currently using CommonJS, so enforce it in eslint.

---

### 13. **Missing TypeScript in Core**
**Issue:** Web app has TypeScript but main server doesn't. Makes for inconsistent codebase.
**Recommendation:** Consider migrating critical paths to TypeScript (gradual migration).

---

### 14. **Unused Gemini CLI Files**
**Files:**
- `gemini-dispatch.yml` (root) - should be in `.github/`
- `Gemini.yml` (root) - unclear purpose
- `GEMINI.md` (root) - docs should be in `/docs`

---

## 🟢 Positive Findings

✅ **npm audit: 0 vulnerabilities** - Dependencies are current and secure  
✅ **Environment secrets** - Now stored in GitHub Secrets, not in code  
✅ **Git history cleaned** - No `.env` in repository  
✅ **HTTPS enforcement** - Properly configured for production via `secure` cookie flag  
✅ **Database connection** - Using MongoDB Atlas SRV (encrypted TLS)  
✅ **2FA support** - Speakeasy/QR code implementation present  

---

## 📋 Recommended Action Plan

### Phase 1: Security Hardening (URGENT)
1. Add `helmet` middleware
2. Add rate limiting  
3. Configure CORS whitelist
4. Add input validation (Joi)
5. Rotate exposed credentials (✅ DONE)
6. Add `HTTPS` enforcement check

### Phase 2: Code Quality (1-2 weeks)
1. Close TODOs or move to GitHub Issues
2. Remove Firebase code or clean up
3. Pin dependency versions (esp. `electron *`)
4. Add TypeScript to core modules
5. Fix XSS risks in DOM manipulation

### Phase 3: Restructuring (2-4 weeks)  
1. Reorganize directory structure
2. Move docs to `/docs` folder
3. Consolidate duplicate files
4. Clean up root directory
5. Document module organization

---

## Files to Update

| File | Changes |
|------|---------|
| `server.js` | Add helmet, rate-limit, CORS config, input validation |
| `package.json` | Add helmet, express-rate-limit, joi; pin electron versions |
| `app.js`, `dashboard.js` | Replace innerHTML with safe DOM methods |
| `config.js` | Remove Firebase commented code |
| `.gitignore` | Add `.env*.local` |
| `README.md` | Document security requirements |

---

## Testing Recommendations

1. **Security Testing:**
   ```bash
   npm audit
   npm install snyk && npx snyk test
   ```

2. **CORS Testing:**
   ```bash
   curl -H "Origin: http://evil.com" http://localhost:3000/api/
   ```

3. **Rate Limit Testing:**
   ```bash
   for i in {1..20}; do curl http://localhost:3000/api/; done
   ```

---

## References
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express.js Security](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Security Checklist](https://github.com/goldbergyoni/nodebestpractices#6-security-best-practices)

---

**Report Generated:** 2026-02-11  
**Next Review:** After Phase 1 completion
