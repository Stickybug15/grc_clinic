import { fetchPatients, fetchMedicines, fetchConsultations } from './api';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const patients = await fetchPatients();
        const consultations = await fetchConsultations();
        const medicines = await fetchMedicines();

        // Stats calculation
        const todayStr = new Date().toISOString().split('T')[0];
        const patientsToday = consultations.filter((c: any) => c.visit_timestamp.startsWith(todayStr)).length;
        const medsAvailable = medicines.length;
        const medsLowStock = medicines.filter((m: any) => m.stock_qty <= m.reorder_level).length;
        
        // Simple logic for expiring soon: within 30 days
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const medsExpiring = medicines.filter((m: any) => new Date(m.expiry_date) <= thirtyDaysFromNow).length;

        // Render stats
        document.getElementById('stat-patients-today')!.textContent = String(patientsToday);
        document.getElementById('stat-meds-available')!.textContent = String(medsAvailable);
        document.getElementById('stat-meds-low')!.textContent = String(medsLowStock);
        document.getElementById('stat-meds-expiring')!.textContent = String(medsExpiring);

        // Render Recent Consultations
        const tableBody = document.getElementById('recent-consultations-body')!;
        tableBody.innerHTML = '';
        consultations.slice(0, 5).forEach((c: any) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-4 py-8 text-center text-slate-800 font-semibold">${c.full_name}</td>
                <td class="px-4 py-8 text-center">${new Date(c.visit_timestamp).toLocaleDateString()}</td>
                <td class="px-4 py-8 text-center">${c.symptoms}</td>
                <td class="px-4 py-8 text-center">${c.treatment || 'None'}</td>
            `;
            tableBody.appendChild(tr);
        });

        // Render Alerts
        const alertsContainer = document.getElementById('dashboard-alerts')!;
        alertsContainer.innerHTML = '';
        medicines.filter((m: any) => m.stock_qty <= m.reorder_level).forEach((m: any) => {
            alertsContainer.innerHTML += `
                <div class="flex items-center gap-4 py-4 border-t border-slate-200">
                    <span class="material-symbols-outlined text-slate-800">error</span>
                    <p class="text-sm font-semibold text-slate-700">${m.med_name} Stock is low (${m.stock_qty} left)</p>
                </div>
            `;
        });
    } catch (e) {
        console.error('Failed to load dashboard data', e);
    }
});
