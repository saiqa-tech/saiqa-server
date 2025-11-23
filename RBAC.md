# RBAC (Role-Based Access Control) Documentation

## Role Hierarchy

Saiqa implements a **three-tier role hierarchy**:

```
┌─────────────────────────────────────────┐
│              ADMIN (Highest)             │
│  ┌───────────────────────────────────┐  │
│  │        MANAGER (Middle)           │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │      USER (Lowest)          │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Role Definitions

| Role | Description | Privileges |
|------|-------------|------------|
| **admin** | System administrator | Full access to all resources and operations |
| **manager** | Department/unit manager | Can manage users (except admins), units, and designations |
| **user** | Standard user | Read-only access to most resources |

---

## RBAC Enforcement Strategy

### 1. Middleware-Level Enforcement

All protected endpoints use authentication and authorization middleware:

```javascript
const config = {
  name: 'StepName',
  type: 'api',
  path: '/api/endpoint',
  method: 'METHOD',
  middleware: [authenticate, adminOnly] // or managerOrAdmin
};
```

**Available Middleware:**
- `authenticate` - Verifies JWT token, attaches user to request
- `adminOnly` - Only admin role can access
- `managerOrAdmin` - Manager or admin roles can access
- `authorize(role1, role2, ...)` - Custom role list

### 2. Handler-Level Validation

Additional RBAC checks within handlers for complex scenarios:

```javascript
// Prevent privilege escalation
if (req.user.role !== 'admin' && currentUser.role === 'admin') {
  return { status: 403, body: { error: 'Only admins can update admin users' } };
}
```

### 3. Defense in Depth

Multiple layers of RBAC checks:
1. **Middleware** - Primary gatekeeper
2. **Handler** - Business logic validation
3. **Database** - Foreign key constraints and triggers

---

## Endpoint Access Matrix

### Authentication Endpoints
| Endpoint | Method | Access | RBAC Enforced |
|----------|--------|--------|---------------|
| `/api/auth/login` | POST | Public | ❌ None |
| `/api/auth/refresh` | POST | Public | ❌ None |
| `/api/auth/logout` | POST | Authenticated | ✅ Any authenticated user |
| `/api/auth/change-password` | POST | Authenticated | ✅ Own password only |
| `/api/auth/me` | GET | Authenticated | ✅ Own profile only |

### User Management
| Endpoint | Method | Admin | Manager | User | Notes |
|----------|--------|-------|---------|------|-------|
| `GET /api/users` | GET | ✅ | ✅ | ❌ | List all users |
| `GET /api/users/:id` | GET | ✅ | ✅ | ❌ | View user details |
| `POST /api/users` | POST | ✅ | ❌ | ❌ | **Admin-only** create user |
| `PUT /api/users/:id` | PUT | ✅ | ✅* | ❌ | Update user (see rules below) |
| `DELETE /api/users/:id` | DELETE | ✅ | ❌ | ❌ | **Admin-only** delete user |
| `POST /api/users/:id/reset-password` | POST | ✅ | ❌ | ❌ | **Admin-only** reset password |

**User Update Rules:**
- ✅ **Admin** can update anyone (including other admins)
- ✅ **Manager** can update users and managers (NOT admins)
- ❌ **Manager** CANNOT change roles
- ❌ **Manager** CANNOT promote users to admin
- ❌ **Manager** CANNOT update admin users
- ❌ Users cannot update themselves (use change-password instead)

### Unit Management
| Endpoint | Method | Admin | Manager | User | Notes |
|----------|--------|-------|---------|------|-------|
| `GET /api/units` | GET | ✅ | ✅ | ✅ | List all units |
| `GET /api/units/:id` | GET | ✅ | ✅ | ✅ | View unit details |
| `POST /api/units` | POST | ✅ | ✅ | ❌ | Create unit |
| `PUT /api/units/:id` | PUT | ✅ | ✅ | ❌ | Update unit |
| `DELETE /api/units/:id` | DELETE | ✅ | ✅ | ❌ | Delete unit (soft) |

**Unit Constraints:**
- ❌ Cannot delete unit with child units
- ❌ Cannot delete unit with assigned users
- ❌ Cannot set unit as its own parent (circular reference)

### Designation Management
| Endpoint | Method | Admin | Manager | User | Notes |
|----------|--------|-------|---------|------|-------|
| `GET /api/designations` | GET | ✅ | ✅ | ✅ | List all designations |
| `GET /api/designations/:id` | GET | ✅ | ✅ | ✅ | View designation details |
| `POST /api/designations` | POST | ✅ | ✅ | ❌ | Create designation |
| `PUT /api/designations/:id` | PUT | ✅ | ✅ | ❌ | Update designation |
| `DELETE /api/designations/:id` | DELETE | ✅ | ✅ | ❌ | Delete designation (soft) |

**Designation Constraints:**
- ❌ Cannot delete designation with assigned users

---

## RBAC Security Rules

### Critical Rules (Privilege Escalation Prevention)

1. **Admin Protection**
   - Only admins can create admin users
   - Only admins can update admin users
   - Only admins can delete admin users
   - Managers CANNOT interact with admin accounts

2. **Role Change Restrictions**
   - Only admins can change user roles
   - Managers cannot change any roles (not even user→manager)
   - Prevents horizontal and vertical privilege escalation

3. **Self-Service Restrictions**
   - Users cannot delete their own accounts
   - Users must use `/auth/change-password` for password changes
   - Admins cannot bypass password change requirements for themselves

### Validation Flow

```javascript
// Example: Updating a user
async function handler(req, { logger }) {
  const targetUser = await getUser(req.pathParams.id);
  
  // RBAC Check 1: Middleware already verified req.user.role
  // RBAC Check 2: Can requester modify target?
  if (req.user.role !== 'admin' && targetUser.role === 'admin') {
    return { status: 403, body: { error: 'Only admins can update admin users' } };
  }
  
  // RBAC Check 3: Can requester change roles?
  if (req.body.role && req.body.role !== targetUser.role) {
    if (req.user.role !== 'admin') {
      return { status: 403, body: { error: 'Only admins can change user roles' } };
    }
  }
  
  // RBAC Check 4: Is new role escalation attempt?
  if (req.body.role === 'admin' && req.user.role !== 'admin') {
    return { status: 403, body: { error: 'Only admins can grant admin privileges' } };
  }
  
  // Proceed with update...
}
```

---

## RBAC Implementation Checklist

### For New Endpoints

When adding a new endpoint, follow this checklist:

- [ ] **1. Define Required Role**
  - Public, Authenticated, Manager+, or Admin-only?

- [ ] **2. Add Middleware**
  ```javascript
  middleware: [authenticate, adminOnly] // or managerOrAdmin
  ```

- [ ] **3. Implement Handler Checks**
  - Check if target resource belongs to higher-privilege user
  - Validate role changes if applicable
  - Prevent self-modification where inappropriate

- [ ] **4. Test Access Scenarios**
  - Admin accessing endpoint ✅
  - Manager accessing endpoint ✅/❌
  - User accessing endpoint ❌
  - Unauthenticated accessing endpoint ❌

- [ ] **5. Test Privilege Escalation**
  - Manager trying to update admin ❌
  - Manager trying to change roles ❌
  - User trying to grant themselves admin ❌

- [ ] **6. Document in Access Matrix**
  - Add endpoint to this document
  - Specify access rules and constraints

---

## Testing RBAC

### Manual Testing Commands

```bash
# 1. Login as admin
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@saiqa.dev","password":"Admin@123"}' \
  -c admin-cookies.txt

