// Cognito-backed auth using Amplify v6 modular APIs
import {
	signUp,
	signIn,
	signOut,
	getCurrentUser,
	fetchUserAttributes,
	updateUserAttributes,
	fetchAuthSession,
	confirmSignUp,
	resendSignUpCode,
	resetPassword,
	confirmResetPassword,
	updatePassword,
	signInWithRedirect
} from 'aws-amplify/auth';
import { normalizeSLPhone } from './phone';

const EMAIL_USERNAME_MAP_KEY = 'businfo_usernames_by_email';

function getEmailUsernameMap() {
	try {
		return JSON.parse(localStorage.getItem(EMAIL_USERNAME_MAP_KEY) || '{}') || {};
	} catch { return {}; }
}

function saveEmailUsernameMap(map) {
	try { localStorage.setItem(EMAIL_USERNAME_MAP_KEY, JSON.stringify(map)); } catch { }
}

function rememberUsernameForEmail(email, username) {
	if (!email || !username) return;
	const key = String(email).toLowerCase();
	const map = getEmailUsernameMap();
	map[key] = username;
	saveEmailUsernameMap(map);
}

function getRememberedUsernameForEmail(email) {
	if (!email) return undefined;
	const map = getEmailUsernameMap();
	return map[String(email).toLowerCase()];
}

export async function register(email, password, extra = {}) {
	// Cognito pools configured with email as alias require username NOT to look like an email.
	// Use provided username or derive one safely from email.
	let username = (extra.username || email || '').trim();
	if (username.includes('@')) {
		// Derive non-email username: take local-part, normalize, and add suffix to avoid collisions.
		const base = (username.split('@')[0] || 'user').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 20) || 'user';
		const suffix = Math.random().toString(36).slice(2, 6);
		username = `${base}_${suffix}`;
	}

	const signUpResult = await signUp({
		username,
		password,
		options: {
			userAttributes: {
				email,
				name: extra.name || '',
				phone_number: extra.phone ? normalizeSLPhone(extra.phone) : undefined,
				birthdate: extra.birthday || undefined,
			}
		}
	});

	// Store mapping so users can sign in with email even if the pool requires username.
	try { rememberUsernameForEmail(email, username); } catch { }

	return {
		username,
		email,
		name: extra.name || '',
		phone: extra.phone || '',
		birthday: extra.birthday || '',
		signUpResult // Include the sign up result for handling confirmation flow
	};
}

export async function login(usernameOrEmail, password) {
	if (!usernameOrEmail || !password) {
		throw new Error('Username/email and password are required');
	}

	let res;
	const id = String(usernameOrEmail).trim();
	const isEmail = id.includes('@');
	let actualUsername = id;

	// If it's an email, try to get the mapped username first
	if (isEmail) {
		const mapped = getRememberedUsernameForEmail(id);
		if (mapped) {
			actualUsername = mapped;
		}
	}

	try {
		// Always try with the actual username first
		res = await signIn({
			username: actualUsername,
			password: password.trim()
		});
	} catch (err) {
		console.error('First login attempt failed:', err);

		// If we used a mapped username and it failed, try with the original email
		if (isEmail && actualUsername !== id) {
			try {
				res = await signIn({
					username: id,
					password: password.trim()
				});
			} catch (secondErr) {
				console.error('Second login attempt with email failed:', secondErr);
				throw secondErr;
			}
		} else {
			throw err;
		}
	}

	// Handle multi-step authentication flows
	if (!res.isSignedIn) {
		const step = res.nextStep?.signInStep;
		console.log('Sign-in requires additional step:', step);

		if (step === 'CONFIRM_SIGN_UP') {
			const e = new Error('Account not confirmed. Please enter the code sent to your email.');
			e.code = 'UserNotConfirmedException';
			e.username = actualUsername; // Pass the actual username for confirmation
			throw e;
		}
		if (step === 'RESET_PASSWORD') {
			const e = new Error('Password reset required. Please reset your password.');
			e.code = 'PasswordResetRequiredException';
			throw e;
		}
		if (step && step !== 'DONE') {
			const e = new Error(`Additional authentication required: ${step}`);
			e.code = step;
			throw e;
		}
	}

	// After successful sign-in, ensure we have valid tokens
	let session;
	try {
		session = await fetchAuthSession();
		console.log('Login session tokens:', {
			hasIdToken: !!session.tokens?.idToken,
			hasAccessToken: !!session.tokens?.accessToken,
			hasRefreshToken: !!session.tokens?.refreshToken
		});
	} catch (sessionErr) {
		console.error('Failed to fetch session after login:', sessionErr);
		// Don't fail login for this, but log the issue
	}

	// Fetch user attributes after successful sign-in
	let attrs;
	try {
		attrs = await fetchUserAttributes();
	} catch (attrErr) {
		console.error('Failed to fetch user attributes:', attrErr);
		// Don't fail login if we can't get attributes, just use defaults
		attrs = {};
	}

	// Update the username mapping if we successfully signed in
	try {
		const user = await getCurrentUser();
		if (attrs?.email && user?.username) {
			rememberUsernameForEmail(attrs.email, user.username);
		}
	} catch (mappingErr) {
		console.error('Failed to update username mapping:', mappingErr);
		// Don't fail login for this
	}

	return {
		email: attrs.email || usernameOrEmail,
		name: attrs.name || '',
		phone: attrs.phone_number || '',
		birthday: attrs.birthdate || '',
		avatar: attrs.picture || '' // Include avatar from Cognito attributes
	};
}

