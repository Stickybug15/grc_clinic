export const API_URL = 'http://localhost:3006/api';

// Security Utility to prevent Cross-Site Scripting (XSS)
export function escapeHTML(str: string | null | undefined): string {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export async function fetchPatients() {
  const response = await fetch(`${API_URL}/patients`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Failed to fetch patients');
  return result;
}

export async function createPatient(data: any) {
  const response = await fetch(`${API_URL}/patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Failed to create patient');
  return result;
}

export async function fetchPatient(id: string) {
  const response = await fetch(`${API_URL}/patients/${id}`);
  return await response.json();
}

export async function updatePatient(id: string, data: any) {
  const response = await fetch(`${API_URL}/patients/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await response.json();
}

export async function deletePatient(id: string) {
  const response = await fetch(`${API_URL}/patients/${id}`, { method: 'DELETE' });
  return await response.json();
}

export async function fetchMedicines() {
  const response = await fetch(`${API_URL}/medicines?_t=${Date.now()}`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Failed to fetch medicines');
  return result;
}

export async function createMedicine(data: any) {
  const response = await fetch(`${API_URL}/medicines`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Failed to create medicine');
  return result;
}

export async function updateMedicineStock(id: string, data: any) {
  const response = await fetch(`${API_URL}/medicines/${id}/stock`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Failed to update stock');
  return result;
}
export async function fetchMedicine(id: string) {
  const response = await fetch(`${API_URL}/medicines/${id}`);
  return await response.json();
}

export async function updateMedicine(id: string, data: any) {
  const response = await fetch(`${API_URL}/medicines/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await response.json();
}

export async function deleteMedicine(id: string) {
  const response = await fetch(`${API_URL}/medicines/${id}`, { method: 'DELETE' });
  return await response.json();
}

export async function fetchInventoryMovements() {
  const response = await fetch(`${API_URL}/inventory-movements?_t=${Date.now()}`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Failed to fetch inventory movements');
  return result;
}

export async function fetchFullAuditLog() {
  const response = await fetch(`${API_URL}/inventory-movements/all?_t=${Date.now()}`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Failed to fetch full audit log');
  return result;
}

export async function fetchConsultations() {
  const response = await fetch(`${API_URL}/consultations?_t=${Date.now()}`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Failed to fetch consultations');
  return result;
}

export async function createConsultation(data: any) {
  const response = await fetch(`${API_URL}/consultations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Failed to create consultation');
  return result;
}

export async function fetchConsultation(id: string) {
  const response = await fetch(`${API_URL}/consultations/${id}`);
  return await response.json();
}

export async function updateConsultation(id: string, data: any) {
  const response = await fetch(`${API_URL}/consultations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await response.json();
}

export async function deleteConsultation(id: string) {
  const response = await fetch(`${API_URL}/consultations/${id}`, { method: 'DELETE' });
  return await response.json();
}