# 2. Login as manager (if exists)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@example.com","password":"ManagerPass"}' \
  -c manager-cookies.txt

# 3. Try manager accessing admin-only endpoint (should fail)
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test@123","firstName":"Test","lastName":"User","role":"user"}' \
  -b manager-cookies.txt
# Expected: 403 Forbidden

# 4. Try manager updating admin user (should fail)
curl -X PUT http://localhost:3000/api/users/ADMIN_USER_ID \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Hacked"}' \
  -b manager-cookies.txt
# Expected: 403 Forbidden

# 5. Try manager changing user role (should fail)
curl -X PUT http://localhost:3000/api/users/USER_ID \
  -H "Content-Type: application/json" \
  -d '{"role":"admin"}' \
  -b manager-cookies.txt
# Expected: 403 Forbidden
```

### Automated Test Scenarios

```javascript
// Example test cases
describe('RBAC Tests', () => {
  test('Manager cannot update admin users', async () => {
    // Login as manager, attempt to update admin
    // Expect 403
  });
  
  test('Manager cannot change user roles', async () => {
    // Login as manager, attempt to change role field
    // Expect 403
  });
  
  test('Admin can update any user', async () => {
    // Login as admin, update another admin
    // Expect 200
  });
  
  test('Unauthenticated cannot access protected endpoint', async () => {
    // Access protected endpoint without token
    // Expect 401
  });
});
```

---

## RBAC Audit Logging

All RBAC-protected operations are logged to the `audit_logs` table:

```sql
SELECT 
  u.email as actor,
  al.action,
  al.entity_type,
  al.entity_id,
  al.created_at,
  al.ip_address
