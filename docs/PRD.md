# PRD — Product Requirements Document
## Hostel Visit Management System (HVMS) Mobile App v2.0

---

## 1. Product Overview

The HVMS Mobile Application is a role-based mobile solution for engineering colleges to digitally manage, track, and audit faculty visits to student hostels. It replaces paper-based logbooks with a real-time digital system accessible from any smartphone via Expo Go.

---

## 2. Problem Statement

Engineering colleges require faculty members to conduct periodic visits to student hostels for inspections, welfare checks, and student meetings. The existing process:

- Uses paper registers that are difficult to audit
- Has no real-time visibility for wardens or administrators
- Cannot generate analytics or trend reports
- Provides no accountability trail for visit verification
- Is inaccessible when faculty are away from their desks

The HVMS Mobile App solves all of these problems by providing an always-available, role-aware mobile interface backed by a cloud database.

---

## 3. Objectives

| # | Objective |
|---|-----------|
| 1 | Enable faculty to log hostel visits instantly from their mobile devices |
| 2 | Give wardens real-time visibility into their hostel's active visits |
| 3 | Allow wardens to verify completed visits and add remarks |
| 4 | Provide administrators a complete analytics dashboard |
| 5 | Replace all paper-based hostel visit registers |
| 6 | Send automated notifications to wardens on visit completion |
| 7 | Maintain a complete, tamper-proof audit trail |

---

## 4. User Roles & Personas

### 4.1 Faculty Visitor
- **Who**: Teaching faculty members assigned to hostel duty
- **Goal**: Quickly start/end visit records and review their own history
- **Pain point**: No digital record of their visits; paper logs are slow

### 4.2 Hostel Warden / Security
- **Who**: Warden assigned to a specific hostel
- **Goal**: See who is visiting their hostel in real time; verify and annotate completed visits
- **Pain point**: No awareness of who entered or exited their hostel

### 4.3 Administrator
- **Who**: College administrator or department head
- **Goal**: Full oversight — manage users, hostels, view reports and analytics
- **Pain point**: No consolidated view of all hostel visit activity

---

## 5. User Stories

### Faculty
- As a faculty member, I want to **log in securely** so that only I can manage my records.
- As a faculty member, I want to **start a visit** by selecting a hostel and stating my purpose.
- As a faculty member, I want to **end my visit** and add remarks when I leave.
- As a faculty member, I want to **view my complete visit history** with filters.
- As a faculty member, I want to **see my active visit** prominently so I never forget to check out.
- As a faculty member, I want to **update my profile** and change my password.

### Warden
- As a warden, I want to **see all active visits to my hostel** in real time.
- As a warden, I want to **verify completed visits** to confirm the faculty actually visited.
- As a warden, I want to **add remarks** to a verified visit (e.g., issues found).
- As a warden, I want to **receive an email** when a faculty visit to my hostel is completed.

### Admin
- As an admin, I want to **view a dashboard** showing active, today's and monthly visit counts.
- As an admin, I want to **create and manage user accounts** for faculty and wardens.
- As an admin, I want to **create and manage hostels** and assign wardens to them.
- As an admin, I want to **view all visits** system-wide with filters.
- As an admin, I want to **view analytics** — visits by hostel, by faculty, monthly trends.
- As an admin, I want to **deactivate users** who are no longer with the college.
- As an admin, I want to **reset passwords** and have credentials emailed to users.

---

## 6. Functional Requirements

### Authentication
- FR-01: System must support JWT-based login for all roles
- FR-02: Sessions must expire after 8 hours
- FR-03: Tokens must be stored securely using device Secure Store (not AsyncStorage)
- FR-04: Users with `mustChangePassword = true` must be redirected to the password change screen immediately after login
- FR-05: Logout must clear all locally stored credentials

### Visits
- FR-06: Faculty can only have one active visit at a time
- FR-07: Start visit requires hostel selection and purpose
- FR-08: End visit records check-out time and calculates duration in minutes
- FR-09: Completed visits can be verified by the assigned warden
- FR-10: Warden verification is limited to visits in their assigned hostel
- FR-11: Upon visit completion, the assigned warden receives an email notification

### Hostels
- FR-12: Hostels have a name, type (boys/girls), capacity, and location
- FR-13: Each hostel can have exactly one assigned warden
- FR-14: Deactivated hostels do not appear in the visit creation flow
- FR-15: Admins can assign/reassign wardens to hostels

### Users
- FR-16: Admin can create users with roles: admin, faculty, warden
- FR-17: New users receive a system-generated temporary password via email
- FR-18: Admin can activate/deactivate user accounts
- FR-19: Admin can reset any user's password (new password emailed)

### Reports
- FR-20: Dashboard shows real-time active visit count, today's count, monthly count
- FR-21: System provides hostel-wise and faculty-wise visit breakdowns
- FR-22: Monthly reports show daily visit breakdown with bar visualization
- FR-23: Warden dashboard is scoped to their assigned hostel only

---

## 7. Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-01 | API response time | < 500ms for 95th percentile |
| NFR-02 | App launch time | < 3 seconds on Expo Go |
| NFR-03 | Availability | 99.5% uptime (Supabase SLA) |
| NFR-04 | Security | JWT HS256, bcrypt cost factor 12, HTTPS only |
| NFR-05 | Token storage | Expo SecureStore (hardware-backed encryption) |
| NFR-06 | Scalability | Supabase PostgreSQL handles 10,000+ visits |
| NFR-07 | Compatibility | Expo Go on Android 10+ and iOS 14+ |
| NFR-08 | Offline handling | Graceful error messages when offline |
| NFR-09 | Audit trail | All actions logged with user, timestamp, IP |
| NFR-10 | Email | Async (non-blocking) email dispatch via SMTP |

---

## 8. Out of Scope (v2.0)

- Push notifications (planned for v3.0)
- Student self-service portal
- Document/photo upload during visits
- Multi-college support
- Offline mode with local sync

---

## 9. Success Metrics

- 100% of faculty visits are digitally recorded (zero paper logs)
- Warden visit verification rate > 90%
- Average visit record creation time < 30 seconds
- Admin can generate monthly report in < 5 seconds
