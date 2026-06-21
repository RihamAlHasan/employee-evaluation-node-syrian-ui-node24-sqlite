const router = require('express').Router();
const { requireAuth } = require('../middleware');
const { service } = require('../appContext');
router.get('/', requireAuth, (req, res) => res.render('dashboard/index', { title: 'لوحة العمل', data: service.getDashboard(req.session.user) }));
module.exports = router;
