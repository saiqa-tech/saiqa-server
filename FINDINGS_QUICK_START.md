# Findings Feature - Quick Start Guide

## Setup (One-Time)

```bash
# 1. Run migration to create config table
npm run migrate:up

# 2. Verify setup
node test-findings-implementation.js

# 3. Start server
npm start
```

## API Endpoints

### Create Finding
```bash
POST /api/checkops/findings
Content-Type: application/json
Cookie: accessToken=YOUR_TOKEN

{
  "submissionId": "SUB-001",
  "questionId": "Q-001",
  "formId": "FORM-001",
  "severity": "Major",
  "department": "Operations",
  "observation": "Issue description",
  "rootCause": "Root cause analysis",
  "status": "open"
}
```

### Get Finding
```bash
GET /api/checkops/findings/FND-001
Cookie: accessToken=YOUR_TOKEN
```

### List Findings
```bash
GET /api/checkops/findings?formId=FORM-001&severity=Critical&limit=50
Cookie: accessToken=YOUR_TOKEN
```

### Update Finding
```bash
PUT /api/checkops/findings/FND-001
Content-Type: application/json
Cookie: accessToken=YOUR_TOKEN

{
  "status": "resolved",
  "rootCause": "Updated analysis"
}
```

### Delete Finding (Admin Only)
```bash
DELETE /api/checkops/findings/FND-001
Cookie: accessToken=YOUR_TOKEN
```

### Get Statistics
```bash
GET /api/checkops/findings/stats/FORM-001
Cookie: accessToken=YOUR_TOKEN
```

### Get Allowed Values (for dropdowns)
```bash
GET /api/checkops/findings-allowed-values
Cookie: accessToken=YOUR_TOKEN
```

## Required Fields

- ✅ `submissionId` - Submission UUID or SID
- ✅ `questionId` - Question UUID or SID
- ✅ `formId` - Form UUID or SID
- ✅ `severity` - Must be: "Minor", "Major", or "Critical"
- ✅ `department` - Must be from allowed list
- ✅ `observation` - Description of the issue

## Optional Fields

- `rootCause` - Why the issue occurred
- `status` - Defaults to "open" if not provided
- `evidenceUrls` - Array of URLs
- `assignment` - Array of `{user_id, user_name}` objects
- `metadata` - Any additional data

## Configuration

### View Current Config
```bash
GET /api/config
Cookie: accessToken=ADMIN_TOKEN
```

### Update Config (SQL)
```sql
-- Add new severity
UPDATE config 
SET value = '["Minor", "Major", "Critical", "Blocker"]'
WHERE key = 'finding_severities';

-- Add new department
UPDATE config 
SET value = value || '["New Department"]'::jsonb
WHERE key = 'finding_departments';
```

## Testing

```bash
# Run test suite
node test-findings-implementation.js

# Test with curl
curl -X POST http://localhost:3002/api/checkops/findings \
  -H "Content-Type: application/json" \
  -H "Cookie: accessToken=YOUR_TOKEN" \
  -d '{
    "submissionId": "SUB-001",
    "questionId": "Q-001",
    "formId": "FORM-001",
    "severity": "Major",
    "department": "Operations",
    "observation": "Test finding"
  }'
```

## Troubleshooting

### "Config table does not exist"
```bash
npm run migrate:up
```

### "Validation failed: severity must be one of..."
Check that severity exactly matches (case-sensitive): "Minor", "Major", or "Critical"

### "Insufficient permissions"
Only admins can delete findings. Check user role.

## Files Reference

- **Validator:** `lib/checkops-finding-validator.js`
- **Config Utility:** `utils/config.js`
- **Wrapper:** `lib/checkops-wrapper.js`
- **Endpoints:** `steps/checkops-findings-*.step.js`
- **Migration:** `migrations/004_create_config_table.js`

## Full Documentation

See `FINDINGS_IMPLEMENTATION_COMPLETE.md` for complete documentation.
