import { fetchPatients, createPatient } from './api';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load and Render Patients
    async function loadPatients() {
        try {
            const tableBody = document.getElementById('patients-table-body');
            if(!tableBody) return;
            
            const patients = await fetchPatients();
            
            tableBody.innerHTML = '';
            patients.forEach((p: any) => {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-slate-50 last:border-b-0';
                
                // We'll format the Last Visit here later (if joined with consultations), but for now we put created_at
                const lastVisit = new Date(p.created_at).toLocaleDateString();

                tr.innerHTML = `
                    <td class="px-4 py-5 border-r border-slate-100 last:border-r-0">${p.student_no}</td>
                    <td class="px-4 py-5 border-r border-slate-100 last:border-r-0 font-medium">${p.full_name}</td>
                    <td class="px-4 py-5 border-r border-slate-100 last:border-r-0">${p.level_section || 'N/A'}</td>
                    <td class="px-4 py-5 border-r border-slate-100 last:border-r-0">${lastVisit}</td>
                    <td class="px-4 py-5 flex items-center justify-center space-x-4">
                        <button class="bg-[#0078d4] hover:bg-blue-600 text-white px-6 py-1.5 rounded text-xs font-semibold transition-colors">View</button>
                        <button class="bg-[#10b981] hover:bg-emerald-600 text-white px-6 py-1.5 rounded text-xs font-semibold transition-colors">Edit</button>
                    </td>
                `;
                tableBody.appendChild(tr);
            });
        } catch (e) {
            console.error('Failed to load patients', e);
        }
    }

    loadPatients();

    // 2. Add New Patient Modal Handling
    const addBtn = document.getElementById('btn-add-patient');
    const modal = document.getElementById('add-patient-modal');
    const closeBtn = document.getElementById('btn-close-modal');
    const form = document.getElementById('form-add-patient') as HTMLFormElement;

    if (addBtn && modal && closeBtn) {
        addBtn.addEventListener('click', () => modal.classList.remove('hidden'));
        closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            try {
                await createPatient(data);
                modal.classList.add('hidden');
                form.reset();
                loadPatients(); // refresh data
            } catch (err) {
                console.error("Error creating patient", err);
                alert("Failed to create patient: " + err);
            }
        });
    }
});
