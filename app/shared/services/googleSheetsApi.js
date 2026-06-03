export const GAS_ENDPOINT = window.SIPAGI_GAS_ENDPOINT || 'https://script.google.com/macros/s/AKfycbwefvZxPKsEX6Bm3jBgX99-HdIR_H6t481ce_UXV1RE7O4fiBhkS-2XUAO2cI6fp_u4/exec';

const globalSheets = new Set(['roles', 'role_permissions', 'sppg_units']);

function getCachedSessionUser() {
    if (typeof window === 'undefined') return null;
    try {
        return JSON.parse(window.localStorage.getItem('sipagi.session.user') || 'null');
    } catch {
        return null;
    }
}

function getActiveTenantKeys() {
    const user = getCachedSessionUser();
    return [
        user?.sppgId,
        user?.sppgCode,
        user?.sppgName
    ].filter(Boolean).map((value) => String(value).toLowerCase());
}

function shouldTenantScope(sheet) {
    if (typeof window === 'undefined') return false;
    const user = getCachedSessionUser();
    if (!user || user.provider === 'demo') return false;
    return !globalSheets.has(sheet);
}

function rowTenantKeys(row = {}) {
    return [
        row.sppgId,
        row.sppg_id,
        row.sppgCode,
        row.sppg_code,
        row.sppgName,
        row.sppg_name
    ].filter(Boolean).map((value) => String(value).toLowerCase());
}

function scopeRowsToActiveTenant(sheet, payload) {
    if (!shouldTenantScope(sheet)) return payload;
    const tenantKeys = getActiveTenantKeys();
    if (!tenantKeys.length) return { ...payload, rows: [] };
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    return {
        ...payload,
        rows: rows.filter((row) => rowTenantKeys(row).some((key) => tenantKeys.includes(key)))
    };
}

function withActiveTenant(row = {}) {
    if (typeof window === 'undefined') return row;
    const user = getCachedSessionUser();
    if (!user || user.provider === 'demo') return row;
    return {
        ...row,
        sppg_id: row.sppg_id || row.sppgId || user.sppgId || '',
        sppg_code: row.sppg_code || user.sppgCode || '',
        sppg_name: row.sppg_name || user.sppgName || ''
    };
}

function getBaseOrigin() {
    if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
    return 'http://127.0.0.1:3005';
}

function getEndpoint() {
    if (typeof window === 'undefined' && process.env.GAS_ENDPOINT) return process.env.GAS_ENDPOINT;
    return GAS_ENDPOINT;
}

async function request(params = {}) {
    const url = new URL(getEndpoint(), getBaseOrigin());
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) url.searchParams.set(key, value);
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);
    let response;
    try {
        response = await fetch(url.toString(), { signal: controller.signal });
    } catch (error) {
        if (error.name === 'AbortError') throw new Error('Sumber data terlalu lama merespons');
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(text.slice(0, 160) || 'Sumber data tidak mengembalikan JSON');
    }

    const payload = await response.json();
    if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || 'Permintaan data gagal');
    }

    return payload;
}

export function checkGasHealth() {
    return request({ action: 'health' });
}

export function getSheetRows(sheet, params = {}) {
    return request({ action: 'list', sheet, ...params }).then((payload) => scopeRowsToActiveTenant(sheet, payload));
}

export function getSchemaIndex() {
    return request({ action: 'schema' });
}

export function setupGoogleSheetsDatabase() {
    return request({ action: 'setup' });
}

export async function createSheetRow(sheet, row, userId = '') {
    return mutateSheet({
        action: 'create',
        sheet,
        row: withActiveTenant(row),
        userId
    });
}

export async function updateSheetRow(sheet, id, row, idField, userId = '') {
    return mutateSheet({
        action: 'update',
        sheet,
        id,
        idField,
        row: withActiveTenant(row),
        userId
    });
}

export async function upsertSheetRow(sheet, id, row, idField, userId = '') {
    return mutateSheet({
        action: 'upsert',
        sheet,
        id,
        idField,
        row: withActiveTenant(row),
        userId
    });
}

export async function deleteSheetRow(sheet, id, idField, userId = '') {
    return mutateSheet({
        action: 'delete',
        sheet,
        id,
        idField,
        userId
    });
}

async function mutateSheet(requestPayload) {
    const response = await fetch(new URL(getEndpoint(), getBaseOrigin()).toString(), {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(requestPayload)
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180) || 'Sumber data tidak mengembalikan JSON');
    }

    const responsePayload = await response.json();
    if (!response.ok || responsePayload.ok === false) {
        throw new Error(responsePayload.error || 'Perubahan data gagal');
    }

    return responsePayload;
}
