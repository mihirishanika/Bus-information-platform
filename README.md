# Bus Information Platform

## About the Project

Bus Information Platform is a web application designed to provide information about buses and their routes. The platform allows users to search for buses, view bus routes, and access verified information about the buses. It features a responsive frontend built with React and a backend API powered by Node.js with AWS services integration. The application supports user authentication via Amazon Cognito, including social sign-in with Google.

## Dependencies

### Backend
- Node.js (v16 or higher)
- npm
- AWS DynamoDB for database
- AWS SAM CLI for deployment

### Frontend
- Node.js (v16 or higher)
- npm
- Web browser

## Running the Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Set a strong `JWT_SECRET` value
   
4. Ensure DynamoDB tables exist:
   - `user` (Primary Key: email [string])
   - `buses` (Primary Key: licenseNo [string])

5. Start the development server with auto-reload:
   ```bash
   npm run dev
   ```

6. The server will be available at `http://localhost:4000`

## Running the Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Fill in the required Cognito configuration values
     - `VITE_AWS_REGION`
     - `VITE_COGNITO_USER_POOL_ID`
     - `VITE_COGNITO_USER_POOL_CLIENT_ID`
     - `VITE_COGNITO_DOMAIN` (if using hosted UI)
     - `VITE_API_BASE` (backend API URL)

4. Start the development server:
   ```bash
   npm run dev
   ```

5. The frontend will be available at `http://localhost:5173`

## Building for Production

### Frontend
```bash
cd frontend
npm run build
```

### Backend (with AWS SAM)
```bash
sam build
sam deploy --guided
```

## Key Features
- User authentication with Amazon Cognito
- Bus information search and browsing
- Real-time next bus arrival information
- Google sign-in integration
- Mobile-responsive design
