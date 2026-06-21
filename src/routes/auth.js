const router = require('express').Router();
const { service } = require('../appContext');
const { flash } = require('../middleware');
router.get('/login', (req, res) => res.render('auth/login', { title: 'تسجيل الدخول' }));
router.post('/login', async (req, res) => {
  const user = await service.login(req.body.identifier, req.body.password);
  if (!user) { flash(req, 'danger', 'بيانات الدخول غير صحيحة'); return res.redirect('/login'); }
  req.session.user = user; res.redirect('/');
});
router.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));
module.exports = router;
