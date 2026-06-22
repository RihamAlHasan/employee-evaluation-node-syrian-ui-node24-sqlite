const crypto = require('crypto');
let bcrypt = null;
try { bcrypt = require('bcryptjs'); } catch { bcrypt = null; }
function sha(password) { return 'sha256$' + crypto.createHash('sha256').update(String(password)).digest('hex'); }
const { UserRole, TemplateType, EvaluationStatus, GrievanceStatus } = require('./enums');
const { sectionWeightsFor, calculateEvaluationScore, calculateFinalResult, round2 } = require('./weights');

class InMemoryStore {
  constructor() { this.reset(); }
  reset() {
    this.tables = {
      entities: [], departments: [], jobTitles: [], departmentJobTitles: [], employees: [], cycles: [], templates: [], templateItems: [], peerAssignments: [], evaluations: [], evaluationScores: [], resultAdjustments: [], grievances: [], logs: [], settings: []
    };
    this.ids = Object.fromEntries(Object.keys(this.tables).map(k => [k, 1]));
    this.tables.settings.push({ id: 1, itemTasksWeight: 70, itemBehaviorsWeight: 30, finalManagerWeight: 70, finalSelfWeight: 10, finalPeerWeight: 20 });
  }
  next(table) { return this.ids[table]++; }
  insert(table, row) { const r = { id: this.next(table), ...row }; this.tables[table].push(r); return r; }
  update(table, id, patch) { const row = this.findById(table, id); if (!row) throw new Error('السجل غير موجود'); Object.assign(row, patch); return row; }
  delete(table, id) { const index = this.tables[table].findIndex(x => Number(x.id) === Number(id)); if (index === -1) throw new Error('السجل غير موجود'); return this.tables[table].splice(index, 1)[0]; }
  findById(table, id) { return this.tables[table].find(x => Number(x.id) === Number(id)); }
  all(table) { return [...this.tables[table]]; }
  log(user, actionType, description, entityName = '', entityId = null, snapshot = null) {
    return this.insert('logs', { userId: user?.id ?? null, userName: user?.fullName ?? user?.nationalId ?? '', actionType, description, entityName, entityId, snapshotJson: snapshot ? JSON.stringify(snapshot) : null, createdAt: new Date().toISOString(), isReverted: false });
  }
}