FROM audit_logs al
JOIN users u ON al.user_id = u.id
WHERE al.action IN ('CREATE', 'UPDATE', 'DELETE')
ORDER BY al.created_at DESC;
```

**Logged Operations:**
- User creation (admin-only)
- User updates (including role changes)
- User deletion (soft delete)
- Password resets (admin-only)
- Unit/designation CRUD operations

---

## Troubleshooting RBAC Issues

### Common Errors

1. **403 Forbidden - "Only admins can..."**
   - Cause: User role insufficient for operation
   - Solution: Verify user's role matches required permission level

2. **401 Unauthorized - "Authentication required"**
   - Cause: Missing or invalid JWT token
   - Solution: Ensure cookies are sent with request (`credentials: 'include'`)

3. **403 Forbidden - "Only admins can change user roles"**
   - Cause: Manager attempting to change role field
   - Solution: Remove `role` field from update request

4. **403 Forbidden - "Only admins can update admin users"**
   - Cause: Manager attempting to modify admin user
   - Solution: Verify target user is not an admin

### Debugging RBAC

Enable detailed RBAC logging:

```javascript
// In middleware/auth.js (temporary)
console.log('RBAC Check:', {
  requesterRole: req.user.role,
  targetUserRole: targetUser?.role,
  requestedRoleChange: req.body.role,
  endpoint: req.path
});
```

---

## Future RBAC Enhancements

### Potential Improvements

1. **Granular Permissions**
   - Move from role-based to permission-based (e.g., `users.create`, `users.update`)
   - Implement permission matrix

2. **Resource Ownership**
   - Users can update their own profile
   - Managers can only manage users in their unit

3. **Audit Trail Enhancement**
   - Log all RBAC denials (failed 403 attempts)
   - Track privilege escalation attempts

4. **Role Inheritance**
   - Define role hierarchies with automatic permission inheritance
   - Custom roles beyond admin/manager/user

5. **Time-Based Permissions**
   - Temporary elevated privileges
   - Scheduled role changes

---

## Related Documentation

- [MIGRATION_STATUS.md](./MIGRATION_STATUS.md) - Migration details
- [MIGRATION_COMPLETE.md](./MIGRATION_COMPLETE.md) - Testing guide
- [middleware/auth.js](./middleware/auth.js) - RBAC middleware implementation
- [migrations/001_initial_schema.js](./migrations/001_initial_schema.js) - Database schema

---

*Last Updated: November 22, 2025*
*Version: 1.0*
