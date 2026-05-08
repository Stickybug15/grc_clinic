import { fetchMedicines, fetchConsultations, DATA_UPDATE_KEY } from './api';

document.addEventListener('DOMContentLoaded', async () => {
    function showToast(message: string) {
        const toast = document.getElementById('global-toast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.remove('opacity-0', 'pointer-events-none');
        toast.classList.add('opacity-100');
        const timeoutKey = '_toastTimeout' as keyof HTMLElement;
        if ((toast as any)[timeoutKey]) {
            window.clearTimeout((toast as any)[timeoutKey]);
        }
        (toast as any)[timeoutKey] = window.setTimeout(() => {
            toast.classList.add('opacity-0');
            toast.classList.add('pointer-events-none');
        }, 3000);
    }

    async function loadDashboard() {
        try {
            const consultations = await fetchConsultations();
            const medicines = await fetchMedicines();

        // Stats calculation
        const todayStr = new Date().toISOString().split('T')[0];
        const patientsToday = consultations.filter((c: any) => c.visit_timestamp.startsWith(todayStr)).length;
        const medsAvailable = medicines.filter((m: any) => m.stock_qty > 0).length;
        const medsLowStock = medicines.filter((m: any) => m.stock_qty > 0 && m.stock_qty <= m.reorder_threshold).length;
        
        // Simple logic for expiring soon: within 30 days
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const medsExpiring = medicines.filter((m: any) => m.stock_qty > 0 && new Date(m.expiry_date) <= thirtyDaysFromNow).length;

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
        
        // Load dismissed alerts from localStorage
        const dismissedStr = localStorage.getItem('dismissedAlerts');
        const dismissedAlerts = dismissedStr ? JSON.parse(dismissedStr) : {};
        const now = Date.now();
        
        // Cleanup expired dismissals (older than 24 hours)
        Object.keys(dismissedAlerts).forEach(k => {
            if (now - dismissedAlerts[k] > 86400000) delete dismissedAlerts[k];
        });
        localStorage.setItem('dismissedAlerts', JSON.stringify(dismissedAlerts));

        medicines.forEach((m: any) => {
            if (m.stock_qty <= 0) {
                // Out of Stock (overrides expiring soon and low stock)
                const alertKey = `out_of_stock_${m.medicine_id}`;
                if (!dismissedAlerts[alertKey]) {
                    alertsContainer.innerHTML += `
                        <div class="alert-item flex items-center justify-between py-4 border-t border-slate-200" data-alert-key="${alertKey}">
                            <div class="flex items-center gap-4">
                                <span class="material-symbols-outlined text-red-600">error</span>
                                <p class="text-sm font-bold text-red-600">${m.med_name} is Out of Stock!</p>
                            </div>
                            <button class="btn-dismiss-alert text-slate-400 hover:text-slate-600" title="Dismiss for 24h"><span class="material-symbols-outlined text-[18px]">close</span></button>
                        </div>
                    `;
                }
            } else {
                // Low Stock
                if (m.stock_qty <= m.reorder_threshold) {
                    const alertKey = `low_stock_${m.medicine_id}`;
                    if (!dismissedAlerts[alertKey]) {
                        alertsContainer.innerHTML += `
                            <div class="alert-item flex items-center justify-between py-4 border-t border-slate-200" data-alert-key="${alertKey}">
                                <div class="flex items-center gap-4">
                                    <span class="material-symbols-outlined text-orange-500">warning</span>
                                    <p class="text-sm font-semibold text-slate-700">${m.med_name} Stock is low (${m.stock_qty} left)</p>
                                </div>
                                <button class="btn-dismiss-alert text-slate-400 hover:text-slate-600" title="Dismiss for 24h"><span class="material-symbols-outlined text-[18px]">close</span></button>
                            </div>
                        `;
                    }
                }
                // Expiring Soon
                if (new Date(m.expiry_date) <= thirtyDaysFromNow) {
                    const alertKey = `expiring_${m.medicine_id}`;
                    if (!dismissedAlerts[alertKey]) {
                        alertsContainer.innerHTML += `
                            <div class="alert-item flex items-center justify-between py-4 border-t border-slate-200" data-alert-key="${alertKey}">
                                <div class="flex items-center gap-4">
                                    <span class="material-symbols-outlined text-amber-500">schedule</span>
                                    <p class="text-sm font-semibold text-slate-700">${m.med_name} is expiring soon (${new Date(m.expiry_date).toLocaleDateString()})</p>
                                </div>
                                <button class="btn-dismiss-alert text-slate-400 hover:text-slate-600" title="Dismiss for 24h"><span class="material-symbols-outlined text-[18px]">close</span></button>
                            </div>
                        `;
                    }
                }
            }
        });

        // Add event listeners for dismiss buttons
        document.querySelectorAll('.btn-dismiss-alert').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const alertItem = target.closest('.alert-item') as HTMLElement;
                if (alertItem) {
                    const key = alertItem.getAttribute('data-alert-key');
                    if (key) {
                        dismissedAlerts[key] = Date.now();
                        localStorage.setItem('dismissedAlerts', JSON.stringify(dismissedAlerts));
                    }
                    alertItem.classList.add('hidden');
                }
            });
        });
    } catch (e) {
        console.error('Failed to load dashboard data', e);
    }
}

    await loadDashboard();

    const REFRESH_INTERVAL_MS = 10000;
    setInterval(loadDashboard, REFRESH_INTERVAL_MS);

    window.addEventListener('storage', (event) => {
        if (event.key === DATA_UPDATE_KEY) {
            loadDashboard();
            showToast('Dashboard refreshed from another tab.');
        }
    });
});
