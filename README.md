# HVMS Mobile Application v2.0
## Hostel Visit Management System — React Native + Expo + Supabase

---

## 📁 Project Structure

```
HVMS-Mobile/
├── mobile-app/          ← React Native Expo app
│   ├── App.js
│   ├── app.json
│   ├── package.json
│   └── src/
│       ├── screens/     ← All app screens
│       ├── navigation/  ← React Navigation setup
│       ├── services/    ← API service layer
│       ├── context/     ← Auth state management
│       ├── components/  ← Reusable UI components
│       └── utils/       ← Theme, helpers, toast
│
├── backend/             ← Node.js + Express API
│   ├── server.js
│   ├── app.js
│   ├── package.json
│   ├── .env.example
│   ├── config/
│   │   ├── db.js        ← Supabase client
│   │   └── schema.sql   ← Run in Supabase SQL Editor
│   ├── controllers/
│   ├── routes/
│   ├── middleware/
│   ├── services/
│   └── utils/
│
└── docs/
    ├── PRD.md           ← Product Requirements
    ├── TRD.md           ← Technical Requirements
    └── SYSTEM_DESIGN.md ← Architecture & Deployment
```

---

## 🚀 Quick Start

### 1. Database (Supabase)
```bash
# 1. Create project at supabase.com
# 2. Open SQL Editor → run backend/config/schema.sql
# 3. Copy Project URL + service_role key
```

### 2. Backend
```bash
cd backend
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, SMTP_*
npm install
node utils/seedAdmin.js    # Creates admin@college.edu / Admin@1234
npm run dev                # Starts on port 5000
```

### 3. Mobile App
```bash
cd mobile-app
# Edit src/services/api.js → set API_BASE_URL to your backend URL
npm install
npx expo start
# Scan QR code with Expo Go app
```

---

## 👤 Default Credentials (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@college.edu | Admin@1234 |

> ⚠️ Change the admin password immediately after first login.

---

## 📱 User Roles

| Role | Capabilities |
|------|-------------|
| **Admin** | Full system access — manage users, hostels, view all reports |
| **Faculty** | Start visit, end visit, view own history |
| **Warden** | View hostel visits in real-time, verify completed visits |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native + Expo Go |
| Navigation | React Navigation v6 |
| State | React Context + Hooks |
| HTTP | Axios |
| Token Storage | expo-secure-store |
| Backend | Node.js + Express.js |
| Database | Supabase (PostgreSQL) |
| Auth | JWT (8h expiry) |
| Email | Nodemailer (SMTP) |

---

## 📖 Documentation

See the `/docs` folder:
- **PRD.md** — Product requirements, user stories, functional requirements
- **TRD.md** — Technical stack, API reference, database schema, security
- **SYSTEM_DESIGN.md** — Architecture diagrams, data flows, deployment guide
