# 🏛️ Community Hall Booking Management System

A beginner-friendly full-stack web app for browsing community halls, checking
availability, booking time slots, and (for admins) managing halls and bookings.

**Tech stack:** HTML / CSS / vanilla JavaScript (frontend) · Node.js + Express
(backend) · MySQL (database) · JWT (authentication)

---

## 📁 Project Structure

```
project/
├── public/                 # FRONTEND (served as static files by Express)
│   ├── index.html          # Home page
│   ├── halls.html          # List of all halls (with search)
│   ├── hall-details.html   # Single hall's full details
│   ├── booking.html        # Pick date/time slot & book
│   ├── booking-history.html# Logged-in user's own bookings
│   ├── login.html
│   ├── register.html
│   ├── admin.html          # Admin dashboard (manage halls + bookings)
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── auth.js         # shared helpers: fetch wrapper, navbar, session
│       ├── main.js         # home page logic
│       ├── halls.js        # halls listing + search
│       ├── hall-details.js
│       ├── booking.js      # availability check + booking form
│       ├── booking-history.js
│       ├── login.js
│       ├── register.js
│       └── admin.js
│
└── server/                 # BACKEND
    ├── server.js            # Express app entry point
    ├── db.js                # MySQL connection pool
    ├── schema.sql            # CREATE TABLE statements
    ├── seed.sql               # sample test data
    ├── package.json
    ├── .env.example
    ├── middleware/
    │   └── auth.js           # verifyToken, isAdmin
    ├── controllers/
    │   ├── authController.js
    │   ├── hallController.js
    │   └── bookingController.js
    └── routes/
        ├── authRoutes.js
        ├── hallRoutes.js
        ├── bookingRoutes.js
        └── adminRoutes.js
```

The Express server serves BOTH the API (`/api/...`) and the static frontend
files, so once the backend is running you only need **one URL**:
`http://localhost:5000`

---

## ✅ Step-by-Step Setup

### 1. Install Node.js

Download and install Node.js (LTS version) from https://nodejs.org.
Check it installed correctly:

```bash
node -v
npm -v
```

### 2. Install & set up MySQL

Install MySQL Community Server if you don't already have it:
https://dev.mysql.com/downloads/mysql/

Log into the MySQL shell:

```bash
mysql -u root -p
```

Then create the database and tables by running the schema file:

```bash
# from the project's /server folder
mysql -u root -p < schema.sql
```

(Optional) Load sample test data:

```bash
mysql -u root -p community_hall_db < seed.sql
```

> ⚠️ The seed file's password hashes are just examples. It's easiest to
> create your own test accounts via the **Sign Up** page (see step 6), then
> promote one to admin with:
> ```sql
> UPDATE users SET role = 'admin' WHERE email = 'youremail@example.com';
> ```

### 3. Configure environment variables

Inside `/server`, copy the example env file:

```bash
cp .env.example .env
```

