# Findings Feature - Deployment Checklist

## Pre-Deployment

### 1. Code Review
- [ ] Review all created files (15 files)
- [ ] Check for hardcoded values or secrets
- [ ] Verify error handling in all endpoints
- [ ] Confirm authorization checks in place

### 2. Database Preparation
- [ ] Backup current database
- [ ] Test migration on development database
- [ ] Verify migration rollback works
- [ ] Check database user has necessary permissions

### 3. Testing
- [ ] Run automated test script: `node test-findings-implementation.js`
- [ ] Test all API endpoints manually
- [ ] Test with invalid data (validation)
- [ ] Test authorization (admin vs non-admin)
- [ ] Test cascade delete behavior
- [ ] Verify audit logs are created

### 4. Environment Variables
- [ ] Verify `CHECKOPS_ENABLED=true` in production .env
- [ ] Confirm database connection variables are correct
- [ ] Check `FRONTEND_URL` is set correctly

## Deployment Steps

### Step 1: Database Migration
```bash
# On production server
cd /path/to/saiqa-server
npm run migrate:up
```

**Verify:**
```sql
-- Check table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'config'
);

-- Check seeded data
SELECT * FROM config WHERE category = 'findings';
```

- [ ] Migration completed successfully
- [ ] Config table created
- [ ] 3 default configs seeded

### Step 2: Deploy Code
```bash
# Pull latest code
git pull origin main

# Install dependencies (if any new ones)
npm install

# Restart server
pm2 restart saiqa-server
# OR
npm start
```

- [ ] Code deployed
- [ ] Dependencies installed
- [ ] Server restarted

### Step 3: Verify Deployment
```bash
# Check server logs
pm2 logs saiqa-server
# OR
tail -f logs/activity.log

# Look for:
# ✅ Configuration cache initialized
# ✅ Saiqa Server starting...
```

- [ ] Server started successfully
- [ ] Config cache initialized
- [ ] No errors in logs

### Step 4: Smoke Tests

**Test 1: Get Allowed Values**
```bash
curl -X GET http://localhost:3002/api/checkops/findings/allowed-values \
  -H "Cookie: accessToken=YOUR_TOKEN"
```
- [ ] Returns severities, departments, statuses

**Test 2: Create Finding**
```bash
curl -X POST http://localhost:3002/api/checkops/findings \
  -H "Content-Type: application/json" \
  -H "Cookie: accessToken=YOUR_TOKEN" \
  -d '{
    "submissionId": "EXISTING_SUB_ID",
    "questionId": "EXISTING_Q_ID",
    "formId": "EXISTING_FORM_ID",
    "severity": "Major",
    "department": "Operations",
    "observation": "Deployment test finding"
  }'
```
- [ ] Finding created successfully
- [ ] Returns finding with SID (e.g., FND-001)

**Test 3: Get Finding**
```bash
curl -X GET http://localhost:3002/api/checkops/findings/FND-001 \
  -H "Cookie: accessToken=YOUR_TOKEN"
```
- [ ] Returns finding details

**Test 4: List Findings**
```bash
curl -X GET "http://localhost:3002/api/checkops/findings?limit=10" \
  -H "Cookie: accessToken=YOUR_TOKEN"
```
- [ ] Returns list with pagination

**Test 5: Get Statistics**
```bash
curl -X GET http://localhost:3002/api/checkops/findings/stats/EXISTING_FORM_ID \
  -H "Cookie: accessToken=YOUR_TOKEN"
```
- [ ] Returns statistics object

**Test 6: Update Finding**
```bash
curl -X PUT http://localhost:3002/api/checkops/findings/FND-001 \
  -H "Content-Type: application/json" \
  -H "Cookie: accessToken=YOUR_TOKEN" \
  -d '{"status": "resolved"}'
```
- [ ] Finding updated successfully

