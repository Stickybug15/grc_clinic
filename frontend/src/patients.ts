import { fetchPatients, createPatient, fetchPatient, updatePatient, deletePatient, fetchPatientHistory, escapeHTML, DATA_UPDATE_KEY } from './api';
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

    // 1. Load and Render Patients
    const tableBody = document.getElementById('patients-table-body');
    let allPatients: any[] = [];

    async function loadPatients(silent = false) {
        if (!tableBody) return;
        try {
            if (!silent) {
                tableBody.innerHTML = '<tr><td colspan="5" class="py-4 text-center">Loading...</td></tr>';
            }
            allPatients = await fetchPatients();
            
            // Only re-render if we're not currently searching
            const searchInput = document.getElementById('search-input') as HTMLInputElement;
            if (!searchInput || !searchInput.value) {
                renderPatients(allPatients);
            } else {
                // If there's an active search, re-apply the filter on the new data
                const query = searchInput.value.toLowerCase();
                const filtered = allPatients.filter(p => 
                    (p.first_name + ' ' + p.last_name).toLowerCase().includes(query) || 
                    p.student_no.toLowerCase().includes(query)
                );
                renderPatients(filtered);
            }
        } catch (e) {
            console.error('Failed to load patients', e);
            if (!silent) {
                tableBody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-red-500">Failed to load patients.</td></tr>';
            }
        }
    }

    function renderPatients(patientsToRender: any[]) {
        if (!tableBody) return;
        tableBody.innerHTML = '';
        
        if (patientsToRender.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-slate-500">No patients found.</td></tr>';
            return;
        }

        patientsToRender.forEach((p: any) => {
            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-100 hover:bg-slate-50 transition-colors";
            const lastVisit = p.last_visit ? new Date(p.last_visit).toLocaleDateString() : (p.created_at ? new Date(p.created_at).toLocaleDateString() : 'N/A');
            const visitCount = p.visit_count != null ? Number(p.visit_count) : 0;

            tr.innerHTML = `
                <td class="px-4 py-5 border-r border-slate-100 last:border-r-0 font-medium">${escapeHTML(p.student_no)}</td>
                <td class="px-4 py-5 border-r border-slate-100 last:border-r-0">${escapeHTML(p.first_name)} ${escapeHTML(p.last_name)}</td>
                <td class="px-4 py-5 border-r border-slate-100 last:border-r-0">${escapeHTML(p.level_section) || 'N/A'}</td>
                <td class="px-4 py-5 border-r border-slate-100 last:border-r-0">${escapeHTML(String(visitCount))}</td>
                <td class="px-4 py-5 border-r border-slate-100 last:border-r-0">${escapeHTML(lastVisit)}</td>
                <td class="px-4 py-5 flex items-center justify-center space-x-2">
                    <button data-id="${p.patient_id}" class="btn-history-patient bg-slate-600 hover:bg-slate-700 text-white px-4 py-1.5 rounded text-xs font-semibold transition-colors">History</button>
                    <button data-id="${p.patient_id}" class="btn-view-patient bg-[#0078d4] hover:bg-blue-600 text-white px-4 py-1.5 rounded text-xs font-semibold transition-colors">View</button>
                    <button data-id="${p.patient_id}" class="btn-edit-patient bg-[#10b981] hover:bg-emerald-600 text-white px-4 py-1.5 rounded text-xs font-semibold transition-colors">Edit</button>
                    <button data-id="${p.patient_id}" class="btn-delete-patient bg-[#ef4444] hover:bg-red-600 text-white px-4 py-1.5 rounded text-xs font-semibold transition-colors">Delete</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    loadPatients();

    window.addEventListener('storage', (event) => {
        if (event.key === DATA_UPDATE_KEY) {
            loadPatients(true);
            showToast('Patient data refreshed from another tab.');
        }
    });

    const REFRESH_INTERVAL_MS = 10000;
    setInterval(() => loadPatients(true), REFRESH_INTERVAL_MS);

    // 1.2 Export All Patients to PDF
    const btnExportPatients = document.getElementById('btn-export-patients');
    if (btnExportPatients) {
        btnExportPatients.addEventListener('click', () => {
            if (allPatients.length === 0) {
                alert("No patients to export.");
                return;
            }
            const doc = new jsPDF();
            doc.text("Patient Records", 14, 15);
            
            const tableData = allPatients.map(p => [
                p.student_no,
                `${p.first_name} ${p.last_name}`,
                p.level_section || 'N/A',
                p.visit_count || 0,
                p.last_visit ? new Date(p.last_visit).toLocaleDateString() : 'N/A'
            ]);

            autoTable(doc, {
                startY: 20,
                head: [['Student No', 'Full Name', 'Level / Section', 'Visits', 'Last Visit']],
                body: tableData,
            });

            doc.save('patient_records.pdf');
        });
    }

    // 1.5 Search Logic
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = (e.target as HTMLInputElement).value.toLowerCase();
            const filtered = allPatients.filter(p => 
                (p.first_name + ' ' + p.last_name).toLowerCase().includes(query) || 
                p.student_no.toLowerCase().includes(query)
            );
            renderPatients(filtered);
        });
    }

    // 2. Add New Patient Modal
    const addBtn = document.getElementById('btn-add-patient');
    const modal = document.getElementById('add-patient-modal');
    const closeBtn = document.getElementById('btn-close-modal');
    const form = document.getElementById('form-add-patient') as HTMLFormElement;

    if (addBtn && modal) addBtn.addEventListener('click', () => modal.classList.remove('hidden'));
    if (closeBtn && modal) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!confirm("Are you sure you want to save this data?")) return;
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            try {
                await createPatient(data);
                modal?.classList.add('hidden');
                form.reset();
                loadPatients(); // refresh data
            } catch (err) {
                console.error("Error creating patient", err);
                alert("Failed to create patient: " + err);
            }
        });
    }

    // 3. Edit and View Patient Modal Handling
    const editModal = document.getElementById('edit-patient-modal');
    const closeEditBtn = document.getElementById('btn-close-edit-modal');
    const editForm = document.getElementById('form-edit-patient') as HTMLFormElement;

    const viewModal = document.getElementById('view-patient-modal');
    const closeViewBtn = document.getElementById('btn-close-view-modal');

    if (closeEditBtn && editModal) closeEditBtn.addEventListener('click', () => editModal.classList.add('hidden'));
    if (closeViewBtn && viewModal) closeViewBtn.addEventListener('click', () => viewModal.classList.add('hidden'));

    const historyModal = document.getElementById('history-patient-modal');
    const closeHistoryBtn = document.getElementById('btn-close-history-modal');
    if (closeHistoryBtn && historyModal) closeHistoryBtn.addEventListener('click', () => historyModal.classList.add('hidden'));

    let currentHistoryData: any[] = [];
    let currentPatientName = '';

    const btnExportHistoryPdf = document.getElementById('btn-export-history-pdf');
    if (btnExportHistoryPdf) {
        btnExportHistoryPdf.addEventListener('click', () => {
            if (!currentHistoryData || currentHistoryData.length === 0) {
                alert("No medical history available to export.");
                return;
            }
            const doc = new jsPDF();
            doc.text(`Medical History - ${currentPatientName}`, 14, 15);
            
            const tableData = currentHistoryData.map(record => [
                new Date(record.visit_timestamp).toLocaleString(),
                record.symptoms || '',
                record.treatment || 'N/A',
                record.dispensed_medicines || 'None',
                record.remarks || ''
            ]);

            autoTable(doc, {
                startY: 20,
                head: [['Date', 'Symptoms', 'Treatment', 'Dispensed Medicines', 'Remarks']],
                body: tableData,
            });

            doc.save(`medical_history_${currentPatientName.replace(/\\s+/g, '_')}.pdf`);
        });
    }

    // Handle View, Edit, and Delete button clicks
    if (tableBody) {
        tableBody.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;
            
            // View Patient
            if (target.classList.contains('btn-view-patient')) {
                const id = target.getAttribute('data-id');
                if (id && viewModal) {
                    try {
                        const patient = await fetchPatient(id);
                        document.getElementById('view_student_no')!.textContent = patient.student_no;
                        document.getElementById('view_full_name')!.textContent = `${patient.first_name} ${patient.last_name}`;
                        document.getElementById('view_gender')!.textContent = patient.gender;
                        document.getElementById('view_birth_date')!.textContent = patient.birth_date ? new Date(patient.birth_date).toLocaleDateString() : 'N/A';
                        document.getElementById('view_level_section')!.textContent = patient.level_section || 'N/A';
                        document.getElementById('view_visit_count')!.textContent = String(patient.visit_count != null ? patient.visit_count : 0);
                        document.getElementById('view_last_visit')!.textContent = patient.last_visit ? new Date(patient.last_visit).toLocaleDateString() : 'N/A';
                        document.getElementById('view_contact_no')!.textContent = 'N/A'; // No direct contact_no in DB
                        document.getElementById('view_emergency_contact_name')!.textContent = patient.guardian_name || 'N/A';
                        document.getElementById('view_emergency_contact_no')!.textContent = patient.guardian_contact || 'N/A';
                        
                        viewModal.classList.remove('hidden');
                    } catch (err) {
                        alert("Failed to load patient details.");
                    }
                }
            }

            // Edit Patient
            if (target.classList.contains('btn-edit-patient')) {
                const id = target.getAttribute('data-id');
                if (id && editModal && editForm) {
                    try {
                        const patient = await fetchPatient(id);
                        (document.getElementById('edit_patient_id') as HTMLInputElement).value = patient.patient_id;
                        (document.getElementById('edit_student_no') as HTMLInputElement).value = patient.student_no;
                        (document.getElementById('edit_full_name') as HTMLInputElement).value = `${patient.first_name} ${patient.last_name}`;
                        (document.getElementById('edit_gender') as HTMLSelectElement).value = patient.gender;
                        (document.getElementById('edit_birth_date') as HTMLInputElement).value = patient.birth_date ? patient.birth_date.split('T')[0] : '';
                        (document.getElementById('edit_level_section') as HTMLInputElement).value = patient.level_section || '';
                        (document.getElementById('edit_contact_no') as HTMLInputElement).value = '';
                        (document.getElementById('edit_emergency_contact_name') as HTMLInputElement).value = patient.guardian_name || '';
                        (document.getElementById('edit_emergency_contact_no') as HTMLInputElement).value = patient.guardian_contact || '';
                        
                        editModal.classList.remove('hidden');
                    } catch (err) {
                        alert("Failed to load patient details.");
                    }
                }
            }

            // Delete Patient
            if (target.classList.contains('btn-delete-patient')) {
                const id = target.getAttribute('data-id');
                if (id && confirm("Are you sure you want to delete this patient? This will also remove any related consultations.")) {
                    try {
                        await deletePatient(id);
                        loadPatients();
                    } catch (err) {
                        alert("Failed to delete patient: " + err);
                    }
                }
            }

            // History Patient
            if (target.classList.contains('btn-history-patient')) {
                const id = target.getAttribute('data-id');
                if (id && historyModal) {
                    try {
                        const historyBody = document.getElementById('history-table-body');
                        if (historyBody) {
                            historyBody.innerHTML = '<tr><td colspan="5" class="py-4 text-center">Loading history...</td></tr>';
                            historyModal.classList.remove('hidden');
                            
                            const historyData = await fetchPatientHistory(id);
                            currentHistoryData = historyData;
                            const patientRecord = allPatients.find(p => String(p.patient_id) === id);
                            currentPatientName = patientRecord ? `${patientRecord.first_name} ${patientRecord.last_name}` : 'Unknown';
                            historyBody.innerHTML = '';
                            
                            if (historyData.length === 0) {
                                historyBody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-slate-500">No medical history found.</td></tr>';
                            } else {
                                historyData.forEach((record: any) => {
                                    const tr = document.createElement('tr');
                                    tr.className = "border-b border-slate-100 hover:bg-slate-50";
                                    const visitDate = new Date(record.visit_timestamp).toLocaleString();
                                    
                                    tr.innerHTML = `
                                        <td class="px-4 py-3 whitespace-nowrap">${escapeHTML(visitDate)}</td>
                                        <td class="px-4 py-3">${escapeHTML(record.symptoms)}</td>
                                        <td class="px-4 py-3">${escapeHTML(record.treatment || 'N/A')}</td>
                                        <td class="px-4 py-3">${escapeHTML(record.dispensed_medicines || 'None')}</td>
                                        <td class="px-4 py-3">${escapeHTML(record.remarks || '')}</td>
                                    `;
                                    historyBody.appendChild(tr);
                                });
                            }
                        }
                    } catch (err) {
                        alert("Failed to load patient history.");
                        historyModal.classList.add('hidden');
                    }
                }
            }
        });
    }

    // Submit Edit Form
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!confirm("Are you sure you want to save this data?")) return;
            const formData = new FormData(editForm);
            const data = Object.fromEntries(formData.entries());
            const id = data.patient_id as string;
            
            try {
                await updatePatient(id, data);
                if(editModal) editModal.classList.add('hidden');
                loadPatients(); // refresh data
            } catch (err) {
                console.error("Error updating patient", err);
                alert("Failed to update patient: " + err);
            }
        });
    }
});
