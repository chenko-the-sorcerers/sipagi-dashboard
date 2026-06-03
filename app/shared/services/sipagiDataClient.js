import {
  createSheetRow,
  deleteSheetRow,
  getSheetRows,
  updateSheetRow,
  upsertSheetRow
} from './googleSheetsApi.js';

const DATA_SOURCE = window.SIPAGI_DATA_SOURCE || localStorage.getItem('sipagi.dataSource') || 'gas';
const API_BASE = window.SIPAGI_API_BASE || '/api/v1';
function resourcePath(resource) {
  return String(resource).includes('/') ? `/api/${resource}` : `${API_BASE}/${resource}`;
}

function getActiveSppgId() {
  if (window.SIPAGI_ACTIVE_SPPG_ID) return window.SIPAGI_ACTIVE_SPPG_ID;
  try {
    return JSON.parse(localStorage.getItem('sipagi.session.user') || 'null')?.sppgId || '';
  } catch {
    return '';
  }
}

async function apiRequest(path, options = {}) {
  const activeSppgId = getActiveSppgId();
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(activeSppgId ? { 'x-sppg-id': activeSppgId } : {}),
      ...(options.headers || {})
    }
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) throw new Error(payload.error || 'Permintaan data gagal');
  return payload;
}

export function useNeonApi() {
  return DATA_SOURCE === 'api';
}

export async function listRows(resource, params = {}) {
  if (!useNeonApi()) return getSheetRows(resource, params);
  const query = new URLSearchParams(params).toString();
  return apiRequest(`${resourcePath(resource)}${query ? `?${query}` : ''}`)
    .catch((error) => {
      if (String(resource).includes('role-permissions')) return getSheetRows('role_permissions', params);
      if (!String(resource).includes('/')) return getSheetRows(resource, params);
      throw error;
    });
}

export async function createRow(resource, row, userId = '') {
  if (!useNeonApi()) return createSheetRow(resource, row, userId);
  return apiRequest(resourcePath(resource), { method: 'POST', body: JSON.stringify(row) })
    .catch((error) => {
      if (String(resource).includes('role-permissions')) return createSheetRow('role_permissions', row, userId);
      throw error;
    });
}

export async function updateRow(resource, id, row, idField, userId = '') {
  if (!useNeonApi()) return updateSheetRow(resource, id, row, idField, userId);
  return apiRequest(`${resourcePath(resource)}?id=${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ ...row, id }) })
    .catch((error) => {
      if (String(resource).includes('role-permissions')) return updateSheetRow('role_permissions', id, row, idField, userId);
      throw error;
    });
}

export async function upsertRow(resource, id, row, idField, userId = '') {
  if (!useNeonApi()) return upsertSheetRow(resource, id, row, idField, userId);
  return updateRow(resource, id, row, idField, userId).catch(() => createRow(resource, row, userId));
}

export async function deleteRow(resource, id, idField, userId = '') {
  if (!useNeonApi()) return deleteSheetRow(resource, id, idField, userId);
  return apiRequest(`${resourcePath(resource)}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}
