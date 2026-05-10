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

    let lastDashboardDataStr = '';
    async function loadDashboard(silent = false) {
        try {
            const consultations = await fetchConsultations();
            const medicines = await fetchMedicines();
            
            const newDataStr = JSON.stringify({ consultations, medicines });
            if (silent && newDataStr === lastDashboardDataStr) return;
            lastDashboardDataStr = newDataStr;


        // Stats calculation
        const todayStr = new Date().toISOString().split('T')[0];
        const patientsToday = consultations.filter((c: any) => c.visit_timestamp.startsWith(todayStr)).length;
        const medsAvailable = medicines.filter((m: any) => m.stock_qty > 0).length;
        const medsLowStock = medicines.filter((m: any) => m.stock_qty > 0 && m.stock_qty <= m.reorder_threshold).length;
        
        // Simple logic for expiring soon: within 30 days
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const nowTime = new Date().getTime();
        const medsExpiring = medicines.filter((m: any) => {
            if (m.stock_qty <= 0) return false;
            const expTime = new Date(m.expiry_date).getTime();
            return expTime >= nowTime && expTime <= thirtyDaysFromNow.getTime();
        }).length;

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
        

        medicines.forEach((m: any) => {
            if (m.stock_qty <= 0) {
                // Out of Stock (overrides expiring soon and low stock)
                const alertKey = `out_of_stock_${m.medicine_id}`;
                alertsContainer.innerHTML += `
                    <div class="alert-item flex items-center justify-between py-4 px-2 border-t border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors" data-alert-key="${alertKey}" onclick="window.location.href='medicines.html?search=${encodeURIComponent(m.med_name)}'">
                        <div class="flex items-center gap-4">
                            <span class="material-symbols-outlined text-red-600">error</span>
                            <p class="text-sm font-bold text-red-600">${m.med_name} is Out of Stock!</p>
                        </div>
                        <span class="material-symbols-outlined text-slate-400 text-sm">arrow_forward_ios</span>
                    </div>
                `;
            } else {
                // Low Stock
                if (m.stock_qty <= m.reorder_threshold) {
                    const alertKey = `low_stock_${m.medicine_id}`;
                    alertsContainer.innerHTML += `
                        <div class="alert-item flex items-center justify-between py-4 px-2 border-t border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors" data-alert-key="${alertKey}" onclick="window.location.href='medicines.html?search=${encodeURIComponent(m.med_name)}'">
                            <div class="flex items-center gap-4">
                                <span class="material-symbols-outlined text-orange-500">warning</span>
                                <p class="text-sm font-semibold text-slate-700">${m.med_name} Stock is low (${m.stock_qty} left)</p>
                            </div>
                            <span class="material-symbols-outlined text-slate-400 text-sm">arrow_forward_ios</span>
                        </div>
                    `;
                }
                // Expiry Alerts
                const expDate = new Date(m.expiry_date);
                if (expDate < new Date()) {
                    // Expired
                    const alertKey = `expired_${m.medicine_id}`;
                    alertsContainer.innerHTML += `
                        <div class="alert-item flex items-center justify-between py-4 px-2 border-t border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors" data-alert-key="${alertKey}" onclick="window.location.href='medicines.html?search=${encodeURIComponent(m.med_name)}'">
                            <div class="flex items-center gap-4">
                                <span class="material-symbols-outlined text-red-600">block</span>
                                <p class="text-sm font-bold text-red-600">${m.med_name} is already EXPIRED (${expDate.toLocaleDateString()})</p>
                            </div>
                            <span class="material-symbols-outlined text-slate-400 text-sm">arrow_forward_ios</span>
                        </div>
                    `;
                } else if (expDate <= thirtyDaysFromNow) {
                    // Expiring Soon
                    const alertKey = `expiring_${m.medicine_id}`;
                    alertsContainer.innerHTML += `
                        <div class="alert-item flex items-center justify-between py-4 px-2 border-t border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors" data-alert-key="${alertKey}" onclick="window.location.href='medicines.html?search=${encodeURIComponent(m.med_name)}'">
                            <div class="flex items-center gap-4">
                                <span class="material-symbols-outlined text-amber-500">schedule</span>
                                <p class="text-sm font-semibold text-slate-700">${m.med_name} is expiring soon (${expDate.toLocaleDateString()})</p>
                            </div>
                            <span class="material-symbols-outlined text-slate-400 text-sm">arrow_forward_ios</span>
                        </div>
                    `;
                }
            }
        });

        // Event listeners for dismiss buttons removed as per request to not vanish alerts

    } catch (e) {
        console.error('Failed to load dashboard data', e);
    }
}

    await loadDashboard();

    const REFRESH_INTERVAL_MS = 10000;
    setInterval(() => loadDashboard(true), REFRESH_INTERVAL_MS);

    window.addEventListener('storage', (event) => {
        if (event.key === DATA_UPDATE_KEY) {
            loadDashboard();
            showToast('Dashboard refreshed from another tab.');
        }
    });
});
