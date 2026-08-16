# Job and Skill — Full Stack Website

This version keeps the mature frontend from the uploaded project and adds a working Node.js/Express/SQLite backend.

## Requirements
- Node.js 18+ (Node.js 20+ recommended)
- VS Code

## Setup

1. Extract the ZIP.
2. Open the `skill connect renew` folder in VS Code.
3. Open the terminal in that folder.
4. Run:

```bash
npm install
```

5. Copy `.env.example` to `.env`.
6. Change `JWT_SECRET`, `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
7. Start:

```bash
npm start
```

8. Open `http://localhost:3000`.

For development with automatic restarts:

```bash
npm run dev
```

## Administrator login

The backend automatically creates an administrator account the first time it starts.

The credentials come from `.env`:

```env
ADMIN_EMAIL=admin@jobandskill.com
ADMIN_PASSWORD=ChangeMe123!
```

**Change the default password before using the site for real users.**

The administrator uses the same `login.html` page. The server puts the admin role inside the login token and the frontend redirects the admin to `/admin/dashboard.html`.

## How the backend works

### 1. Signup
`signup.html` sends the registration data to:

`POST /api/auth/register`

The server:
- validates the data
- checks for duplicate email
- hashes the password with bcrypt
- stores the user in SQLite
- creates a signed JWT login token

The raw password is never stored in the database.

### 2. Login
`login.html` sends email and password to:

`POST /api/auth/login`

The server finds the account, checks the bcrypt password hash and returns a JWT.

If `role === "admin"`, the frontend sends the administrator to the admin dashboard. Otherwise it sends the learner to the user dashboard.

### 3. Courses
Courses are stored in the `courses` table. The frontend can request:

`GET /api/courses`

or a specific course:

`GET /api/courses/:slug`

### 4. Course application
When a learner clicks a course, the URL becomes something like:

`review.html?course=web-development`

The review page loads that course from the backend.

When the learner submits the form:

`POST /api/applications`

The backend stores:
- learner ID
- course ID
- programme duration
- phone
- application message
- status

Every new application starts as `pending`.

### 5. Administrator review
The admin dashboard calls:

`GET /api/admin/applications`

The admin can open an application and choose:

- Accept
- Reject

The decision is sent to:

`PUT /api/admin/applications/:id/decision`

The application status becomes `approved` or `rejected`, and the administrator can save a note.

### 6. Learner dashboard
The learner dashboard calls:

`GET /api/applications/my`

The learner sees their applications and the current decision.

### 7. Seeing everyone who created an account
The administrator dashboard calls:

`GET /api/admin/users`

This shows the account holders, including:
- name
- email
- phone
- interest/account type
- number of applications
- registration date

### 8. Contact messages
The contact form sends:

`POST /api/contact`

Messages are stored in SQLite.

The admin dashboard gets them with:

`GET /api/admin/messages`

## Database

The database file is automatically created at:

`database/jobandskill.db`

Tables:
- `users`
- `courses`
- `applications`
- `contact_messages`

Do not upload the `.env` file or the SQLite database to a public GitHub repository if it contains real user information.

## Important production note

This is a strong local/development full-stack foundation. Before deploying publicly, add HTTPS, secure cookie-based sessions or hardened token storage, rate limiting, CSRF protection where applicable, stronger validation, backups, email notifications, and a production database/hosting setup.
