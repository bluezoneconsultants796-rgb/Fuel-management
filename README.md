# Fuel Expense & Slip Management System

Fleet fuel-expense tracking with OCR-assisted receipt capture for a medicine-distribution
fleet. Drivers photograph a fuel slip; the backend reads it (OCR) and pre-fills the fields;
the driver reviews/corrects and saves. Office staff verify entries, browse/filter records,
watch the dashboard, and download a month-end PDF report.

```
fuel-management-system/
├── backend/    Node.js + Express + Prisma + PostgreSQL REST API (TypeScript)
├── mobile/     React Native (Expo) app — drivers and office staff
└── docs/       Project roadmap & technical specification
```

## Quick start

### 1. Backend

```bash
cd backend
cp .env.example .env        # fill in DATABASE_URL, DIRECT_URL, JWT_SECRET
npm install                 # also runs `prisma generate`
npx prisma migrate deploy   # creates the tables
npm run seed                # optional: demo users, drivers, vehicles, entries
npm run dev                 # http://localhost:5000/api/health
npm test                    # (optional) full API test suite — server must be running
```

Generate a JWT secret:
`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

### 2. Mobile app

```bash
cd mobile
cp .env.example .env        # set EXPO_PUBLIC_API_URL (see comments inside)
npm install
npm start                   # scan the QR code with Expo Go, or press `a` for Android
```

### Demo logins (after `npm run seed`)

| Role       | Email                    | Password      |
|------------|--------------------------|---------------|
| Admin      | admin@fleet.dev          | `Admin@123`   |
| Accountant | accountant@fleet.dev     | `Account@123` |
| Driver     | ahmed.driver@fleet.dev   | `Driver@123`  |

**Change or delete these accounts before going to production.**

## Scripts

| Where     | Command                  | Purpose                                              |
|-----------|--------------------------|------------------------------------------------------|
| backend   | `npm run dev`            | Dev server with auto-reload                          |
| backend   | `npm run build` / `start`| Compile to `dist/` and run                           |
| backend   | `npm run typecheck`      | Strict TypeScript check                              |
| backend   | `npm test`               | API integration tests (server + DB must be running)  |
| backend   | `npm run prisma:migrate` | Create a new migration during development            |
| backend   | `npm run prisma:deploy`  | Apply migrations (production)                        |
| backend   | `npm run prisma:studio`  | Browse the database                                  |
| mobile    | `npm start`              | Expo dev server                                      |
| mobile    | `npm run typecheck`      | Strict TypeScript check                              |

## Roles

- **Driver** — uploads slips, reviews OCR output, tracks own entries.
- **Accountant** — verifies/rejects entries (entries start as *verified*; rejected ones are
  excluded from dashboards and reports), dashboards, reports.
- **Admin** — everything above plus drivers, vehicles, and user accounts.

## Roadmap coverage

| Roadmap item                                   | Status |
|------------------------------------------------|--------|
| Role-based login (Admin / Accountant / Driver) | ✅ JWT + bcrypt, rate-limited login |
| Slip upload JPG / PNG / PDF, camera capture    | ✅ |
| OCR auto-fill (9 fields) + manual correction   | ✅ Tesseract.js default, Google Vision optional, PDF text layer |
| Database storage with image proof              | ✅ PostgreSQL (Prisma) |
| Search & filter (driver, vehicle, date, status)| ✅ |
| Dashboard (monthly, daily, per vehicle/driver) | ✅ |
| Month-end PDF report (download / print / share)| ✅ pdfkit, A4 landscape |
| Mobile-first UI                                | ✅ React Native (Expo) |
| Optional: duplicate-slip detection, GPS tag, WhatsApp, cloud backup, fraud AI | ⏳ Phase 6 — not built |

**Deliberate deviations from the roadmap's suggested stack:** PostgreSQL instead of MongoDB,
and a React Native app instead of a React web frontend. A browser-based office dashboard is
not included yet.

## Configuration notes

- **Database:** any PostgreSQL works. `DATABASE_URL` is used at runtime; `DIRECT_URL` is used
  by `prisma migrate` (set both to the same value if you don't use a connection pooler).
- **Uploads** are stored on local disk (`backend/uploads`). On hosts with an ephemeral
  filesystem (Railway, Heroku, Render) they are lost on redeploy — mount a persistent volume
  or move `storage.service.ts` to S3/Cloudinary before relying on this in production.
- **CORS:** `CORS_ORIGIN=*` is fine for development; set explicit origins in production.
- **Secrets:** `.env` files are git-ignored. Never commit real credentials.

## Tech stack

- **Backend:** Express, Prisma ORM, PostgreSQL, JWT, Zod, Multer, Tesseract.js / Google
  Vision, pdf-parse, PDFKit, Helmet, rate limiting.
- **Mobile:** React Native (Expo), React Navigation, Expo Image/Document Picker,
  Expo File System / Sharing.
