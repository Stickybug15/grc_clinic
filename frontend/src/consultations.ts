import { fetchPatients, createConsultation } from './api';

document.addEventListener('DOMContentLoaded', async () => {
    // Populate Patient Dropdown
    const patientSelect = document.getElementById('select-patient') as HTMLSelectElement;
    if (patientSelect) {
        try {
            const patients = await fetchPatients();
            patients.forEach((p: any) => {
                const opt = document.createElement('option');
                opt.value = p.patient_id;
                opt.textContent = `${p.student_no} - ${p.full_name}`;
                patientSelect.appendChild(opt);
            });
        } catch(e) {
            console.error("Error loading patients", e);
        }
    }

    // Handle Form Submit
    const form = document.getElementById('form-consultation') as HTMLFormElement;
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            
            // Gather treatments
            const treatments: string[] = [];
            document.querySelectorAll('input[name="treatment_option"]:checked').forEach(el => {
                treatments.push((el as HTMLInputElement).value);
            });

            const payload = {
                patient_id: formData.get('patient_id'),
                symptoms: formData.get('symptoms') || 'Not specified',
                treatment: treatments.join(', '),
                remarks: formData.get('remarks'),
                vital_signs: {},
                followup_required: formData.get('followup_required') === 'on'
            };

            try {
                await createConsultation(payload);
                alert("Consultation saved successfully!");
                form.reset();
            } catch (err) {
                alert("Failed to save consultation: " + err);
            }
        });
    }
});
