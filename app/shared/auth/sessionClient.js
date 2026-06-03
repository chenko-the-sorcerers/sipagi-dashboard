const sessionStorageKey = 'sipagi.session.user';
const activityStorageKey = 'sipagi.session.lastActivityAt';
const idleLimitMs = 60 * 60 * 1000;
const heartbeatIntervalMs = 5 * 60 * 1000;
const activityWriteIntervalMs = 30 * 1000;
const demoPassword = '@Sipagi2026';
const demoUsers = [
    ['kepala@sipagi.local', 'Kepala SPPG Demo', 'kepala_sppg', 'sppg_nakala'],
    ['ahli.gizi@sipagi.local', 'Ahli Gizi Demo', 'ahli_gizi', 'sppg_nakala'],
    ['pengadaan@sipagi.local', 'Pengadaan Demo', 'akuntan_pengadaan', 'sppg_nakala'],
    ['distribusi@sipagi.local', 'Distribusi Demo', 'asisten_distribusi', 'sppg_nakala'],
    ['produksi@sipagi.local', 'Produksi Demo', 'produksi', 'sppg_nakala'],
    ['packing@sipagi.local', 'Pemorsian Packing Demo', 'pemorsian_packing', 'sppg_nakala'],
    ['kebersihan@sipagi.local', 'Kebersihan Demo', 'pencuci_kebersihan', 'sppg_nakala'],
    ['sekolah@sipagi.local', 'Sekolah Demo', 'sekolah', 'sppg_nakala'],
    ['bgn@sipagi.local', 'BGN Demo', 'bgn', 'sppg_nakala'],
    ['supplier@sipagi.local', 'Supplier Demo', 'supplier', 'sppg_nakala'],
    ['developer@sipagi.local', 'Developer SIPAGI', 'developer', 'sppg_nakala']
];
let lastHeartbeatAt = 0;
let lastActivityWriteAt = 0;

async function request(path, options = {}) {
    const response = await fetch(path, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        throw new Error('API auth belum aktif. Jalankan npm run dev:local atau Vercel dev, bukan static server.');
    }
    const payload = await response.json();
    if (!response.ok || payload.ok === false) throw new Error(payload.error || 'Permintaan auth gagal');
    return payload;
}

function toDemoUser([email, name, roleId, sppgId]) {
    return {
        id: `static:${email}`,
        name,
        email,
        roleId,
        sppgId,
        sppgCode: 'SPPG-NAKALA',
        sppgName: 'SPPG Nakala',
        provider: 'static-demo'
    };
}

function findDemoUser(email, password) {
    if (String(password || '') !== demoPassword) return null;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const row = demoUsers.find(([demoEmail]) => demoEmail === normalizedEmail);
    return row ? toDemoUser(row) : null;
}

function createStaticSignupUser(payload = {}) {
    const sppgName = String(payload.sppgName || 'SPPG Baru').trim();
    const email = String(payload.email || '').trim().toLowerCase();
    const headName = String(payload.headName || 'Kepala SPPG').trim();
    const code = `sppg_${sppgName.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || Date.now()}`;
    return {
        id: `static-signup:${email || code}`,
        name: headName,
        email,
        roleId: 'kepala_sppg',
        sppgId: code,
        sppgCode: code.toUpperCase(),
        sppgName,
        provider: 'static-signup'
    };
}

export function getCachedSessionUser() {
    try {
        return JSON.parse(localStorage.getItem(sessionStorageKey) || 'null');
    } catch {
        return null;
    }
}

export function cacheSessionUser(user) {
    try {
        if (user) {
            localStorage.setItem(sessionStorageKey, JSON.stringify(user));
            markSessionActivity();
        } else {
            localStorage.removeItem(sessionStorageKey);
            localStorage.removeItem(activityStorageKey);
        }
    } catch {
        // UI can continue without local cache.
    }
}

export function markSessionActivity({ sync = false } = {}) {
    const now = Date.now();
    try {
        if (!lastActivityWriteAt || now - lastActivityWriteAt > activityWriteIntervalMs) {
            localStorage.setItem(activityStorageKey, String(now));
            lastActivityWriteAt = now;
        }
    } catch {
        // Idle tracking is best-effort when browser storage is blocked.
    }

    if (!sync || now - lastHeartbeatAt < heartbeatIntervalMs) return;
    lastHeartbeatAt = now;
    request('/api/auth/heartbeat', { method: 'POST' }).catch(() => {});
}

export function isSessionIdleExpired() {
    try {
        const lastActivityAt = Number(localStorage.getItem(activityStorageKey) || 0);
        return Boolean(lastActivityAt && Date.now() - lastActivityAt > idleLimitMs);
    } catch {
        return false;
    }
}

export async function getCurrentSession() {
    if (isSessionIdleExpired()) {
        cacheSessionUser(null);
        await request('/api/auth/logout', { method: 'POST' }).catch(() => null);
        return { ok: true, authenticated: false, reason: 'idle_timeout' };
    }

    try {
        const payload = await request('/api/auth/me');
        cacheSessionUser(payload.authenticated ? payload.user : null);
        return payload;
    } catch {
        const cachedUser = getCachedSessionUser();
        return { ok: true, authenticated: Boolean(cachedUser), user: cachedUser, source: 'static-demo' };
    }
}

export async function login(email, password) {
    try {
        const payload = await request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        cacheSessionUser(payload.user);
        return payload.user;
    } catch {
        const user = findDemoUser(email, password);
        if (!user) throw new Error('Email atau password tidak sesuai');
        cacheSessionUser(user);
        return user;
    }
}

export async function signup(payload) {
    try {
        const responsePayload = await request('/api/auth/signup', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        cacheSessionUser(responsePayload.user);
        return responsePayload.user;
    } catch {
        const user = createStaticSignupUser(payload);
        cacheSessionUser(user);
        return user;
    }
}

export async function logout() {
    cacheSessionUser(null);
    request('/api/auth/logout', { method: 'POST' }).catch(() => {});
}
