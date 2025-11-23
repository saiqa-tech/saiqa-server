# Audit Logging Strategy

## Current Implementation

### Logged Operations

Currently, the following operations are logged to the `audit_logs` table:

#### ✅ **CREATE Operations**
- User creation
- Unit creation
- Designation creation

#### ✅ **UPDATE Operations**
- User updates
- Unit updates
- Designation updates

#### ✅ **DELETE Operations**
- User deletion (soft delete)
- Unit deletion (soft delete)
- Designation deletion (soft delete)

#### ✅ **Authentication Operations** (Activity Logs)
- Login success/failure
- Logout
- Password changes
- Password resets
- Token refresh

### Current Audit Log Schema

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,                    -- Who performed the action
  action VARCHAR(50) NOT NULL,     -- CREATE, UPDATE, DELETE, etc.
  entity_type VARCHAR(100) NOT NULL, -- user, unit, designation
  entity_id UUID,                  -- ID of affected entity
  changes JSONB,                   -- Before/after state
  metadata JSONB DEFAULT '{}',     -- Additional context
  ip_address VARCHAR(45),          -- Client IP
  user_agent TEXT,                 -- Browser/client info
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
```

---

## Read Operation Logging Analysis

### Decision: **Selective Read Logging**

After careful consideration, we recommend **NOT logging all read operations** for the following reasons:

#### ❌ **Why Not Log All Reads?**

1. **Performance Impact**
   - High-frequency read operations would generate massive log volume
   - Every `GET /api/users` call would create a log entry
   - Database write overhead on every read request
   - Index maintenance costs increase significantly

2. **Storage Concerns**
   - Audit log table grows exponentially
   - Increased backup sizes
   - Higher storage costs
   - More complex log rotation/archival

3. **Signal-to-Noise Ratio**
   - Important audit events buried in routine read operations
   - Difficult to identify security incidents
   - Log analysis becomes time-consuming
   - Compliance reviews require filtering out noise

4. **Limited Security Value**
   - Most read operations are authorized by design
   - Unauthorized read attempts blocked at middleware (401/403)
   - Real security concern is unauthorized writes, not reads

#### ✅ **When to Log Reads?**

Log read operations **only when**:

1. **Sensitive Data Access**
   - Viewing admin user details
   - Accessing salary/compensation data (if added)
   - Retrieving audit logs themselves
   - Accessing user passwords/tokens (should never happen)

2. **Compliance Requirements**
   - GDPR data access requests
   - HIPAA patient record access (if applicable)
   - Financial data access (if applicable)
   - PII export operations

3. **Failed Access Attempts**
   - 403 Forbidden responses (privilege escalation attempts)
   - 401 Unauthorized attempts (authentication failures already logged)
   - Resource not found attempts (potential enumeration attacks)

---

## Recommended Audit Strategy

### 1. Continue Current Approach (CUD Operations)

**Status:** ✅ Implemented

Keep logging CREATE, UPDATE, DELETE operations as they:
- Provide accountability for data changes
- Enable compliance reporting
- Support forensic investigations
- Meet most regulatory requirements

### 2. Add Selective Read Logging

**Status:** ⏳ Recommended for Implementation

#### High-Value Read Operations to Log:

```javascript
// Example: Log admin user profile views
async function handler(req, { logger }) {
  const userId = req.pathParams.id;
  const userResult = await query('SELECT * FROM users WHERE id = $1', [userId]);
  const user = userResult.rows[0];
  
  // Log if viewing admin user profile
  if (user.role === 'admin') {
    await logAudit({
      userId: req.user.userId,
      action: 'READ',
      entityType: 'user',
      entityId: userId,
      metadata: { 
        targetRole: 'admin',
        reason: 'Sensitive profile access'
      },
      ...getRequestInfo(req)
    });
  }
  
  return { status: 200, body: { user } };
}
```

#### Audit Log Exports:

```javascript
// Log when users export/download audit logs
async function exportAuditLogs(req, { logger }) {
  const logs = await fetchAuditLogs(req.queryParams);
  
  await logAudit({
    userId: req.user.userId,
    action: 'EXPORT',
    entityType: 'audit_logs',
    metadata: { 
      recordCount: logs.length,
      filters: req.queryParams 
    },
    ...getRequestInfo(req)
  });
  
  return { status: 200, body: { logs } };
}
```

### 3. Log Failed Authorization Attempts

**Status:** ⏳ Recommended for Implementation

Track privilege escalation attempts:

```javascript
// In middleware/auth.js
async function adminOnly(req, ctx, next) {
  if (!req.user || req.user.role !== 'admin') {
    // Log failed admin access attempt
    await logAudit({
      userId: req.user?.userId || null,
      action: 'ACCESS_DENIED',
      entityType: 'endpoint',
      metadata: {
        endpoint: req.path,
        method: req.method,
        requiredRole: 'admin',
        actualRole: req.user?.role || 'none',
        reason: 'Insufficient permissions'
      },
      ipAddress: getClientIP(req),
      userAgent: getUserAgent(req)
    });
    
    return { status: 403, body: { error: 'Admin access required' } };
  }
  
  return next();
}
```

### 4. Implement Activity Monitoring

**Status:** ✅ Partially Implemented (activity.log)

Continue using `logs/activity.log` for:
- Authentication events
- Security-relevant operations
- System errors
- Performance issues

---

## Audit Log Retention Policy

### Retention Periods

| Log Type | Retention Period | Archival Strategy |
|----------|------------------|-------------------|
| Authentication logs | 90 days active, 1 year archive | Compress and move to cold storage |
| CUD operations | 1 year active, 7 years archive | Annual compliance exports |
| Failed access attempts | 180 days active, 1 year archive | Security incident reviews |
| Read logs (if enabled) | 30 days active, 90 days archive | Minimal retention due to volume |

### Implementation

```sql
-- Archive old audit logs (run monthly)
CREATE TABLE audit_logs_archive (
  LIKE audit_logs INCLUDING ALL
);

