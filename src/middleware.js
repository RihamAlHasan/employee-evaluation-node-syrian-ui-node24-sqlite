function currentUser(req, res, next) {
  res.locals.user = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
}
function requireAuth(req, res, next) { if (!req.session.user) return res.redirect('/login'); next(); }
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user || !roles.includes(req.session.user.role)) {
      req.session.flash = { type: 'danger', message: 'لا تملك الصلاحية المطلوبة' };
      return res.redirect('/');
    }
    next();
  };
}
function flash(req, type, message) { req.session.flash = { type, message }; }
module.exports = { currentUser, requireAuth, requireRole, flash };
