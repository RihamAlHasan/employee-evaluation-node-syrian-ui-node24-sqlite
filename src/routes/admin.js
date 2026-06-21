const router = require('express').Router();
const { requireAuth, requireRole, flash } = require('../middleware');
const { service } = require('../appContext');
const { UserRole, TemplateType } = require('../domain/enums');
const canAdmin = requireRole(UserRole.Admin, UserRole.CentralEvaluationManager, UserRole.EntityEvaluationManager);
router.use(requireAuth, canAdmin);
router.get('/', (req, res) => res.redirect('/admin/employees'));
router.get('/employees', (req, res) => res.render('admin/employees', { title: 'الموظفون', employees: service.employees(), lookups: service.lookups(), roles: UserRole }));
router.post('/employees', async (req, res, next) => { try { await service.createEmployee(req.session.user, req.body); flash(req,'success','تمت إضافة الموظف'); res.redirect('/admin/employees'); } catch(e){ next(e); } });
router.get('/cycles', (req, res) => res.render('admin/cycles', { title: 'الدورات', cycles: service.cycles() }));
router.post('/cycles', (req, res, next) => { try { service.createCycle(req.session.user, req.body); flash(req,'success','تم إنشاء الدورة'); res.redirect('/admin/cycles'); } catch(e){ next(e); } });
router.post('/cycles/:id/publish', (req, res, next) => { try { service.publishCycle(req.session.user, req.params.id); flash(req,'success','تم نشر الدورة'); res.redirect('/admin/cycles'); } catch(e){ next(e); } });
router.post('/cycles/:id/close', (req, res, next) => { try { service.closeCycle(req.session.user, req.params.id); flash(req,'success','تم إغلاق الدورة'); res.redirect('/admin/cycles'); } catch(e){ next(e); } });
router.get('/templates', (req, res) => res.render('admin/templates', { title: 'النماذج', templates: service.templates(), lookups: service.lookups(), cycles: service.cycles(), types: TemplateType }));
router.post('/templates', (req, res, next) => { try { const items = normalizeItems(req.body); service.createTemplate(req.session.user, { ...req.body, items }); flash(req,'success','تم إنشاء النموذج'); res.redirect('/admin/templates'); } catch(e){ next(e); } });
router.get('/logs', (req, res) => res.render('admin/logs', { title: 'سجل النشاط', logs: service.logs().reverse() }));
function normalizeItems(body) { const names = Array.isArray(body.itemName) ? body.itemName : [body.itemName].filter(Boolean); const desc = Array.isArray(body.itemDescription) ? body.itemDescription : [body.itemDescription]; const weights = Array.isArray(body.itemWeight) ? body.itemWeight : [body.itemWeight]; const kinds = Array.isArray(body.itemKind) ? body.itemKind : [body.itemKind]; return names.map((name,i)=>({ name, description: desc[i]||'', weight: weights[i]||0, isTask: kinds[i] === 'task' })).filter(i=>i.name); }
module.exports = router;
