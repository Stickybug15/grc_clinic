import { fetchMedicines, createMedicine, updateMedicineStock, fetchMedicine, updateMedicine, deleteMedicine, fetchInventoryMovements, fetchFullAuditLog, escapeHTML } from './api';

document.addEventListener('DOMContentLoaded', async () => {
    const tableBody = document.getElementById('medicines-table-body');
    // 1. Load and Render Medicines
    async function loadMedicines() {
        try {
            if(!tableBody) return;
            
            const medicines = await fetchMedicines();
            
            tableBody.innerHTML = '';
            
            // Populate stock update dropdown
            const selectMed = document.getElementById('select-medicine') as HTMLSelectElement;
            if(selectMed) selectMed.innerHTML = '<option value="">Select Medicine</option>';

            // Get search term
            const searchInput = document.getElementById('search-medicine') as HTMLInputElement;
            const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

            // Filter medicines
            const filteredMedicines = medicines.filter((m: any) => 
                m.med_name.toLowerCase().includes(searchTerm) ||
                (m.category && m.category.toLowerCase().includes(searchTerm))
            );

            if (filteredMedicines.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-slate-500">No medicines found matching "${searchTerm}"</td></tr>`;
            }

            filteredMedicines.forEach((m: any) => {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-slate-100';
                
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

                if(selectMed) {
                    const opt = document.createElement('option');
                    opt.value = m.medicine_id;
                    opt.textContent = m.med_name;
                    selectMed.appendChild(opt);
                }
            });
        } catch (e) {
            console.error('Failed to load medicines', e);
            if(tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-red-500">Failed to load medicines: ${e}</td></tr>`;
        }
    }

    loadMedicines();

    const searchInput = document.getElementById('search-medicine');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            loadMedicines();
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
                // Check for duplicates
                const existingMedicines = await fetchMedicines();
                const newMedName = String(data.med_name).trim().toLowerCase();
                const isDuplicate = existingMedicines.some((m: any) => m.med_name.trim().toLowerCase() === newMedName);
                
                if (isDuplicate) {
                    alert("Cannot add medicine: A medicine with this name already exists in the inventory.");
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
                    } catch (err) {
                        alert("Failed to delete medicine: " + err);
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
    async function loadMovements() {
        if (!movementsBody) return;
        try {
            movementsBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center">Loading...</td></tr>';
            const movements = await fetchInventoryMovements();
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

    if (btnViewAudit && modalAudit && btnCloseAudit && auditBody) {
        btnViewAudit.addEventListener('click', async () => {
            modalAudit.classList.remove('hidden');
            auditBody.innerHTML = '<tr><td colspan="6" class="py-8 text-center">Loading full audit log...</td></tr>';
            try {
                const logs = await fetchFullAuditLog();
                auditBody.innerHTML = '';
                if(logs.length === 0) {
                    auditBody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-slate-500">No logs found.</td></tr>';
                    return;
                }
                logs.forEach((m: any) => {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b border-slate-100 hover:bg-slate-50 transition-colors';
                    const sign = m.quantity_change > 0 ? '+' : '';
                    const colorClass = m.quantity_change > 0 ? 'text-green-600' : 'text-red-600';
                    tr.innerHTML = `
                        <td class="px-6 py-4">${new Date(m.recorded_at).toLocaleString()}</td>
                        <td class="px-6 py-4 font-semibold text-slate-800">${m.med_name} ${m.unit ? `(${m.unit})` : ''}</td>
                        <td class="px-6 py-4 text-center capitalize">${m.action.replace('_', ' ')}</td>
                        <td class="px-6 py-4 text-right font-bold ${colorClass}">${sign}${m.quantity_change}</td>
                        <td class="px-6 py-4 text-right">${m.stock_after}</td>
                        <td class="px-6 py-4 text-slate-500 italic text-xs max-w-[200px] truncate" title="${m.notes || ''}">${m.notes || '-'}</td>
                    `;
                    auditBody.appendChild(tr);
                });
            } catch(e) {
                console.error("Failed to fetch full audit log", e);
                auditBody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-red-500">Failed to load audit logs.</td></tr>';
            }
        });

        btnCloseAudit.addEventListener('click', () => {
            modalAudit.classList.add('hidden');
        });
    }

});
