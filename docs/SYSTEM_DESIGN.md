# SYSTEM_DESIGN.md
## HVMS Mobile Application — System Architecture & Design

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MOBILE LAYER                             │
│                                                                 │
│  ┌───────────┐   ┌────────────┐   ┌───────────┐               │
│  │  Faculty   │   │   Admin    │   │  Warden   │               │
│  │  (Expo Go) │   │  (Expo Go) │   │ (Expo Go) │               │
│  └─────┬─────┘   └─────┬──────┘   └─────┬─────┘               │
│        │               │                │                       │
│        └───────────────┴────────────────┘                       │
│                        │                                        │
│            React Native + Expo SDK                              │
│         React Navigation | Axios | SecureStore                  │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS REST API
                         │ Authorization: Bearer <JWT>
┌────────────────────────┴────────────────────────────────────────┐
│                       API LAYER (Backend)                        │
│                                                                 │
│   Node.js 18 + Express.js                                       │
│                                                                 │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│   │   Auth   │  │  Visits  │  │ Hostels  │  │  Users   │      │
│   │  Routes  │  │  Routes  │  │  Routes  │  │  Routes  │      │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
│        │             │              │              │             │
│        └─────────────┴──────────────┴──────────────┘            │
│                             │                                    │
│              ┌──────────────┴──────────┐                        │
│              │   Middleware Pipeline    │                        │
│              │  helmet | cors | rateLimit│                       │
│              │  authMiddleware | RBAC   │                        │
│              └─────────────────────────┘                        │
└────────────────────────┬────────────────────────────────────────┘
                         │ Supabase JS SDK (HTTPS)
┌────────────────────────┴────────────────────────────────────────┐
│                     DATABASE LAYER                               │
│                                                                 │
│   Supabase (PostgreSQL 15)                                      │
│                                                                 │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│   │  users   │  │ hostels  │  │  visits  │  │audit_logs│      │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                         │
                  ┌──────┴──────┐
                  │  SMTP Email  │
                  │  (Nodemailer)│
                  │  Gmail/SMTP  │
                  └─────────────┘
```

---

## 2. Navigation Architecture

```
RootNavigator (Stack)
│
├── [unauthenticated] → AuthNavigator (Stack)
│       ├── LoginScreen
│       └── ChangePasswordScreen (forced)
│
└── [authenticated] → MainNavigator (Stack)
        │
        ├── Tabs → [based on user.role]
        │     │
        │     ├── [faculty] FacultyTabs (BottomTab)
        │     │     ├── Dashboard (FacultyDashboardScreen)
        │     │     ├── Visits (VisitHistoryScreen)
        │     │     └── Profile (ProfileScreen)
        │     │
        │     ├── [admin] AdminTabs (BottomTab)
        │     │     ├── Dashboard (AdminDashboardScreen)
        │     │     ├── Users (ManageUsersScreen)
        │     │     ├── Hostels (ManageHostelsScreen)
        │     │     ├── Reports (ReportsScreen)
        │     │     └── Profile (ProfileScreen)
        │     │
        │     └── [warden] WardenTabs (BottomTab)
        │           ├── Dashboard (WardenDashboardScreen)
        │           ├── Hostel Visits (WardenVisitsScreen)
        │           └── Profile (ProfileScreen)
        │
        ├── StartVisit (modal push)
        ├── EndVisit (modal push)
        ├── VisitDetail (modal push)
        ├── ChangePassword (modal push)
        ├── CreateUser (modal push)
        ├── CreateHostel (modal push)
        └── AllVisits (modal push)