**Test 7: Delete Finding (Admin)**
```bash
curl -X DELETE http://localhost:3002/api/checkops/findings/FND-001 \
  -H "Cookie: accessToken=ADMIN_TOKEN"
```
- [ ] Finding deleted successfully

**Test 8: Verify Audit Logs**
```sql
SELECT * FROM audit_logs 
WHERE entity_type = 'checkops_finding' 
ORDER BY created_at DESC 
LIMIT 10;
```
- [ ] Audit logs created for all operations

### Step 5: Integration Tests

**Test Cascade Delete:**
1. Create form with submission
2. Create finding for that submission
3. Delete the form
4. Verify finding is also deleted

- [ ] Cascade delete works correctly

**Test Validation:**
1. Try to create finding with invalid severity
2. Verify validation error returned

- [ ] Validation working correctly

**Test Authorization:**
1. Try to delete finding as non-admin
2. Verify 403 Forbidden returned

- [ ] Authorization working correctly

## Post-Deployment

### 1. Monitoring
- [ ] Check error logs for any issues
- [ ] Monitor API response times
- [ ] Check database query performance
- [ ] Verify audit logs are being created

### 2. Documentation
- [ ] Update API documentation
- [ ] Notify frontend team of new endpoints
- [ ] Share allowed values with UI team
- [ ] Document any custom configurations

### 3. User Communication
- [ ] Announce new feature to users
- [ ] Provide training materials if needed
- [ ] Set up support channels for questions

## Rollback Plan

If issues arise, rollback using these steps:

### Step 1: Rollback Code
```bash
git revert <commit-hash>
pm2 restart saiqa-server
```

### Step 2: Rollback Database
```bash
npm run migrate:down
```

**Or manually:**
```sql
DROP TABLE IF EXISTS config CASCADE;
```

### Step 3: Verify Rollback
- [ ] Server running without errors
- [ ] Config table removed
- [ ] No finding endpoints accessible

## Troubleshooting

### Issue: Config cache not initialized
**Symptom:** Validation uses default values

**Solution:**
```bash
# Restart server
pm2 restart saiqa-server

# Or manually refresh cache via API (future enhancement)
```

### Issue: Migration fails
**Symptom:** "relation already exists" or similar

**Solution:**
```sql
-- Check if table exists
SELECT * FROM config;

-- If exists and has data, skip migration
-- If exists but empty, drop and re-run
DROP TABLE config CASCADE;
```

### Issue: Validation errors
**Symptom:** "severity must be one of..."

**Solution:**
```sql
-- Check current config
SELECT * FROM config WHERE key = 'finding_severities';

-- Update if needed
UPDATE config 
SET value = '["Minor", "Major", "Critical"]'
WHERE key = 'finding_severities';
```

### Issue: Authorization errors
**Symptom:** "Insufficient permissions"

**Solution:**
- Verify user has correct role in database
- Check JWT token is valid
- Confirm auth middleware is working

## Performance Monitoring

### Metrics to Watch
- [ ] API response times (should be < 200ms)
- [ ] Database query times (should be < 50ms)
- [ ] Config cache hit rate (should be > 99%)
- [ ] Error rate (should be < 1%)

### Database Indexes
```sql
-- Verify indexes exist
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename = 'config';

-- Should see:
-- idx_config_key
-- idx_config_category
-- idx_config_is_active
```

## Success Criteria

- ✅ All smoke tests pass
- ✅ Integration tests pass
- ✅ No errors in logs
- ✅ Audit logs being created
- ✅ Performance metrics acceptable
- ✅ Frontend can consume API

## Sign-Off

- [ ] Developer: Implementation complete and tested
- [ ] QA: All tests passed
- [ ] DevOps: Deployment successful
- [ ] Product: Feature approved for production

---

**Deployment Date:** _____________  
**Deployed By:** _____________  
**Version:** 1.0.0  
**Status:** ⬜ Pending / ⬜ In Progress / ⬜ Complete
