# TRD — Technical Requirements Document
## HVMS Mobile App v2.0

---

## 1. Technology Stack

### Mobile Frontend
| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | React Native | 0.74 | Cross-platform mobile UI |
| Toolchain | Expo | ~51.0 | Build, preview, OTA updates |
| Preview | Expo Go | Latest | Development & testing |
| Navigation | React Navigation v6 | ^6.x | Screen routing |
| HTTP Client | Axios | ^1.7 | API communication |
| Secure Storage | expo-secure-store | ~13.0 | JWT token storage |
| UI Components | react-native-paper | ^5.12 | Material Design components |
| Gradients | expo-linear-gradient | ~13.0 | Visual design |
| Icons | @expo/vector-icons (Ionicons) | ^14 | Icon system |
| Toast | react-native-toast-message | ^2.2 | User feedback |
| Date Utils | date-fns | ^3.6 | Date formatting |
| Animations | react-native-reanimated | ~3.10 | Smooth animations |

### Backend
| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Runtime | Node.js | ≥18 LTS | Server runtime |
| Framework | Express.js | ^4.19 | HTTP server |
| Database Client | @supabase/supabase-js | ^2.43 | Supabase PostgreSQL |
| Auth | jsonwebtoken | ^9.0 | JWT signing/verification |
| Hashing | bcryptjs | ^2.4 | Password hashing |
| Email | nodemailer | ^6.9 | SMTP email dispatch |
| Security | helmet + cors | latest | HTTP security headers |
| Rate Limit | express-rate-limit | ^7.3 | Abuse prevention |
| Logging | morgan | ^1.10 | Request logging |

### Database
| Layer | Technology | Details |
|-------|-----------|---------|
| Platform | Supabase | Cloud-hosted PostgreSQL |
| Version | PostgreSQL | 15+ |
| ORM/Client | Supabase JS SDK | Direct REST/PostgREST |
| Auth | Service Role Key | Backend bypasses RLS |

---

## 2. Backend Architecture

### Directory Structure
```
/backend
├── app.js               # Express app (middleware, routes)
├── server.js            # Entry point (DB connect + listen)
├── package.json
├── .env.example
│
├── /config
│   ├── db.js            # Supabase client + connectDB()
│   └── schema.sql       # Full PostgreSQL schema
│
├── /controllers
│   ├── authController.js
│   ├── visitController.js
│   ├── hostelController.js
│   ├── userController.js
│   └── reportController.js
│
├── /routes
│   ├── authRoutes.js
│   ├── visitRoutes.js
│   ├── hostelRoutes.js
│   ├── userRoutes.js
│   └── reportRoutes.js
│
├── /middleware
│   ├── authMiddleware.js   # JWT verification + user attach
│   └── helpers.js         # authorizeRoles, errorHandler, auditLogger
│
├── /services
│   └── emailService.js    # Nodemailer SMTP
│
└── /utils
    ├── helpers.js          # generateToken, generatePassword, ApiError
    └── seedAdmin.js        # One-time admin account seeder
```

### Request Lifecycle
```
Mobile App
  ↓ HTTPS Request (Authorization: Bearer <token>)
Express Rate Limiter
  ↓
authMiddleware.js
  → jwt.verify(token) → decode userId
  → supabase.from('users').select().eq('id', userId) → attach req.user
  ↓
authorizeRoles(...roles) [if route requires specific role]
  ↓
Controller Function
  → Business logic
  → supabase query (SELECT / INSERT / UPDATE / DELETE)
  → auditLogger (fire-and-forget)
  → res.json({ success, data })
  ↓
errorHandler (global catch)
```

---

## 3. Mobile Frontend Architecture

### Directory Structure
```
/mobile-app
├── App.js                    # Root component
├── app.json                  # Expo config
├── babel.config.js
├── package.json
│
└── /src
    ├── /context
    │   └── AuthContext.js    # useAuth hook + login/logout/restore
    │
    ├── /navigation
    │   ├── RootNavigator.js  # Auth guard (Login ↔ Main)
    │   ├── AuthNavigator.js  # Login → ChangePassword
    │   └── MainNavigator.js  # Role-based tabs + modal screens
    │
    ├── /screens
    │   ├── /auth
    │   │   ├── LoginScreen.js
    │   │   └── ChangePasswordScreen.js
    │   ├── /faculty
    │   │   ├── FacultyDashboardScreen.js
    │   │   ├── StartVisitScreen.js
    │   │   ├── EndVisitScreen.js
    │   │   └── VisitHistoryScreen.js
    │   ├── /admin
    │   │   ├── AdminDashboardScreen.js
    │   │   ├── ManageUsersScreen.js
    │   │   ├── ManageHostelsScreen.js
    │   │   ├── ReportsScreen.js
    │   │   ├── CreateUserScreen.js
    │   │   ├── CreateHostelScreen.js
    │   │   └── AllVisitsScreen.js
    │   ├── /warden
    │   │   ├── WardenDashboardScreen.js
    │   │   └── WardenVisitsScreen.js
    │   └── /shared
    │       ├── ProfileScreen.js
    │       └── VisitDetailScreen.js
    │
    ├── /components
    │   ├── /common
    │   │   ├── AppHeader.js
    │   │   ├── Button.js
    │   │   ├── InputField.js
    │   │   └── UIComponents.js  (Card, Badge, StatCard, EmptyState)
    │   ├── /cards
    │   │   └── VisitCard.js
    │   └── /forms
    │       └── SelectPicker.js
    │
    ├── /services
    │   ├── api.js            # Axios instance + interceptors
    │   ├── authService.js
    │   ├── visitService.js
    │   ├── hostelService.js
    │   ├── userService.js
    │   └── reportService.js
    │
    └── /utils
        ├── theme.js          # Colors, spacing, shadows, typography
        ├── helpers.js        # Date formatting, label maps, constants
        └── toastConfig.js    # Custom toast components
```

