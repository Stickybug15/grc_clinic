import { fetchMedicines, createMedicine, updateMedicineStock } from './api';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load and Render Medicines
    async function loadMedicines() {
        try {
            const tableBody = document.getElementById('medicines-table-body');
            if(!tableBody) return;
            
            const medicines = await fetchMedicines();
            
            tableBody.innerHTML = '';
            
            // Populate stock update dropdown
            const selectMed = document.getElementById('select-medicine') as HTMLSelectElement;
            if(selectMed) selectMed.innerHTML = '<option value="">Select Medicine</option>';

            medicines.forEach((m: any) => {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-slate-100';
                
                const expDate = m.expiry_date ? new Date(m.expiry_date).toLocaleDateString() : 'N/A';
                
                let statusHtml = '';
                if (m.stock_qty <= 0) {
                     statusHtml = `<span class="bg-red-600 text-white px-8 py-2 rounded-sm font-bold block mx-auto w-fit min-w-[140px]">Out of Stock</span>`;
                } else if (m.stock_qty <= m.reorder_level) {
                     statusHtml = `<span class="bg-yellow-500 text-white px-8 py-2 rounded-sm font-bold block mx-auto w-fit min-w-[140px]">Low Stock</span>`;
                } else {
                     statusHtml = `<span class="bg-green-500 text-white px-8 py-2 rounded-sm font-bold block mx-auto w-fit min-w-[140px]">Available</span>`;
                }

                tr.innerHTML = `
                    <td class="px-6 py-6 border-r border-slate-200">${m.med_name} ${m.unit ? `(${m.unit})` : ''}</td>
                    <td class="px-6 py-6 border-r border-slate-200">${m.category || 'N/A'}</td>
                    <td class="px-6 py-6 border-r border-slate-200 font-semibold">${m.stock_qty}</td>
                    <td class="px-6 py-6 border-r border-slate-200">${expDate}</td>
                    <td class="px-6 py-6">${statusHtml}</td>
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
        }
    }

    loadMedicines();

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
            const data = Object.fromEntries(formData.entries());
            data.stock_qty = Number(data.stock_qty);
            data.reorder_level = Number(data.reorder_level);
            
            try {
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
});
