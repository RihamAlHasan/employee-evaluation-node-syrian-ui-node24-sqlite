const router = require('express').Router();
const { requireAuth, requireRole, flash } = require('../middleware');
const { service } = require('../appContext');
const { UserRole } = require('../domain/enums');
router.use(requireAuth);
router.get('/me', (req, res, next) => { try { const cycle = service.cycles().find(c=>c.isActive && c.isPublished) || service.cycles()[0]; const result = service.resultForEmployee(req.session.user, cycle.id, req.session.user.id); res.render('reports/me', { title: 'نتيجتي', cycle, result }); } catch(e){ next(e); } });
router.get('/', requireRole(UserRole.Admin, UserRole.CentralEvaluationManager, UserRole.EntityEvaluationManager), (req, res, next) => { try { const cycleId = req.query.cycleId || service.cycles()[0]?.id; const rows = cycleId ? service.reportRows(req.session.user, cycleId) : []; res.render('reports/index', { title: 'التقارير والاعتماد', rows, cycles: service.cycles(), cycleId }); } catch(e){ next(e); } });
router.post('/approve', requireRole(UserRole.Admin, UserRole.CentralEvaluationManager), (req, res, next) => { try { service.approveResult(req.session.user, req.body.cycleId, req.body.employeeId, req.body); flash(req,'success','تم اعتماد النتيجة'); res.redirect('/reports?cycleId=' + req.body.cycleId); } catch(e){ next(e); } });
module.exports = router;
