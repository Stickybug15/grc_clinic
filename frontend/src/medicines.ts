import { fetchMedicines, createMedicine, updateMedicineStock, fetchMedicine, updateMedicine, deleteMedicine, fetchInventoryMovements, fetchFullAuditLog, escapeHTML, DATA_UPDATE_KEY } from './api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

    function showRestockTimer(medName: string) {
        const alertId = 'restock-alert-' + Date.now();
        const alertDiv = document.createElement('div');
        alertDiv.id = alertId;
        alertDiv.className = 'fixed top-24 right-5 z-[200] bg-[#1DBB8E] text-white px-6 py-4 rounded-lg shadow-xl flex items-center gap-4 transition-all duration-300 opacity-0 translate-y-[-10px] transform';
        
        let secondsLeft = 15;
        alertDiv.innerHTML = `
            <span class="material-symbols-outlined text-3xl">check_circle</span>
            <div>
                <p class="font-bold text-lg">${escapeHTML(medName)} got a stock again!</p>
                <p class="text-sm font-medium">Vanishing in <span id="timer-${alertId}" class="font-bold">${secondsLeft}</span>s...</p>
            </div>
            <button id="close-${alertId}" class="ml-4 text-white hover:text-green-100 transition-colors">
                <span class="material-symbols-outlined">close</span>
            </button>
        `;
        
        document.body.appendChild(alertDiv);
        
        // Trigger reflow for animation
        void alertDiv.offsetWidth;
        alertDiv.classList.remove('opacity-0', 'translate-y-[-10px]');
        alertDiv.classList.add('opacity-100', 'translate-y-0');
        
        const timerSpan = document.getElementById(`timer-${alertId}`);
        const closeBtn = document.getElementById(`close-${alertId}`);
        
        const interval = setInterval(() => {
            secondsLeft--;
            if (timerSpan) timerSpan.textContent = secondsLeft.toString();
            if (secondsLeft <= 0) {
                clearInterval(interval);
                removeAlert();
            }
        }, 1000);
        
        function removeAlert() {
            alertDiv.classList.remove('opacity-100', 'translate-y-0');
            alertDiv.classList.add('opacity-0', 'translate-y-[-10px]');
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.parentNode.removeChild(alertDiv);
                }
            }, 300);
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                clearInterval(interval);
                removeAlert();
            });
        }
    }

    const tableBody = document.getElementById('medicines-table-body');
    
    let outOfStockMedicines: any[] = [];
    let lowStockMedicines: any[] = [];

    let currentPage = 1;
    const itemsPerPage = 10;
    let currentFilteredMedicines: any[] = [];

    function getStatusPriority(m: any): number {
        const now = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(now.getDate() + 30);
        const expiryDateObj = m.expiry_date ? new Date(m.expiry_date) : null;

        if (m.stock_qty <= 0) {
            return 4; // Out of Stock
        } else if (expiryDateObj && expiryDateObj < now) {
            return 5; // Expired
        } else if (expiryDateObj && expiryDateObj <= thirtyDaysFromNow) {
            return 3; // Expiring Soon
        } else if (m.stock_qty <= m.reorder_threshold) {
            return 2; // Low Stock
        } else {
            return 1; // Available
        }
    }

    let lastMedicinesDataStr = '';
    // 1. Load and Render Medicines
    async function loadMedicines(silent = false) {
        try {
            if(!tableBody) return;
            
            const medicines = await fetchMedicines();
            const newDataStr = JSON.stringify(medicines);
            if (silent && newDataStr === lastMedicinesDataStr) return;
            lastMedicinesDataStr = newDataStr;

            
            outOfStockMedicines = medicines.filter((m: any) => m.stock_qty <= 0);
            lowStockMedicines = medicines.filter((m: any) => m.stock_qty > 0 && m.stock_qty <= m.reorder_threshold);
            
            const alertBanner = document.getElementById('out-of-stock-alert');
            if (alertBanner) {
                if (outOfStockMedicines.length > 0) {
                    alertBanner.classList.remove('hidden');
                } else {
                    alertBanner.classList.add('hidden');
                }
            }
            
            tableBody.innerHTML = '';
            
            // Populate stock update dropdown
            const selectMed = document.getElementById('select-medicine') as HTMLSelectElement;
            if(selectMed) {
                selectMed.innerHTML = '<option value="">Select Medicine</option>';
                medicines.forEach((m: any) => {
                    const opt = document.createElement('option');
                    opt.value = m.medicine_id;
                    const exp = m.expiry_date ? new Date(m.expiry_date).toLocaleDateString() : 'N/A';
                    opt.textContent = `${m.med_name} (Exp: ${exp})`;
                    selectMed.appendChild(opt);
                });
            }

            // Get search term
            const searchInput = document.getElementById('search-medicine') as HTMLInputElement;
            
            // Check for search query param on first load
            if (searchInput && !searchInput.dataset.initialized) {
                const urlParams = new URLSearchParams(window.location.search);
                const querySearch = urlParams.get('search');
                if (querySearch) {
                    searchInput.value = querySearch;
                }
                searchInput.dataset.initialized = 'true';
            }

            const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

            // Filter medicines
            const filteredMedicines = medicines.filter((m: any) => 
                m.med_name.toLowerCase().includes(searchTerm) ||
                (m.category && m.category.toLowerCase().includes(searchTerm))
            );

            // Sort medicines by priority
            filteredMedicines.sort((a: any, b: any) => getStatusPriority(a) - getStatusPriority(b));

            currentFilteredMedicines = filteredMedicines;
            renderCurrentPage();

        } catch (e) {
            console.error('Failed to load medicines', e);
            if(tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-red-500">Failed to load medicines: ${e}</td></tr>`;
        }
    }

    function renderCurrentPage() {
        if (!tableBody) return;
        tableBody.innerHTML = '';
        
        const totalItems = currentFilteredMedicines.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
        
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
        const pageItems = currentFilteredMedicines.slice(startIndex, endIndex);

        if (pageItems.length === 0) {
            const searchInput = document.getElementById('search-medicine') as HTMLInputElement;
            const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
            tableBody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-slate-500">No medicines found matching "${searchTerm}"</td></tr>`;
        } else {
            pageItems.forEach((m: any) => {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-slate-100 hover:bg-slate-50 transition-colors';
                
                const expDate = m.expiry_date ? new Date(m.expiry_date).toLocaleDateString() : 'N/A';
                
                let statusHtml = '';
                
                const now = new Date();
                const thirtyDaysFromNow = new Date();
                thirtyDaysFromNow.setDate(now.getDate() + 30);
                const expiryDateObj = m.expiry_date ? new Date(m.expiry_date) : null;

                if (m.stock_qty <= 0) {
                     statusHtml = `<span class="bg-red-600 text-white px-8 py-2 rounded-sm font-bold block mx-auto w-fit min-w-[140px]">Out of Stock</span>`;
                } else if (expiryDateObj && expiryDateObj < now) {
                     statusHtml = `<span class="bg-red-800 text-white px-8 py-2 rounded-sm font-bold block mx-auto w-fit min-w-[140px]">Expired</span>`;
                } else if (expiryDateObj && expiryDateObj <= thirtyDaysFromNow) {
                     statusHtml = `<span class="bg-orange-500 text-white px-8 py-2 rounded-sm font-bold block mx-auto w-fit min-w-[140px]">Expiring Soon</span>`;
                } else if (m.stock_qty <= m.reorder_threshold) {
                     statusHtml = `<span class="bg-yellow-500 text-white px-8 py-2 rounded-sm font-bold block mx-auto w-fit min-w-[140px]">Low Stock</span>`;
                } else {
                     statusHtml = `<span class="bg-green-500 text-white px-8 py-2 rounded-sm font-bold block mx-auto w-fit min-w-[140px]">Available</span>`;
                }

                tr.innerHTML = `
                    <td class="px-6 py-6 border-r border-slate-200">${escapeHTML(m.med_name)} ${m.unit ? `(${escapeHTML(m.unit)})` : ''}</td>
                    <td class="px-6 py-6 border-r border-slate-200">${escapeHTML(m.category) || 'N/A'}</td>
                    <td class="px-6 py-6 border-r border-slate-200 font-semibold">${m.stock_qty}</td>
                    <td class="px-6 py-6 border-r border-slate-200">${escapeHTML(expDate)}</td>
                    <td class="px-6 py-6 border-r border-slate-200">${statusHtml}</td>
                    <td class="px-6 py-6 flex items-center justify-center space-x-3">
                        <button data-id="${m.medicine_id}" class="btn-edit-med bg-[#10b981] hover:bg-emerald-600 text-white px-4 py-1 rounded text-xs font-semibold transition-colors">Edit</button>
                        <button data-id="${m.medicine_id}" class="btn-delete-med bg-[#ef4444] hover:bg-red-600 text-white px-4 py-1 rounded text-xs font-semibold transition-colors">Delete</button>
                    </td>
                `;
                tableBody.appendChild(tr);
            });
        }

        // Update pagination info
        const pageInfo = document.getElementById('pagination-info');
        if (pageInfo) {
            pageInfo.textContent = totalItems === 0 
                ? 'Showing 0 entries' 
                : `Showing ${startIndex + 1} to ${endIndex} of ${totalItems} entries`;
        }
        
        const btnPrev = document.getElementById('btn-prev-page') as HTMLButtonElement;
        const btnNext = document.getElementById('btn-next-page') as HTMLButtonElement;
        
        if (btnPrev) btnPrev.disabled = currentPage === 1;
        if (btnNext) btnNext.disabled = currentPage === totalPages;
    }

    loadMedicines();

    window.addEventListener('storage', (event) => {
        if (event.key === DATA_UPDATE_KEY) {
            loadMedicines(true);
            loadMovements(true);
            showToast('Medicine inventory refreshed from another tab.');
        }
    });

    const REFRESH_INTERVAL_MS = 10000;
    setInterval(() => {
        loadMedicines(true);
        loadMovements(true);
    }, REFRESH_INTERVAL_MS);

    const searchInput = document.getElementById('search-medicine');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            currentPage = 1;
            loadMedicines();
        });
    }

    // Pagination event listeners
    const btnPrev = document.getElementById('btn-prev-page');
    const btnNext = document.getElementById('btn-next-page');
    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderCurrentPage();
            }
        });
    }
    if (btnNext) {
        btnNext.addEventListener('click', () => {
            const totalPages = Math.ceil(currentFilteredMedicines.length / itemsPerPage) || 1;
            if (currentPage < totalPages) {
                currentPage++;
                renderCurrentPage();
            }
        });
    }

    // 2. Add New Medicine Modal
    const addBtn = document.getElementById('btn-add-medicine');
    const modalAdd = document.getElementById('add-medicine-modal');
    const closeAddBtn = document.getElementById('btn-close-add-modal');
    const formAdd = document.getElementById('form-add-medicine') as HTMLFormElement;

    if (addBtn && modalAdd && closeAddBtn) {
        addBtn.addEventListener('click', () => modalAdd.classList.remove('hidden'));
        closeAddBtn.addEventListener('click', () => modalAdd.classList.add('hidden'));

        formAdd.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(formAdd);
            const data = Object.fromEntries(formData.entries()) as Record<string, any>;
            
            try {
                // Check for duplicates (same name AND same expiration date)
                const existingMedicines = await fetchMedicines();
                const newMedName = String(data.med_name).trim().toLowerCase();
                const isDuplicate = existingMedicines.some((m: any) => {
                    const isSameName = m.med_name.trim().toLowerCase() === newMedName;
                    const isSameExpiry = m.expiry_date && data.expiry_date && m.expiry_date.startsWith(data.expiry_date);
                    return isSameName && isSameExpiry;
                });
                
                if (isDuplicate) {
                    alert("Cannot add medicine: A medicine with this exact name AND expiration date already exists.");
                    return;
                }

                if (!confirm("Are you sure you want to save this data?")) return;

                data.stock_qty = Number(data.stock_qty);
                data.reorder_level = Number(data.reorder_level);
                
                await createMedicine(data);
                modalAdd.classList.add('hidden');
                formAdd.reset();
                loadMedicines();
            } catch (err) {
                alert("Failed to create medicine: " + err);
            }
        });
    }

    // 3. Update Stock Modal
    const updateBtn = document.getElementById('btn-update-stock');
    const modalUpd = document.getElementById('update-stock-modal');
    const closeUpdBtn = document.getElementById('btn-close-upd-modal');
    const formUpd = document.getElementById('form-update-stock') as HTMLFormElement;

    if (updateBtn && modalUpd && closeUpdBtn) {
        updateBtn.addEventListener('click', () => modalUpd.classList.remove('hidden'));
        closeUpdBtn.addEventListener('click', () => modalUpd.classList.add('hidden'));

        formUpd.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!confirm("Are you sure you want to save this data?")) return;
            const formData = new FormData(formUpd);
            const { medicine_id, transaction_type, quantity, action_type, remarks } = Object.fromEntries(formData.entries());
            
            if(!medicine_id) return alert("Select a medicine");

            if (transaction_type === 'IN') {
                try {
                    const medDetails = await fetchMedicine(medicine_id as string);
                    if (medDetails && medDetails.expiry_date) {
                        const expiryDate = new Date(medDetails.expiry_date);
                        const now = new Date();
                        if (expiryDate < now) {
                            alert("Cannot restock: This medicine has already reached its expiration date.");
                            return;
                        }
                    }
                } catch (err) {
                    console.error("Failed to verify expiration date", err);
                }
            }

            const payload = {
                transaction_type,
                quantity: Number(quantity),
                action_type,
                remarks
            };
            try {
                await updateMedicineStock(medicine_id as string, payload);
                modalUpd.classList.add('hidden');
                formUpd.reset();
                loadMedicines();
                loadMovements();
                
                if (transaction_type === 'IN') {
                    const selectMed = document.getElementById('select-medicine') as HTMLSelectElement;
                    const selectedOption = selectMed.options[selectMed.selectedIndex];
                    const medName = selectedOption ? selectedOption.text : 'Medicine';
                    showRestockTimer(medName);
                }
            } catch (err) {
                alert("Failed to update stock: " + err);
            }
        });
    }

    // 4. Edit Medicine Modal Handling
    const editMedModal = document.getElementById('edit-medicine-modal');
    const closeEditMedBtn = document.getElementById('btn-close-edit-med-modal');
    const editMedForm = document.getElementById('form-edit-medicine') as HTMLFormElement;

    if (closeEditMedBtn && editMedModal) closeEditMedBtn.addEventListener('click', () => editMedModal.classList.add('hidden'));

    // Handle Edit and Delete using event delegation
    if (tableBody) {
        tableBody.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;

            // Edit Medicine
            if (target.classList.contains('btn-edit-med')) {
                const id = target.getAttribute('data-id');
                if (id && editMedModal && editMedForm) {
                    try {
                        const medicine = await fetchMedicine(id);
                        (document.getElementById('edit_medicine_id') as HTMLInputElement).value = medicine.medicine_id;
                        (document.getElementById('edit_med_name') as HTMLInputElement).value = medicine.med_name;
                        (document.getElementById('edit_generic_name') as HTMLInputElement).value = medicine.med_desc || '';
                        (document.getElementById('edit_category') as HTMLInputElement).value = medicine.category || '';
                        (document.getElementById('edit_unit') as HTMLInputElement).value = medicine.unit || '';
                        (document.getElementById('edit_reorder_level') as HTMLInputElement).value = medicine.reorder_threshold;
                        (document.getElementById('edit_expiry_date') as HTMLInputElement).value = medicine.expiry_date ? medicine.expiry_date.split('T')[0] : '';
                        
                        editMedModal.classList.remove('hidden');
                    } catch (err) {
                        alert("Failed to load medicine details.");
                    }
                }
            }

            // Delete Medicine
            if (target.classList.contains('btn-delete-med')) {
                const id = target.getAttribute('data-id');
                if (id && confirm("Are you sure you want to delete this medicine? This action cannot be undone.")) {
                    try {
                        await deleteMedicine(id);
                        loadMedicines(); // Refresh table
                        loadMovements();
                    } catch (err) {
                        const message = err instanceof Error ? err.message : String(err);
                        alert(message || "Failed to delete medicine.");
                    }
                }
            }
        });
    }

    // Submit Edit Form
    if (editMedForm) {
        editMedForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!confirm("Are you sure you want to save this data?")) return;
            const formData = new FormData(editMedForm);
            const data = Object.fromEntries(formData.entries());
            const id = data.medicine_id as string;
            
            try {
                await updateMedicine(id, data);
                if(editMedModal) editMedModal.classList.add('hidden');
                loadMedicines(); // refresh data
            } catch (err) {
                console.error("Error updating medicine", err);
                alert("Failed to update medicine: " + err);
            }
        });
    }

    // 5. Load and Render Inventory Movements
    const movementsBody = document.getElementById('inventory-movements-body');
    let lastMovementsDataStr = '';

    async function loadMovements(silent = false) {
        if (!movementsBody) return;
        try {
            if (movementsBody.children.length === 0 && !silent) {
                movementsBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-slate-400">Loading...</td></tr>';
            }
            const movements = await fetchInventoryMovements();
            const newDataStr = JSON.stringify(movements);
            if (silent && newDataStr === lastMovementsDataStr) return;
            lastMovementsDataStr = newDataStr;

            movementsBody.innerHTML = '';
            
            if (movements.length === 0) {
                movementsBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-slate-500">No recent movements found.</td></tr>';
                return;
            }

            movements.forEach((m: any) => {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-slate-100 hover:bg-slate-50 transition-colors';
                
                const sign = m.quantity_change > 0 ? '+' : '';
                const colorClass = m.quantity_change > 0 ? 'text-green-600' : 'text-red-600';
                
                tr.innerHTML = `
                    <td class="px-6 py-4 font-medium">${new Date(m.recorded_at).toLocaleString()}</td>
                    <td class="px-6 py-4 font-semibold text-slate-800">${m.med_name} ${m.unit ? `(${m.unit})` : ''}</td>
                    <td class="px-6 py-4 text-center capitalize">${m.action.replace('_', ' ')}</td>
                    <td class="px-6 py-4 text-right font-bold ${colorClass}">${sign}${m.quantity_change}</td>
                `;
                movementsBody.appendChild(tr);
            });
        } catch (e) {
            console.error('Failed to load movements', e);
            movementsBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-red-500">Failed to load inventory movements.</td></tr>';
        }
    }
    loadMovements();

    // 6. Full Audit Log Modal
    const btnViewAudit = document.getElementById('btn-view-audit-log');
    const modalAudit = document.getElementById('audit-log-modal');
    const btnCloseAudit = document.getElementById('btn-close-audit-log');
    const auditBody = document.getElementById('full-audit-log-body');
    const searchAuditLog = document.getElementById('search-audit-log') as HTMLInputElement;
    const filterAuditAction = document.getElementById('filter-audit-action') as HTMLSelectElement;
    const filterAuditMonthSelect = document.getElementById('filter-audit-month-select') as HTMLSelectElement;
    const filterAuditYearSelect = document.getElementById('filter-audit-year-select') as HTMLSelectElement;
    const btnExportAuditPdf = document.getElementById('btn-export-audit-pdf');
    const btnAuditPrev = document.getElementById('btn-audit-prev') as HTMLButtonElement;
    const btnAuditNext = document.getElementById('btn-audit-next') as HTMLButtonElement;
    const auditPaginationInfo = document.getElementById('audit-pagination-info');

    if (filterAuditYearSelect) {
        const currentYear = new Date().getFullYear();
        for (let y = 2024; y <= currentYear + 10; y++) {
            const opt = document.createElement('option');
            opt.value = String(y);
            opt.textContent = String(y);
            filterAuditYearSelect.appendChild(opt);
        }
    }

    let allAuditLogs: any[] = [];
    let currentAuditPage = 1;
    const auditItemsPerPage = 15;

    function renderAuditLogs() {
        if (!auditBody) return;
        
        let filteredLogs = allAuditLogs;
        
        const searchTerm = searchAuditLog ? searchAuditLog.value.toLowerCase() : '';
        const actionFilter = filterAuditAction ? filterAuditAction.value : '';
        const monthFilter = filterAuditMonthSelect ? filterAuditMonthSelect.value : '';
        const yearFilter = filterAuditYearSelect ? filterAuditYearSelect.value : '';

        if (searchTerm) {
            filteredLogs = filteredLogs.filter((m: any) => m.med_name.toLowerCase().includes(searchTerm));
        }
        if (actionFilter) {
            filteredLogs = filteredLogs.filter((m: any) => m.action === actionFilter);
        }
        if (monthFilter || yearFilter) {
            filteredLogs = filteredLogs.filter((m: any) => {
                if (!m.recorded_at) return false;
                const d = new Date(m.recorded_at);
                const mMonth = String(d.getMonth() + 1).padStart(2, '0');
                const mYear = String(d.getFullYear());
                
                if (monthFilter && mMonth !== monthFilter) return false;
                if (yearFilter && mYear !== yearFilter) return false;
                return true;
            });
        }

        const totalItems = filteredLogs.length;
        const totalPages = Math.ceil(totalItems / auditItemsPerPage) || 1;
        
        if (currentAuditPage > totalPages) currentAuditPage = totalPages;
        if (currentAuditPage < 1) currentAuditPage = 1;

        const startIndex = (currentAuditPage - 1) * auditItemsPerPage;
        const endIndex = Math.min(startIndex + auditItemsPerPage, totalItems);
        const pageItems = filteredLogs.slice(startIndex, endIndex);

        auditBody.innerHTML = '';

        if (pageItems.length === 0) {
            auditBody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-slate-500">No logs found matching criteria.</td></tr>';
        } else {
            pageItems.forEach((m: any) => {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-slate-100 hover:bg-slate-50 transition-colors';
                const sign = m.quantity_change > 0 ? '+' : '';
                const colorClass = m.quantity_change > 0 ? 'text-green-600' : 'text-red-600';
                
                let actionBadge = '';
                if (m.notes === 'Medicine deleted from active inventory.') actionBadge = '<span class="bg-slate-200 text-slate-800 px-2 py-1 rounded text-xs font-bold">Deleted</span>';
                else if (m.action === 'restock') actionBadge = '<span class="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">Restock</span>';
                else if (m.action === 'dispense') actionBadge = '<span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">Dispense</span>';
                else if (m.action === 'expired_removal') actionBadge = '<span class="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold">Expired</span>';
                else actionBadge = '<span class="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-bold">Adjustment</span>';

                tr.innerHTML = `
                    <td class="px-6 py-4">${new Date(m.recorded_at).toLocaleString()}</td>
                    <td class="px-6 py-4 font-semibold text-slate-800">${m.med_name} ${m.unit ? `(${m.unit})` : ''}</td>
                    <td class="px-6 py-4 text-center">${actionBadge}</td>
                    <td class="px-6 py-4 text-right font-bold ${colorClass}">${sign}${m.quantity_change}</td>
                    <td class="px-6 py-4 text-right">${m.stock_after}</td>
                    <td class="px-6 py-4 text-slate-500 italic text-xs max-w-[200px] truncate" title="${m.notes || ''}">${m.notes || '-'}</td>
                `;
                auditBody.appendChild(tr);
            });
        }

        if (auditPaginationInfo) {
            auditPaginationInfo.textContent = totalItems === 0 
                ? 'Showing 0 entries' 
                : `Showing ${startIndex + 1} to ${endIndex} of ${totalItems} entries`;
        }
        
        if (btnAuditPrev) btnAuditPrev.disabled = currentAuditPage === 1;
        if (btnAuditNext) btnAuditNext.disabled = currentAuditPage === totalPages;
    }

    if (searchAuditLog) {
        searchAuditLog.addEventListener('input', () => {
            currentAuditPage = 1;
            renderAuditLogs();
        });
    }

    if (filterAuditAction) {
        filterAuditAction.addEventListener('change', () => {
            currentAuditPage = 1;
            renderAuditLogs();
        });
    }

    if (filterAuditMonthSelect) {
        filterAuditMonthSelect.addEventListener('change', () => {
            currentAuditPage = 1;
            renderAuditLogs();
        });
    }

    if (filterAuditYearSelect) {
        filterAuditYearSelect.addEventListener('change', () => {
            currentAuditPage = 1;
            renderAuditLogs();
        });
    }

    if (btnAuditPrev) {
        btnAuditPrev.addEventListener('click', () => {
            if (currentAuditPage > 1) {
                currentAuditPage--;
                renderAuditLogs();
            }
        });
    }
    
    if (btnAuditNext) {
        btnAuditNext.addEventListener('click', () => {
            currentAuditPage++;
            renderAuditLogs();
        });
    }

    if (btnExportAuditPdf) {
        btnExportAuditPdf.addEventListener('click', () => {
            let filteredLogs = allAuditLogs;
            const searchTerm = searchAuditLog ? searchAuditLog.value.toLowerCase() : '';
            const actionFilter = filterAuditAction ? filterAuditAction.value : '';
            const monthFilter = filterAuditMonthSelect ? filterAuditMonthSelect.value : '';
            const yearFilter = filterAuditYearSelect ? filterAuditYearSelect.value : '';

            if (searchTerm) filteredLogs = filteredLogs.filter((m: any) => m.med_name.toLowerCase().includes(searchTerm));
            if (actionFilter) filteredLogs = filteredLogs.filter((m: any) => m.action === actionFilter);
            if (monthFilter || yearFilter) {
                filteredLogs = filteredLogs.filter((m: any) => {
                    if (!m.recorded_at) return false;
                    const d = new Date(m.recorded_at);
                    const mMonth = String(d.getMonth() + 1).padStart(2, '0');
                    const mYear = String(d.getFullYear());
                    
                    if (monthFilter && mMonth !== monthFilter) return false;
                    if (yearFilter && mYear !== yearFilter) return false;
                    return true;
                });
            }

            if (filteredLogs.length === 0) {
                alert("No logs to export.");
                return;
            }

            const doc = new jsPDF();
            doc.text("Inventory Audit Log Report", 14, 15);
            
            const tableData = filteredLogs.map((m: any) => [
                new Date(m.recorded_at).toLocaleString(),
                m.med_name,
                m.action.replace('_', ' ').toUpperCase(),
                (m.quantity_change > 0 ? '+' : '') + String(m.quantity_change),
                String(m.stock_after),
                m.notes || ''
            ]);

            autoTable(doc, {
                startY: 20,
                head: [['Timestamp', 'Medicine', 'Action', 'Change', 'Stock After', 'Notes']],
                body: tableData,
            });

            doc.save(`audit_log_report.pdf`);
        });
    }

    if (btnViewAudit && modalAudit && btnCloseAudit && auditBody) {
        btnViewAudit.addEventListener('click', async () => {
            modalAudit.classList.remove('hidden');
            auditBody.innerHTML = '<tr><td colspan="6" class="py-8 text-center">Loading full audit log...</td></tr>';
            try {
                allAuditLogs = await fetchFullAuditLog();
                currentAuditPage = 1;
                if(searchAuditLog) searchAuditLog.value = '';
                if(filterAuditAction) filterAuditAction.value = '';
                if(filterAuditMonthSelect) filterAuditMonthSelect.value = '';
                if(filterAuditYearSelect) filterAuditYearSelect.value = '';
                renderAuditLogs();
            } catch(e) {
                console.error("Failed to fetch full audit log", e);
                auditBody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-red-500">Failed to load audit logs.</td></tr>';
            }
        });

        btnCloseAudit.addEventListener('click', () => {
            modalAudit.classList.add('hidden');
        });
    }

    // 7. Order List Modal
    const btnOrderList = document.getElementById('btn-order-list');
    const modalOrderList = document.getElementById('order-list-modal');
    const btnCloseOrderList = document.getElementById('btn-close-order-list');
    const orderListBody = document.getElementById('order-list-table-body');

    if (btnOrderList && modalOrderList && btnCloseOrderList && orderListBody) {
        btnOrderList.addEventListener('click', () => {
            modalOrderList.classList.remove('hidden');
            orderListBody.innerHTML = '';
            
            const itemsToOrder = [...outOfStockMedicines, ...lowStockMedicines];
            
            if (itemsToOrder.length === 0) {
                orderListBody.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-slate-500 font-semibold">All medicines are well-stocked. Nothing to order!</td></tr>';
                return;
            }
            
            itemsToOrder.forEach(m => {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-slate-100 hover:bg-slate-200 cursor-pointer transition-colors';
                
                let statusHtml = '';
                if (m.stock_qty <= 0) {
                    statusHtml = `<span class="bg-red-100 text-red-700 px-3 py-1 rounded font-bold text-xs inline-block w-full text-center">Out of Stock</span>`;
                } else {
                    statusHtml = `<span class="bg-yellow-100 text-yellow-700 px-3 py-1 rounded font-bold text-xs inline-block w-full text-center">Low Stock</span>`;
                }
                
                tr.innerHTML = `
                    <td class="px-4 py-4 font-semibold text-slate-800">${escapeHTML(m.med_name)} ${m.unit ? `(${escapeHTML(m.unit)})` : ''}</td>
                    <td class="px-4 py-4 font-bold ${m.stock_qty <= 0 ? 'text-red-600' : 'text-yellow-600'}">${m.stock_qty}</td>
                    <td class="px-4 py-4">${m.reorder_threshold}</td>
                    <td class="px-4 py-4">${statusHtml}</td>
                `;
                
                tr.addEventListener('click', () => {
                    modalOrderList.classList.add('hidden');
                    const searchInput = document.getElementById('search-medicine') as HTMLInputElement;
                    if (searchInput) {
                        searchInput.value = m.med_name;
                        searchInput.dispatchEvent(new Event('input'));
                    }
                });
                
                orderListBody.appendChild(tr);
            });
        });
        
        btnCloseOrderList.addEventListener('click', () => {
            modalOrderList.classList.add('hidden');
        });
    }

    // Export PDF Logic
    const btnExportPdf = document.getElementById('btn-export-pdf');
    const exportModal = document.getElementById('export-pdf-modal');
    const closeExportBtn = document.getElementById('btn-close-export-modal');

    if (btnExportPdf && exportModal && closeExportBtn) {
        btnExportPdf.addEventListener('click', () => exportModal.classList.remove('hidden'));
        closeExportBtn.addEventListener('click', () => exportModal.classList.add('hidden'));
    }

    function generateInventoryPDF(filterType: 'all' | 'out_of_stock' | 'expired') {
        fetchMedicines().then(medicines => {
            let dataToExport = medicines;
            let title = "Medicine Inventory Report";
            
            if (filterType === 'out_of_stock') {
                dataToExport = medicines.filter((m: any) => m.stock_qty <= 0);
                title = "Out of Stock Medicines Report";
            } else if (filterType === 'expired') {
                const now = new Date();
                // Reset time to start of day for comparison
                now.setHours(0, 0, 0, 0); 
                dataToExport = medicines.filter((m: any) => {
                    if (!m.expiry_date) return false;
                    const exp = new Date(m.expiry_date);
                    return exp < now;
                });
                title = "Expired Medicines Report";
            }

            if (dataToExport.length === 0) {
                alert("No medicines found for this category to export.");
                return;
            }

            const doc = new jsPDF();
            doc.text(title, 14, 15);
            
            const tableData = dataToExport.map((m: any) => {
                const expDateObj = m.expiry_date ? new Date(m.expiry_date) : null;
                const now = new Date();
                now.setHours(0,0,0,0);
                let status = 'Available';
                if (m.stock_qty <= 0) status = 'Out of Stock';
                else if (expDateObj && expDateObj < now) status = 'Expired';
                else if (m.stock_qty <= m.reorder_threshold) status = 'Low Stock';
                else if (expDateObj) {
                    const thirtyDays = new Date();
                    thirtyDays.setDate(now.getDate() + 30);
                    if (expDateObj <= thirtyDays) status = 'Expiring Soon';
                }

                return [
                    m.med_name,
                    m.category || 'N/A',
                    String(m.stock_qty),
                    m.expiry_date ? new Date(m.expiry_date).toLocaleDateString() : 'N/A',
                    status
                ];
            });

            autoTable(doc, {
                startY: 20,
                head: [['Medicine Name', 'Category', 'Quantity', 'Expiration Date', 'Status']],
                body: tableData,
            });

            doc.save(`inventory_${filterType}.pdf`);
            exportModal?.classList.add('hidden');
        }).catch(err => {
            console.error(err);
            alert("Failed to fetch medicines for export.");
        });
    }

    document.getElementById('btn-export-all')?.addEventListener('click', () => generateInventoryPDF('all'));
    document.getElementById('btn-export-out-of-stock')?.addEventListener('click', () => generateInventoryPDF('out_of_stock'));
    document.getElementById('btn-export-expired')?.addEventListener('click', () => generateInventoryPDF('expired'));

});
