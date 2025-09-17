// Simple localStorage-based auth demo (NOT for production)
// Stored key names
const USERS_KEY = 'businfo_users';
const CURRENT_KEY = 'businfo_current_user_email';

function loadUsers() {
	try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; } catch { return []; }
}
function saveUsers(list) { localStorage.setItem(USERS_KEY, JSON.stringify(list)); }

export function register(email, password, extra = {}) {
	email = email.trim().toLowerCase();
	if (!email) throw new Error('Email required');
	if (!password || password.length < 6) throw new Error('Password min 6 chars');
	const users = loadUsers();
	if (users.some(u => u.email === email)) throw new Error('Email already registered');
	const user = { email, password, name: extra.name || '', phone: extra.phone || '', birthday: extra.birthday || '', createdAt: Date.now() };
	users.push(user);
	saveUsers(users);
	localStorage.setItem(CURRENT_KEY, email);
	const { password: _pw, ...safe } = user;
	return safe;
}

export function login(email, password) {
	email = (email||'').trim().toLowerCase();
	const users = loadUsers();
	const user = users.find(u => u.email === email && u.password === password);
	if (!user) throw new Error('Invalid credentials');
	localStorage.setItem(CURRENT_KEY, email);
	const { password: _pw, ...safe } = user;
	return safe;
}

export function logout() { localStorage.removeItem(CURRENT_KEY); }

export function currentUser() {
	const email = localStorage.getItem(CURRENT_KEY);
	if (!email) return null;
	const users = loadUsers();
	const user = users.find(u => u.email === email);
	if (!user) return null;
	const { password: _pw, ...safe } = user;
	return safe;
}

export function updateUser(partial, newPassword) {
	const email = localStorage.getItem(CURRENT_KEY);
	if (!email) return null;
	const users = loadUsers();
	const idx = users.findIndex(u => u.email === email);
	if (idx === -1) return null;
	const updated = { ...users[idx], ...partial };
	if (newPassword) updated.password = newPassword;
	users[idx] = updated;
	saveUsers(users);
	const { password: _pw, ...safe } = updated;
	return safe;
}

export function rememberEmail(value) {
	if (value) localStorage.setItem('businfo_last_email', value); else localStorage.removeItem('businfo_last_email');
}
export function lastRememberedEmail() { return localStorage.getItem('businfo_last_email') || ''; }

// Simulated Google login (no real OAuth flow). In a real application you would
// integrate Google Identity Services (client library) and exchange tokens.
export function loginWithGoogle(mockEmail='google.user@example.com', profile={ name:'Google User' }) {
	const email = mockEmail.toLowerCase();
	let users = loadUsers();
	let existing = users.find(u => u.email === email);
	if (!existing) {
		existing = { email, password: null, name: profile.name || 'Google User', phone:'', birthday:'', createdAt: Date.now(), provider:'google' };
		users.push(existing);
		saveUsers(users);
	}
	localStorage.setItem(CURRENT_KEY, email);
	const { password: _pw, ...safe } = existing;
	return safe;
}
