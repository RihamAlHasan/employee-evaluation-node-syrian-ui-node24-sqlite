const test = require('node:test');
const assert = require('node:assert/strict');
const { createEvaluationService, InMemoryStore, UserRole, TemplateType, EvaluationStatus } = require('../src/domain/store');

async function fixture() {
  const svc = createEvaluationService(new InMemoryStore());
  const users = await svc.seedDemo();
  return { svc, ...users };
}

test('employee can evaluate self, manager, and assigned department peer only', async () => {
  const { svc, ahmad, cycle } = await fixture();
  const targets = svc.availableTargets(ahmad, cycle.id);
  assert.ok(targets.some(t => t.type === TemplateType.EmployeeSelf && t.evaluatee.id === ahmad.id));
  assert.ok(targets.some(t => t.type === TemplateType.EmployeeToManager));
  assert.ok(targets.some(t => t.type === TemplateType.EmployeeToEmployee));
  assert.equal(targets.some(t => t.evaluatee.fullName.includes('سامر')), false);
});

test('central manager cannot submit performance evaluation but can approve results', async () => {
  const { svc, central, ahmad, cycle } = await fixture();
  assert.equal(svc.availableTargets(central, cycle.id).length, 0);
  assert.throws(() => svc.submitEvaluation(central, { cycleId: cycle.id, evaluateeId: ahmad.id, type: TemplateType.ManagerToEmployee, scores: {} }), /صلاحية|نموذج/);
});

test('score calculation and result visibility require central approval', async () => {
  const { svc, central, hrManager, ahmad, laila, cycle } = await fixture();
  submitAll90(svc, hrManager, cycle.id, ahmad.id, TemplateType.ManagerToEmployee);
  submitAll90(svc, ahmad, cycle.id, ahmad.id, TemplateType.EmployeeSelf);
  submitAll90(svc, laila, cycle.id, ahmad.id, TemplateType.EmployeeToEmployee);
  const hidden = svc.resultForEmployee(ahmad, cycle.id, ahmad.id);
  assert.equal(hidden.visible, false);
  const approved = svc.approveResult(central, cycle.id, ahmad.id, { strengthsHighlights: 'إنجاز واضح', improvementPoints: 'توثيق أكثر' });
  assert.equal(approved.resultStatus, EvaluationStatus.Approved);
  const visible = svc.resultForEmployee(ahmad, cycle.id, ahmad.id);
  assert.equal(visible.visible, true);
  assert.equal(visible.finalScore, 90);
});

test('duplicate evaluation is blocked', async () => {
  const { svc, hrManager, ahmad, cycle } = await fixture();
  submitAll90(svc, hrManager, cycle.id, ahmad.id, TemplateType.ManagerToEmployee);
  assert.throws(() => submitAll90(svc, hrManager, cycle.id, ahmad.id, TemplateType.ManagerToEmployee), /سابق/);
});

test('director general can evaluate department managers', async () => {
  const { svc, director, hrManager, cycle } = await fixture();
  const targets = svc.availableTargets(director, cycle.id);
  assert.ok(targets.some(t => t.evaluatee.id === hrManager.id && t.type === TemplateType.DirectorGeneralToManager));
});

function submitAll90(svc, user, cycleId, evaluateeId, type) {
  const started = svc.startEvaluation(user, cycleId, evaluateeId, type);
  const scores = Object.fromEntries(started.items.map(i => [i.id, 90]));
  return svc.submitEvaluation(user, { cycleId, evaluateeId, type, scores, strengths: 'جيد', weaknesses: 'لا يوجد' });
}

test('shared manager and peer templates apply across departments without duplicate setup', async () => {
  const { svc, ahmad, samer, orgManager, cycle } = await fixture();
  assert.ok(svc.availableTargets(samer, cycle.id).some(t => t.type === TemplateType.EmployeeToManager && t.evaluatee.id === orgManager.id));
  assert.ok(svc.availableTargets(ahmad, cycle.id).some(t => t.type === TemplateType.EmployeeToEmployee));
});

