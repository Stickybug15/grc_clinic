export const API_URL = 'http://localhost:3000/api';

export async function fetchPatients() {
  const response = await fetch(`${API_URL}/patients`);
  return await response.json();
}

export async function createPatient(data: any) {
  const response = await fetch(`${API_URL}/patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await response.json();
}

export async function fetchMedicines() {
  const response = await fetch(`${API_URL}/medicines`);
  return await response.json();
}

export async function createMedicine(data: any) {
  const response = await fetch(`${API_URL}/medicines`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await response.json();
}

export async function updateMedicineStock(id: string, data: any) {
  const response = await fetch(`${API_URL}/medicines/${id}/stock`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await response.json();
}

export async function fetchConsultations() {
  const response = await fetch(`${API_URL}/consultations`);
  return await response.json();
}

export async function createConsultation(data: any) {
  const response = await fetch(`${API_URL}/consultations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await response.json();
}