### State Management
- **Authentication state**: React Context + useReducer (AuthContext)
- **Screen-level state**: useState + useCallback with useFocusEffect for data refresh
- **No Redux** — the app's state is simple enough for Context + local state
- **Token persistence**: expo-secure-store (hardware-encrypted)

---

## 4. Authentication System

### Flow Diagram
```
User enters email + password
        ↓
POST /api/v1/auth/login
        ↓
Backend: bcrypt.compare(password, hash)
        ↓ (match)
Backend: jwt.sign({ userId, role, name }, JWT_SECRET, { expiresIn: '8h' })
        ↓
Mobile: SecureStore.setItemAsync('hvms_token', token)
Mobile: SecureStore.setItemAsync('hvms_user', JSON.stringify(user))
        ↓
AuthContext: dispatch LOGIN_SUCCESS → isAuthenticated = true
        ↓
RootNavigator: renders MainNavigator (role-based tabs)
```

### Session Restoration (App Reopen)
```
App mounts → AuthContext.restoreSession()
        ↓
SecureStore.getItemAsync('hvms_token')
        ↓ (token exists)
GET /api/v1/auth/me (with token)
        ↓ (valid)
dispatch LOGIN_SUCCESS → user restored
        ↓ (401 / expired)
SecureStore.deleteItemAsync → dispatch LOGOUT
```

### Token Storage Security
- Storage: `expo-secure-store` — backed by Android Keystore / iOS Keychain
- **Never** stored in AsyncStorage, MMKV, or other plain-text storage
- Cleared on logout and on 401 response from any API call

---

## 5. API Communication

### Base Configuration
```
Base URL: http://localhost:5000/api/v1  (development)
          https://your-app.onrender.com/api/v1  (production)
Timeout: 15,000ms
Headers: Content-Type: application/json
         Authorization: Bearer <token>  (auto-injected by interceptor)
```

### Standard Response Envelope
```json
{
  "success": true | false,
  "message": "Human-readable message",
  "data": { ... }
}
```

### Error Handling
- 400: Validation errors — shown as field-level errors
- 401: Token expired — auto logout + redirect to Login
- 403: Forbidden — Toast error shown
- 404: Not found — appropriate screen feedback
- 500: Server error — generic error Toast shown
- Network timeout — "Check your connection" message

---

## 6. API Endpoints Reference

### Auth (`/api/v1/auth`)
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/login` | No | All | Login + get JWT |
| POST | `/logout` | Yes | All | Log logout action |
| GET | `/me` | Yes | All | Get current user profile |
| PUT | `/profile` | Yes | All | Update name/phone/department |
| PUT | `/change-password` | Yes | All | Change own password |

### Visits (`/api/v1/visits`)
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/start` | Yes | faculty | Start a new visit |
| PATCH | `/:id/end` | Yes | faculty | End an active visit |
| GET | `/my` | Yes | all | Get own visit history |
| GET | `/active` | Yes | warden,admin | Get active visits |
| GET | `/` | Yes | admin | Get all visits (paginated) |
| GET | `/:id` | Yes | all | Get single visit details |
| PATCH | `/:id/verify` | Yes | warden | Verify a completed visit |

### Hostels (`/api/v1/hostels`)
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/` | Yes | all | List active hostels |
| GET | `/:id` | Yes | all | Get hostel details |
| POST | `/` | Yes | admin | Create hostel |
| PUT | `/:id` | Yes | admin | Update hostel |
| PATCH | `/:id/assign-warden` | Yes | admin | Assign warden |
| DELETE | `/:id` | Yes | admin | Deactivate hostel |

### Users (`/api/v1/users`) — Admin only
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all users (filter by role, status) |
| GET | `/:id` | Get user details |
| POST | `/` | Create user (sends welcome email) |
| PUT | `/:id` | Update user info |
| PATCH | `/:id/status` | Activate/deactivate user |
| PATCH | `/:id/role` | Change user role |
| POST | `/:id/reset-password` | Reset + email new password |

### Reports (`/api/v1/reports`)
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/dashboard` | all | Active, today, month counts |
| GET | `/daily` | admin | All visits for a date |
| GET | `/monthly` | admin | Month breakdown by day |
| GET | `/by-hostel` | admin,warden | Per-hostel stats |
| GET | `/by-faculty` | admin | Per-faculty stats |

