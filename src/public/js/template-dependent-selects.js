(() => {
  const data = window.templateLookups || { departments: [], departmentJobTitles: [], jobTitles: [], employees: [] };
  const jobById = id => data.jobTitles.find(j => Number(j.id) === Number(id));
  const fill = form => {
    const dept = form.querySelector('.js-template-department');
    const job = form.querySelector('.js-template-job');
    const link = form.querySelector('.js-template-link');
    const targets = form.querySelector('.js-template-targets');
    if (!dept || !job) return;
    const savedLink = form.dataset.departmentJobTitle;
    const savedJob = form.dataset.jobTitle || job.value;
    if (savedLink) {
      const found = data.departmentJobTitles.find(dj => Number(dj.id) === Number(savedLink));
      if (found) dept.value = found.departmentId;
    }
    const links = dept.value ? data.departmentJobTitles.filter(dj => Number(dj.departmentId) === Number(dept.value)) : data.departmentJobTitles;
    const seen = new Set();
    job.innerHTML = links.filter(dj => !seen.has(Number(dj.jobTitleId)) && seen.add(Number(dj.jobTitleId))).map(dj => `<option value="${dj.jobTitleId}" data-link="${dept.value ? dj.id : ''}" ${Number(savedJob) === Number(dj.jobTitleId) ? 'selected' : ''}>${jobById(dj.jobTitleId)?.name || 'مسمى غير معروف'}${dj.isManagerTitle ? ' (إداري)' : ''}</option>`).join('') || '<option value="">لا توجد مسميات</option>';
    if (link) link.value = job.selectedOptions[0]?.dataset.link || '';
    if (targets) {
      const selected = (form.dataset.targets || '').split(',').filter(Boolean).map(Number);
      const available = data.employees.filter(e => (!dept.value || Number(e.departmentId) === Number(dept.value)) && (!job.value || Number(e.jobTitleId) === Number(job.value)));
      targets.innerHTML = available.map(e => { const deptName = data.departments.find(d => Number(d.id) === Number(e.departmentId))?.name || '-'; const jobName = jobById(e.jobTitleId)?.name || '-'; return `<option value="${e.id}" ${selected.includes(Number(e.id)) ? 'selected' : ''}>${e.fullName} — ${deptName} / ${jobName}</option>`; }).join('');
    }
  };
  document.querySelectorAll('.js-template-form').forEach(form => {
    fill(form);
    form.querySelector('.js-template-department')?.addEventListener('change', () => { form.dataset.departmentJobTitle = ''; form.dataset.jobTitle = ''; form.dataset.targets = ''; fill(form); });
    form.querySelector('.js-template-job')?.addEventListener('change', () => { const job = form.querySelector('.js-template-job'); form.dataset.jobTitle = job.value; form.dataset.targets = ''; const link = form.querySelector('.js-template-link'); if (link) link.value = job.selectedOptions[0]?.dataset.link || ''; fill(form); });
  });
})();
