import { fetchPatients, fetchMedicines, createConsultation, fetchConsultations, fetchConsultation, updateConsultation, deleteConsultation, escapeHTML, DATA_UPDATE_KEY } from './api';
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

    // 1. Populate Patient Dropdown for Add Modal
    const patientSelect = document.getElementById('select-patient') as HTMLSelectElement;
    let lastPatientOptionsStr = '';
    async function loadPatientOptions(silent = false) {
        if (!patientSelect) return;
        try {
            const patients = await fetchPatients();
            const newDataStr = JSON.stringify(patients);
            if (silent && newDataStr === lastPatientOptionsStr) return;
            lastPatientOptionsStr = newDataStr;

            patientSelect.innerHTML = '<option value="">-- Select Patient --</option>';
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

    await loadPatientOptions();

    // 1b. Load Medicines for Dispensing Dropdown
    let availableMedicines: any[] = [];
    async function loadMedicineOptions() {
        try {
            availableMedicines = await fetchMedicines();
        } catch(e) {
            console.error("Error loading medicines", e);
        }
    }

    await loadMedicineOptions();

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
                const exp = m.expiry_date ? new Date(m.expiry_date).toLocaleDateString() : 'N/A';
                optionsHtml += `<option value="${m.medicine_id}">${m.med_name} (Exp: ${exp}) (${m.stock_qty} in stock)</option>`;
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
    const searchConsultation = document.getElementById('search-consultation') as HTMLInputElement;
    const filterConsultationMonth = document.getElementById('filter-consultation-month') as HTMLSelectElement;
    const filterConsultationYear = document.getElementById('filter-consultation-year') as HTMLSelectElement;
    const btnExportConsultationPdf = document.getElementById('btn-export-consultation-pdf');
    const btnConsultationPrev = document.getElementById('btn-consultation-prev') as HTMLButtonElement;
    const btnConsultationNext = document.getElementById('btn-consultation-next') as HTMLButtonElement;
    const consultationPaginationInfo = document.getElementById('consultation-pagination-info');

    let allConsultations: any[] = [];
    let currentConsultationPage = 1;
    const consultationsPerPage = 15;

    // Populate Year Dropdown dynamically
    if (filterConsultationYear) {
        const currentYear = new Date().getFullYear();
        for (let y = 2024; y <= currentYear + 10; y++) {
            const opt = document.createElement('option');
            opt.value = String(y);
            opt.textContent = String(y);
            filterConsultationYear.appendChild(opt);
        }
    }

    function renderConsultations() {
        if (!tableBody) return;

        let filteredLogs = allConsultations;
        const searchTerm = searchConsultation ? searchConsultation.value.toLowerCase() : '';
        const monthFilter = filterConsultationMonth ? filterConsultationMonth.value : '';
        const yearFilter = filterConsultationYear ? filterConsultationYear.value : '';

        if (searchTerm) {
            filteredLogs = filteredLogs.filter((c: any) => 
                c.full_name.toLowerCase().includes(searchTerm) || 
                c.student_no.toLowerCase().includes(searchTerm) ||
                c.symptoms.toLowerCase().includes(searchTerm)
            );
        }

        if (monthFilter || yearFilter) {
            filteredLogs = filteredLogs.filter((c: any) => {
                if (!c.visit_timestamp) return false;
                const d = new Date(c.visit_timestamp);
                const mMonth = String(d.getMonth() + 1).padStart(2, '0');
                const mYear = String(d.getFullYear());
                
                if (monthFilter && mMonth !== monthFilter) return false;
                if (yearFilter && mYear !== yearFilter) return false;
                return true;
            });
        }

        const totalItems = filteredLogs.length;
        const totalPages = Math.ceil(totalItems / consultationsPerPage) || 1;
        
        if (currentConsultationPage > totalPages) currentConsultationPage = totalPages;
        if (currentConsultationPage < 1) currentConsultationPage = 1;

        const startIndex = (currentConsultationPage - 1) * consultationsPerPage;
        const endIndex = Math.min(startIndex + consultationsPerPage, totalItems);
        const pageItems = filteredLogs.slice(startIndex, endIndex);

        tableBody.innerHTML = '';

        if (pageItems.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-slate-500">No consultations found matching criteria.</td></tr>';
        } else {
            pageItems.forEach((c: any) => {
                const date = new Date(c.visit_timestamp).toLocaleString();
                let vitalsHtml = '';
                if (c.vital_signs) {
                    try {
                        const v = typeof c.vital_signs === 'string' ? JSON.parse(c.vital_signs) : c.vital_signs;
                        if (v && v.temperature) {
                            vitalsHtml = `<div class="text-xs text-rose-500 font-bold mt-1">Temp: ${v.temperature} °C</div>`;
                        }
                    } catch(e) {}
                }

                const tr = document.createElement('tr');
                tr.className = "border-b border-slate-100 hover:bg-slate-50 transition-colors";
                tr.innerHTML = `
                    <td class="px-6 py-4 border-r border-slate-100">${escapeHTML(date)}</td>
                    <td class="px-6 py-4 border-r border-slate-100 font-semibold text-slate-800">${escapeHTML(c.full_name)} <br> <span class="text-xs text-slate-500 font-normal">${escapeHTML(c.student_no)}</span></td>
                    <td class="px-6 py-4 border-r border-slate-100">
                        ${escapeHTML(c.symptoms)}
                        ${vitalsHtml}
                    </td>
                    <td class="px-6 py-4 border-r border-slate-100">${escapeHTML(c.treatment) || 'N/A'}</td>
                    <td class="px-6 py-4 flex items-center justify-center space-x-3">
                        <button data-id="${c.consultation_id}" class="btn-edit-consultation bg-[#10b981] hover:bg-emerald-600 text-white px-4 py-1 rounded text-xs font-semibold transition-colors">Edit</button>
                        <button data-id="${c.consultation_id}" class="btn-delete-consultation bg-[#ef4444] hover:bg-red-600 text-white px-4 py-1 rounded text-xs font-semibold transition-colors">Delete</button>
                    </td>
                `;
                tableBody.appendChild(tr);
            });
        }

        if (consultationPaginationInfo) {
            consultationPaginationInfo.textContent = totalItems === 0 
                ? 'Showing 0 entries' 
                : `Showing ${startIndex + 1} to ${endIndex} of ${totalItems} entries`;
        }
        
        if (btnConsultationPrev) btnConsultationPrev.disabled = currentConsultationPage === 1;
        if (btnConsultationNext) btnConsultationNext.disabled = currentConsultationPage === totalPages;
    }

    if (searchConsultation) {
        searchConsultation.addEventListener('input', () => {
            currentConsultationPage = 1;
            renderConsultations();
        });
    }

    if (filterConsultationMonth) {
        filterConsultationMonth.addEventListener('change', () => {
            currentConsultationPage = 1;
            renderConsultations();
        });
    }

    if (filterConsultationYear) {
        filterConsultationYear.addEventListener('change', () => {
            currentConsultationPage = 1;
            renderConsultations();
        });
    }

    if (btnConsultationPrev) {
        btnConsultationPrev.addEventListener('click', () => {
            if (currentConsultationPage > 1) {
                currentConsultationPage--;
                renderConsultations();
            }
        });
    }
    
    if (btnConsultationNext) {
        btnConsultationNext.addEventListener('click', () => {
            currentConsultationPage++;
            renderConsultations();
        });
    }

    if (btnExportConsultationPdf) {
        btnExportConsultationPdf.addEventListener('click', () => {
            let filteredLogs = allConsultations;
            const searchTerm = searchConsultation ? searchConsultation.value.toLowerCase() : '';
            const monthFilter = filterConsultationMonth ? filterConsultationMonth.value : '';
            const yearFilter = filterConsultationYear ? filterConsultationYear.value : '';

            if (searchTerm) {
                filteredLogs = filteredLogs.filter((c: any) => 
                    c.full_name.toLowerCase().includes(searchTerm) || 
                    c.student_no.toLowerCase().includes(searchTerm) ||
                    c.symptoms.toLowerCase().includes(searchTerm)
                );
            }

            if (monthFilter || yearFilter) {
                filteredLogs = filteredLogs.filter((c: any) => {
                    if (!c.visit_timestamp) return false;
                    const d = new Date(c.visit_timestamp);
                    const mMonth = String(d.getMonth() + 1).padStart(2, '0');
                    const mYear = String(d.getFullYear());
                    
                    if (monthFilter && mMonth !== monthFilter) return false;
                    if (yearFilter && mYear !== yearFilter) return false;
                    return true;
                });
            }

            if (filteredLogs.length === 0) {
                alert("No consultations to export.");
                return;
            }

            const doc = new jsPDF();
            doc.text("Consultation History Report", 14, 15);
            
            const tableData = filteredLogs.map((c: any) => {
                let temp = 'N/A';
                if (c.vital_signs) {
                    try {
                        const v = typeof c.vital_signs === 'string' ? JSON.parse(c.vital_signs) : c.vital_signs;
                        if (v && v.temperature) temp = `${v.temperature} °C`;
                    } catch(e) {}
                }

                return [
                    new Date(c.visit_timestamp).toLocaleString(),
                    c.full_name,
                    c.symptoms,
                    temp,
                    c.treatment || 'N/A'
                ];
            });

            autoTable(doc, {
                startY: 20,
                head: [['Date/Time', 'Patient Name', 'Symptoms', 'Temp', 'Treatment']],
                body: tableData,
            });

            doc.save(`consultations_report.pdf`);
        });
    }

    let lastConsultationsDataStr = '';
    async function loadConsultations(silent = false) {
        if (!tableBody) return;
        try {
            if (!silent) {
                tableBody.innerHTML = '<tr><td colspan="5" class="py-4 text-center">Loading...</td></tr>';
            }
            const fetchedConsultations = await fetchConsultations();
            const newDataStr = JSON.stringify(fetchedConsultations);
            if (silent && newDataStr === lastConsultationsDataStr) return;
            lastConsultationsDataStr = newDataStr;
            
            allConsultations = fetchedConsultations;
            renderConsultations();
        } catch (e) {
            console.error('Failed to load consultations', e);
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-red-500">Failed to load consultations: ${e}</td></tr>`;
        }
    }
    loadConsultations();

    window.addEventListener('storage', (event) => {
        if (event.key === DATA_UPDATE_KEY) {
            loadConsultations(true);
            loadPatientOptions(true);
            loadMedicineOptions();
            showToast('Consultations refreshed from another tab.');
        }
    });

    const REFRESH_INTERVAL_MS = 10000;
    setInterval(() => {
        loadConsultations(true);
        loadPatientOptions(true);
        loadMedicineOptions();
    }, REFRESH_INTERVAL_MS);

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
            if (!confirm("Are you sure you want to save this data?")) return;
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

            const temperatureInput = formData.get('temperature') as string;
            const vitalSigns = temperatureInput ? { temperature: Number(temperatureInput) } : {};

            const payload = {
                patient_id: formData.get('patient_id'),
                symptoms: formData.get('symptoms') || 'Not specified',
                treatment: treatments.join(', '),
                remarks: formData.get('remarks'),
                vital_signs: vitalSigns,
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
                        
                        let temp = '';
                        if (consultation.vital_signs) {
                            try {
                                const v = typeof consultation.vital_signs === 'string' ? JSON.parse(consultation.vital_signs) : consultation.vital_signs;
                                if (v && v.temperature) temp = String(v.temperature);
                            } catch(e) {}
                        }
                        (document.getElementById('edit_temperature') as HTMLInputElement).value = temp;

                        const treatmentString = consultation.treatment || '';
                        const treatmentArray = treatmentString.split(',').map((s: string) => s.trim());
                        document.querySelectorAll('input[name="edit_treatment_option"]').forEach(el => {
                            const checkbox = el as HTMLInputElement;
                            checkbox.checked = treatmentArray.includes(checkbox.value);
                        });

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
            if (!confirm("Are you sure you want to save this data?")) return;
            const formData = new FormData(editForm);
            const id = formData.get('consultation_id') as string;
            
            // Gather edited treatments
            const treatments: string[] = [];
            editForm.querySelectorAll('input[name="edit_treatment_option"]:checked').forEach(el => {
                treatments.push((el as HTMLInputElement).value);
            });

            const temperatureInput = formData.get('temperature') as string;
            const vitalSigns = temperatureInput ? { temperature: Number(temperatureInput) } : {};

            const payload = {
                symptoms: formData.get('symptoms'),
                treatment: treatments.join(', '),
                remarks: formData.get('remarks'),
                vital_signs: vitalSigns,
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
