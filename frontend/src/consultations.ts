import { fetchPatients, fetchMedicines, createConsultation, fetchConsultations, fetchConsultation, updateConsultation, deleteConsultation, escapeHTML } from './api';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Populate Patient Dropdown for Add Modal
    const patientSelect = document.getElementById('select-patient') as HTMLSelectElement;
    if (patientSelect) {
        try {
            const patients = await fetchPatients();
            patients.forEach((p: any) => {
                const opt = document.createElement('option');
                opt.value = p.patient_id;
                opt.textContent = `${p.student_no} - ${p.first_name} ${p.last_name}`;
                patientSelect.appendChild(opt);
            });
        } catch(e) {
            console.error("Error loading patients", e);
        }
    }
    
    // 1b. Load Medicines for Dispensing Dropdown
    let availableMedicines: any[] = [];
    try {
        availableMedicines = await fetchMedicines();
    } catch(e) {
        console.error("Error loading medicines", e);
    }

    // 1c. Dynamic Dispense Medicine Rows
    const btnAddDispense = document.getElementById('btn-add-dispense-row');
    const dispenseContainer = document.getElementById('dispense-container');
    
    if (btnAddDispense && dispenseContainer) {
        btnAddDispense.addEventListener('click', () => {
            const row = document.createElement('div');
            row.className = 'flex gap-3 items-center bg-slate-50 p-3 rounded border border-slate-200';
            
            // Build options string
            let optionsHtml = '<option value="">-- Select Medicine --</option>';
            availableMedicines.filter(m => m.stock_qty > 0).forEach(m => {
                optionsHtml += `<option value="${m.medicine_id}">${m.med_name} (${m.stock_qty} in stock)</option>`;
            });

            row.innerHTML = `
                <select name="dispense_medicine_id" class="border-slate-300 rounded p-2 text-sm flex-1" required>
                    ${optionsHtml}
                </select>
                <input type="number" name="dispense_qty" placeholder="Qty" min="1" class="border-slate-300 rounded p-2 text-sm w-20" required>
                <input type="text" name="dispense_dosage" placeholder="Dosage info (e.g. 1 tab 3x a day)" class="border-slate-300 rounded p-2 text-sm flex-1">
                <button type="button" class="btn-remove-row text-red-500 hover:text-red-700 font-bold px-2">&times;</button>
            `;
            
            row.querySelector('.btn-remove-row')?.addEventListener('click', () => {
                row.remove();
            });

            dispenseContainer.appendChild(row);
        });
    }

    // 2. Load and Render Consultations Table
    const tableBody = document.getElementById('consultations-table-body');
    async function loadConsultations() {
        if (!tableBody) return;
        try {
            tableBody.innerHTML = '<tr><td colspan="5" class="py-4 text-center">Loading...</td></tr>';
            const consultations = await fetchConsultations();
            tableBody.innerHTML = '';
            
            if (consultations.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-slate-500">No consultations found.</td></tr>';
                return;
            }

            consultations.forEach((c: any) => {
                const date = new Date(c.visit_timestamp).toLocaleString();
                const tr = document.createElement('tr');
                tr.className = "border-b border-slate-100 hover:bg-slate-50 transition-colors";
                tr.innerHTML = `
                    <td class="px-6 py-4 border-r border-slate-100">${escapeHTML(date)}</td>
                    <td class="px-6 py-4 border-r border-slate-100 font-semibold text-slate-800">${escapeHTML(c.full_name)} <br> <span class="text-xs text-slate-500 font-normal">${escapeHTML(c.student_no)}</span></td>
                    <td class="px-6 py-4 border-r border-slate-100">${escapeHTML(c.symptoms)}</td>
                    <td class="px-6 py-4 border-r border-slate-100">${escapeHTML(c.treatment) || 'N/A'}</td>
                    <td class="px-6 py-4 flex items-center justify-center space-x-3">
                        <button data-id="${c.consultation_id}" class="btn-edit-consultation bg-[#10b981] hover:bg-emerald-600 text-white px-4 py-1 rounded text-xs font-semibold transition-colors">Edit</button>
                        <button data-id="${c.consultation_id}" class="btn-delete-consultation bg-[#ef4444] hover:bg-red-600 text-white px-4 py-1 rounded text-xs font-semibold transition-colors">Delete</button>
                    </td>
                `;
                tableBody.appendChild(tr);
            });
        } catch (e) {
            console.error('Failed to load consultations', e);
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-red-500">Failed to load consultations: ${e}</td></tr>`;
        }
    }
    loadConsultations();

    // 3. Modals Toggle Logic
    const addModal = document.getElementById('add-consultation-modal');
    const editModal = document.getElementById('edit-consultation-modal');
    
    document.getElementById('btn-add-consultation')?.addEventListener('click', () => addModal?.classList.remove('hidden'));
    document.getElementById('btn-close-add-modal')?.addEventListener('click', () => addModal?.classList.add('hidden'));
    document.getElementById('btn-close-edit-modal')?.addEventListener('click', () => editModal?.classList.add('hidden'));

    // 4. Handle Add Form Submit
    const addForm = document.getElementById('form-add-consultation') as HTMLFormElement;
    if (addForm) {
        addForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(addForm);
            
            // Gather treatments
            const treatments: string[] = [];
            addForm.querySelectorAll('input[name="treatment_option"]:checked').forEach(el => {
                treatments.push((el as HTMLInputElement).value);
            });

            // Gather dispensed medicines
            const dispensedMedicines: any[] = [];
            const dispenseRows = addForm.querySelectorAll('#dispense-container > div');
            dispenseRows.forEach(row => {
                const medId = (row.querySelector('select[name="dispense_medicine_id"]') as HTMLSelectElement).value;
                const qty = (row.querySelector('input[name="dispense_qty"]') as HTMLInputElement).value;
                const dosage = (row.querySelector('input[name="dispense_dosage"]') as HTMLInputElement).value;
                if (medId && qty) {
                    dispensedMedicines.push({ medicine_id: medId, qty: Number(qty), dosage: dosage || '' });
                }
            });

            const payload = {
                patient_id: formData.get('patient_id'),
                symptoms: formData.get('symptoms') || 'Not specified',
                treatment: treatments.join(', '),
                remarks: formData.get('remarks'),
                vital_signs: {},
                followup_required: formData.get('followup_required') === 'on',
                dispensed_medicines: dispensedMedicines
            };

            try {
                await createConsultation(payload);
                addForm.reset();
                if (dispenseContainer) dispenseContainer.innerHTML = '';
                addModal?.classList.add('hidden');
                loadConsultations();
            } catch (err) {
                alert("Failed to save consultation: " + err);
            }
        });
    }

    // 5. Handle Edit and Delete via Event Delegation
    if (tableBody) {
        tableBody.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;

            // Delete
            if (target.classList.contains('btn-delete-consultation')) {
                const id = target.getAttribute('data-id');
                if (id && confirm("Are you sure you want to delete this consultation?")) {
                    try {
                        await deleteConsultation(id);
                        loadConsultations();
                    } catch (err) {
                        alert("Failed to delete consultation: " + err);
                    }
                }
            }

            // Edit
            if (target.classList.contains('btn-edit-consultation')) {
                const id = target.getAttribute('data-id');
                if (id && editModal) {
                    try {
                        const consultation = await fetchConsultation(id);
                        (document.getElementById('edit_consultation_id') as HTMLInputElement).value = consultation.consultation_id;
                        (document.getElementById('edit_patient_name') as HTMLInputElement).value = `${consultation.student_no} - ${consultation.full_name}`;
                        (document.getElementById('edit_symptoms') as HTMLInputElement).value = consultation.symptoms || '';
                        (document.getElementById('edit_treatment') as HTMLInputElement).value = consultation.treatment || '';
                        (document.getElementById('edit_remarks') as HTMLTextAreaElement).value = consultation.remarks || '';
                        (document.getElementById('edit_followup') as HTMLInputElement).checked = consultation.followup_required === 1;
                        
                        editModal.classList.remove('hidden');
                    } catch (err) {
                        alert("Failed to fetch consultation details.");
                    }
                }
            }
        });
    }

    // 6. Handle Edit Form Submit
    const editForm = document.getElementById('form-edit-consultation') as HTMLFormElement;
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(editForm);
            const id = formData.get('consultation_id') as string;
            
            const payload = {
                symptoms: formData.get('symptoms'),
                treatment: formData.get('treatment'),
                remarks: formData.get('remarks'),
                followup_required: formData.get('followup_required') === 'on'
            };

            try {
                await updateConsultation(id, payload);
                editModal?.classList.add('hidden');
                loadConsultations();
            } catch (err) {
                alert("Failed to update consultation: " + err);
            }
        });
    }
});
