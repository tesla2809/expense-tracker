# Kushal Timbers — Expense Tracker

A dedicated income & expense tracker for Kushal Timbers, built on a MERN stack
(MongoDB, Express, React, Node).

## What's in here

- `backend/` — Express + MongoDB API (auth, expenses, income, file uploads)
- `frontend/` — React (Vite) dashboard
- `docker-compose.yml`, `k8s/` — deployment configs (not required for local dev)

## Features

- Login/signup with hashed passwords (JWT-based sessions)
- Expense and income tracking with categories tailored to a timber business
  (raw timber purchase, transport & freight, labor wages, sawmill/machinery
  maintenance, GST & taxes, timber sales, sawdust/byproduct sales, etc.),
  plus an "Other" option with a free-text category when nothing fits
- Party/vendor tracking on every entry (who you paid, or who paid you) —
  useful for supplier and customer credit accounts
- Payment mode (Cash / Bank Transfer / UPI / Cheque / Other)
- Optional bill/invoice photo or PDF attached to any entry
- Dashboard with category-wise breakdowns and recent-transactions view
- All amounts shown in ₹ (INR)

## Running it locally

### 1. Backend

```bash
cd backend
cp .env.example .env   # then fill in MONGO_URI and JWT_SECRET
npm install
npm run dev            # http://localhost:3000
```

`MONGO_URI` can point to a local MongoDB or a free MongoDB Atlas cluster.
`JWT_SECRET` should be a long random string — used to sign login tokens.

Uploaded bills are stored under `backend/uploads/` and served at
`/uploads/<filename>`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev             # http://localhost:5173
```

Set `VITE_API_BASE_URL` in `frontend/.env` to your backend's `/api` URL
(defaults to `http://localhost:3000/api` for local dev).

## Notes on this upgrade (Sept 2026)

This started as a generic personal expense tracker and was reworked into a
dedicated tool for Kushal Timbers:

- Fixed a security bug where passwords were stored and compared in plain
  text — they're now hashed with bcrypt.
- Expense/income routes now require a valid login token and always use the
  logged-in user's identity server-side, instead of trusting a `userId`
  sent by the client.
- Added timber-business categories, party/vendor tracking, payment mode,
  and bill/invoice file uploads, on both the API and the UI.
- Rebranded the UI for Kushal Timbers and switched currency display to ₹.

It currently supports a single login. If Kushal Timbers' owner needs their
own login later (e.g. to review reports without entering data), that would
mean adding user roles — a bigger change than this round covered, but the
data model (everything scoped by `user`) is a reasonable starting point for
it.

Deployment (Vercel for the frontend, Render/Railway for the backend) isn't
set up yet — the app is currently meant to be run locally. Ask when you're
ready to put it on a public URL and we can wire that up.