function createEvaluationService(store = new InMemoryStore()) {
  const s = store;
  function assertRole(user, roles) {
    if (!user || !roles.includes(user.role)) throw new Error('لا تملك الصلاحية المطلوبة');
  }
  function publicEmployee(e) { return e && { ...e, passwordHash: undefined }; }
  async function hash(password) { return bcrypt ? bcrypt.hash(password, 8) : sha(password); }
  async function verify(password, hashValue) {
    if (!hashValue) return false;
    if (String(hashValue).startsWith('sha256$')) return sha(password) === hashValue;
    return bcrypt ? bcrypt.compare(password, hashValue) : false;
  }

  return {
    store: s,
    seedDemo,
    login,
    employees: () => s.all('employees').map(publicEmployee),
    cycles: () => s.all('cycles'),
    templates: () => s.all('templates').map(t => ({ ...t, items: s.all('templateItems').filter(i => i.evaluationTemplateId === t.id) })),
    evaluations: () => s.all('evaluations'),
    logs: () => s.all('logs'),
    settings: () => s.findById('settings', 1),
    getDashboard,
    createEmployee,
    updateEmployee,
    createJobTitle,
    createCycle,
    updateCycle,
    publishCycle,
    closeCycle,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    assignPeer,
    availableTargets,
    startEvaluation,
    submitEvaluation,
    resultForEmployee,
    approveResult,
    submitGrievance,
    reviewGrievance,
    reportRows,
    lookups
  };

  async function seedDemo() {
    s.reset();
    const entity = s.insert('entities', { name: 'مديرية التنمية الإدارية - حمص', isActive: true });
    const hr = s.insert('departments', { name: 'دائرة الموارد البشرية', entityId: entity.id, isActive: true });
    const org = s.insert('departments', { name: 'دائرة التنظيم المؤسساتي', entityId: entity.id, isActive: true });
    const jtCentral = s.insert('jobTitles', { name: 'مسؤول تقييم مركزي', userName: 'central', departmentId: hr.id, isActive: true });
    const jtDirector = s.insert('jobTitles', { name: 'مدير المديرية', userName: 'director', departmentId: hr.id, isActive: true });
    const jtManager = s.insert('jobTitles', { name: 'مدير دائرة', userName: 'manager', departmentId: hr.id, isActive: true });
    const jtEmployee = s.insert('jobTitles', { name: 'موظف', userName: 'employee', departmentId: hr.id, isActive: true });
    const djtCentral = s.insert('departmentJobTitles', { departmentId: hr.id, jobTitleId: jtCentral.id, isManagerTitle: false, isActive: true });
    const djtDirector = s.insert('departmentJobTitles', { departmentId: hr.id, jobTitleId: jtDirector.id, isManagerTitle: true, isActive: true });
    const djtHrManager = s.insert('departmentJobTitles', { departmentId: hr.id, jobTitleId: jtManager.id, isManagerTitle: true, isActive: true });
    const djtOrgManager = s.insert('departmentJobTitles', { departmentId: org.id, jobTitleId: jtManager.id, isManagerTitle: true, isActive: true });
    const djtHrEmployee = s.insert('departmentJobTitles', { departmentId: hr.id, jobTitleId: jtEmployee.id, isManagerTitle: false, isActive: true });
    const djtOrgEmployee = s.insert('departmentJobTitles', { departmentId: org.id, jobTitleId: jtEmployee.id, isManagerTitle: false, isActive: true });
    const passwordHash = await hash('123456');
    const central = s.insert('employees', emp('رهام - مسؤول التقييم المركزي', '11000000001', 'C001', UserRole.CentralEvaluationManager, hr, jtCentral, djtCentral, null, passwordHash));
    const director = s.insert('employees', emp('مدير المديرية', '12000000001', 'D001', UserRole.DirectorGeneral, hr, jtDirector, djtDirector, null, passwordHash));
    const hrManager = s.insert('employees', emp('مدير الموارد البشرية', '13000000001', 'M001', UserRole.DepartmentManager, hr, jtManager, djtHrManager, director.id, passwordHash));
    const orgManager = s.insert('employees', emp('مدير التنظيم المؤسساتي', '13000000002', 'M002', UserRole.DepartmentManager, org, jtManager, djtOrgManager, director.id, passwordHash));
    const ahmad = s.insert('employees', emp('أحمد خالد', '14000000001', 'E001', UserRole.Employee, hr, jtEmployee, djtHrEmployee, hrManager.id, passwordHash));
    const laila = s.insert('employees', emp('ليلى حسن', '14000000002', 'E002', UserRole.Employee, hr, jtEmployee, djtHrEmployee, hrManager.id, passwordHash));
    const samer = s.insert('employees', emp('سامر علي', '14000000003', 'E003', UserRole.Employee, org, jtEmployee, djtOrgEmployee, orgManager.id, passwordHash));
    const cycle = s.insert('cycles', { name: 'دورة تقييم تجريبية 2026', startDate: '2026-06-01', endDate: '2026-06-30', isActive: true, isStarted: true, isTesting: true, isHrApproved: false, isPublished: true, variationRate: 20, resultComment: '', grievanceStartDate: '2026-07-01', grievanceEndDate: '2026-07-15', hrApprovedAt: null });
    makeTemplate(cycle.id, djtHrEmployee.id, jtEmployee.id, TemplateType.ManagerToEmployee, 'نموذج المدير للموظف', true);
    makeTemplate(cycle.id, djtHrEmployee.id, jtEmployee.id, TemplateType.EmployeeSelf, 'نموذج التقييم الذاتي للموظف', true);
    makeTemplate(cycle.id, null, jtManager.id, TemplateType.EmployeeToManager, 'نموذج الموظف للمدير', false);
    makeTemplate(cycle.id, null, jtEmployee.id, TemplateType.EmployeeToEmployee, 'نموذج تقييم الزملاء', false);
    makeTemplate(cycle.id, djtHrManager.id, jtManager.id, TemplateType.ManagerSelf, 'نموذج التقييم الذاتي للمدير', true);
    makeTemplate(cycle.id, null, jtManager.id, TemplateType.ManagerToManager, 'نموذج مدير لمدير', false);
    makeDirectorTemplate(cycle.id, jtManager.id);
    s.insert('peerAssignments', { cycleId: cycle.id, evaluatorId: ahmad.id, evaluateeId: laila.id });
    s.insert('peerAssignments', { cycleId: cycle.id, evaluatorId: laila.id, evaluateeId: ahmad.id });
    s.insert('peerAssignments', { cycleId: cycle.id, evaluatorId: hrManager.id, evaluateeId: orgManager.id });
    s.log(central, 'Seed', 'تم توليد بيانات تجريبية', 'EvaluationCycle', cycle.id);
    return { central, director, hrManager, orgManager, ahmad, laila, samer, cycle };
  }

  function emp(fullName, nationalId, employeeCode, role, department, jobTitle, djt, managerId, passwordHash) {
    return { fullName, nationalId, employeeCode, userName: nationalId, passwordHash, mustChangePassword: false, email: '', jobTitleId: jobTitle.id, departmentId: department.id, departmentJobTitleId: djt.id, hireDate: '2024-01-01', role, managerId, isActive: true };
  }
  function makeTemplate(cycleId, departmentJobTitleId, jobTitleId, type, name, withTasks) {
    const w = sectionWeightsFor(type);
    const t = s.insert('templates', { name, cycleId, jobTitleId, departmentJobTitleId, targetEmployeeId: null, targetEmployeeIds: [], tasksSectionWeight: w.tasks, behaviorsSectionWeight: w.behaviors, type });
    if (withTasks) {
      s.insert('templateItems', { evaluationTemplateId: t.id, isTask: true, name: 'إنجاز المهام الأساسية', description: 'إنجاز المهام وفق الخطة', weight: 50 });
      s.insert('templateItems', { evaluationTemplateId: t.id, isTask: true, name: 'جودة المخرجات', description: 'الدقة والالتزام بالمعايير', weight: 50 });
    }
    s.insert('templateItems', { evaluationTemplateId: t.id, isTask: false, name: 'التعاون', description: 'العمل بروح الفريق', weight: 35 });
    s.insert('templateItems', { evaluationTemplateId: t.id, isTask: false, name: 'الالتزام', description: 'الانضباط واحترام الوقت', weight: 35 });
    s.insert('templateItems', { evaluationTemplateId: t.id, isTask: false, name: 'التطوير والتحسين', description: 'اقتراح حلول وتحسينات', weight: 30 });
    return t;
  }
  function makeDirectorTemplate(cycleId, jobTitleId) {
    const w = sectionWeightsFor(TemplateType.DirectorGeneralToManager);
    const t = s.insert('templates', { name: 'نموذج تقييم الإدارة', cycleId, jobTitleId, departmentJobTitleId: null, targetEmployeeId: null, targetEmployeeIds: [], tasksSectionWeight: w.tasks, behaviorsSectionWeight: w.behaviors, type: TemplateType.DirectorGeneralToManager });
    for (let i = 1; i <= 7; i++) s.insert('templateItems', { evaluationTemplateId: t.id, isTask: true, name: `المهام والمسؤوليات ${i}`, description: 'مؤشر الأداء', weight: i === 7 ? 10 : 15 });
    const behaviors = [
      'قيادة وتمكين الفريق',
      'التعاون المؤسسي',
      'المرونة الوظيفية في الطوارئ',
      'المبادرة وتعزيز الابتكار',
      'التواصل والمتابعة الفعالة'
    ];
    behaviors.forEach(name => s.insert('templateItems', { evaluationTemplateId: t.id, isTask: false, name, description: '', weight: 20 }));
    return t;
  }

  async function login(identifier, password) {
    const user = s.all('employees').find(e => e.isActive && (e.nationalId === identifier || e.employeeCode === identifier || e.userName === identifier));
    if (!user || !(await verify(password, user.passwordHash))) return null;
    return publicEmployee(user);
  }

  function getActiveCycle() { return s.all('cycles').find(c => c.isActive && c.isPublished); }
  function getDashboard(user) {
    const cycle = getActiveCycle();
    return { cycle, employeesCount: s.all('employees').filter(e => e.isActive).length, templatesCount: s.all('templates').length, processedCount: s.all('evaluations').filter(e => e.status === EvaluationStatus.Processed || e.status === EvaluationStatus.Approved).length, pendingTargets: cycle ? availableTargets(user, cycle.id) : [] };
  }
  function lookups() { return { entities: s.all('entities'), departments: s.all('departments'), jobTitles: s.all('jobTitles'), departmentJobTitles: s.all('departmentJobTitles') }; }

  async function createEmployee(user, data) {
    assertRole(user, [UserRole.Admin, UserRole.CentralEvaluationManager, UserRole.EntityEvaluationManager]);
    const passwordHash = await hash(data.password || '123456');
    const row = s.insert('employees', { fullName: data.fullName, nationalId: data.nationalId, employeeCode: data.employeeCode || data.nationalId, userName: data.userName || data.nationalId, passwordHash, mustChangePassword: true, email: data.email || '', jobTitleId: Number(data.jobTitleId), departmentId: Number(data.departmentId), departmentJobTitleId: data.departmentJobTitleId ? Number(data.departmentJobTitleId) : null, hireDate: data.hireDate || new Date().toISOString().slice(0,10), role: data.role || UserRole.Employee, managerId: data.managerId ? Number(data.managerId) : null, isActive: true });
    s.log(user, 'CreateEmployee', `إضافة موظف: ${row.fullName}`, 'Employee', row.id, row);
    return publicEmployee(row);
  }
  async function updateEmployee(user, id, data) {
    assertRole(user, [UserRole.Admin, UserRole.CentralEvaluationManager, UserRole.EntityEvaluationManager]);
    const patch = { fullName: data.fullName, nationalId: data.nationalId, employeeCode: data.employeeCode || data.nationalId, userName: data.userName || data.nationalId, jobTitleId: Number(data.jobTitleId), departmentId: Number(data.departmentId), departmentJobTitleId: data.departmentJobTitleId ? Number(data.departmentJobTitleId) : null, role: data.role || UserRole.Employee, managerId: data.managerId ? Number(data.managerId) : null, isActive: data.isActive !== 'false' };
    const row = s.update('employees', id, patch);
    s.log(user, 'UpdateEmployee', `تعديل موظف: ${row.fullName}`, 'Employee', row.id, row);
    return publicEmployee(row);
  }
  function createJobTitle(user, data) {
    assertRole(user, [UserRole.Admin, UserRole.CentralEvaluationManager]);
    const jobTitle = s.insert('jobTitles', { name: data.name, userName: data.userName || '', departmentId: data.departmentId ? Number(data.departmentId) : null, isActive: true });
    if (data.departmentId) s.insert('departmentJobTitles', { departmentId: Number(data.departmentId), jobTitleId: jobTitle.id, isManagerTitle: !!data.isManagerTitle, isActive: true });
    s.log(user, 'CreateJobTitle', `إضافة مسمى وظيفي: ${jobTitle.name}`, 'JobTitle', jobTitle.id, jobTitle);
    return jobTitle;
  }
  function createCycle(user, data) {
    assertRole(user, [UserRole.Admin, UserRole.CentralEvaluationManager]);
    const row = s.insert('cycles', { name: data.name, startDate: data.startDate, endDate: data.endDate, isActive: !!data.isActive, isStarted: !!data.isStarted, isTesting: !!data.isTesting, isHrApproved: false, isPublished: false, variationRate: Number(data.variationRate || 20), resultComment: data.resultComment || '', grievanceStartDate: data.grievanceStartDate || null, grievanceEndDate: data.grievanceEndDate || null, hrApprovedAt: null });
    s.log(user, 'CreateCycle', `إنشاء دورة: ${row.name}`, 'EvaluationCycle', row.id, row);
    return row;
  }
  function updateCycle(user, cycleId, data) {
    assertRole(user, [UserRole.Admin, UserRole.CentralEvaluationManager]);
    const existing = s.findById('cycles', cycleId);
    if (!existing) throw new Error('الدورة غير موجودة');
    if (existing.isPublished && data.startDate && data.startDate !== existing.startDate) throw new Error('لا يمكن تعديل تاريخ بدء الدورة بعد النشر');
    const row = s.update('cycles', cycleId, { name: data.name, startDate: existing.isPublished ? existing.startDate : data.startDate, endDate: data.endDate, grievanceStartDate: data.grievanceStartDate || null, grievanceEndDate: data.grievanceEndDate || null, variationRate: Number(data.variationRate || existing.variationRate || 20), resultComment: data.resultComment || existing.resultComment || '' });
    s.log(user, 'UpdateCycle', `تعديل دورة: ${row.name}`, 'EvaluationCycle', row.id, row);
    return row;
  }
  function publishCycle(user, cycleId) {
    assertRole(user, [UserRole.Admin, UserRole.CentralEvaluationManager]);
    const existing = s.findById('cycles', cycleId);
    if (!existing) throw new Error('الدورة غير موجودة');
    if (existing.isPublished) throw new Error('الدورة منشورة مسبقاً');
    const row = s.update('cycles', cycleId, { isPublished: true, isStarted: true, isActive: true });
    s.log(user, 'PublishCycle', `نشر دورة: ${row.name}`, 'EvaluationCycle', row.id, row);
    return row;
  }
  function closeCycle(user, cycleId) { assertRole(user, [UserRole.Admin, UserRole.CentralEvaluationManager]); const row = s.update('cycles', cycleId, { isActive: false }); s.log(user, 'CloseCycle', `إغلاق دورة: ${row.name}`, 'EvaluationCycle', row.id, row); return row; }
  function createTemplate(user, data) {
    assertRole(user, [UserRole.Admin, UserRole.CentralEvaluationManager]);
    const w = sectionWeightsFor(data.type);
    const cycleIds = normalizeIds(data.cycleIds || data.cycleId);
    let first = null;
    for (const cycleId of cycleIds) {
      const row = s.insert('templates', { name: data.name, cycleId, jobTitleId: data.jobTitleId ? Number(data.jobTitleId) : null, departmentJobTitleId: data.departmentJobTitleId ? Number(data.departmentJobTitleId) : null, targetEmployeeId: null, targetEmployeeIds: normalizeIds(data.targetEmployeeIds || data.targetEmployeeId), tasksSectionWeight: Number(data.tasksSectionWeight ?? w.tasks), behaviorsSectionWeight: Number(data.behaviorsSectionWeight ?? w.behaviors), type: data.type });
      for (const item of (data.items || [])) s.insert('templateItems', { evaluationTemplateId: row.id, isTask: !!item.isTask, name: item.name, description: item.description || '', weight: Number(item.weight) });
      first ||= row;
      s.log(user, 'CreateTemplate', `إنشاء نموذج: ${row.name}`, 'EvaluationTemplate', row.id, row);
    }
    return first;
  }
  function updateTemplate(user, templateId, data) {
    assertRole(user, [UserRole.Admin, UserRole.CentralEvaluationManager]);
    const template = s.findById('templates', templateId);
    if (!template) throw new Error('النموذج غير موجود');
    const cycle = s.findById('cycles', template.cycleId);
    if (cycle?.isPublished) throw new Error('لا يمكن تعديل النموذج بعد نشر دورته');
    const w = sectionWeightsFor(data.type || template.type);
    const row = s.update('templates', templateId, { name: data.name, type: data.type, jobTitleId: data.jobTitleId ? Number(data.jobTitleId) : null, departmentJobTitleId: data.departmentJobTitleId ? Number(data.departmentJobTitleId) : null, targetEmployeeId: null, targetEmployeeIds: normalizeIds(data.targetEmployeeIds || data.targetEmployeeId), tasksSectionWeight: Number(data.tasksSectionWeight ?? w.tasks), behaviorsSectionWeight: Number(data.behaviorsSectionWeight ?? w.behaviors) });
    s.tables.templateItems = s.tables.templateItems.filter(i => Number(i.evaluationTemplateId) !== Number(templateId));
    for (const item of (data.items || [])) s.insert('templateItems', { evaluationTemplateId: row.id, isTask: !!item.isTask, name: item.name, description: item.description || '', weight: Number(item.weight) });
    s.persist?.();
    s.log(user, 'UpdateTemplate', `تعديل نموذج: ${row.name}`, 'EvaluationTemplate', row.id, row);
    return row;
  }
  function deleteTemplate(user, templateId) {
    assertRole(user, [UserRole.Admin, UserRole.CentralEvaluationManager]);
    const template = s.findById('templates', templateId);
    if (!template) throw new Error('النموذج غير موجود');
    const cycle = s.findById('cycles', template.cycleId);
    if (cycle?.isPublished) throw new Error('لا يمكن حذف النموذج بعد نشر دورته');
    s.tables.templateItems = s.tables.templateItems.filter(i => Number(i.evaluationTemplateId) !== Number(templateId));
    const row = s.delete('templates', templateId);
    s.persist?.();
    s.log(user, 'DeleteTemplate', `حذف نموذج: ${row.name}`, 'EvaluationTemplate', row.id, row);
    return row;
  }
  function assignPeer(user, cycleId, evaluatorId, evaluateeId) {
    assertRole(user, [UserRole.Admin, UserRole.CentralEvaluationManager, UserRole.EntityEvaluationManager]);
    if (Number(evaluatorId) === Number(evaluateeId)) throw new Error('لا يمكن إسناد الموظف لنفسه كزميل');
    const exists = s.all('peerAssignments').some(p => p.cycleId == cycleId && p.evaluatorId == evaluatorId && p.evaluateeId == evaluateeId);
    if (exists) return null;
    return s.insert('peerAssignments', { cycleId: Number(cycleId), evaluatorId: Number(evaluatorId), evaluateeId: Number(evaluateeId) });
  }

  function availableTargets(user, cycleId) {
    const cycle = s.findById('cycles', cycleId);
    if (!cycle || !cycle.isPublished || !cycle.isActive) return [];
    const me = s.findById('employees', user.id);
    if (!me) return [];
    const targets = [];
    const add = (evaluatee, type, label) => {
      const template = findTemplateFor(cycleId, evaluatee, type);
      if (!template) return;
      const done = s.all('evaluations').some(e => !e.isDeleted && e.cycleId == cycleId && e.evaluatorId == me.id && e.evaluateeId == evaluatee.id && e.type == type);
      targets.push({ evaluatee: publicEmployee(evaluatee), type, label, template, done });
    };
    if (me.role === UserRole.Employee) {
      add(me, TemplateType.EmployeeSelf, 'تقييم ذاتي');
      const manager = s.findById('employees', me.managerId); if (manager) add(manager, TemplateType.EmployeeToManager, 'تقييم المدير المباشر');
      s.all('peerAssignments').filter(p => p.cycleId == cycleId && p.evaluatorId == me.id).forEach(p => { const e = s.findById('employees', p.evaluateeId); if (e) add(e, TemplateType.EmployeeToEmployee, 'تقييم زميل'); });
    }
    if (me.role === UserRole.DepartmentManager) {
      add(me, TemplateType.ManagerSelf, 'تقييم ذاتي للمدير');
      s.all('employees').filter(e => e.managerId == me.id && e.isActive).forEach(e => add(e, TemplateType.ManagerToEmployee, 'تقييم موظف مباشر'));
      s.all('peerAssignments').filter(p => p.cycleId == cycleId && p.evaluatorId == me.id).forEach(p => { const e = s.findById('employees', p.evaluateeId); if (e) add(e, TemplateType.ManagerToManager, 'تقييم مدير زميل'); });
    }
    if (me.role === UserRole.DirectorGeneral) {
      s.all('employees').filter(e => e.role === UserRole.DepartmentManager && e.isActive).forEach(e => add(e, TemplateType.DirectorGeneralToManager, 'تقييم مدير دائرة'));
    }
    return targets;
  }
  function findTemplateFor(cycleId, evaluatee, type) {
    return s.all('templates').find(t => {
      const targets = normalizeIds(t.targetEmployeeIds || t.targetEmployeeId);
      const targetMatches = !targets.length || targets.includes(Number(evaluatee.id));
      const scopeMatches = !t.departmentJobTitleId || t.departmentJobTitleId == evaluatee.departmentJobTitleId || t.jobTitleId == evaluatee.jobTitleId;
      const jobMatches = !t.jobTitleId || t.jobTitleId == evaluatee.jobTitleId;
      return t.cycleId == cycleId && t.type === type && targetMatches && scopeMatches && jobMatches;
    });
  }
  function startEvaluation(user, cycleId, evaluateeId, type) {
    const target = availableTargets(user, cycleId).find(t => t.evaluatee.id == evaluateeId && t.type === type);
    if (!target) throw new Error('لا يوجد نموذج متاح لهذا التقييم أو لا تملك صلاحية الوصول إليه');
    const items = s.all('templateItems').filter(i => i.evaluationTemplateId == target.template.id);
    return { cycle: s.findById('cycles', cycleId), template: target.template, items, evaluatee: target.evaluatee, type };
  }
  function submitEvaluation(user, data) {
    const started = startEvaluation(user, data.cycleId, data.evaluateeId, data.type);
    const existing = s.all('evaluations').find(e => !e.isDeleted && e.cycleId == data.cycleId && e.evaluatorId == user.id && e.evaluateeId == data.evaluateeId && e.type == data.type);
    if (existing) throw new Error('تم إرسال هذا التقييم سابقًا');
    const scores = calculateEvaluationScore(started.template, started.items, data.scores || {});
    const evalRow = s.insert('evaluations', { isDeleted: false, cycleId: Number(data.cycleId), evaluatorId: Number(user.id), evaluateeId: Number(data.evaluateeId), type: data.type, status: EvaluationStatus.Processed, tasksScore: scores.tasksScore, behaviorsScore: scores.behaviorsScore, totalScore: scores.totalScore, strengths: data.strengths || '', weakness: data.weakness || '', weaknesses: data.weaknesses || '', notes: data.notes || '', recommendations: data.recommendations || '', hasAppeal: false, appealReason: null, appealDate: null, createdAt: new Date().toISOString(), submittedAt: new Date().toISOString() });
    for (const item of started.items) s.insert('evaluationScores', { evaluationId: evalRow.id, templateItemId: item.id, score: Number(data.scores?.[item.id] || 0), weightedScore: round2(Number(data.scores?.[item.id] || 0) * Number(item.weight) / 100) });
    s.log(user, 'SubmitEvaluation', `إرسال تقييم إلى ${started.evaluatee.fullName}`, 'Evaluation', evalRow.id, evalRow);
    return evalRow;
  }
  function resultForEmployee(requester, cycleId, employeeId) {
    const isOwner = Number(requester.id) === Number(employeeId);
    const canManage = [UserRole.Admin, UserRole.CentralEvaluationManager, UserRole.EntityEvaluationManager].includes(requester.role);
    const adjustment = s.all('resultAdjustments').find(r => r.cycleId == cycleId && r.employeeId == employeeId);
    if (isOwner && (!adjustment || adjustment.resultStatus !== EvaluationStatus.Approved)) return { visible: false, reason: 'النتيجة لا تظهر قبل اعتماد مسؤول التقييم المركزي' };
    if (!isOwner && !canManage) throw new Error('لا تملك صلاحية عرض هذه النتيجة');
    const evals = s.all('evaluations').filter(e => !e.isDeleted && e.cycleId == cycleId && e.evaluateeId == employeeId && [EvaluationStatus.Processed, EvaluationStatus.Approved].includes(e.status));
    const managerScore = firstScore(evals, [TemplateType.ManagerToEmployee, TemplateType.DirectorGeneralToManager, TemplateType.ManagerToProbationEmployee]);
    const selfScore = firstScore(evals, [TemplateType.EmployeeSelf, TemplateType.ManagerSelf, TemplateType.ProbationEmployeeSelf]);
    const peerScores = evals.filter(e => [TemplateType.EmployeeToEmployee, TemplateType.EmployeeToManager, TemplateType.ManagerToManager, TemplateType.ProbationEmployeeToManager].includes(e.type)).map(e => e.totalScore);
    const finalScore = adjustment?.adjustedFinalScore ?? calculateFinalResult({ managerScore, selfScore, peerScores }, s.findById('settings', 1));
    return { visible: true, employee: publicEmployee(s.findById('employees', employeeId)), evaluations: evals, managerScore, selfScore, peerAverage: peerScores.length ? round2(peerScores.reduce((a,b)=>a+b,0)/peerScores.length) : null, finalScore, adjustment };
  }
  function firstScore(evals, types) { const row = evals.find(e => types.includes(e.type)); return row ? row.totalScore : null; }
  function approveResult(user, cycleId, employeeId, data = {}) {
    assertRole(user, [UserRole.Admin, UserRole.CentralEvaluationManager]);
    const current = resultForEmployee(user, cycleId, employeeId);
    const existing = s.all('resultAdjustments').find(r => r.cycleId == cycleId && r.employeeId == employeeId);
    if (existing?.resultStatus === EvaluationStatus.Approved) throw new Error('تم اعتماد هذه النتيجة مسبقاً');
    const patch = { adjustedFinalScore: data.adjustedFinalScore !== undefined && data.adjustedFinalScore !== '' ? Number(data.adjustedFinalScore) : current.finalScore, adjustmentNotes: data.adjustmentNotes || '', strengthsHighlights: data.strengthsHighlights || '', improvementPoints: data.improvementPoints || '', resultStatus: EvaluationStatus.Approved, updatedById: user.id, updatedAt: new Date().toISOString() };
    const row = existing ? s.update('resultAdjustments', existing.id, patch) : s.insert('resultAdjustments', { cycleId: Number(cycleId), employeeId: Number(employeeId), createdAt: new Date().toISOString(), ...patch });
    s.log(user, 'ApproveResult', `اعتماد نتيجة ${current.employee.fullName}`, 'EvaluationResultAdjustment', row.id, row);
    return row;
  }
  function submitGrievance(user, cycleId, reason) {
    const result = resultForEmployee(user, cycleId, user.id);
    if (!result.visible) throw new Error(result.reason);
    const cycle = s.findById('cycles', cycleId);
    const today = new Date().toISOString().slice(0,10);
    if (cycle.grievanceStartDate && today < cycle.grievanceStartDate) throw new Error('لم تبدأ فترة التظلمات بعد');
    if (cycle.grievanceEndDate && today > cycle.grievanceEndDate) throw new Error('انتهت فترة التظلمات');
    return s.insert('grievances', { cycleId: Number(cycleId), employeeId: user.id, reason, status: GrievanceStatus.Pending, hrReply: '', attachmentPath: null, isResultAccepted: false, allowsRevision: false, createdAt: new Date().toISOString(), reviewedAt: null, reviewedById: null });
  }
  function reviewGrievance(user, grievanceId, status, reply = '', allowsRevision = false) {
    assertRole(user, [UserRole.Admin, UserRole.CentralEvaluationManager]);
    const g = s.update('grievances', grievanceId, { status, hrReply: reply, allowsRevision: !!allowsRevision, reviewedAt: new Date().toISOString(), reviewedById: user.id });
    if (status === GrievanceStatus.Accepted) {
      const adj = s.all('resultAdjustments').find(r => r.cycleId == g.cycleId && r.employeeId == g.employeeId);
      if (adj) s.update('resultAdjustments', adj.id, { resultStatus: EvaluationStatus.AppealInProgress, updatedAt: new Date().toISOString(), updatedById: user.id });
    }
    return g;
  }
  function reportRows(user, cycleId) {
    assertRole(user, [UserRole.Admin, UserRole.CentralEvaluationManager, UserRole.EntityEvaluationManager]);
    return s.all('employees').filter(e => e.role === UserRole.Employee || e.role === UserRole.DepartmentManager).map(e => resultForEmployee(user, cycleId, e.id));
  }
  function normalizeIds(value) {
    if (value === undefined || value === null || value === '') return [];
    const values = Array.isArray(value) ? value : [value];
    return values.map(Number).filter(Number.isFinite);
  }
}

module.exports = { InMemoryStore, createEvaluationService, UserRole, TemplateType, EvaluationStatus, GrievanceStatus };