---

## 7. Database Schema (Supabase PostgreSQL)

### users
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | |
| name | VARCHAR(100) | NOT NULL | |
| email | VARCHAR(255) | NOT NULL, UNIQUE | Lowercased |
| password | VARCHAR(255) | NOT NULL | bcrypt hash |
| role | VARCHAR(20) | CHECK IN (admin,faculty,warden) | |
| department | VARCHAR(100) | DEFAULT '' | Faculty only |
| phone | VARCHAR(20) | DEFAULT '' | |
| profile_photo | TEXT | DEFAULT '' | URL or base64 |
| assigned_hostel_id | UUID | FK → hostels(id) | Warden only |
| is_active | BOOLEAN | DEFAULT TRUE | |
| must_change_password | BOOLEAN | DEFAULT FALSE | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTO-UPDATED | Trigger |

### hostels
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| name | VARCHAR(100) | NOT NULL, UNIQUE |
| type | VARCHAR(10) | CHECK IN (boys,girls) |
| capacity | INTEGER | CHECK > 0 |
| location | VARCHAR(255) | NOT NULL |
| warden_id | UUID | FK → users(id), NULLABLE |
| is_active | BOOLEAN | DEFAULT TRUE |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### visits
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| faculty_id | UUID | FK → users(id) NOT NULL |
| hostel_id | UUID | FK → hostels(id) NOT NULL |
| purpose | VARCHAR(30) | CHECK IN (inspection,student_meeting,routine_check,emergency,other) |
| purpose_detail | TEXT | NULLABLE |
| check_in | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| check_out | TIMESTAMPTZ | NULLABLE |
| duration | INTEGER | NULLABLE (minutes) |
| status | VARCHAR(15) | CHECK IN (active,completed) DEFAULT active |
| faculty_remarks | TEXT | NULLABLE |
| warden_remarks | TEXT | NULLABLE |
| is_verified | BOOLEAN | DEFAULT FALSE |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### audit_logs
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → users(id) |
| action | VARCHAR(50) | e.g. LOGIN, START_VISIT |
| entity_id | UUID | Related record ID |
| entity_type | VARCHAR(50) | e.g. Visit, Hostel |
| metadata | JSONB | Extra context |
| ip_address | VARCHAR(60) | |
| created_at | TIMESTAMPTZ | |

---

## 8. Security Implementation

### Password Security
- bcrypt with cost factor 12 (≈ 300ms per hash)
- Minimum length: 8 characters enforced at API level
- Temporary passwords auto-generated with upper + lower + digit + special chars
- `must_change_password` flag forces immediate reset on first login

### JWT Security
- Algorithm: HS256
- Expiry: 8 hours
- Payload: `{ userId, role, name }` — minimal claims only
- Secret: minimum 32-character random string in production
- Token verified on every protected route via middleware

### API Security
- `helmet()`: Sets 11 security HTTP headers (CSP, HSTS, etc.)
- `cors()`: Configurable origin whitelist
- `express-rate-limit`: 20 auth requests/minute, 200 general requests/minute
- Request body size limit: 10kb
- All SQL via Supabase SDK (parameterized queries — no SQL injection risk)

### Mobile Security
- Token in `expo-secure-store` (iOS Keychain / Android Keystore)
- Auto-logout on 401 response via Axios interceptor
- No sensitive data in component state that persists

### Role-Based Access Control (RBAC)
```
admin   → full access to all routes
faculty → start/end own visits, view own history
warden  → active visits (own hostel only), verify visits (own hostel only)
```

---

## 9. Performance Considerations

### Database (Supabase)
- Indexed columns: `email`, `role`, `faculty_id+status`, `hostel_id+status`, `check_in DESC`
- Use `{ count: 'exact', head: true }` for count-only queries
- Use `.range(offset, end)` for pagination instead of fetching all
- Aggregate stats in JS when PostgreSQL window functions aren't available via SDK

### Mobile
- `useFocusEffect` + `useCallback` for screen focus data refresh
- `FlatList` with `onEndReached` for infinite scroll (never load all records)
- `ActivityIndicator` during loading with pull-to-refresh support
- Image/component lazy loading (no upfront heavy imports)
- Avoid re-renders with `useCallback` on event handlers

### Network
- Axios timeout: 15 seconds
- Parallel API calls with `Promise.all` on dashboard screens
- Minimal payload — backend returns only necessary fields via `.select(...)`