export async function loginWithGoogle() {
	try {
		// Check if Hosted UI (Cognito OAuth) is configured
		const {
			VITE_AWS_REGION,
			VITE_COGNITO_USER_POOL_ID,
			VITE_COGNITO_USER_POOL_CLIENT_ID,
			VITE_COGNITO_DOMAIN,
			VITE_OIDC_REDIRECT_URI
		} = import.meta.env;

		const missing = [];
		if (!VITE_AWS_REGION) missing.push('VITE_AWS_REGION');
		if (!VITE_COGNITO_USER_POOL_ID) missing.push('VITE_COGNITO_USER_POOL_ID');
		if (!VITE_COGNITO_USER_POOL_CLIENT_ID) missing.push('VITE_COGNITO_USER_POOL_CLIENT_ID');
		if (!VITE_COGNITO_DOMAIN) missing.push('VITE_COGNITO_DOMAIN');
		if (missing.length) {
			throw new Error(
				`Missing env: ${missing.join(', ')}. Update frontend/.env. Callback URL must match ${VITE_OIDC_REDIRECT_URI || window.location.origin}`
			);
		}

		// Basic domain sanity (should look like *.auth.<region>.amazoncognito.com)
		const looksLikeCognitoDomain = /\.auth\.[a-z0-9-]+\.amazoncognito\.com$/i.test(String(VITE_COGNITO_DOMAIN).replace(/^https?:\/\//, ''));
		if (!looksLikeCognitoDomain) {
			console.warn('VITE_COGNITO_DOMAIN may be incorrect:', VITE_COGNITO_DOMAIN);
		}

		// Use Amplify's signInWithRedirect for Google OAuth
		await signInWithRedirect({ provider: 'Google' });

		// Note: The function will redirect the user to Google, so execution stops here.
		// After successful authentication, the user will be redirected back to your app.
		// The currentUser() function should then work to get the authenticated user.

	} catch (error) {
		console.error('Google sign-in error:', error);

		// Provide helpful error messages
		if (
			error.message?.includes('not configured') ||
			error.message?.includes('OIDC') ||
			error.message?.includes('Cognito') ||
			error.message?.includes('Missing env')
		) {
			throw new Error('Google sign-in is not properly configured. Check frontend/.env and Cognito callback URLs. See README.');
		} else if (error.message?.includes('popup') || error.message?.includes('redirect')) {
			throw new Error('Google sign-in was blocked. Please allow popups and try again.');
		} else {
			throw new Error('Google sign-in failed. Please try again or use email/password.');
		}
	}
}

export async function resendConfirmation(usernameOrEmail) {
	if (!usernameOrEmail) {
		throw new Error('Username or email is required');
	}

	const id = String(usernameOrEmail).trim();

	try {
		return await resendSignUpCode({ username: id });
	} catch (err) {
		console.error('First resend attempt failed:', err);

		// If it's an email, try with mapped username
		if (id.includes('@')) {
			const mapped = getRememberedUsernameForEmail(id);
			if (mapped && mapped !== id) {
				try {
					return await resendSignUpCode({ username: mapped });
				} catch (secondErr) {
					console.error('Second resend attempt failed:', secondErr);
					throw secondErr;
				}
			}
		}
		throw err;
	}
}

export async function startPasswordReset(usernameOrEmail) {
	if (!usernameOrEmail) {
		throw new Error('Username or email is required');
	}

	const id = String(usernameOrEmail).trim();

	try {
		return await resetPassword({ username: id });
	} catch (err) {
		console.error('First password reset attempt failed:', err);

		// If it's an email, try with mapped username
		if (id.includes('@')) {
			const mapped = getRememberedUsernameForEmail(id);
			if (mapped && mapped !== id) {
				try {
					return await resetPassword({ username: mapped });
				} catch (secondErr) {
					console.error('Second password reset attempt failed:', secondErr);
					throw secondErr;
				}
			}
		}
		throw err;
	}
}

export async function finishPasswordReset(usernameOrEmail, confirmationCode, newPassword) {
	if (!usernameOrEmail || !confirmationCode || !newPassword) {
		throw new Error('Username/email, confirmation code, and new password are required');
	}

	const id = String(usernameOrEmail).trim();

	try {
		return await confirmResetPassword({
			username: id,
			confirmationCode: confirmationCode.trim(),
			newPassword
		});
	} catch (err) {
		console.error('First password reset confirmation failed:', err);

		// If it's an email, try with mapped username
		if (id.includes('@')) {
			const mapped = getRememberedUsernameForEmail(id);
			if (mapped && mapped !== id) {
				try {
					return await confirmResetPassword({
						username: mapped,
						confirmationCode: confirmationCode.trim(),
						newPassword
					});
				} catch (secondErr) {
					console.error('Second password reset confirmation failed:', secondErr);
					throw secondErr;
				}
			}
		}
		throw err;
	}
}

export async function logout() {
	try {
		await signOut();
	} catch (err) {
		console.error('Logout error:', err);
		// Don't throw - user should be able to "logout" even if the API call fails
	}
}

export async function currentUser() {
	try {
		const user = await getCurrentUser();
		const attrs = await fetchUserAttributes();

		return {
			email: attrs.email || '',
			name: attrs.name || '',
			phone: attrs.phone_number || '',
			birthday: attrs.birthdate || '',
			avatar: attrs.picture || '' // Include avatar from Cognito
		};
	} catch (err) {
		console.log('No current user:', err.message);
		return null;
	}
}

// Test function to verify authentication after password change
export async function verifyAuthenticationState() {
	try {
		console.log('=== Authentication State Check ===');

		// Check if user is signed in
		const user = await getCurrentUser();
		console.log('Current user:', user);

		// Check session tokens
		const session = await fetchAuthSession();
		console.log('Session tokens:', {
			hasIdToken: !!session.tokens?.idToken,
			hasAccessToken: !!session.tokens?.accessToken,
			hasRefreshToken: !!session.tokens?.refreshToken,
			idTokenExpiry: session.tokens?.idToken?.payload?.exp,
			accessTokenExpiry: session.tokens?.accessToken?.payload?.exp
		});

		// Check user attributes
		const attrs = await fetchUserAttributes();
		console.log('User attributes:', attrs);

		return {
			authenticated: true,
			user: user,
			attributes: attrs,
			tokens: {
				hasIdToken: !!session.tokens?.idToken,
				hasAccessToken: !!session.tokens?.accessToken,
				hasRefreshToken: !!session.tokens?.refreshToken
			}
		};
	} catch (error) {
		console.error('Authentication verification failed:', error);
		return {
			authenticated: false,
			error: error.message
		};
	}
}

// Helper function to validate password strength
export function validatePassword(password) {
	if (!password) return { isValid: false, message: 'Password is required' };

	if (password.length < 8) {
		return { isValid: false, message: 'Password must be at least 8 characters long' };
	}

	if (!/(?=.*[a-z])/.test(password)) {
		return { isValid: false, message: 'Password must contain at least one lowercase letter' };
	}

	if (!/(?=.*[A-Z])/.test(password)) {
		return { isValid: false, message: 'Password must contain at least one uppercase letter' };
	}

	if (!/(?=.*\d)/.test(password)) {
		return { isValid: false, message: 'Password must contain at least one number' };
	}

	// Optional: Check for special characters (uncomment if your Cognito policy requires them)
	// if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(password)) {
	//     return { isValid: false, message: 'Password must contain at least one special character' };
	// }

	return { isValid: true, message: 'Password is valid' };
}

export async function updateUser(partial, newPassword, currentPassword) {
	const attrs = {};
	if (partial.name !== undefined) attrs.name = partial.name;
	if (partial.phone !== undefined) attrs.phone_number = partial.phone ? normalizeSLPhone(partial.phone) : '';
	if (partial.birthday !== undefined) attrs.birthdate = partial.birthday;
	if (partial.avatar !== undefined) attrs.picture = partial.avatar; // Store avatar in Cognito

	// Update attributes first if any are provided
	if (Object.keys(attrs).length) {
		await updateUserAttributes({ userAttributes: attrs });
	}

	// Handle password change if requested
	if (newPassword && currentPassword) {
		try {
			console.log('Attempting to change password...');
			await updatePassword({ oldPassword: currentPassword, newPassword });
			console.log('Password changed successfully');

			// After password change, verify the session is still valid
			try {
				const session = await fetchAuthSession();
				console.log('Session check after password change:', !!session.tokens?.accessToken);

				// Force token refresh to ensure we have valid tokens
				await fetchAuthSession({ forceRefresh: true });
				console.log('Session refreshed after password change');

			} catch (sessionError) {
				console.warn('Session validation after password change failed:', sessionError);
				// The password change was successful, but we might need to re-authenticate
				// Don't throw here - password change was successful
			}

		} catch (error) {
			console.error('Password change failed:', error);

			// Provide more specific error messages
			if (error.name === 'NotAuthorizedException' || error.code === 'NotAuthorizedException') {
				throw new Error('Current password is incorrect');
			} else if (error.name === 'InvalidPasswordException' || error.code === 'InvalidPasswordException') {
				throw new Error('New password does not meet security requirements');
			} else if (error.name === 'LimitExceededException' || error.code === 'LimitExceededException') {
				throw new Error('Too many password change attempts. Please wait and try again later');
			} else {
				throw new Error(error.message || 'Password change failed');
			}
		}
	} else if (newPassword && !currentPassword) {
		throw new Error('Current password is required to change password');
	}

	// Return fresh user attributes
	try {
		const a = await fetchUserAttributes();
		return {
			email: a.email || '',
			name: a.name || '',
			phone: a.phone_number || '',
			birthday: a.birthdate || '',
			avatar: a.picture || '' // Include avatar from Cognito attributes
		};
	} catch (fetchError) {
		console.error('Failed to fetch updated user attributes:', fetchError);
		// If we can't fetch fresh attributes, return what we expect based on the update
		return {
			email: partial.email || '',
			name: partial.name || '',
			phone: partial.phone || '',
			birthday: partial.birthday || '',
			avatar: partial.avatar || ''
		};
	}
}

export function rememberEmail(value) {
	if (value) localStorage.setItem('businfo_last_email', value);
	else localStorage.removeItem('businfo_last_email');
}

export function lastRememberedEmail() {
	return localStorage.getItem('businfo_last_email') || '';
}

export async function getIdToken() {
	try {
		const session = await fetchAuthSession();
		return session.tokens?.idToken?.toString();
	} catch (err) {
		console.error('Failed to get ID token:', err);
		return null;
	}
}

export async function confirmRegistration(username, code) {
	if (!username || !code) {
		throw new Error('Username and confirmation code are required');
	}

	return await confirmSignUp({
		username: username.trim(),
		confirmationCode: code.trim()
	});
}