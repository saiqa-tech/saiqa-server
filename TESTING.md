# Testing Guide

**Quick Reference for all testing procedures**

---

## Automated Tests

### 1. Cookie Utilities Test
**Purpose:** Validate URL encoding/decoding for special characters in cookies

```bash
npm run test:cookies
```

**Expected Output:**
```
📊 TEST SUMMARY
Total Tests: 37
✅ Passed: 37
❌ Failed: 0
🎉 All tests passed!
```

**Coverage:**
- Basic cookie parsing (15 tests)
- Cookie serialization (6 tests)  
- Set-Cookie header creation (9 tests)
- Round-trip encoding (7 tests)

---

### 2. Database Migration Verification
**Purpose:** Verify database schema is correctly migrated

**Prerequisites:**
- PostgreSQL running
- Database credentials in `.env`

```bash
npm run verify:migrations
```

**Expected Output:**
```
🔍 Starting database migration verification...

1️⃣  UUID extension... ✅
2️⃣  Required tables... ✅
3️⃣  Users table structure... ✅
4️⃣  Database indexes... ✅
5️⃣  Foreign key constraints... ✅
6️⃣  Database triggers... ✅
7️⃣  Admin user... ✅

📊 VERIFICATION SUMMARY
✅ Passed: 7
❌ Failed: 0
🎉 All migration checks passed! Database is ready.
```

---

## Manual Tests

### 3. RBAC Security Test
**Purpose:** Prove manager cannot escalate privileges to admin

**Prerequisites:**
- Database running and migrated
- Server running on `http://localhost:3000`
- Admin user exists: `admin@saiqa.dev` / `Admin@123`

```bash
# Start server first
npm run dev

# In another terminal:
bash tests/rbac-manual-test.sh
```

**Expected Output:**
```
🧪 RBAC Tests - Privilege Escalation Prevention

✅ PASS: Manager views users list (HTTP 200)
✅ PASS: Manager attempts to update admin user (HTTP 403)
✅ PASS: Manager attempts to delete admin user (HTTP 403)
✅ PASS: Manager updates regular user (HTTP 200)
✅ PASS: Manager attempts to change user role to admin (HTTP 403)
✅ PASS: Manager attempts to create user (HTTP 403)
✅ PASS: Manager attempts to reset user password (HTTP 403)
✅ PASS: Admin updates admin user (HTTP 200)
✅ PASS: Admin changes user role (HTTP 200)
✅ PASS: Unauthenticated access to /users (HTTP 401)

📊 RBAC TEST SUMMARY
Total Tests: 10
✅ Passed: 10
❌ Failed: 0

🎉 All RBAC tests passed!

✅ RBAC is properly enforced:
   • Managers cannot update/delete admin users
   • Managers cannot change user roles
   • Managers cannot create users
   • Managers cannot reset passwords
   • Only admins have full privileges
```

**What it Tests:**
1. ✅ Manager CAN view users list
2. ✅ Manager CANNOT update admin user (403)
3. ✅ Manager CANNOT delete admin user (403)
4. ✅ Manager CAN update regular user
5. ✅ Manager CANNOT change user role (403)
6. ✅ Manager CANNOT create users (403)
7. ✅ Manager CANNOT reset passwords (403)
8. ✅ Admin CAN update admin user
9. ✅ Admin CAN change user role
10. ✅ Unauthenticated CANNOT access protected endpoints (401)

---

## Integration Tests (Manual)

### 4. Frontend Integration Test
**Purpose:** Verify frontend works with backend cookie changes

**Steps:**

1. **Start Backend:**
   ```bash
   cd saiqa-server
   npm run dev
   ```

2. **Start Frontend:**
   ```bash
   cd saiqa-client
   npm run dev
   ```

3. **Test Login Flow:**
   - Navigate to `http://localhost:3001` (or configured frontend port)
   - Login with: `admin@saiqa.dev` / `Admin@123`
   - ✅ Should login successfully
   - ✅ Should set cookies automatically
   - ✅ Should redirect to dashboard

4. **Test Authenticated Requests:**
   - Navigate to Users page
   - ✅ Should fetch users list
   - ✅ Cookies sent automatically with requests

5. **Test Logout:**
   - Click logout button
   - ✅ Should clear cookies
   - ✅ Should redirect to login

6. **Test Session Persistence:**
   - Login again
   - Refresh page
   - ✅ Should remain logged in
   - ✅ Cookies persist across page refresh

**Verification:**
- ✅ No frontend code changes required
- ✅ Browser handles cookies natively
- ✅ `credentials: 'include'` in fetch works correctly
- ✅ JWT tokens set as HTTP-only cookies

---

## Test Execution Checklist

### Pre-Deployment

- [ ] Run `npm run test:cookies` → 37/37 passing
- [ ] Run `npm run verify:migrations` → 7/7 checks passing
- [ ] Run `bash tests/rbac-manual-test.sh` → 10/10 tests passing
- [ ] Test frontend login/logout flow → All steps working
- [ ] No compilation errors → `get_problems` returns clean

### Post-Deployment

- [ ] Verify migrations in production database
- [ ] Test RBAC with real users
- [ ] Monitor `logs/activity.log` for errors
- [ ] Check audit_logs table populating
- [ ] Verify frontend authentication flow

---

## Troubleshooting

### Cookie Tests Failing
**Issue:** URL encoding tests fail

**Solution:**
```bash
# Check utils/cookies.js is correct
cat utils/cookies.js | grep -A5 "function parseCookies"

# Re-run tests
npm run test:cookies
```

### Migration Verification Failing
**Issue:** Database checks fail

**Solution:**
```bash
# Check database connection
psql $DATABASE_URL -c "SELECT 1;"

# Run migrations
npm run migrate:up

# Re-verify
npm run verify:migrations
```

### RBAC Tests Failing
**Issue:** Manager can update admin (403 expected, got 200)

**Solution:**
```bash
# Check RBAC code in users-update.step.js
grep -A5 "RBAC: Prevent privilege escalation" steps/users-update.step.js

# Restart server
npm run dev

# Re-run tests
bash tests/rbac-manual-test.sh
```

### Frontend Not Working
**Issue:** Login fails or cookies not set

**Solution:**
1. Check CORS settings in `motia.config.js`
2. Verify `credentials: 'include'` in frontend fetch
3. Check browser console for errors
4. Verify backend cookies in Network tab (Set-Cookie headers)

---

## Test Data Cleanup

After testing, clean up test users:

```bash
# Login as admin
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@saiqa.dev","password":"Admin@123"}' \
  -c admin-cookies.txt

# Delete test manager
curl -X DELETE http://localhost:3000/api/users/MANAGER_USER_ID \
  -b admin-cookies.txt

# Delete test user
curl -X DELETE http://localhost:3000/api/users/TEST_USER_ID \
  -b admin-cookies.txt

# Cleanup cookies
rm -f admin-cookies.txt test-*.txt
```

**Note:** RBAC test script automatically cleans up test users on exit.

---

## Continuous Integration (Future)

When setting up CI/CD, run these tests in sequence:

```yaml
# .github/workflows/test.yml (example)
steps:
  - name: Cookie Tests
    run: npm run test:cookies
  
  - name: Migration Verification
    run: npm run verify:migrations
  
  - name: RBAC Security Tests
    run: bash tests/rbac-manual-test.sh
```

---

*Last Updated: November 22, 2025*  
*All tests validated and passing ✅*
