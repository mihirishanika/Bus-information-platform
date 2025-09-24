// Simple REST helpers for backend calls
// Uses VITE_API_BASE and Cognito ID token from auth.js for protected routes

import { getIdToken } from './auth';

// Prefer explicit VITE_API_BASE; fall back to Vite dev proxy at /api in local dev
const API_BASE = (import.meta.env.VITE_API_BASE && import.meta.env.VITE_API_BASE.trim()) || '/api';

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
function parseErrorResponse(res, text) {
    try {
        const data = text ? JSON.parse(text) : null;
        if (data && typeof data === 'object') {
            return data.error || data.message || text || `HTTP ${res.status}`;
        }
    } catch { }
    return text || `HTTP ${res.status}`;
}

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
        throw new Error(parseErrorResponse(res, text) || `Failed to create bus: ${res.status}`);
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
        throw new Error(parseErrorResponse(res, text) || `Failed to update bus: ${res.status}`);
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
        throw new Error(parseErrorResponse(res, text) || `Failed to get bus: ${res.status}`);
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
        throw new Error(parseErrorResponse(res, text) || `Failed to list buses: ${res.status}`);
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
        throw new Error(parseErrorResponse(res, text) || `Failed to search buses: ${res.status}`);
    }

    return res.json();
}

// Directional search for buses with journey times
export async function searchDirectionalBuses(from, to, filters = {}) {
    if (!API_BASE) throw new Error('VITE_API_BASE not set');

    const params = {
        from: from?.trim() || '',
        to: to?.trim() || '',
        directional: 'true',
        ...filters
    };
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
        throw new Error(parseErrorResponse(res, text) || `Failed to search directional buses: ${res.status}`);
    }

    return res.json();
}

// Vote for bus verification (legacy)
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
        throw new Error(parseErrorResponse(res, text) || `Failed to vote: ${res.status}`);
    }

    return res.json();
}

// Verify bus
export async function verifyBus(licenseNo) {
    if (!API_BASE) throw new Error('VITE_API_BASE not set');
    const token = await getIdToken();
    if (!token) throw new Error('Not authenticated. Please login.');

    const res = await fetch(`${API_BASE}/buses/${encodeURIComponent(licenseNo)}/verify`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(parseErrorResponse(res, text) || `Failed to verify: ${res.status}`);
    }

    return res.json();
}

// Report bus
export async function reportBus(licenseNo) {
    if (!API_BASE) throw new Error('VITE_API_BASE not set');
    const token = await getIdToken();
    if (!token) throw new Error('Not authenticated. Please login.');

    const res = await fetch(`${API_BASE}/buses/${encodeURIComponent(licenseNo)}/report`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(parseErrorResponse(res, text) || `Failed to report: ${res.status}`);
    }

    return res.json();
}

// Get user's vote for a specific bus
export async function getUserVote(licenseNo) {
    if (!API_BASE) throw new Error('VITE_API_BASE not set');
    const token = await getIdToken();
    if (!token) throw new Error('Not authenticated. Please login.');

    const res = await fetch(`${API_BASE}/buses/${encodeURIComponent(licenseNo)}/my-vote`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(parseErrorResponse(res, text) || `Failed to get vote: ${res.status}`);
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

// Request a presigned URL for bus photos and then upload the file
export async function uploadBusPhoto(file) {
    if (!API_BASE) throw new Error('VITE_API_BASE not set');
    if (!file) throw new Error('No file');

    const token = await getIdToken();
    if (!token) throw new Error('Not authenticated. Please login.');

    const contentType = file.type || 'application/octet-stream';
    const fileName = file.name || `bus_photo_${Date.now()}`;

    // Use the same endpoint for both avatar and bus photos
    const presignRes = await fetch(`${API_BASE}/uploads/avatar-url`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            fileName,
            contentType,
            type: 'bus_photo' // This helps the backend differentiate (though not implemented yet)
        }),
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
        },
        body: file,
    });

    if (!putRes.ok) {
        const text = await putRes.text().catch(() => '');
        throw new Error(`Upload failed: ${putRes.status} ${text}`.trim());
    }

    return objectUrl;
}