Open `.env` and fill in your real MySQL password and a strong, unique JWT
secret (generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`):

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=community_hall_db
DB_PORT=3306
PORT=5000
JWT_SECRET=
JWT_EXPIRES_IN=1d
```

For verified owner setup, configure SMTP credentials in the server environment
as well (`EMAIL_USER`, `EMAIL_PASS`, and, if needed, `EMAIL_HOST`, `EMAIL_PORT`,
and `EMAIL_SECURE`). Never commit `.env`.

### 4. Install backend dependencies

```bash
cd server
npm install
```

This installs: express, mysql2, bcrypt, jsonwebtoken, cors, dotenv (and
nodemon for development).

### 5. Apply the additive database migration

From the `server` directory, run:

```bash
npm run db:migrate
```

This migration preserves existing accounts, halls, and bookings. It adds the
owner/manager roles, account activation and verification fields, hall
facilities and activation fields, manager-to-hall assignments, cancelled
booking status, supporting indexes, and the management audit log. It is safe to rerun. Back up the
database before applying schema changes in production.

### 6. Initialize the owner account

The owner account is restricted to `faruqh042@gmail.com`. Public registration
cannot create owner or manager accounts. After configuring SMTP, run this
command from an interactive terminal:

```bash
npm run owner:init
```

The script emails a short-lived one-time code to the owner mailbox before
setting a new owner password. Existing account data is retained; the owner
password is reset only after mailbox verification. Only one owner account is
allowed. Managers are created by changing a registered user's role in the
Owner Dashboard, then assigning that manager one or more active halls.

### 7. Run the backend

```bash
npm start
```

or, for auto-restart on file changes during development:

```bash
npm run dev
```

You should see:

```
🚀 Server running at http://localhost:5000
✅ MySQL database connected successfully
```

### 8. Open the frontend

Just open your browser and go to:

```
http://localhost:5000
```

That's it — no separate frontend server needed, since Express serves the
`/public` folder directly.

1. Click **Sign Up** to create a normal user account.
2. Browse halls, view details, pick a date, and book a slot.
3. The owner initializes the verified account with `npm run owner:init` and
   signs in through the normal Login page. Managers are redirected to Manager
   Dashboard after the owner assigns them halls.
4. Existing legacy admin accounts retain access to the Admin Dashboard.

---

## 🔌 API Reference

| Method | Route                          | Auth        | Description                          |
|--------|---------------------------------|-------------|---------------------------------------|
| POST   | `/api/register`                | Public      | Create a new user account             |
| POST   | `/api/login`                   | Public      | Log in, returns a JWT token           |
| GET    | `/api/halls`                   | Public      | List all halls                        |
| GET    | `/api/halls/:id`               | Public      | Get one hall's details                |
| GET    | `/api/halls/:id/availability`  | Public      | `?date=YYYY-MM-DD` → booked slots     |
| POST   | `/api/book`                    | User        | Create a booking (pending status)     |
| GET    | `/api/bookings`                | User        | Get the logged-in user's bookings     |
| POST   | `/api/admin/halls`             | Admin       | Add a new hall                        |
| PUT    | `/api/admin/halls/:id`         | Admin       | Edit a hall                           |
| DELETE | `/api/admin/halls/:id`         | Admin       | Delete a hall                         |
| GET    | `/api/admin/bookings`          | Admin       | List every booking                    |
| PUT    | `/api/admin/bookings/:id`      | Admin       | Approve/reject a booking               |
| GET    | `/api/me`                      | User        | Return the current database-backed identity |
| GET    | `/api/owner/dashboard`         | Owner       | Real owner statistics and activity |
| GET    | `/api/owner/users`             | Owner       | Search and paginate user/manager accounts |
| GET    | `/api/owner/bookings`          | Owner       | Search and paginate booking history |
| GET    | `/api/manager/dashboard`       | Manager     | Statistics and activity for assigned halls |
| GET    | `/api/manager/bookings`        | Manager     | Search and paginate assigned-hall bookings |

**Authentication:** After login, the frontend stores the returned JWT in
`localStorage` and sends it on every protected request as:
`Authorization: Bearer <token>`

---

## 🚫 How Double-Booking Is Prevented

Before a booking is inserted, `bookingController.js` checks whether a
`pending` or `approved` booking already exists for the same
`hall_id + date + time_slot`. If one does, the API responds with `409
Conflict` and the message *"This slot is already booked."* Rejected
bookings don't block the slot, so it becomes available again after an admin
rejects a request.

The frontend also checks `/api/halls/:id/availability?date=...` when a user
picks a date, and greys out/disables any already-booked time slots before
they can even click one.

---

## 🧪 Sample Test Data

See `server/seed.sql` for sample halls. Recommended flow for testing:

1. Register a user account (e.g. `test@example.com` / `test123`).
2. Promote it to admin via SQL if you want to test admin features.
3. Log in, browse the seeded halls, pick a date/slot, and submit a booking.
4. Log in as admin (or switch role) and approve/reject it from the
   **Admin Dashboard → Manage Bookings** tab.

---

## 🔒 Security Notes

- Passwords are hashed with **bcrypt** before being stored — never saved as
  plain text.
- Protected routes verify JWTs, reload the current account and role from
  MySQL, and enforce owner, manager, user, and legacy admin permissions.
- Manager reads and writes are scoped to halls assigned by the owner.
- Only the owner initialization script can bootstrap the fixed owner account,
  and it requires mailbox verification.
- SQL queries use parameterized placeholders (`?`) to prevent SQL injection.
- Never expose or commit SMTP credentials, database passwords, or JWT secrets.
- Revenue is reported as unavailable until actual payment/transaction records
  are added; the dashboard does not invent financial totals.

---

---

## ✨ Bright Theme and Animations

The frontend uses CSS and vanilla JavaScript layered on `style.css`, with a
persistent light/dark theme, owner and manager dashboards, and server-side
role enforcement.

### Colour palette
| Role | Colour |
|---|---|
| Page background | `#FFFFFF` |
| Light blue sections | `#F0F7FF` |
| Primary blue / sky blue | `#2563EB` / `#38BDF8` |
| Violet / soft lavender | `#8B5CF6` / `#F3E8FF` |
| Coral accent / soft peach / mint | `#FF6B6B` / `#FFF1E8` / `#D1FAE5` |
| Main text / secondary text | `#172554` / `#64748B` |
| Borders | `#E2E8F0` |

Colours are CSS variables in `public/css/theme.css`. The saved theme is
applied before the stylesheets load.

### Frontend files
| File | What it does |
|---|---|
| `public/css/theme.css` | Colours, shapes, shadows: navbar, buttons, hall cards, hero, forms, booking page, dashboard, footer. |
| `public/css/animations.css` | Motion: drifting pastel blobs, floating shapes, marquee ribbon, card shine, row slide-ins. Switched off for `prefers-reduced-motion`. |
| `public/js/effects.js` | Loader, scroll reveal, 3D card tilt, button ripple, optional sounds, typing subtitle, toasts. The normal mouse cursor is never hidden or replaced. |
| `public/js/animations.js` | Background shapes, scroll progress bar, card spotlight, click sparkle burst. |
| `public/js/manager.js` | Assigned-hall dashboard, scoped booking management, and report export. |
| `public/js/owner.js` | Owner dashboard, account and hall management, assignments, and reports. |
| `public/js/theme-init.js` | Restores theme before the page is painted. |
| `public/js/calendar.js` | Dependency-free calendar date picker used on the booking page. |
| `public/images/hero-hall.svg` | Illustration used in the hero. Hall cards use their own database image, or a generated illustration if it is missing. |

### Live data on the pages
- Hall cards show an availability badge ("3 of 4 slots free today") taken from
  `GET /api/halls/:id/availability`.
- Dashboard statistic cards are counted from `GET /api/halls` and
  `GET /api/admin/bookings`.
- Hall facilities are stored in the additive schema migration and shown when
  configured for a hall.

### "Already booked" feedback
Clicking a taken slot (shown with a lock) shakes it and shows a toast. If two
people race for the same slot, the backend still rejects the second request
with `409 Conflict` and the page shows the same toast.


### Owner contact info
Every page's footer (and the booking page specifically) now shows:
📞 **+91 93539 16328** as a tap-to-call link, plus a WhatsApp click-to-chat
link (`wa.me/919353916328`). Update the number by searching for
`9353916328` across the `public/` folder if it ever changes.

### 📧 Setting Up Booking Emails

Every time someone submits a booking, the backend emails the owner
(`ADMIN_EMAIL` in `.env`) with the hall, date, time slot, price, and who
booked it. This uses **nodemailer** with a normal SMTP account — Gmail is
the easiest to set up:

1. **Install the new dependency** (already in `package.json`):
   ```bash
   cd server
   npm install
   ```

2. **Create a Gmail "App Password"** (you cannot use your normal Gmail
   password for this — Google blocks it for security):
   - Go to https://myaccount.google.com/security
   - Turn on **2-Step Verification** if it isn't already on.
   - Go to https://myaccount.google.com/apppasswords
   - Create an app password (name it e.g. "Community Hall Booking"), and copy the
     16-character code it gives you.

3. **Fill in your `.env`** file (in `/server`):
   ```
   ADMIN_EMAIL=faruqh042@gmail.com
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=465
   EMAIL_SECURE=true
   EMAIL_USER=your_gmail_address@gmail.com
   EMAIL_PASS=the_16_character_app_password
   ```
   - `ADMIN_EMAIL` is who **receives** the notification (defaults to your
     address, `faruqh042@gmail.com`).
   - `EMAIL_USER` / `EMAIL_PASS` is the account that **sends** it — this
     can be the same Gmail address or a separate one you set up just for
     the app.

4. **Restart the server** (`npm start`). Make a test booking — you should
   receive an email within a few seconds.

> If you'd rather not use Gmail, any SMTP provider works (Outlook,
> SendGrid, Mailgun, Resend, your web host's SMTP, etc.) — just change
> `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_SECURE` to match their settings.
>
> If `.env` is left without `EMAIL_USER`/`EMAIL_PASS`, the app still works
> completely normally — it just logs *"Email not configured — skipping
> notification email"* and skips sending. A broken or missing email setup
> can never block or break a booking.

---

## 🛠️ Troubleshooting

- **"Could not connect to MySQL database"** → check your `.env` credentials
  and that MySQL is running (`mysql.server start` or via Services on
  Windows).
- **"Access denied. Admins only."** → your account's `role` is still
  `user`. Update it in MySQL and log in again to get a fresh token.
- **Port already in use** → change `PORT` in `.env`.
- **Images look like grey placeholders** → that's expected; this project
  doesn't ship real photos. Replace image URLs in the admin dashboard with
  your own image links, or add files to `public/images/`.
- **Booking email never arrives** → check the server console: it logs
  either `✅ Booking notification email sent...` or a specific error. The
  most common cause is using your normal Gmail password instead of an
  **App Password** (see "Setting Up Booking Emails" above) — Gmail
  silently rejects normal passwords for SMTP logins.
- **Calendar panel doesn't open / date picker missing** → make sure
  `calendar.js` is included in the HTML **after** `effects.js` and
  **before** `booking.js` (see `booking.html`).
