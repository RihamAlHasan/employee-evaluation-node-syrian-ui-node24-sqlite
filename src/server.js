require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');
const { currentUser } = require('./middleware');
const { ensureSeeded } = require('./appContext');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: process.env.SESSION_SECRET || 'dev-secret', resave: false, saveUninitialized: false }));
app.use(currentUser);

app.use(async (req, res, next) => { await ensureSeeded(); next(); });
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/dashboard'));
app.use('/admin', require('./routes/admin'));
app.use('/evaluations', require('./routes/evaluations'));
app.use('/reports', require('./routes/reports'));
app.use('/api', require('./routes/api'));

app.use((err, req, res, next) => {
  console.error(err);
  req.session.flash = { type: 'danger', message: err.message || 'حدث خطأ غير متوقع' };
  res.redirect(req.headers.referer || '/');
});

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`Employee Evaluation Node running on http://localhost:${port}`));
}
module.exports = app;