-- Move logs older than 1 year to archive
INSERT INTO audit_logs_archive
SELECT * FROM audit_logs
WHERE created_at < NOW() - INTERVAL '1 year';

-- Delete archived logs from main table
DELETE FROM audit_logs
WHERE created_at < NOW() - INTERVAL '1 year';

-- Vacuum to reclaim space
VACUUM ANALYZE audit_logs;
```

---

## Audit Log Queries

### Common Audit Queries

#### 1. User Activity Report

```sql
SELECT 
  u.email,
  al.action,
  al.entity_type,
  al.entity_id,
  al.created_at,
  al.ip_address
FROM audit_logs al
JOIN users u ON al.user_id = u.id
WHERE al.created_at >= NOW() - INTERVAL '30 days'
ORDER BY al.created_at DESC;
```

#### 2. Failed Access Attempts

```sql
SELECT 
  u.email,
  al.metadata->>'endpoint' as endpoint,
  al.metadata->>'requiredRole' as required_role,
  al.metadata->>'actualRole' as actual_role,
  al.ip_address,
  al.created_at
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
WHERE al.action = 'ACCESS_DENIED'
AND al.created_at >= NOW() - INTERVAL '7 days'
ORDER BY al.created_at DESC;
```

#### 3. Data Modification History

```sql
SELECT 
  u.email as modified_by,
  al.action,
  al.entity_type,
  al.entity_id,
  al.changes->>'old' as before_state,
  al.changes->>'new' as after_state,
  al.created_at
FROM audit_logs al
JOIN users u ON al.user_id = u.id
WHERE al.entity_type = 'user'
AND al.entity_id = 'TARGET_USER_ID'
ORDER BY al.created_at DESC;
```

#### 4. Admin Operations Audit

```sql
SELECT 
  u.email as admin_user,
  al.action,
  al.entity_type,
  al.entity_id,
  al.metadata,
  al.created_at
FROM audit_logs al
JOIN users u ON al.user_id = u.id
WHERE u.role = 'admin'
AND al.created_at >= NOW() - INTERVAL '90 days'
ORDER BY al.created_at DESC;
```

#### 5. Privilege Escalation Attempts

```sql
SELECT 
  u.email,
  al.metadata->>'endpoint' as endpoint,
  al.metadata->>'targetRole' as target_role,
  al.ip_address,
  COUNT(*) as attempt_count,
  MAX(al.created_at) as last_attempt
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
WHERE al.action = 'ACCESS_DENIED'
AND al.metadata->>'reason' LIKE '%privilege%'
GROUP BY u.email, al.metadata->>'endpoint', al.metadata->>'targetRole', al.ip_address
HAVING COUNT(*) > 3
ORDER BY attempt_count DESC;
```

---

## Compliance Reporting

### GDPR Data Access Request

```javascript
async function generateGDPRReport(userId) {
  const auditLogs = await query(`
    SELECT 
      action,
      entity_type,
      entity_id,
      changes,
      metadata,
      ip_address,
      user_agent,
      created_at
    FROM audit_logs
    WHERE user_id = $1
    OR (changes->>'new')::jsonb->>'id' = $1
    OR (changes->>'old')::jsonb->>'id' = $1
    ORDER BY created_at DESC
  `, [userId]);
  
  return {
    userId,
    dataAccessed: auditLogs.rows,
    generatedAt: new Date(),
    format: 'JSON'
  };
}
```

### Compliance Export Script

```bash
#!/bin/bash
# Export audit logs for compliance review

