(() => {
  const data = window.evalLookups || { departmentJobTitles: [], jobTitles: [], employees: [] };
  const jobById = id => data.jobTitles.find(j => Number(j.id) === Number(id));
  const employeeLabel = e => `${e.fullName} — ${jobById(e.jobTitleId)?.name || '-'} / ${departmentName(e.departmentId)}`;
  const departmentName = id => data.departments.find(d => Number(d.id) === Number(id))?.name || '';
  const fill = form => {
    const dept = form.querySelector('.js-department');
    const job = form.querySelector('.js-job-title');
    const link = form.querySelector('.js-department-job-title');
    const manager = form.querySelector('.js-manager');
    if (!dept || !job) return;
    const selectedJob = form.dataset.jobTitle || job.value;
    const selectedManager = form.dataset.manager || manager?.value || '';
    const links = data.departmentJobTitles.filter(dj => Number(dj.departmentId) === Number(dept.value));
    job.innerHTML = links.map(dj => {
      const jt = jobById(dj.jobTitleId);
      return `<option value="${dj.jobTitleId}" data-link="${dj.id}" ${Number(selectedJob) === Number(dj.jobTitleId) ? 'selected' : ''}>${jt?.name || 'مسمى غير معروف'}${dj.isManagerTitle ? ' (إداري)' : ''}</option>`;
    }).join('') || '<option value="">لا توجد مسميات مرتبطة بهذه الدائرة</option>';
    if (link) link.value = job.selectedOptions[0]?.dataset.link || '';
    if (manager) {
      const choices = data.employees.filter(e => Number(e.departmentId) === Number(dept.value));
      manager.innerHTML = '<option value="">بدون مدير مباشر</option>' + choices.map(e => `<option value="${e.id}" ${Number(selectedManager) === Number(e.id) ? 'selected' : ''}>${employeeLabel(e)}</option>`).join('');
    }
  };
  document.querySelectorAll('.js-dependent-form').forEach(form => {
    fill(form);
    form.querySelector('.js-department')?.addEventListener('change', () => { form.dataset.jobTitle = ''; form.dataset.manager = ''; fill(form); });
    form.querySelector('.js-job-title')?.addEventListener('change', () => { const link = form.querySelector('.js-department-job-title'); if (link) link.value = form.querySelector('.js-job-title').selectedOptions[0]?.dataset.link || ''; });
  });
})();
