require('dotenv').config();
const { service, ensureSeeded } = require('./appContext');
(async () => {
  const [, , command] = process.argv;
  if (command === 'seed') {
    await service.seedDemo();
    console.log('Seed completed. Demo users password: 123456');
    return;
  }
  await ensureSeeded();
  console.log('Available commands: seed');
})();