psql $DATABASE_URL -c "COPY (
  SELECT 
    al.*,
    u.email as user_email
  FROM audit_logs al
  LEFT JOIN users u ON al.user_id = u.id
  WHERE al.created_at >= NOW() - INTERVAL '1 year'
) TO '/tmp/audit_export_$(date +%Y%m%d).csv' WITH CSV HEADER;"
```

---

## Performance Optimization

### 1. Async Audit Logging

Log audit entries asynchronously to avoid blocking requests:

```javascript
// Don't await audit log writes
logAudit({...}).catch(err => logger.error('Audit log failed:', err));

// Or use a queue
auditQueue.add({ userId, action, entityType, entityId });
```

### 2. Batch Inserts

For high-volume operations, batch audit logs:

```javascript
const auditBatch = [];

// Collect logs
auditBatch.push({ userId, action, entityType, entityId });

// Flush periodically
if (auditBatch.length >= 100) {
  await batchInsertAuditLogs(auditBatch);
  auditBatch.length = 0;
}
```

### 3. Partitioning

Partition audit logs by month for better performance:

```sql
CREATE TABLE audit_logs (
  id UUID DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  -- other columns...
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_logs_2024_11 PARTITION OF audit_logs
FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');

CREATE TABLE audit_logs_2024_12 PARTITION OF audit_logs
FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
```

---

## Monitoring & Alerting

### Alert Triggers

Set up alerts for:

1. **Excessive Failed Logins**
   ```sql
   SELECT COUNT(*) FROM audit_logs
   WHERE action = 'ACCESS_DENIED'
   AND created_at >= NOW() - INTERVAL '1 hour'
   HAVING COUNT(*) > 10;
   ```

2. **Admin Account Changes**
   ```sql
   SELECT * FROM audit_logs
   WHERE entity_type = 'user'
   AND (changes->>'new')::jsonb->>'role' = 'admin'
   AND created_at >= NOW() - INTERVAL '1 hour';
   ```

3. **Unusual Activity Patterns**
   ```sql
   SELECT user_id, COUNT(*) as action_count
   FROM audit_logs
   WHERE created_at >= NOW() - INTERVAL '15 minutes'
   GROUP BY user_id
   HAVING COUNT(*) > 50;
   ```

---

## Security Considerations

### 1. Audit Log Protection

- ✅ Never allow modification of audit logs
- ✅ Only admins can view audit logs
- ✅ Log audit log exports (meta-logging)
- ✅ Store IP address and User-Agent for correlation

### 2. Sensitive Data Handling

```javascript
// Don't log passwords or tokens
const { password_hash, ...userWithoutPassword } = user;

await logAudit({
  changes: {
    old: sanitizeUser(oldUser),
    new: sanitizeUser(newUser)
  }
});

function sanitizeUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}
```

### 3. GDPR Compliance

- Log only necessary PII
- Provide audit log export for data subject requests
- Implement right-to-be-forgotten (anonymize audit logs)

---

## Conclusion

### Current Status: ✅ **Well-Implemented**

The current audit logging strategy is **appropriate** for the application's security and compliance needs:

- ✅ All data modifications logged
- ✅ Authentication events tracked
- ✅ IP address and User-Agent captured
- ✅ Before/after state preserved
- ⏳ Consider adding failed access attempt logging
- ⏳ Consider adding sensitive read operation logging

### Recommended Next Steps

1. ✅ **Keep current CUD logging** - No changes needed
2. ⏳ **Add ACCESS_DENIED logging** - Track privilege escalation attempts
3. ⏳ **Add selective read logging** - Only for admin profile views
4. ⏳ **Implement log retention policy** - Archive old logs
5. ⏳ **Add monitoring alerts** - Detect suspicious activity

---

*Last Updated: November 22, 2025*
*Version: 1.0*
