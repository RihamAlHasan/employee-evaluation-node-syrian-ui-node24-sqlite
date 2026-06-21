const router = require('express').Router();
const { service } = require('../appContext');
router.get('/health', (req,res)=>res.json({ ok:true, app:'employee-evaluation-node' }));
router.get('/employees', (req,res)=>res.json(service.employees()));
router.get('/cycles', (req,res)=>res.json(service.cycles()));
router.get('/templates', (req,res)=>res.json(service.templates()));
module.exports = router;
