# Smart Electricity Tracker

This repository now supports both:

- a React + Vite web app in [C:\python\smart-electricity-tracker\client](C:\python\smart-electricity-tracker\client)
- an Expo React Native mobile app in [C:\python\smart-electricity-tracker\mobile](C:\python\smart-electricity-tracker\mobile)
- a shared Express + MongoDB backend in [C:\python\smart-electricity-tracker\server](C:\python\smart-electricity-tracker\server)

The web app is the main layout builder and dashboard. The mobile app is a companion app for login, live monitoring, device control, floor switching, alerts, profile/theme settings, and saving device-state changes back to the same backend.

## Monorepo Layout

- [C:\python\smart-electricity-tracker\client](C:\python\smart-electricity-tracker\client): web app
- [C:\python\smart-electricity-tracker\mobile](C:\python\smart-electricity-tracker\mobile): mobile app
- [C:\python\smart-electricity-tracker\server](C:\python\smart-electricity-tracker\server): API server
- [C:\python\smart-electricity-tracker\package.json](C:\python\smart-electricity-tracker\package.json): workspace scripts

## Prerequisites

- Node.js 20+ or the portable Node toolchain already used in this workspace
- npm
- MongoDB Atlas or another MongoDB instance

## Root Scripts

From [C:\python\smart-electricity-tracker](C:\python\smart-electricity-tracker):

```powershell
npm run dev:client
npm run dev:server
npm run dev:mobile
```

These map to:

- `dev:client` -> Vite web app
- `dev:server` -> Express backend
- `dev:mobile` -> Expo mobile app

## Backend Setup

Create:

- [C:\python\smart-electricity-tracker\server\.env](C:\python\smart-electricity-tracker\server\.env)

Use the same values already configured in production:

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

## Mobile App Setup

Create:

- [C:\python\smart-electricity-tracker\mobile\.env](C:\python\smart-electricity-tracker\mobile\.env)

```text
EXPO_PUBLIC_API_URL=http://localhost:5000
```

For a real phone on the same Wi-Fi, replace `localhost` with your laptop IP:

```text
EXPO_PUBLIC_API_URL=http://192.168.x.x:5000
```

Run:

```powershell
npm --prefix mobile install
npm --prefix mobile run start
```

The Expo mobile app includes:

- login and signup
- forgot-password OTP flow
- live simulator polling every second
- floor switching
- device toggles
- alerts
- profile update
- theme switch
- manual save back to backend

## Current Product Split

Use the web app when you want to:

- create and refine the house or facility layout
- manage the richer builder workflow
- work with the full dashboard on a larger screen

Use the mobile app when you want to:

- monitor live power on the move
- switch devices on and off
- check alerts quickly
- update your profile or theme
- save device-state changes from your phone

## Shared Backend APIs

Main endpoints already used by both apps:

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

For local Expo testing against production, use:

```text
EXPO_PUBLIC_API_URL=https://smart-electricity-tracker.onrender.com
```

## Notes

- Real OTP email delivery depends on SMTP variables being set on the backend.
- The mobile app reads the same saved account, floors, rooms, and devices as the web app.
- `.env` files are intentionally ignored. Use the `.env.example` files as templates.
