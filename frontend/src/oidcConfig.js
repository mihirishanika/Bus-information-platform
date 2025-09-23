// Build react-oidc-context configuration from Vite env
// This is optional; enable by setting VITE_USE_OIDC_HOSTED_UI=true and providing the values below.

const env = import.meta.env;

export function getOidcConfig() {
    const useOidc = env.VITE_USE_OIDC_HOSTED_UI === 'true';
    if (!useOidc) return null;

    const region = env.VITE_AWS_REGION;
    const userPoolId = env.VITE_COGNITO_USER_POOL_ID;
    const clientId = env.VITE_COGNITO_USER_POOL_CLIENT_ID;
    const domain = env.VITE_COGNITO_DOMAIN; // e.g., https://your-domain.auth.us-east-1.amazoncognito.com
    const redirect = env.VITE_OIDC_REDIRECT_URI || window.location.origin;
    const scope = env.VITE_OIDC_SCOPE || 'openid email profile';

    if (!region || !userPoolId || !clientId || !domain) {
        console.warn('OIDC not enabled: missing region/userPoolId/clientId/domain');
        return null;
    }

    return {
        authority: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
        client_id: clientId,
        redirect_uri: redirect,
        response_type: 'code',
        scope,
        // Recommended extras
        automaticSilentRenew: false,
        loadUserInfo: true,
        extraQueryParams: {},
    };
}

export function buildLogoutUrl() {
    const domain = import.meta.env.VITE_COGNITO_DOMAIN;
    const clientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID;
    const logoutUri = import.meta.env.VITE_OIDC_LOGOUT_URI || window.location.origin;
    if (!domain || !clientId) return null;
    return `${domain}/logout?client_id=${encodeURIComponent(clientId)}&logout_uri=${encodeURIComponent(logoutUri)}`;
}
