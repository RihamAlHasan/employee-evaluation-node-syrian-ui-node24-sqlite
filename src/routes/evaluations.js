const router = require('express').Router();
const { requireAuth, flash } = require('../middleware');
const { service } = require('../appContext');
router.use(requireAuth);
router.get('/', (req, res, next) => { if (req.session.user.role === 'CentralEvaluationManager') return next(new Error('مسؤول التقييم المركزي لا يملك صفحة تقييماتي')); const cycle = service.cycles().find(c=>c.isActive && c.isPublished); const targets = cycle ? service.availableTargets(req.session.user, cycle.id) : []; res.render('evaluations/index', { title: 'تقييماتي', cycle, targets }); });
router.get('/start', (req, res, next) => { try { const data = service.startEvaluation(req.session.user, req.query.cycleId, req.query.evaluateeId, req.query.type); res.render('evaluations/form', { title: 'تعبئة التقييم', ...data }); } catch(e){ next(e); } });
router.post('/submit', (req, res, next) => { try { const scores = {}; for (const [k,v] of Object.entries(req.body)) if (k.startsWith('score_')) scores[k.replace('score_','')] = v; service.submitEvaluation(req.session.user, { ...req.body, scores }); flash(req,'success','تم إرسال التقييم وقفل النموذج'); res.redirect('/evaluations'); } catch(e){ next(e); } });
module.exports = router;
