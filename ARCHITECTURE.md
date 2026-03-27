# Saiqa Server - Complete Architecture Documentation

**Version:** 1.0.0  
**Last Updated:** February 5, 2026  
**Node.js Version:** >=24.0.0  
**Framework:** Motia v0.11.2-beta.156

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture Patterns](#architecture-patterns)
4. [Directory Structure](#directory-structure)
5. [Core Components](#core-components)
6. [Database Architecture](#database-architecture)
7. [API Architecture](#api-architecture)
8. [Authentication & Authorization](#authentication--authorization)
9. [CheckOps Integration](#checkops-integration)
10. [Logging & Monitoring](#logging--monitoring)
11. [Security Architecture](#security-architecture)
12. [Data Flow](#data-flow)
13. [Deployment Architecture](#deployment-architecture)
14. [Performance Considerations](#performance-considerations)

---

## 1. System Overview

### Purpose
Saiqa Server is an enterprise-grade Node.js backend application built on the Motia framework, providing:
- User management with RBAC (Role-Based Access Control)
- Organizational structure management (Units & Designations)
- CheckOps integration for dynamic form management
- Comprehensive audit logging and security features
- RESTful API for client applications

### Key Characteristics
- **Framework:** Motia-based (convention-over-configuration)
- **Architecture:** Step-based API routing with middleware pipeline
- **Database:** PostgreSQL with UUID primary keys
- **Authentication:** JWT-based with refresh tokens
- **Authorization:** Three-tier role hierarchy (admin, manager, user)
- **Integration:** CheckOps v4.0.0 for form/submission management


---

## 2. Technology Stack

### Core Technologies
| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Runtime** | Node.js | >=24.0.0 | JavaScript runtime |
| **Framework** | Motia | 0.11.2-beta.156 | API framework with auto-discovery |
| **Database** | PostgreSQL | 8.16.3+ | Primary data store |
| **ORM/Query** | pg (node-postgres) | 8.16.3 | Direct SQL queries |
| **Authentication** | jsonwebtoken | 9.0.2 | JWT token generation/verification |
| **Password Hashing** | bcrypt | 6.0.0 | Secure password storage |
| **Logging** | winston | 3.18.3 | Structured logging |
| **Environment** | dotenv | 17.2.3 | Configuration management |

### Key Dependencies
```json
{
  "@saiqa-tech/checkops": "^4.0.0",    // Form management system
  "cookie-parser": "^1.4.7",            // Cookie handling
  "cors": "^2.8.5",                     // Cross-origin requests
  "express-rate-limit": "^7.1.5",       // Rate limiting
  "uuid": "^13.0.0",                    // UUID generation
  "semver": "^7.5.4"                    // Version checking
}
```

### Development Tools
- **Testing:** Jest 29.7.0 + Supertest 7.1.4
- **Code Quality:** ESLint (via dependencies)
- **Version Control:** Git


---

## 3. Architecture Patterns

### 3.1 Motia Framework Pattern

**Convention-Over-Configuration:**
- Step files auto-discovered from `/steps` directory
- Each step defines an API endpoint with config + handler
- Middleware pipeline for authentication/authorization
- Automatic routing based on file naming

**Step File Structure:**
```javascript
const config = {
  name: 'StepName',           // Unique identifier
  type: 'api',                // Step type (api, task, etc.)
  path: '/api/endpoint',      // HTTP path
  method: 'GET',              // HTTP method
  middleware: [authenticate]  // Middleware chain
};

const handler = async (req, ctx) => {
  // Business logic
  return { status: 200, body: { data } };
};

module.exports = { config, handler };
```

### 3.2 Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                          │
│              (React/TanStack Router)                     │
└─────────────────────────────────────────────────────────┘
                          ↓ HTTP/REST
┌─────────────────────────────────────────────────────────┐
│                  API LAYER (Steps)                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Middleware: CORS → Auth → RBAC → Rate Limit    │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              BUSINESS LOGIC LAYER                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Handlers   │  │  Validators  │  │   Wrappers   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  DATA ACCESS LAYER                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  PostgreSQL  │  │   CheckOps   │  │  Audit Logs  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Security Patterns

**Defense in Depth:**
1. **Network Layer:** CORS, rate limiting
2. **Authentication Layer:** JWT verification
3. **Authorization Layer:** Role-based access control
4. **Business Logic Layer:** Input validation, privilege escalation prevention
5. **Data Layer:** SQL injection prevention, audit logging


---

## 4. Directory Structure

```
saiqa-server/
├── config/                      # Configuration files
│   └── database.js             # PostgreSQL connection pool
│
├── lib/                        # Business logic libraries
│   ├── checkops-wrapper.js     # CheckOps ES module bridge
│   ├── checkops-validation.js  # Form/question validation
│   ├── checkops-question-id-mapper.js  # Question ID mapping
│   ├── checkops-finding-validator.js   # Finding validation
│   └── transaction-wrapper.js  # Database transaction helper
│
├── middleware/                 # Express/Motia middleware
│   ├── auth.js                # JWT authentication & RBAC
│   ├── checkops-rate-limit.js # Rate limiting for CheckOps
│   └── logger.js              # Request logging middleware
│
├── migrations/                 # Database migrations
│   ├── 001_initial_schema.js  # Users, units, designations
│   ├── 002_add_user_preferences.js
│   ├── 003_add_entity_sid_to_audit_logs.js
│   └── 004_create_config_table.js
│
├── scripts/                    # Utility scripts
│   ├── migrate.js             # Migration runner
│   ├── setup-checkops.js      # CheckOps initialization
│   ├── verify-migrations.js   # Migration verification
│   └── check-node-version.js  # Node version check
│
├── steps/                      # API endpoints (Motia steps)
│   ├── auth-*.step.js         # Authentication endpoints
│   ├── users-*.step.js        # User management
│   ├── units-*.step.js        # Unit management
│   ├── designations-*.step.js # Designation management
│   ├── checkops-forms-*.step.js      # Form management
│   ├── checkops-submissions-*.step.js # Submission management
│   ├── checkops-findings-*.step.js   # Finding management
│   └── config-*.step.js       # Configuration endpoints
│
├── tests/                      # Test files
│   ├── helpers/               # Test utilities
│   ├── checkops-*.test.js     # CheckOps tests
│   └── cookie-utils.test.js   # Cookie utility tests
│
├── utils/                      # Utility functions
│   ├── audit.js               # Audit logging
│   ├── auth.js                # JWT & password utilities
│   ├── config.js              # Configuration cache
│   ├── cookies.js             # Cookie parsing/creation
│   ├── logger.js              # Winston logger setup
│   ├── password.js            # Password validation
│   └── request.js             # Request helper utilities
│
├── logs/                       # Application logs
│   ├── activity.log           # General activity
│   └── error.log              # Error logs
│
├── .env                        # Environment variables
├── .env.example               # Environment template
├── motia.config.js            # Motia framework config
├── package.json               # Dependencies & scripts
└── index.js                   # Entry point (empty - Motia handles)
```


---

## 5. Core Components

### 5.1 Motia Configuration (`motia.config.js`)

**Purpose:** Central configuration for the Motia framework

**Key Features:**
- Port configuration (3002)
- CORS setup for multiple origins
- Lifecycle hooks (onStart)
- Configuration cache initialization

```javascript
{
  port: 3002,
  logging: { level: 'info' },
  app(app) {
    // CORS middleware
    app.use(cors({ origin: [...], credentials: true }));
  },
  async onStart() {
    // Initialize config cache
    await initializeConfigCache();
  }
}
```

### 5.2 Database Connection Pool (`config/database.js`)

**Features:**
- PostgreSQL connection pooling
- Query execution with timing
- Client checkout with timeout monitoring
- Error handling and process exit on critical errors

**Methods:**
- `query(text, params)` - Execute parameterized queries
- `getClient()` - Get connection from pool with timeout tracking
- `pool` - Direct access to pg.Pool instance

### 5.3 CheckOps Wrapper (`lib/checkops-wrapper.js`)

**Purpose:** Bridge between CommonJS (saiqa-server) and ES Modules (CheckOps)

**Architecture:**
```
┌──────────────────────────────────────────────┐
│         Saiqa Server (CommonJS)              │
│  ┌────────────────────────────────────────┐ │
│  │     CheckOpsWrapper (Singleton)        │ │
│  │  ┌──────────────────────────────────┐ │ │
│  │  │  Dynamic Import (ES Modules)     │ │ │
│  │  │  @saiqa-tech/checkops v4.0.0     │ │ │
│  │  └──────────────────────────────────┘ │ │
│  └────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

**Key Methods:**
- Form Management: `createForm`, `getForm`, `updateForm`, `deleteForm`
- Question Management: `createQuestion`, `getQuestion`, `updateQuestion`
- Submission Management: `createSubmission`, `getSubmissionsByForm`
- Finding Management: `createFinding`, `getFinding`, `updateFinding`
- Monitoring: `getHealthStatus`, `getCacheStats`, `getMetrics`

### 5.4 Authentication Middleware (`middleware/auth.js`)

**Middleware Functions:**

1. **authenticate** - Verifies JWT token from cookies
   ```javascript
   req.user = { userId, email, role }
   ```

2. **authorize(...roles)** - Role-based access control
   ```javascript
   authorize('admin', 'manager')
   ```

3. **adminOnly** - Admin-only access
4. **managerOrAdmin** - Manager or admin access


---

## 6. Database Architecture

### 6.1 Schema Overview

```sql
┌─────────────────────────────────────────────────────────┐
│                    CORE TABLES                           │
├─────────────────────────────────────────────────────────┤
│  users                                                   │
│  ├── id (UUID, PK)                                      │
│  ├── email (UNIQUE)                                     │
│  ├── password_hash                                      │
│  ├── role (admin|manager|user)                          │
│  ├── unit_id (FK → units)                              │
│  ├── designation_id (FK → designations)                │
│  └── metadata (JSONB)                                   │
├─────────────────────────────────────────────────────────┤
│  units                                                   │
│  ├── id (UUID, PK)                                      │
│  ├── name, code (UNIQUE)                                │
│  ├── parent_unit_id (FK → units, self-reference)       │
│  └── metadata (JSONB)                                   │
├─────────────────────────────────────────────────────────┤
│  designations                                            │
│  ├── id (UUID, PK)                                      │
│  ├── title, code (UNIQUE)                               │
│  ├── level (INTEGER)                                    │
│  └── metadata (JSONB)                                   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                 AUTHENTICATION TABLES                    │
├─────────────────────────────────────────────────────────┤
│  refresh_tokens                                          │
│  ├── id (UUID, PK)                                      │
│  ├── user_id (FK → users)                              │
│  ├── token_hash                                         │
│  └── expires_at                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   AUDIT & CONFIG                         │
├─────────────────────────────────────────────────────────┤
│  audit_logs                                              │
│  ├── id (UUID, PK)                                      │
│  ├── user_id (FK → users)                              │
│  ├── action (CREATE|UPDATE|DELETE|LOGIN|...)           │
│  ├── entity_type, entity_id                             │
│  ├── entity_sid (human-readable ID)                     │
│  ├── changes (JSONB)                                    │
│  ├── ip_address, user_agent                             │
│  └── created_at                                         │
├─────────────────────────────────────────────────────────┤
│  config                                                  │
│  ├── id (UUID, PK)                                      │
│  ├── key (UNIQUE)                                       │
│  ├── value (JSONB)                                      │
│  └── updated_at                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              CHECKOPS TABLES (Managed by CheckOps)      │
├─────────────────────────────────────────────────────────┤
│  forms, question_bank, submissions, findings            │
│  (See CheckOps documentation for schema details)        │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Key Relationships

**User → Unit → Parent Unit (Hierarchical)**
```
Organization
  ├── Department A
  │   ├── Team A1
  │   └── Team A2
  └── Department B
```

**User → Designation (Job Title/Level)**
```
User: John Doe
  ├── Unit: Engineering Team
  └── Designation: Senior Developer (Level 5)
```

### 6.3 Indexes

**Performance Optimization:**
- Email lookups: `idx_users_email`
- Role filtering: `idx_users_role`
- Unit hierarchy: `idx_units_parent_unit_id`
- Audit queries: `idx_audit_logs_created_at`, `idx_audit_logs_entity_type`
- JSONB searches: GIN indexes on metadata columns

### 6.4 Triggers

**Automatic Timestamp Updates:**
```sql
CREATE TRIGGER update_users_updated_at 
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```


---

## 7. API Architecture

### 7.1 Endpoint Categories

#### Authentication Endpoints (`/api/auth/*`)
| Endpoint | Method | Access | Purpose |
|----------|--------|--------|---------|
| `/api/auth/login` | POST | Public | User login with JWT |
| `/api/auth/logout` | POST | Authenticated | Invalidate refresh token |
| `/api/auth/refresh` | POST | Public | Refresh access token |
| `/api/auth/change-password` | POST | Authenticated | Change own password |
| `/api/auth/me` | GET | Authenticated | Get current user profile |

#### User Management (`/api/users/*`)
| Endpoint | Method | RBAC | Purpose |
|----------|--------|------|---------|
| `/api/users` | GET | Manager+ | List all users |
| `/api/users/:id` | GET | Manager+ | Get user details |
| `/api/users` | POST | Admin | Create new user |
| `/api/users/:id` | PUT | Manager+* | Update user |
| `/api/users/:id` | DELETE | Admin | Delete user (soft) |
| `/api/users/:id/reset-password` | POST | Admin | Reset user password |
| `/api/users/:id/preferences` | GET | Self | Get user preferences |
| `/api/users/:id/preferences` | PUT | Self | Update preferences |

*Managers cannot update admin users or change roles

#### Unit Management (`/api/units/*`)
| Endpoint | Method | RBAC | Purpose |
|----------|--------|------|---------|
| `/api/units` | GET | All | List all units |
| `/api/units/:id` | GET | All | Get unit details |
| `/api/units` | POST | Manager+ | Create unit |
| `/api/units/:id` | PUT | Manager+ | Update unit |
| `/api/units/:id` | DELETE | Manager+ | Delete unit (soft) |

#### Designation Management (`/api/designations/*`)
| Endpoint | Method | RBAC | Purpose |
|----------|--------|------|---------|
| `/api/designations` | GET | All | List designations |
| `/api/designations/:id` | GET | All | Get designation |
| `/api/designations` | POST | Manager+ | Create designation |
| `/api/designations/:id` | PUT | Manager+ | Update designation |
| `/api/designations/:id` | DELETE | Manager+ | Delete designation |

#### CheckOps Forms (`/api/checkops/forms/*`)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/checkops/forms` | GET | List all forms |
| `/api/checkops/forms/:id` | GET | Get form details |
| `/api/checkops/forms` | POST | Create new form |
| `/api/checkops/forms/:id` | PUT | Update form |
| `/api/checkops/forms/:id` | DELETE | Delete form |

#### CheckOps Submissions (`/api/checkops/submissions/*`)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/checkops/submissions` | POST | Create submission |
| `/api/checkops/submissions` | GET | List submissions |
| `/api/checkops/submissions/stats` | GET | Submission statistics |

#### CheckOps Findings (`/api/checkops/findings/*`)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/checkops/findings` | GET | List findings |
| `/api/checkops/findings/:id` | GET | Get finding details |
| `/api/checkops/findings` | POST | Create finding |
| `/api/checkops/findings/:id` | PUT | Update finding |
| `/api/checkops/findings/:id` | DELETE | Delete finding |
| `/api/checkops/findings/stats` | GET | Finding statistics |
| `/api/checkops/findings/allowed-values` | GET | Get allowed field values |

#### Configuration (`/api/config/*`)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/config` | GET | Get all config |
| `/api/config/:key` | GET | Get config by key |

### 7.2 Request/Response Format

**Standard Success Response:**
```json
{
  "status": 200,
  "body": {
    "data": { ... },
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10
    }
  }
}
```

**Standard Error Response:**
```json
{
  "status": 400,
  "body": {
    "error": "Validation failed",
    "details": ["Email is required", "Password too short"]
  }
}
```

### 7.3 Pagination

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `search` - Search term
- `sort` - Sort field
- `order` - Sort order (asc/desc)


---

## 8. Authentication & Authorization

### 8.1 JWT Authentication Flow

```
┌─────────────┐                                    ┌─────────────┐
│   Client    │                                    │   Server    │
└──────┬──────┘                                    └──────┬──────┘
       │                                                  │
       │  1. POST /api/auth/login                        │
       │     { email, password }                         │
       ├────────────────────────────────────────────────>│
       │                                                  │
       │                                    2. Verify credentials
       │                                    3. Generate tokens
       │                                                  │
       │  4. Set-Cookie: accessToken (15min)             │
       │     Set-Cookie: refreshToken (7days)            │
       │<────────────────────────────────────────────────┤
       │                                                  │
       │  5. GET /api/users (with cookies)               │
       ├────────────────────────────────────────────────>│
       │                                                  │
       │                                    6. Verify accessToken
       │                                    7. Check RBAC
       │                                                  │
       │  8. Response with data                          │
       │<────────────────────────────────────────────────┤
       │                                                  │
       │  9. POST /api/auth/refresh (when expired)       │
       ├────────────────────────────────────────────────>│
       │                                                  │
       │                                    10. Verify refreshToken
       │                                    11. Generate new accessToken
       │                                                  │
       │  12. Set-Cookie: accessToken (new)              │
       │<────────────────────────────────────────────────┤
```

### 8.2 Token Structure

**Access Token (15 minutes):**
```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "role": "admin",
  "iat": 1234567890,
  "exp": 1234568790
}
```

**Refresh Token (7 days):**
- Stored as hash in `refresh_tokens` table
- Used only for token refresh endpoint
- Invalidated on logout

### 8.3 RBAC (Role-Based Access Control)

**Role Hierarchy:**
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

**Permission Matrix:**

| Operation | Admin | Manager | User |
|-----------|-------|---------|------|
| Create users | ✅ | ❌ | ❌ |
| Update users | ✅ | ✅* | ❌ |
| Delete users | ✅ | ❌ | ❌ |
| Change roles | ✅ | ❌ | ❌ |
| Reset passwords | ✅ | ❌ | ❌ |
| Manage units | ✅ | ✅ | ❌ |
| Manage designations | ✅ | ✅ | ❌ |
| View users | ✅ | ✅ | ❌ |
| View units | ✅ | ✅ | ✅ |
| View designations | ✅ | ✅ | ✅ |

*Managers cannot update admin users or change roles

### 8.4 Security Rules

**Privilege Escalation Prevention:**
1. Only admins can create admin users
2. Only admins can update admin users
3. Only admins can change user roles
4. Managers cannot promote users to admin
5. Users cannot delete their own accounts

**Implementation:**
```javascript
// Example: Prevent manager from updating admin
if (req.user.role !== 'admin' && targetUser.role === 'admin') {
  return { status: 403, body: { error: 'Only admins can update admin users' } };
}

// Example: Prevent role changes by non-admins
if (req.body.role && req.user.role !== 'admin') {
  return { status: 403, body: { error: 'Only admins can change user roles' } };
}
```


---

## 9. CheckOps Integration

### 9.1 Integration Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Saiqa Server                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │              API Layer (Steps)                     │  │
│  │  /api/checkops/forms/*                             │  │
│  │  /api/checkops/submissions/*                       │  │
│  │  /api/checkops/findings/*                          │  │
│  └────────────────────────────────────────────────────┘  │
│                          ↓                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │         CheckOps Wrapper (lib/)                    │  │
│  │  - checkops-wrapper.js (ES module bridge)         │  │
│  │  - checkops-validation.js (input validation)      │  │
│  │  - checkops-question-id-mapper.js (ID mapping)    │  │
│  │  - checkops-finding-validator.js (finding rules)  │  │
│  └────────────────────────────────────────────────────┘  │
│                          ↓                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │      @saiqa-tech/checkops v4.0.0 (ES Module)      │  │
│  │  - FormService, QuestionService                    │  │
│  │  - SubmissionService, FindingService               │  │
│  │  - CacheManager, MetricsCollector                  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│              PostgreSQL Database                          │
│  - forms, question_bank, submissions, findings           │
│  - option_history, sid_counters                          │
└──────────────────────────────────────────────────────────┘
```

### 9.2 CheckOps Features Used

**Form Management:**
- Dynamic form creation with questions
- Form versioning and activation/deactivation
- Question bank for reusable questions
- Option label history tracking

**Submission Management:**
- Form submission with validation
- Submission statistics and analytics
- Bulk submission operations

**Finding Management (v4.0.0):**
- Risk findings linked to submissions
- Severity levels (Critical, High, Medium, Low)
- Status tracking (Open, In Progress, Resolved, Closed)
- Category classification

**Performance Features:**
- Intelligent caching (LRU cache)
- Connection pooling (40 max, 5 min)
- Batch operations support
- Production metrics monitoring

### 9.3 Wrapper Pattern

**Why Wrapper?**
- CheckOps is ES Module, Saiqa is CommonJS
- Provides singleton instance management
- Adds error tracking and metrics
- Simplifies initialization

**Initialization:**
```javascript
const wrapper = getCheckOpsWrapper();
await wrapper.initialize({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 40,  // Connection pool size
  min: 5
});
```

### 9.4 ID System (v4.0.0)

**Dual ID System:**
- **UUID (id):** Internal database primary key
- **SID (sid):** Human-readable sequential ID (e.g., "FORM-0001")

**Benefits:**
- UUIDs prevent enumeration attacks
- SIDs provide user-friendly references
- Both supported in API queries


---

## 10. Logging & Monitoring

### 10.1 Logging Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   Application Events                      │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│                  Winston Logger                           │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────┐ │
│  │  Console       │  │  activity.log  │  │ error.log  │ │
│  │  (dev only)    │  │  (all logs)    │  │ (errors)   │ │
│  └────────────────┘  └────────────────┘  └────────────┘ │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│              Database (audit_logs table)                  │
│  - User actions (CREATE, UPDATE, DELETE)                 │
│  - Authentication events (LOGIN, LOGOUT)                 │
│  - Security events (ACCESS_DENIED)                       │
└──────────────────────────────────────────────────────────┘
```

### 10.2 Log Categories

**Activity Logs (`logs/activity.log`):**
```javascript
logActivity.auth('LOGIN_SUCCESS', { userId, email, role, ip });
logActivity.user('CREATE', userId, { email, role });
logActivity.api('POST', '/api/users', 201, userId, 45);
logActivity.security('ACCESS_DENIED', { endpoint, requiredRole });
```

**Error Logs (`logs/error.log`):**
```javascript
logActivity.error(error, { context: 'user-creation', userId });
```

**Audit Logs (Database):**
```javascript
await logAudit({
  userId: req.user.userId,
  action: 'CREATE',
  entityType: 'user',
  entityId: newUser.id,
  entitySid: newUser.sid,  // Human-readable ID
  changes: { old: null, new: userData },
  ipAddress: getClientIP(req),
  userAgent: getUserAgent(req)
});
```

### 10.3 Audit Log Strategy

**What Gets Logged:**
- ✅ All CREATE operations (users, units, designations, forms)
- ✅ All UPDATE operations (with before/after state)
- ✅ All DELETE operations (soft deletes)
- ✅ Authentication events (login, logout, password changes)
- ✅ Failed authorization attempts (403 responses)
- ❌ Read operations (too high volume, low security value)

**Audit Log Schema:**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  user_id UUID,                    -- Who performed action
  action VARCHAR(50),              -- CREATE, UPDATE, DELETE, LOGIN
  entity_type VARCHAR(100),        -- user, unit, designation, form
  entity_id UUID,                  -- UUID of affected entity
  entity_sid VARCHAR(50),          -- Human-readable ID (v4.0.0)
  changes JSONB,                   -- { old: {...}, new: {...} }
  metadata JSONB,                  -- Additional context
  ip_address VARCHAR(45),          -- Client IP
  user_agent TEXT,                 -- Browser/client info
  created_at TIMESTAMP
);
```

### 10.4 Monitoring Metrics

**CheckOps Metrics:**
```javascript
const metrics = wrapper.getMetrics();
// {
//   operations: 1234,
//   errors: 5,
//   errorRate: 0.004,
//   initialized: true,
//   initTime: '2026-02-05T10:00:00Z'
// }
```

**Health Check:**
```javascript
const health = await wrapper.getHealthStatus();
// {
//   status: 'healthy',
//   uptime: 3600000,
//   operations: 1234,
//   errors: 5,
//   monitoring: true
// }
```

**Cache Statistics:**
```javascript
const cacheStats = await wrapper.getCacheStats();
// {
//   hits: 890,
//   misses: 110,
//   hitRate: 0.89,
//   size: 45
// }
```


---

## 11. Security Architecture

### 11.1 Security Layers

```
┌──────────────────────────────────────────────────────────┐
│  Layer 1: Network Security                               │
│  - CORS (specific origins only)                          │
│  - Rate limiting (express-rate-limit)                    │
│  - HTTPS (production)                                    │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  Layer 2: Authentication                                 │
│  - JWT tokens (15min access, 7day refresh)              │
│  - Secure cookie storage (httpOnly, sameSite)           │
│  - Token rotation on refresh                             │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  Layer 3: Authorization (RBAC)                           │
│  - Role-based middleware (admin, manager, user)         │
│  - Privilege escalation prevention                       │
│  - Resource ownership validation                         │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  Layer 4: Input Validation                               │
│  - Request body validation                               │
│  - SQL injection prevention (parameterized queries)     │
│  - XSS prevention (output encoding)                      │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  Layer 5: Audit & Monitoring                             │
│  - Comprehensive audit logging                           │
│  - Failed access attempt tracking                        │
│  - Security event alerting                               │
└──────────────────────────────────────────────────────────┘
```

### 11.2 Password Security

**Hashing:**
- Algorithm: bcrypt
- Salt rounds: 10
- Password requirements enforced

**Password Policy:**
```javascript
// utils/password.js
{
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true
}
```

**Force Password Change:**
- New users must change password on first login
- Admin-reset passwords require change
- Tracked via `force_password_change` flag

### 11.3 Cookie Security

**Configuration:**
```javascript
{
  httpOnly: true,        // Prevent JavaScript access
  secure: true,          // HTTPS only (production)
  sameSite: 'strict',    // CSRF protection
  path: '/',
  maxAge: 900000         // 15 minutes (access token)
}
```

### 11.4 SQL Injection Prevention

**Parameterized Queries:**
```javascript
// ✅ SAFE
await query('SELECT * FROM users WHERE email = $1', [email]);

// ❌ UNSAFE (never do this)
await query(`SELECT * FROM users WHERE email = '${email}'`);
```

### 11.5 CORS Configuration

**Allowed Origins:**
```javascript
[
  'http://localhost:3000',      // React dev server
  'http://localhost:5173',      // Vite dev server
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL      // Production URL
]
```

**Credentials:** Enabled for cookie-based authentication

### 11.6 Rate Limiting

**CheckOps Endpoints:**
```javascript
// middleware/checkops-rate-limit.js
{
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
  message: 'Too many requests'
}
```

### 11.7 Environment Variables

**Sensitive Configuration:**
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=saiqa
DB_USER=postgres
DB_PASSWORD=***

# JWT
JWT_SECRET=***
JWT_REFRESH_SECRET=***

# CheckOps
CHECKOPS_ENABLED=true
CHECKOPS_POOL_MAX=40
```

**Security Best Practices:**
- Never commit `.env` file
- Use strong random secrets (32+ characters)
- Rotate secrets regularly
- Use different secrets per environment


---

## 12. Data Flow

### 12.1 User Login Flow

```
┌─────────┐                                              ┌─────────┐
│ Client  │                                              │ Server  │
└────┬────┘                                              └────┬────┘
     │                                                        │
     │ 1. POST /api/auth/login                               │
     │    { email, password }                                │
     ├──────────────────────────────────────────────────────>│
     │                                                        │
     │                                    2. Query users table
     │                                    3. Compare password hash
     │                                    4. Generate JWT tokens
     │                                    5. Store refresh token hash
     │                                    6. Log audit event
     │                                                        │
     │ 7. Set-Cookie: accessToken, refreshToken              │
     │    { user, requiresPasswordChange }                   │
     │<──────────────────────────────────────────────────────┤
     │                                                        │
     │ 8. Subsequent requests include cookies                │
     ├──────────────────────────────────────────────────────>│
     │                                                        │
     │                                    9. Verify accessToken
     │                                    10. Attach user to req
     │                                    11. Check RBAC
     │                                                        │
     │ 12. Response with data                                │
     │<──────────────────────────────────────────────────────┤
```

### 12.2 Form Creation Flow (CheckOps)

```
┌─────────┐                                              ┌─────────┐
│ Client  │                                              │ Server  │
└────┬────┘                                              └────┬────┘
     │                                                        │
     │ 1. POST /api/checkops/forms                           │
     │    { title, description, questions }                  │
     ├──────────────────────────────────────────────────────>│
     │                                                        │
     │                                    2. Authenticate user
     │                                    3. Validate form data
     │                                    4. Call CheckOpsWrapper
     │                                                        │
     │                                    ┌──────────────────┐
     │                                    │  CheckOps v4.0.0 │
     │                                    │  5. Create form  │
     │                                    │  6. Create Qs    │
     │                                    │  7. Generate SID │
     │                                    │  8. Cache form   │
     │                                    └──────────────────┘
     │                                                        │
     │                                    9. Log audit event
     │                                    10. Return form data
     │                                                        │
     │ 11. { success: true, data: form }                     │
     │<──────────────────────────────────────────────────────┤
```

### 12.3 User Update Flow (RBAC)

```
┌─────────┐                                              ┌─────────┐
│ Manager │                                              │ Server  │
└────┬────┘                                              └────┬────┘
     │                                                        │
     │ 1. PUT /api/users/:id                                 │
     │    { firstName: "Updated" }                           │
     ├──────────────────────────────────────────────────────>│
     │                                                        │
     │                                    2. Authenticate (JWT)
     │                                    3. Check managerOrAdmin
     │                                    4. Query target user
     │                                                        │
     │                                    5. RBAC Checks:
     │                                       - Is target admin?
     │                                       - Role change attempt?
     │                                       - Privilege escalation?
     │                                                        │
     │                                    6. Update database
     │                                    7. Log audit event
     │                                                        │
     │ 8. { user: updatedUser }                              │
     │<──────────────────────────────────────────────────────┤
```

### 12.4 Submission with Finding Flow

```
┌─────────┐                                              ┌─────────┐
│ Client  │                                              │ Server  │
└────┬────┘                                              └────┬────┘
     │                                                        │
     │ 1. POST /api/checkops/submissions                     │
     │    { formId, answers, metadata }                      │
     ├──────────────────────────────────────────────────────>│
     │                                                        │
     │                                    2. Validate submission
     │                                    3. Create submission
     │                                                        │
     │                                    4. Analyze answers
     │                                    5. Detect risks
     │                                                        │
     │ 6. POST /api/checkops/findings                        │
     │    { submissionId, severity, category }               │
     ├──────────────────────────────────────────────────────>│
     │                                                        │
     │                                    7. Validate finding
     │                                    8. Create finding
     │                                    9. Link to submission
     │                                                        │
     │ 10. { submission, findings }                          │
     │<──────────────────────────────────────────────────────┤
```


---

## 13. Deployment Architecture

### 13.1 Production Environment

```
┌──────────────────────────────────────────────────────────┐
│                    Load Balancer                          │
│                   (HTTPS Termination)                     │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│              Saiqa Server Instances (N)                   │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Node.js 24+ (Motia Framework)                     │  │
│  │  Port: 3002                                        │  │
│  │  PM2/Docker for process management                 │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│              PostgreSQL Database                          │
│  - Primary/Replica setup                                 │
│  - Connection pooling (40 max per instance)              │
│  - Automated backups                                     │
└──────────────────────────────────────────────────────────┘
```

### 13.2 Environment Configuration

**Development:**
```bash
NODE_ENV=development
PORT=3002
LOG_LEVEL=debug
DB_HOST=localhost
FRONTEND_URL=http://localhost:3000
CHECKOPS_MONITORING_ENABLED=false
```

**Production:**
```bash
NODE_ENV=production
PORT=3002
LOG_LEVEL=info
DB_HOST=production-db.example.com
DB_SSL=true
FRONTEND_URL=https://app.example.com
CHECKOPS_MONITORING_ENABLED=true
CHECKOPS_MONITORING_INTERVAL=60000
```

### 13.3 Startup Process

```
1. Load environment variables (.env)
2. Check Node.js version (>=24.0.0)
3. Initialize Motia framework
4. Apply CORS middleware
5. Initialize config cache
6. Auto-discover step files
7. Register API routes
8. Start HTTP server on port 3002
9. Initialize CheckOps wrapper (lazy)
10. Start monitoring (if enabled)
```

### 13.4 Health Checks

**Server Health:**
```bash
GET /health
Response: { status: 'ok', uptime: 3600 }
```

**CheckOps Health:**
```bash
npm run checkops:health
# Returns: { status: 'healthy', operations: 1234, errors: 5 }
```

### 13.5 Scaling Considerations

**Horizontal Scaling:**
- Stateless design (JWT in cookies)
- No in-memory session storage
- Database connection pooling per instance
- Load balancer distributes traffic

**Vertical Scaling:**
- Increase connection pool size (CHECKOPS_POOL_MAX)
- Adjust Node.js memory limits
- Optimize database queries with indexes

**Caching Strategy:**
- CheckOps LRU cache (per instance)
- Config cache (in-memory, refreshed on change)
- Consider Redis for shared cache (future)


---

## 14. Performance Considerations

### 14.1 Database Optimization

**Connection Pooling:**
```javascript
// config/database.js
const pool = new Pool({
  max: 20,              // Max connections (Saiqa)
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

// CheckOps pool (separate)
{
  max: 40,              // Higher for form operations
  min: 5
}
```

**Query Optimization:**
- Parameterized queries (prevent SQL injection + query plan caching)
- Indexes on frequently queried columns
- JSONB GIN indexes for metadata searches
- Pagination for large result sets

**Example Optimized Query:**
```sql
-- With indexes on email, role, unit_id, is_active
SELECT u.*, un.name as unit_name, d.title as designation_title
FROM users u
LEFT JOIN units un ON u.unit_id = un.id
LEFT JOIN designations d ON u.designation_id = d.id
WHERE u.is_active = true
  AND u.role = 'user'
  AND u.unit_id = $1
ORDER BY u.created_at DESC
LIMIT 10 OFFSET 0;
```

### 14.2 Caching Strategy

**CheckOps Cache (LRU):**
```javascript
// Automatic caching of:
- Forms (by ID and SID)
- Questions (by ID)
- Submissions (recent)

// Cache stats
{
  hits: 890,
  misses: 110,
  hitRate: 0.89,
  size: 45,
  maxSize: 100
}
```

**Config Cache:**
```javascript
// In-memory cache for config table
// Refreshed on config updates
// Reduces database queries for validation rules
```

### 14.3 Async Operations

**Non-Blocking Audit Logs:**
```javascript
// Don't await audit logs (fire and forget)
logAudit({...}).catch(err => logger.error('Audit failed:', err));

// Or use async queue for batch processing
```

**Parallel Operations:**
```javascript
// Fetch related data in parallel
const [user, unit, designation] = await Promise.all([
  getUser(userId),
  getUnit(unitId),
  getDesignation(designationId)
]);
```

### 14.4 Rate Limiting

**Global Rate Limit:**
```javascript
// 100 requests per 15 minutes per IP
rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
})
```

**CheckOps Rate Limit:**
```javascript
// Stricter for form operations
// 50 requests per 15 minutes
```

### 14.5 Monitoring Metrics

**Key Performance Indicators:**
- Request latency (p50, p95, p99)
- Database query time
- Error rate
- Cache hit rate
- Connection pool utilization
- Memory usage
- CPU usage

**CheckOps Metrics:**
```javascript
{
  operations: 1234,
  errors: 5,
  errorRate: 0.004,
  avgResponseTime: 45,
  cacheHitRate: 0.89,
  poolUtilization: 0.65
}
```

### 14.6 Performance Best Practices

**Database:**
- Use connection pooling
- Implement pagination
- Add indexes strategically
- Use EXPLAIN ANALYZE for slow queries
- Regular VACUUM and ANALYZE

**Application:**
- Minimize middleware chain
- Use async/await properly
- Avoid blocking operations
- Implement caching
- Use streaming for large responses

**CheckOps:**
- Enable caching (default)
- Use batch operations when possible
- Monitor pool utilization
- Adjust pool size based on load


---

## 15. Migration & Maintenance

### 15.1 Database Migrations

**Migration System:**
```javascript
// migrations/XXX_description.js
async function up() {
  // Apply changes
  await client.query('CREATE TABLE ...');
}

async function down() {
  // Rollback changes
  await client.query('DROP TABLE ...');
}
```

**Running Migrations:**
```bash
# Apply all pending migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down

# Verify migration status
npm run verify:migrations
```

**Migration History:**
1. `001_initial_schema.js` - Core tables (users, units, designations)
2. `002_add_user_preferences.js` - User preferences JSONB
3. `003_add_entity_sid_to_audit_logs.js` - Human-readable IDs
4. `004_create_config_table.js` - Configuration storage

**CheckOps Migrations:**
```bash
# Run CheckOps schema migrations
npm run checkops:migrate

# Verify CheckOps schema
npm run checkops:verify
```

### 15.2 Backup Strategy

**Database Backups:**
```bash
# Daily automated backups
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup_$(date +%Y%m%d).sql

# Backup with compression
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | gzip > backup_$(date +%Y%m%d).sql.gz
```

**Backup Retention:**
- Daily backups: 7 days
- Weekly backups: 4 weeks
- Monthly backups: 12 months

**Restore Process:**
```bash
# Restore from backup
psql -h $DB_HOST -U $DB_USER -d $DB_NAME < backup_20260205.sql
```

### 15.3 Monitoring & Alerts

**Log Monitoring:**
```bash
# Watch error logs
tail -f logs/error.log

# Watch activity logs
tail -f logs/activity.log

# Search for specific errors
grep "ERROR" logs/activity.log
```

**Alert Triggers:**
- High error rate (>5% of requests)
- Database connection failures
- Excessive failed login attempts
- Privilege escalation attempts
- Disk space low (<10%)
- Memory usage high (>90%)

### 15.4 Maintenance Tasks

**Daily:**
- Monitor error logs
- Check disk space
- Verify backup completion

**Weekly:**
- Review audit logs
- Check performance metrics
- Update dependencies (security patches)

**Monthly:**
- Database VACUUM ANALYZE
- Archive old audit logs
- Review and rotate secrets
- Performance optimization review

**Quarterly:**
- Security audit
- Dependency updates (major versions)
- Load testing
- Disaster recovery drill


---

## 16. Testing Strategy

### 16.1 Test Structure

```
tests/
├── unit/                       # Unit tests (individual functions)
│   ├── auth.test.js
│   ├── password.test.js
│   └── validation.test.js
│
├── integration/                # Integration tests (API endpoints)
│   ├── auth.integration.test.js
│   ├── users.integration.test.js
│   └── checkops.integration.test.js
│
├── helpers/                    # Test utilities
│   ├── test-db.js             # Test database setup
│   └── test-auth.js           # Authentication helpers
│
└── checkops-*.test.js         # CheckOps-specific tests
```

### 16.2 Test Commands

```bash
# Run all tests
npm test

# Run specific test suite
npm run test:checkops

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

### 16.3 Test Examples

**Unit Test:**
```javascript
describe('Password Validation', () => {
  test('should reject weak passwords', () => {
    expect(validatePassword('weak')).toBe(false);
  });
  
  test('should accept strong passwords', () => {
    expect(validatePassword('Strong@Pass123')).toBe(true);
  });
});
```

**Integration Test:**
```javascript
describe('POST /api/auth/login', () => {
  test('should login with valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@saiqa.dev', password: 'Admin@123' });
    
    expect(response.status).toBe(200);
    expect(response.body.user).toBeDefined();
    expect(response.headers['set-cookie']).toBeDefined();
  });
});
```

### 16.4 Manual Testing

**RBAC Testing:**
```bash
# See tests/rbac-manual-test.sh
./tests/rbac-manual-test.sh
```

**CheckOps Testing:**
```bash
# Comprehensive CheckOps test
node test-checkops-comprehensive.js

# Findings implementation test
npm run test:findings
```


---

## 17. Troubleshooting Guide

### 17.1 Common Issues

**Issue: Server won't start**
```bash
# Check Node.js version
node --version  # Should be >=24.0.0

# Check environment variables
npm run checkops:validate-env

# Check database connection
psql -h $DB_HOST -U $DB_USER -d $DB_NAME
```

**Issue: Authentication failures**
```bash
# Check JWT secrets are set
echo $JWT_SECRET
echo $JWT_REFRESH_SECRET

# Check cookie settings
# Ensure secure: false in development
# Ensure sameSite: 'lax' or 'none' for cross-origin
```

**Issue: CheckOps initialization fails**
```bash
# Verify CheckOps schema
npm run checkops:verify

# Run CheckOps migrations
npm run checkops:migrate

# Check CheckOps health
npm run checkops:health
```

**Issue: RBAC denials**
```bash
# Check user role
SELECT email, role FROM users WHERE email = 'user@example.com';

# Check middleware configuration
# Ensure correct middleware in step config
```

### 17.2 Debug Mode

**Enable Debug Logging:**
```bash
LOG_LEVEL=debug npm run dev
```

**Database Query Logging:**
```javascript
// config/database.js already logs all queries with timing
// Check console output for slow queries
```

**CheckOps Debug:**
```javascript
// Enable CheckOps verbose logging
process.env.CHECKOPS_LOG_LEVEL = 'debug';
```

### 17.3 Performance Issues

**Slow Queries:**
```sql
-- Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Analyze specific query
EXPLAIN ANALYZE SELECT ...;
```

**High Memory Usage:**
```bash
# Check Node.js memory
node --max-old-space-size=4096 index.js

# Monitor memory
watch -n 1 'ps aux | grep node'
```

**Connection Pool Exhaustion:**
```javascript
// Check pool stats
console.log(pool.totalCount, pool.idleCount, pool.waitingCount);

// Increase pool size
DB_POOL_MAX=30
CHECKOPS_POOL_MAX=50
```


---

## 18. API Quick Reference

### 18.1 Authentication

```bash
# Login
POST /api/auth/login
Body: { "email": "user@example.com", "password": "Pass@123" }

# Logout
POST /api/auth/logout

# Refresh token
POST /api/auth/refresh

# Change password
POST /api/auth/change-password
Body: { "currentPassword": "old", "newPassword": "new" }

# Get current user
GET /api/auth/me
```

### 18.2 User Management

```bash
# List users
GET /api/users?page=1&limit=10&search=john&role=admin

# Get user
GET /api/users/:id

# Create user (admin only)
POST /api/users
Body: { "email": "...", "password": "...", "firstName": "...", "lastName": "...", "role": "user" }

# Update user (manager+)
PUT /api/users/:id
Body: { "firstName": "Updated" }

# Delete user (admin only)
DELETE /api/users/:id

# Reset password (admin only)
POST /api/users/:id/reset-password
Body: { "newPassword": "Temp@123" }
```

### 18.3 CheckOps Forms

```bash
# List forms
GET /api/checkops/forms?page=1&limit=10

# Get form
GET /api/checkops/forms/:id

# Create form
POST /api/checkops/forms
Body: { "title": "...", "description": "...", "questions": [...] }

# Update form
PUT /api/checkops/forms/:id
Body: { "title": "Updated" }

# Delete form
DELETE /api/checkops/forms/:id
```

### 18.4 CheckOps Submissions

```bash
# Create submission
POST /api/checkops/submissions
Body: { "formId": "...", "answers": {...}, "metadata": {...} }

# List submissions
GET /api/checkops/submissions?formId=...&page=1&limit=10

# Get submission stats
GET /api/checkops/submissions/stats?formId=...
```

### 18.5 CheckOps Findings

```bash
# List findings
GET /api/checkops/findings?severity=high&status=open

# Get finding
GET /api/checkops/findings/:id

# Create finding
POST /api/checkops/findings
Body: { "submissionId": "...", "severity": "high", "category": "compliance" }

# Update finding
PUT /api/checkops/findings/:id
Body: { "status": "resolved" }

# Delete finding
DELETE /api/checkops/findings/:id

# Get finding stats
GET /api/checkops/findings/stats

# Get allowed values
GET /api/checkops/findings/allowed-values
```


---

## 19. Related Documentation

### 19.1 Internal Documentation

- **[README.md](./README.md)** - Project overview and setup
- **[RBAC.md](./RBAC.md)** - Role-based access control details
- **[AUDIT_LOGGING.md](./AUDIT_LOGGING.md)** - Audit logging strategy
- **[MIGRATION_STATUS.md](./MIGRATION_STATUS.md)** - Database migration status
- **[MIGRATION_COMPLETE.md](./MIGRATION_COMPLETE.md)** - Migration testing guide
- **[CHECKOPS_V4_UPGRADE_COMPLETE.md](./CHECKOPS_V4_UPGRADE_COMPLETE.md)** - CheckOps v4 upgrade
- **[FINDINGS_IMPLEMENTATION_COMPLETE.md](./FINDINGS_IMPLEMENTATION_COMPLETE.md)** - Findings feature
- **[FINDINGS_QUICK_START.md](./FINDINGS_QUICK_START.md)** - Findings usage guide

### 19.2 External Documentation

- **[Motia Framework](https://motia.dev)** - Framework documentation
- **[CheckOps Package](https://www.npmjs.com/package/@saiqa-tech/checkops)** - CheckOps npm package
- **[PostgreSQL](https://www.postgresql.org/docs/)** - Database documentation
- **[Node.js](https://nodejs.org/docs/)** - Runtime documentation

### 19.3 API Documentation

For detailed API documentation, see:
- Postman collection (if available)
- OpenAPI/Swagger spec (if generated)
- Individual step files in `/steps` directory

---

## 20. Glossary

**Terms:**

- **Motia** - Convention-over-configuration Node.js framework for building APIs
- **Step** - Motia's term for an API endpoint definition (config + handler)
- **RBAC** - Role-Based Access Control (admin, manager, user)
- **JWT** - JSON Web Token (authentication mechanism)
- **CheckOps** - Form management and submission tracking system
- **SID** - Sequential ID (human-readable identifier, e.g., "FORM-0001")
- **UUID** - Universally Unique Identifier (database primary key)
- **Finding** - Risk or compliance issue identified in a submission
- **Audit Log** - Record of user actions for compliance and security
- **Soft Delete** - Marking records as inactive instead of physical deletion

**Acronyms:**

- **API** - Application Programming Interface
- **CORS** - Cross-Origin Resource Sharing
- **CRUD** - Create, Read, Update, Delete
- **DB** - Database
- **FK** - Foreign Key
- **GIN** - Generalized Inverted Index (PostgreSQL)
- **HTTP** - Hypertext Transfer Protocol
- **HTTPS** - HTTP Secure
- **JSON** - JavaScript Object Notation
- **JSONB** - JSON Binary (PostgreSQL data type)
- **LRU** - Least Recently Used (cache eviction strategy)
- **PK** - Primary Key
- **REST** - Representational State Transfer
- **SQL** - Structured Query Language
- **SSL** - Secure Sockets Layer
- **TLS** - Transport Layer Security

---

## 21. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-05 | Initial comprehensive architecture documentation |

---

## 22. Contact & Support

**Development Team:**
- Backend: Saiqa Server Team
- CheckOps: @saiqa-tech/checkops maintainers

**Support Channels:**
- GitHub Issues: [Repository Issues](https://github.com/your-org/saiqa-server/issues)
- Email: support@saiqa.dev
- Documentation: [Internal Wiki](https://wiki.saiqa.dev)

---

*This architecture document is maintained by the Saiqa development team and should be updated with any significant architectural changes.*

