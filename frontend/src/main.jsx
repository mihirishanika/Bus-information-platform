import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { Amplify } from 'aws-amplify';
import { AuthProvider } from 'react-oidc-context';
import { getOidcConfig } from './oidcConfig';
import { fetchAuthSession } from 'aws-amplify/auth';

// Configure AWS Amplify Auth (Cognito)
// Values are taken from Vite env. Create a .env file with VITE_* keys.
const {
    VITE_AWS_REGION,
    VITE_COGNITO_USER_POOL_ID,
    VITE_COGNITO_USER_POOL_CLIENT_ID,
    VITE_COGNITO_DOMAIN,
    VITE_OIDC_REDIRECT_URI,
    VITE_OIDC_LOGOUT_URI,
} = import.meta.env;

if (VITE_AWS_REGION && VITE_COGNITO_USER_POOL_ID && VITE_COGNITO_USER_POOL_CLIENT_ID) {
    // Amplify v6 configuration shape for Cognito User Pools
    const amplifyConfig = {
        Auth: {
            Cognito: {
                region: VITE_AWS_REGION,
                userPoolId: VITE_COGNITO_USER_POOL_ID,
                userPoolClientId: VITE_COGNITO_USER_POOL_CLIENT_ID,
            }
        }
    };

    // Add OAuth configuration if domain is provided (for Google sign-in)
    if (VITE_COGNITO_DOMAIN) {
        // Normalize domain: remove protocol and any trailing slashes
        const normDomain = String(VITE_COGNITO_DOMAIN)
            .replace(/^https?:\/\//i, '')
            .replace(/\/?$/, '');

        const redirectSignIn = VITE_OIDC_REDIRECT_URI || window.location.origin;
        const redirectSignOut = VITE_OIDC_LOGOUT_URI || window.location.origin;

        amplifyConfig.Auth.Cognito.oauth = {
            domain: normDomain,
            scope: ['email', 'openid', 'profile'],
            redirectSignIn,
            redirectSignOut,
            responseType: 'code',
        };
    }

    Amplify.configure(amplifyConfig);

    console.log('Amplify configured with:', {
        region: VITE_AWS_REGION,
        userPoolId: VITE_COGNITO_USER_POOL_ID,
        hasOAuth: !!VITE_COGNITO_DOMAIN,
        redirectSignIn: VITE_OIDC_REDIRECT_URI || window.location.origin
    });
} else {
    // eslint-disable-next-line no-console
    console.warn('Amplify Auth not configured. Set VITE_AWS_REGION, VITE_COGNITO_USER_POOL_ID, VITE_COGNITO_USER_POOL_CLIENT_ID in .env');
}

// Check for OAuth callback parameters in URL (for Google sign-in)
const handleOAuthCallback = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code) {
        console.log('OAuth callback detected, checking authentication status...');
        try {
            // Give Amplify a moment to process the OAuth callback
            setTimeout(async () => {
                try {
                    const session = await fetchAuthSession();
                    if (session.tokens?.accessToken) {
                        console.log('OAuth sign-in successful');
                        // Clean up URL parameters
                        window.history.replaceState({}, document.title, window.location.pathname);
                    }
                } catch (error) {
                    console.error('OAuth callback processing failed:', error);
                }
            }, 1000);
        } catch (error) {
            console.error('OAuth callback error:', error);
        }
    }
};

// Handle OAuth callback if present
handleOAuthCallback();

// App wrapper component to handle auth state
function AppWrapper() {
    return <App />;
}

// Mount the React application
const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    const oidcConfig = getOidcConfig();

    if (oidcConfig) {
        root.render(
            <AuthProvider {...oidcConfig}>
                <AppWrapper />
            </AuthProvider>
        );
    } else {
        root.render(<AppWrapper />);
    }
} else {
    console.error('Root element #root not found in index.html');
}

// Hot Module Replacement (handled automatically by Vite)
if (import.meta.hot) {
    import.meta.hot.accept();
}