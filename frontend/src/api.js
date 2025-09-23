// Simple REST helpers for backend calls
// Uses VITE_API_BASE and Cognito ID token from auth.js for protected routes

import { getIdToken } from './auth';

const API_BASE = import.meta.env.VITE_API_BASE || '';

export async function protectedPing() {
    if (!API_BASE) throw new Error('VITE_API_BASE not set');
    const token = await getIdToken();
    if (!token) throw new Error('Not authenticated. Please login.');

    const res = await fetch(`${API_BASE}/protected/ping`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Protected ping failed: ${res.status} ${text}`.trim());
    }

    return res.json();
}

// Bus API functions
export async function createBus(payload) {
    if (!API_BASE) throw new Error('VITE_API_BASE not set');
    const token = await getIdToken();
    if (!token) throw new Error('Not authenticated. Please login.');

    const res = await fetch(`${API_BASE}/buses`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        const errorData = JSON.parse(text);
        throw new Error(errorData.error || `Failed to create bus: ${res.status}`);
    }

    return res.json();
}

export async function updateBus(licenseNo, payload) {
    if (!API_BASE) throw new Error('VITE_API_BASE not set');
    const token = await getIdToken();
    if (!token) throw new Error('Not authenticated. Please login.');

    const res = await fetch(`${API_BASE}/buses/${encodeURIComponent(licenseNo)}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        const errorData = JSON.parse(text);
        throw new Error(errorData.error || `Failed to update bus: ${res.status}`);
    }

    return res.json();
}

export async function getBus(licenseNo) {
    if (!API_BASE) throw new Error('VITE_API_BASE not set');

    const res = await fetch(`${API_BASE}/buses/${encodeURIComponent(licenseNo)}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        const errorData = JSON.parse(text);
        throw new Error(errorData.error || `Failed to get bus: ${res.status}`);
    }

    return res.json();
}

export async function listBuses(params = {}) {
    if (!API_BASE) throw new Error('VITE_API_BASE not set');

    const queryString = new URLSearchParams(params).toString();
    const url = `${API_BASE}/buses${queryString ? '?' + queryString : ''}`;

    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        const errorData = JSON.parse(text);
        throw new Error(errorData.error || `Failed to list buses: ${res.status}`);
    }

    return res.json();
}

export async function searchBuses(query, filters = {}) {
    if (!API_BASE) throw new Error('VITE_API_BASE not set');

    const params = { q: query, ...filters };
    const queryString = new URLSearchParams(params).toString();
    const url = `${API_BASE}/search${queryString ? '?' + queryString : ''}`;

    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        const errorData = JSON.parse(text);
        throw new Error(errorData.error || `Failed to search buses: ${res.status}`);
    }

    return res.json();
}

// Vote for bus verification
export async function voteBusVerification(licenseNo) {
    if (!API_BASE) throw new Error('VITE_API_BASE not set');
    const token = await getIdToken();
    if (!token) throw new Error('Not authenticated. Please login.');

    const res = await fetch(`${API_BASE}/buses/${encodeURIComponent(licenseNo)}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            verifiedVotes: 'increment' // Special flag for incrementing votes
        })
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        const errorData = JSON.parse(text);
        throw new Error(errorData.error || `Failed to vote: ${res.status}`);
    }

    return res.json();
}

// Request a presigned URL for avatar upload and then upload the file
export async function uploadAvatar(file) {
    if (!API_BASE) throw new Error('VITE_API_BASE not set');
    if (!file) throw new Error('No file');

    const token = await getIdToken();
    if (!token) throw new Error('Not authenticated. Please login.');

    const contentType = file.type || 'application/octet-stream';
    const fileName = file.name || 'avatar';

    // FIXED: Added Authorization header with Cognito token
    const presignRes = await fetch(`${API_BASE}/uploads/avatar-url`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`, // Added this line
        },
        body: JSON.stringify({ fileName, contentType }),
    });

    if (!presignRes.ok) {
        const text = await presignRes.text().catch(() => '');
        throw new Error(`Failed to get upload URL: ${presignRes.status} ${text}`.trim());
    }

    const { uploadUrl, objectUrl } = await presignRes.json();

    // Upload the file to S3 using the presigned URL
    const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': contentType,
            // Removed 'x-amz-acl': 'public-read' header as it should be in the presigned URL
        },
        body: file,
    });

    if (!putRes.ok) {
        const text = await putRes.text().catch(() => '');
        throw new Error(`Upload failed: ${putRes.status} ${text}`.trim());
    }

    return objectUrl;
}