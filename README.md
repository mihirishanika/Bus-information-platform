````markdown
# Bus Information Platform

## About the Project

Bus Information Platform is a web application designed to provide information about buses and their routes. The platform allows users to search for buses, view bus routes, and access verified information about the buses. It features a responsive frontend built with React and a backend API powered by Node.js with AWS services integration. The application supports user authentication via Amazon Cognito, including social sign-in with Google.

The platform uses a Network Load Balancer (NLB) with Elastic IPs for providing a static IP address for the backend API, ensuring consistent connectivity regardless of underlying infrastructure changes.

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

### Deploying with Network Load Balancer (Static IP)

To deploy the application with a Network Load Balancer that provides static IP addresses:

1. Use our automated deployment script (recommended):
   ```bash
   ./scripts/deploy-nlb.sh
   ```
   This script will:
   - Help you select your VPC and subnets
   - Clean up any failed deployments
   - Choose the best template based on your requirements
   - Handle the deployment process
   - Update your frontend configuration

2. Or deploy manually using the appropriate template:
   ```bash
   # If using Cognito auth:
   sam deploy --template-file template-nlb.yaml --guided
   
   # If encountering auth errors:
   sam deploy --template-file template-nlb-alt.yaml --guided
   
   # Simplest approach (no auth):
   sam deploy --template-file template-nlb-noauth.yaml --guided
   ```

3. For detailed instructions, see the [NLB Deployment Guide](./NLB-DEPLOYMENT-GUIDE.md).

4. For detailed configuration options and troubleshooting, refer to the [NLB Configuration Guide](./NLB-CONFIG.md).

The NLB setup provides two static Elastic IPs that you can use for your API endpoint, ensuring that your backend API has consistent IP addresses even if the underlying infrastructure changes.

## Key Features
- User authentication with Amazon Cognito
- Bus information search and browsing
- Real-time next bus arrival information
- Google sign-in integration
- Mobile-responsive design
- Static IP addresses for backend API via Network Load Balancer