test('central manager can update direct manager and create department job titles', async () => {
  const { svc, central, ahmad, director } = await fixture();
  const title = svc.createJobTitle(central, { name: 'خبير موارد بشرية', departmentId: ahmad.departmentId });
  assert.equal(title.name, 'خبير موارد بشرية');
  const link = svc.lookups().departmentJobTitles.find(dj => dj.jobTitleId === title.id && dj.departmentId === ahmad.departmentId);
  const updated = await svc.updateEmployee(central, ahmad.id, { ...ahmad, jobTitleId: title.id, departmentJobTitleId: link.id, managerId: director.id });
  assert.equal(updated.managerId, director.id);
  assert.equal(updated.jobTitleId, title.id);
});

test('published cycles keep start date editable fields locked but allow other dates', async () => {
  const { svc, central, cycle } = await fixture();
  assert.throws(() => svc.updateCycle(central, cycle.id, { ...cycle, startDate: '2026-06-02' }), /تاريخ بدء/);
  const updated = svc.updateCycle(central, cycle.id, { ...cycle, endDate: '2026-07-05', grievanceEndDate: '2026-07-20' });
  assert.equal(updated.startDate, cycle.startDate);
  assert.equal(updated.endDate, '2026-07-05');
  assert.equal(updated.grievanceEndDate, '2026-07-20');
});

test('published cycles and approved results cannot be published or approved twice', async () => {
  const { svc, central, hrManager, ahmad, cycle } = await fixture();
  assert.throws(() => svc.publishCycle(central, cycle.id), /منشورة/);
  submitAll90(svc, hrManager, cycle.id, ahmad.id, TemplateType.ManagerToEmployee);
  const approved = svc.approveResult(central, cycle.id, ahmad.id, {});
  assert.equal(approved.resultStatus, EvaluationStatus.Approved);
  assert.throws(() => svc.approveResult(central, cycle.id, ahmad.id, {}), /مسبق/);
});

test('reference departments and job titles are seeded and linked', async () => {
  const { svc } = await fixture();
  const lookups = svc.lookups();
  const department = lookups.departments.find(d => d.name === 'إدارة البرامج والمشاريع - مشروع العدالة الوظيفية');
  assert.ok(department);
  const title = lookups.jobTitles.find(j => j.name === 'مسؤول التحقق والوثائق');
  assert.ok(title);
  assert.ok(lookups.departmentJobTitles.some(dj => dj.departmentId === department.id && dj.jobTitleId === title.id));
});

test('same-department employees and department managers are automatic peer targets', async () => {
  const { svc, ahmad, laila, samer, hrManager, orgManager, cycle } = await fixture();
  const employeeTargets = svc.availableTargets(ahmad, cycle.id);
  assert.ok(employeeTargets.some(t => t.type === TemplateType.EmployeeToEmployee && t.evaluatee.id === laila.id));
  assert.equal(employeeTargets.some(t => t.type === TemplateType.EmployeeToEmployee && t.evaluatee.id === samer.id), false);
  const managerTargets = svc.availableTargets(hrManager, cycle.id);
  assert.ok(managerTargets.some(t => t.type === TemplateType.ManagerToManager && t.evaluatee.id === orgManager.id));
});

test('central manager can process a result before approval and employees only see approved results', async () => {
  const { svc, central, hrManager, ahmad, cycle } = await fixture();
  submitAll90(svc, hrManager, cycle.id, ahmad.id, TemplateType.ManagerToEmployee);
  const processed = svc.processResult(central, cycle.id, ahmad.id, { strengthsHighlights: 'منجز', improvementPoints: 'متابعة' });
  assert.equal(processed.resultStatus, EvaluationStatus.Processed);
  assert.equal(svc.resultForEmployee(ahmad, cycle.id, ahmad.id).visible, false);
  const approved = svc.approveResult(central, cycle.id, ahmad.id, {});
  assert.equal(approved.resultStatus, EvaluationStatus.Approved);
  assert.equal(svc.resultForEmployee(ahmad, cycle.id, ahmad.id).visible, true);
});

test('reference employee roster is seeded with managers and editable lookup links', async () => {
  const { svc } = await fixture();
  const employees = svc.employees();
  const leen = employees.find(e => e.employeeCode === 'HO-Cc-0019');
  assert.ok(leen);
  assert.equal(leen.fullName, 'لين رفيق نوريه');
  assert.equal(leen.hireDate, '1998-10-10');
  const hani = employees.find(e => e.fullName === 'هاني عفيف متري');
  assert.equal(leen.managerId, hani.id);
  const director = employees.find(e => e.employeeCode === 'HO-B-0272');
  assert.equal(director.role, UserRole.DirectorGeneral);
});
