# Smart Electricity Tracker

This repository contains:

- a React + Vite web app in [C:\python\smart-electricity-tracker\client](C:\python\smart-electricity-tracker\client)
- a shared Express + MongoDB backend in [C:\python\smart-electricity-tracker\server](C:\python\smart-electricity-tracker\server)

The web app is the main experience for authentication, layout building, live monitoring, analytics, alerts, and settings.

## Monorepo Layout

- [C:\python\smart-electricity-tracker\client](C:\python\smart-electricity-tracker\client): web app
- [C:\python\smart-electricity-tracker\server](C:\python\smart-electricity-tracker\server): API server
- [C:\python\smart-electricity-tracker\package.json](C:\python\smart-electricity-tracker\package.json): root scripts

## Prerequisites

- Node.js 20+ or the portable Node toolchain already used in this workspace
- npm
- MongoDB Atlas or another MongoDB instance

## Root Scripts

From [C:\python\smart-electricity-tracker](C:\python\smart-electricity-tracker):

```powershell
npm run dev:client
npm run dev:server
```

These map to:

- `dev:client` -> Vite web app
- `dev:server` -> Express backend

## Backend Setup

Create:

- [C:\python\smart-electricity-tracker\server\.env](C:\python\smart-electricity-tracker\server\.env)

```text
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
CORS_ORIGIN=http://localhost:5173
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@example.com
SMTP_SECURE=false
```

Run:

```powershell
npm --prefix server install
npm --prefix server run dev
```

Health check:

- [http://localhost:5000/health](http://localhost:5000/health)

## Web App Setup

Create:

- [C:\python\smart-electricity-tracker\client\.env](C:\python\smart-electricity-tracker\client\.env)

```text
VITE_API_URL=http://localhost:5000
REACT_APP_API_URL=http://localhost:5000
```

Run:

```powershell
npm --prefix client install
npm --prefix client run dev
```

Default local URL:

- [http://localhost:5173](http://localhost:5173)

## Shared Backend APIs

Main endpoints already used by the web app:

- `POST /signup`
- `POST /login`
- `POST /forgot-password`
- `POST /reset-password`
- `GET /user-data`
- `PATCH /user-profile`
- `GET /usage-data`
- `POST /save-usage`
- `GET /get-layout`
- `POST /save-layout`
- `POST /api/simulator/batch`

## Production

Already deployed:

- Web: [https://smart-electricity-tracker-client.vercel.app](https://smart-electricity-tracker-client.vercel.app)
- Backend: [https://smart-electricity-tracker.onrender.com](https://smart-electricity-tracker.onrender.com)

Health check:

- [https://smart-electricity-tracker.onrender.com/health](https://smart-electricity-tracker.onrender.com/health)

## Notes

- Real OTP email delivery depends on SMTP variables being set on the backend.
- `.env` files are intentionally ignored. Use the `.env.example` files as templates.