```

---

## 3. Authentication Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                   LOGIN FLOW                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. User enters email + password on LoginScreen         │
│     ↓                                                   │
│  2. authService.login() → POST /api/v1/auth/login       │
│     ↓                                                   │
│  3. Backend: bcrypt.compare(password, storedHash)       │
│     ↓ success                                           │
│  4. Backend: jwt.sign({userId, role, name}, secret, 8h) │
│     ↓                                                   │
│  5. Backend: returns { token, user }                    │
│     ↓                                                   │
│  6. Mobile: SecureStore.setItemAsync('hvms_token')      │
│  6. Mobile: SecureStore.setItemAsync('hvms_user')       │
│     ↓                                                   │
│  7. AuthContext: dispatch LOGIN_SUCCESS                  │
│     ↓                                                   │
│  8. RootNavigator: isAuthenticated=true → MainNavigator │
│     ↓                                                   │
│  9. MainNavigator: renders role-appropriate tabs        │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                 SESSION RESTORE FLOW                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  App opens → AuthContext.restoreSession()               │
│     ↓                                                   │
│  SecureStore.getItemAsync('hvms_token') → token found   │
│     ↓                                                   │
│  GET /api/v1/auth/me (with token in header)             │
│     ↓ 200                          ↓ 401               │
│  dispatch LOGIN_SUCCESS        clearStorage()           │
│  → MainNavigator               dispatch LOGOUT          │
│                                → LoginScreen            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Visit Lifecycle Data Flow

```
FACULTY starts visit:
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  StartVisitScreen                                          │
│  - Select hostel (from /hostels API)                       │
│  - Select purpose (dropdown)                               │
│  - Optional: purpose detail, remarks                       │
│     ↓                                                      │
│  POST /api/v1/visits/start                                 │
│  { hostelId, purpose, purposeDetail, facultyRemarks }      │
│     ↓                                                      │
│  Backend: check no active visit for this faculty           │
│  Backend: verify hostel exists + is_active                 │
│  Backend: INSERT visit { status: 'active', check_in: NOW } │
│  Backend: auditLog('START_VISIT')                          │
│     ↓                                                      │
│  201 Created → visit record returned                       │
│     ↓                                                      │
│  App: navigate to Dashboard (active visit shown)           │
│                                                            │
└────────────────────────────────────────────────────────────┘

FACULTY ends visit:
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  EndVisitScreen (live duration displayed)                  │
│  - Optional: add/update faculty remarks                    │
│  - Confirm dialog                                          │
│     ↓                                                      │
│  PATCH /api/v1/visits/:id/end                              │
│     ↓                                                      │
│  Backend: verify visit belongs to this faculty             │
│  Backend: check_out = NOW, duration = minutes elapsed      │
│  Backend: UPDATE visits { status: 'completed', check_out } │
│  Backend: async sendVisitCompletedEmail to warden          │
│  Backend: auditLog('END_VISIT')                            │
│     ↓                                                      │
│  200 OK → completed visit returned                         │
│     ↓                                                      │
│  App: Toast success → navigate to Dashboard                │
│                                                            │
└────────────────────────────────────────────────────────────┘

WARDEN verifies visit:
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  WardenVisitsScreen → tap "Verify" on completed visit      │
│  - Optional: add warden remarks                            │
│     ↓                                                      │
│  PATCH /api/v1/visits/:id/verify                           │
│     ↓                                                      │
│  Backend: verify visit.hostel_id === warden.assignedHostel │
│  Backend: UPDATE visits { is_verified: true, warden_remarks}│
│  Backend: auditLog('VERIFY_VISIT')                         │
│     ↓                                                      │
│  200 OK → Toast success, visit row updated in list         │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 5. Component Interaction Map

```
AuthContext (Global State)
    ├── useAuth() → consumed by ALL screens
    ├── user, token, isAuthenticated, isLoading
    ├── login() → calls authService → stores in SecureStore
    ├── logout() → calls authService → clears SecureStore
    └── updateUser() → updates state + SecureStore

RootNavigator
    └── reads isAuthenticated, isLoading from useAuth()

Services Layer (API calls)
    ├── api.js (Axios instance)
    │     ├── Interceptor: auto-inject Bearer token
    │     └── Interceptor: auto-logout on 401
    ├── authService.js → /auth/*
    ├── visitService.js → /visits/*
    ├── hostelService.js → /hostels/*
    ├── userService.js → /users/*
    └── reportService.js → /reports/*

Shared Components
    ├── AppHeader → title, subtitle, back button, right action
    ├── Button → primary/outline/danger variants
    ├── InputField → label, icon, error, secure text
    ├── SelectPicker → modal dropdown
    ├── UIComponents → Card, Badge, StatCard, EmptyState
    └── VisitCard → reusable visit list item
```

