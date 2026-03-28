# Smart Electricity Usage Tracker

This project now includes a working self-contained version at the project root that runs without `npm install` on this machine.

## Fast Start

1. Run [start-smart-tracker.bat](C:/python/electricity_tracker_prototype/start-smart-tracker.bat)
2. Open `http://localhost:5000`
3. Sign up or log in

If the batch file cannot find the bundled Node binary, run:

```powershell
& 'C:\Program Files\cursor\resources\app\resources\helpers\node.exe' 'C:\python\electricity_tracker_prototype\server.js'
```

## Working Root App

- Backend: [server.js](C:/python/electricity_tracker_prototype/server.js)
- Frontend: [index.html](C:/python/electricity_tracker_prototype/index.html), [styles.css](C:/python/electricity_tracker_prototype/styles.css), [app.js](C:/python/electricity_tracker_prototype/app.js)
- Data store: created automatically in `data/store.json`

### Features

- Signup and login
- Token-based authenticated session
- Logout
- Real-time electricity usage simulation
- Voltage, current, kWh, and bill estimation
- 2D house map with room-wise appliance control
- Appliance ON/OFF persistence
- Daily usage history saving
- Alerts for usage limit, low voltage, peak hours, and overload risk
- Mobile + desktop responsive layout
- Dark mode and notification preferences

## Optional Scaffold

There is also a dependency-based scaffold kept in:

- [client](C:/python/electricity_tracker_prototype/client)
- [server](C:/python/electricity_tracker_prototype/server)

That version expects a normal React/Express/MongoDB setup with `npm` and MongoDB installed.

## Password Reset OTP

The root app now includes a forgot-password flow with OTP-based reset.

### Real Email Delivery

Set these environment variables before starting `server.js` if you want the OTP to be sent to a real mailbox:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `SMTP_USE_SSL`

Example PowerShell launch:

```powershell
$env:SMTP_HOST='smtp.gmail.com'
$env:SMTP_PORT='587'
$env:SMTP_USER='your-email@example.com'
$env:SMTP_PASS='your-app-password'
$env:SMTP_FROM='your-email@example.com'
$env:SMTP_USE_SSL='true'
& 'C:\Program Files\cursor\resources\app\resources\helpers\node.exe' 'C:\python\electricity_tracker_prototype\server.js'
```

### Local Preview Mode

If SMTP is not configured, the app still works in local preview mode:

- the backend generates the OTP
- the UI shows the preview OTP so you can complete the reset flow locally

## In-App SMTP Setup

You no longer need to edit SMTP environment variables by hand for the working root app.

1. Sign in.
2. Open Settings.
3. Use the `Password reset OTP mail` card.
4. Save the sender mailbox SMTP details and send a test email.

Notes:
- Gmail usually requires an App Password.
- If SMTP is not configured, the app still falls back to local OTP preview mode in development.

## Hosted Backend Configuration

The working root app can now use a public backend URL instead of being tied to `http://localhost:5000`.

Environment variables:

- `PORT` for the backend port
- `PUBLIC_API_URL` for the public backend base URL
- `CORS_ORIGIN` for the allowed frontend origin
- `JWT_SECRET` for production token signing

Example PowerShell launch for a hosted-style setup:

```powershell
$env:PORT='5000'
$env:PUBLIC_API_URL='https://your-backend.onrender.com'
$env:CORS_ORIGIN='https://your-frontend.onrender.com'
$env:JWT_SECRET='replace-this-in-production'
& 'C:\Program Files\cursor\resources\app\resources\helpers\node.exe' 'C:\python\electricity_tracker_prototype\server.js'
```

Notes:
- The root app reads runtime API config from `/app-config.js`, so it works without hardcoding localhost in the browser.
- If you use the React scaffold in [client](C:/python/electricity_tracker_prototype/client), set `REACT_APP_API_URL` in that build environment.
- I prepared the app for deployment, but I did not deploy it to Render or Railway from this machine because that requires network access and your cloud account/project credentials.

## React + Express Deployment

The React/Express scaffold is now prepared for a hosted backend/frontend split.

- Frontend API env: `REACT_APP_API_URL`
- Vite-compatible fallback env: `VITE_API_URL`
- Backend envs: `PORT`, `MONGO_URI`, `JWT_SECRET`, `CORS_ORIGIN`

Files added or updated:

- [client/.env.example](C:/python/electricity_tracker_prototype/client/.env.example)
- [client/vite.config.js](C:/python/electricity_tracker_prototype/client/vite.config.js)
- [client/src/utils/api.js](C:/python/electricity_tracker_prototype/client/src/utils/api.js)
- [server/.env.example](C:/python/electricity_tracker_prototype/server/.env.example)
- [server/src/index.js](C:/python/electricity_tracker_prototype/server/src/index.js)
- [render.yaml](C:/python/electricity_tracker_prototype/render.yaml)

Render deployment path:

1. Push this repo to GitHub.
2. Create services from [render.yaml](C:/python/electricity_tracker_prototype/render.yaml).
3. Set backend secrets: `MONGO_URI`, `JWT_SECRET`, `CORS_ORIGIN`.
4. Set frontend env: `REACT_APP_API_URL` to your backend Render URL.

Official references:

- [Render Blueprint Spec](https://render.com/docs/blueprint-spec)
- [Render Static Sites](https://render.com/docs/static-sites)

I prepared the app for hosted deployment, but I did not deploy it to Render or Railway from this machine because that requires network access and your cloud account credentials.

## React Password Reset Email Setup

The React + Express deployment now supports OTP-based password reset over email.

Backend environment variables required on Render:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `SMTP_SECURE`

Typical Gmail settings:

```text
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@example.com
SMTP_SECURE=false
```

If SMTP is missing, the backend will reject forgot-password requests with a clear configuration message instead of pretending the email was sent.
