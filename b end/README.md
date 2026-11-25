# JWT + OAuth (Mock) Starter

A clean starter aligned with your assignment:
- Login/Register with **JWT**
- **Public** and **Protected** routes (≥3 each across the app)
- **Refresh token** flow
- A **mock OAuth 2.0** flow to demonstrate authorization code -> token exchange
- Security basics: CORS, Helmet, Rate limit

## 1) Setup
```bash
npm install
cp .env.example .env
# edit .env and set JWT_SECRET to a long random string
npm run dev
```

Server runs at `http://localhost:3000`.

## 2) Endpoints

### Auth
- `POST /api/auth/register` `{ email, password }` → create user
- `POST /api/auth/login` `{ email, password }` → `{ token, refreshToken }`
- `POST /api/auth/refresh` `{ refreshToken }` → new access token
- `POST /api/auth/logout` `{ refreshToken }` → revoke refresh

### OAuth (Mock)
- `GET  /api/auth/oauth/authorize?redirect_uri=http://localhost:3000/callback`
  - Redirects to `redirect_uri?code=...`
- `POST /api/auth/oauth/token` `{ code }` → `{ token }`

### Public (no auth)
- `GET /api/public/info`
- `GET /api/public/ping`
- `GET /api/public/users-count`

### Protected (JWT required)
- `GET /api/protect/me`
- `GET /api/protect/dashboard`
- `GET /api/protect/admin/stats` (admin role required)

## 3) Testing with Postman
Import the collection in `/postman` and set the `token` variable after login.


python3 -m http.server 5500