---

## 6. Deployment Guide

### Step 1: Supabase Database Setup

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project (choose nearest region)
3. Go to **SQL Editor** → **New Query**
4. Paste and run the contents of `backend/config/schema.sql`
5. Go to **Project Settings → API**
6. Copy: **Project URL** and **service_role (secret)** key

### Step 2: Backend Deployment (Render.com — free tier)

1. Push the `/backend` folder to a GitHub repository
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your GitHub repo
4. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Add **Environment Variables**:
   ```
   PORT=5000
   NODE_ENV=production
   JWT_SECRET=<random 32+ char string>
   SUPABASE_URL=<your supabase project URL>
   SUPABASE_SERVICE_ROLE_KEY=<your service role key>
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=<your gmail>
   SMTP_PASS=<your app password>
   FROM_EMAIL=noreply@college.edu
   FROM_NAME=HVMS System
   FRONTEND_URL=*
   ```
6. Deploy — Render provides a public URL like `https://hvms-api.onrender.com`

### Step 3: Seed Admin Account

After backend is deployed, run locally once:
```bash
cd backend
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node utils/seedAdmin.js
```
Default credentials: `admin@college.edu` / `Admin@1234`

### Step 4: Configure Mobile App

Edit `mobile-app/src/services/api.js`:
```js
export const API_BASE_URL = 'https://hvms-api.onrender.com/api/v1';
```

### Step 5: Run on Expo Go

```bash
cd mobile-app
npm install
npx expo start
```

- Scan the QR code with **Expo Go** app (Android/iOS)
- Make sure your phone and laptop are on the same Wi-Fi network
- For production use: `npx expo build` or `EAS Build`

### Step 6: Email Configuration (Gmail)

1. Enable 2FA on your Gmail account
2. Go to **Google Account → Security → App Passwords**
3. Generate a password for "Mail"
4. Use that 16-character password as `SMTP_PASS`

---

## 7. Environment Variables Reference

### Backend `.env`
```env
PORT=5000
NODE_ENV=development
JWT_SECRET=change_this_to_a_long_random_secret
JWT_EXPIRES_IN=8h
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourapp@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
FROM_EMAIL=noreply@college.edu
FROM_NAME=HVMS System
FRONTEND_URL=*
ADMIN_EMAIL=admin@college.edu
ADMIN_PASSWORD=Admin@1234
ADMIN_NAME=System Administrator
```

---

## 8. Security Checklist for Production

- [ ] Change `JWT_SECRET` to a random 64-character string
- [ ] Change `ADMIN_PASSWORD` from `Admin@1234` to something strong
- [ ] Set `FRONTEND_URL` to your specific app domain (not `*`)
- [ ] Enable Supabase RLS policies for additional database-level security
- [ ] Use HTTPS-only for all API calls (never HTTP in production)
- [ ] Rotate `SUPABASE_SERVICE_ROLE_KEY` if compromised
- [ ] Set `NODE_ENV=production` to disable morgan request logging
- [ ] Review Supabase rate limits and upgrade plan if needed

---

## 9. Monitoring & Maintenance

| Task | How |
|------|-----|
| API health check | GET `/api/health` |
| Database queries | Supabase Dashboard → Table Editor |
| Logs | Render.com → Logs tab |
| Audit trail | Query `audit_logs` table in Supabase |
| Email delivery | Check SMTP provider logs |
| Token expiry | Default 8h — adjust `JWT_EXPIRES_IN` in .env |
