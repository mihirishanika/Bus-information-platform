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

## Cognito integration (new)

We now support Amazon Cognito for signup/login and secure API access.

1) Create a Cognito User Pool (User pool only) and an App client without client secret. Note the User Pool ARN, Region, and App Client ID.

2) Configure frontend:
	 - Copy `frontend/.env.example` to `frontend/.env` and fill in:
		 - `VITE_AWS_REGION`
		 - `VITE_COGNITO_USER_POOL_ID`
		 - `VITE_COGNITO_USER_POOL_CLIENT_ID`
		 - Optionally `VITE_API_BASE` after deployment.
	 - Install dependency in `frontend/`:
		 - `npm i aws-amplify`

3) Deploy backend with SAM using the User Pool ARN:
	 - From repo root:
		 - `sam build`
		 - `sam deploy --guided` and when prompted, provide `UserPoolArn` parameter. Set `AllowedOrigin` to your frontend origin (e.g., http://localhost:5173).

4) Test protected endpoint:
	 - After deploy, get `ApiUrl` from stack outputs.
	 - Sign up and confirm via email in the app, then login. The app will acquire a Cognito session.
	 - Call `GET {ApiUrl}/protected/ping` with `Authorization: ID_TOKEN` header from Cognito (Amplify uses ID token by default). Should return `{ ok: true, principal: <email> }`.

Notes:
- Public endpoints remain: `GET /routes`, `GET /next`.
- All other sensitive endpoints should be attached to the shared API (`ApiGateway`) so they inherit Cognito auth by default.

## Enable Google Sign-In via Cognito Hosted UI

This project uses Amazon Cognito User Pools with Hosted UI for social sign-in (Google). Frontend is wired to use Amplify v6 + redirect flow.

Prereqs
- A Cognito User Pool with an App client (no client secret)
- A Cognito domain (App integration > Domain name)

Step 1 — Configure Google in AWS Cognito
1) Open Amazon Cognito > User pools > Your pool > App integration.
2) Under Social sign-in, choose Google, then Create a Google client in Google Cloud Console (next section).
3) After you have Google credentials, enter the Google Client ID and Client secret in Cognito and Save changes.
4) In App client settings (under App integration), ensure:
	 - Allowed callback URLs includes your frontend URL(s):
		 - Local dev: http://localhost:5173
		 - Prod: https://your-domain
	 - Allowed sign-out URLs includes the same origins
	 - OAuth 2.0 grant type: Authorization code grant
	 - OAuth scopes: openid, email, profile

Step 2 — Create Google OAuth credentials
1) Go to https://console.cloud.google.com/apis/credentials
2) Create Credentials > OAuth client ID > Web application
3) Add Authorized JavaScript origins:
	 - http://localhost:5173 (dev)
	 - https://your-domain (prod)
4) Add Authorized redirect URIs:
	 - http://localhost:5173 (for this app; Amplify uses root as redirect)
	 - https://your-domain
5) Copy the Client ID and Client secret back into Cognito Social IdP config.

Step 3 — Frontend environment
In `frontend/.env` (copy from `.env.example`) set:
- VITE_AWS_REGION
- VITE_COGNITO_USER_POOL_ID
- VITE_COGNITO_USER_POOL_CLIENT_ID
- VITE_COGNITO_DOMAIN (from Cognito Domain name)
- VITE_OIDC_REDIRECT_URI (e.g., http://localhost:5173)
- VITE_OIDC_LOGOUT_URI (e.g., http://localhost:5173)

Run frontend
1) cd frontend && npm install
2) npm run dev
3) Click "Sign in with Google" on the Login page. You should be redirected to Google and back.

Troubleshooting
- Error: "Google sign-in is not properly configured":
	- Ensure VITE_COGNITO_DOMAIN is set in frontend/.env
	- Ensure the domain in Cognito is active and matches the region
	- Ensure Allowed callback/sign-out URLs in Cognito include your frontend URL exactly
- Redirect mismatch on Google page:
	- Add the exact redirect (http://localhost:5173) under Authorized redirect URIs in Google OAuth client
- Blank after redirect:
	- Open devtools console; Amplify processes the OAuth code on load. Verify tokens with `fetchAuthSession()` logs.
