# Role-Based Access Control Implementation

## Overview

Implemented a complete role-based access control (RBAC) system for VivaLoop where both **admins** and **students** use a unified login page and are redirected to their respective dashboards based on their role.

## Architecture

### Backend Changes

#### 1. Admin Model (`models.py`)
- Created new `Admin` model with fields:
  - `id`, `name`, `email`, `password_hash`, `created_at`, `updated_at`
- Added Pydantic schemas:
  - `AdminBase`, `AdminCreate`, `AdminRead`, `AdminLogin`
- Updated `TokenResponse` to include `user` (dict) and `role` (string) instead of just `student`

#### 2. Authentication System (`auth.py`)
- Updated `create_access_token()` to accept `role` parameter
- JWT payload now includes: `sub` (user_id), `role` (student/admin), `exp` (expiration)
- Added `get_current_admin()` dependency for admin-only routes
- Updated `get_current_student()` to validate role is "student"

#### 3. Unified Login (`routers/auth.py`)
- Single `/api/auth/login` endpoint checks both `students` and `admins` tables
- Returns JWT with role information
- `/api/auth/me` endpoint returns user profile based on role

#### 4. Database Schema
- Created `admins` table
- Seeded default admin: `admin@edumaster.com` / `password123`

### Frontend Changes

#### 1. AuthContext (`context/AuthContext.jsx`)
- Changed state from `student` to `user` (can be student or admin)
- Added `role` state to track user role
- Updated `login()` to return `{ user, role }`
- Updated `logout()` to clear both `user` and `role`

#### 2. Unified Login Page (`pages/Login.jsx`)
- Single login page for both students and admins
- After successful login, redirects based on role:
  - **Admin** → `/dashboard` (admin dashboard)
  - **Student** → `/student/viva` (student viva page)
- Updated UI text to reflect unified login
- Shows demo credentials for both roles

#### 3. Protected Routes (`components/ProtectedRoute.jsx`)
- Added `requiredRole` prop for role-based access control
- Redirects users to appropriate page if role doesn't match:
  - Admin trying to access student route → `/dashboard`
  - Student trying to access admin route → `/student/viva`

#### 4. Role-Based Navigation (`components/Navbar.jsx`)
- Navigation adapts based on role:
  - **Admin sees**: Dashboard, Viva Session, Students, Logout
  - **Student sees**: Take Viva, My Dashboard, Logout
- Shows user name and role in navbar (e.g., "Admin User (admin)")
- Unauthenticated users see only "Login" link

#### 5. Route Protection (`App.jsx`)
- Admin routes protected with `requiredRole="admin"`:
  - `/` (Dashboard)
  - `/viva` (Viva Session)
  - `/students` (Students management)
- Student routes protected with `requiredRole="student"`:
  - `/student/viva` (Take Viva)
  - `/student/dashboard` (My Dashboard)

#### 6. Student Pages Updated
- `StudentViva.jsx`: Changed `student` to `user` from auth context
- `StudentDashboard.jsx`: Changed `student` to `user` from auth context

## User Flow

### Admin Flow
1. Admin visits any page → redirected to `/login`
2. Logs in with `admin@edumaster.com` / `password123`
3. System detects admin role → redirects to `/dashboard`
4. Navbar shows admin navigation: Dashboard, Viva Session, Students
5. Can access all admin pages
6. If tries to access student pages → redirected back to `/dashboard`

### Student Flow
1. Student visits any page → redirected to `/login`
2. Logs in with `kasun@example.com` / `password123`
3. System detects student role → redirects to `/student/viva`
4. Navbar shows student navigation: Take Viva, My Dashboard
5. Can access all student pages
6. If tries to access admin pages → redirected back to `/student/viva`

## Demo Credentials

### Admin
- **Email**: `admin@edumaster.com`
- **Password**: `password123`
- **Access**: Dashboard, Viva Session, Students management

### Students (5 seeded)
- **Emails**: `kasun@example.com`, `nimali@example.com`, `ravi@example.com`, `dinesh@example.com`, `amara@example.com`
- **Password**: `password123` (all students)
- **Access**: Take Viva, My Dashboard

## API Endpoints

### POST `/api/auth/login`
Unified login for both students and admins.

**Request:**
```json
{
  "email": "admin@edumaster.com",
  "password": "password123"
}
```

**Response (Admin):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "name": "Admin User",
    "email": "admin@edumaster.com",
    "created_at": "2026-08-26T18:11:20.906110",
    "updated_at": "2026-08-26T18:11:20.906110"
  },
  "role": "admin"
}
```

**Response (Student):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "name": "Kasun Perera",
    "email": "kasun@example.com",
    "student_code": "IT-2024-001",
    "created_at": "2026-08-26T16:57:08.685718",
    "updated_at": "2026-08-26T16:57:08.685718"
  },
  "role": "student"
}
```

### GET `/api/auth/me`
Returns current user's profile based on JWT token.

**Response (Admin):**
```json
{
  "user": {
    "id": 1,
    "name": "Admin User",
    "email": "admin@edumaster.com"
  },
  "role": "admin"
}
```

**Response (Student):**
```json
{
  "user": {
    "id": 1,
    "name": "Kasun Perera",
    "email": "kasun@example.com",
    "student_code": "IT-2024-001"
  },
  "role": "student",
  "placement": {
    "track": "Developer",
    "level": "L2 – Developing",
    ...
  }
}
```

## Security Features

1. **Role-based JWT tokens**: Each token includes user ID and role
2. **Password hashing**: Bcrypt hashing for all passwords
3. **Route protection**: Both frontend and backend enforce role checks
4. **Token expiration**: 24-hour token validity
5. **Role validation**: Backend validates role on every protected endpoint

## Testing

Both logins tested and working:
- ✅ Admin login returns correct role and user data
- ✅ Student login returns correct role and user data
- ✅ Role-based redirects working
- ✅ Protected routes enforce role restrictions
- ✅ Navigation adapts to user role

## Next Steps

1. Add admin management features (create/edit/delete admins)
2. Add student management features (view all students, manage enrollments)
3. Implement admin dashboard to view all student evaluations
4. Add role-based analytics and reporting
5. Implement learning materials and quizzes for students
