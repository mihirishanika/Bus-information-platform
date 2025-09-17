## Bus Platform Backend & Frontend

### Backend Setup

1. Navigate to `backend/` and install dependencies:
	- `npm install`
2. Copy `.env.example` to `.env` and set a strong `JWT_SECRET`.
3. Ensure DynamoDB tables exist:
	- `user` (PK: email [string])
	- `buses` (PK: licenseNo [string])
4. Start in dev mode with auto-reload:
	- `npm run dev`

### Environment Variables
See `backend/.env.example` for all variables.

### API Endpoints (summary)
- `GET /health` basic liveness check.
- `POST /signup` create user (unique email enforced).
- `POST /login` returns JWT.
- `GET /me` (auth) current user profile.
- `POST /buses` (auth) add a bus (unique licenseNo enforced).
- `GET /buses?limit=25&cursor=<licenseNo>` list buses with pagination.

### Frontend
Frontend lives in `frontend/` (Vite + React). Run with:
1. `npm install`
2. `npm run dev`

### Notes
- Update CORS origin using `ALLOWED_ORIGIN` if frontend served elsewhere.
- For production, rotate `JWT_SECRET` and consider using AWS KMS or Secrets Manager.
- Replace full table scans with query patterns as data volume grows.
