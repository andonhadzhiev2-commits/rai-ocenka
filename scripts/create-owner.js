// Usage: node scripts/create-owner.js email@example.com "Име" 'парола-мин-10-символа'
const db = require('../src/lib/db');
const auth = require('../src/lib/auth');
const { migrate } = require('../src/migrate');
(async () => {
  const [email, name, password] = process.argv.slice(2);
  if (!email || !name || !auth.validPassword(password)) { console.error('Usage: node scripts/create-owner.js <email> <name> <password (min 10)>'); process.exit(1); }
  await migrate();
  await db.q(`INSERT INTO users(email,name,password_hash,role) VALUES ($1,$2,$3,'owner')
              ON CONFLICT (email) DO UPDATE SET role='owner', active=true, password_hash=EXCLUDED.password_hash, token_version=users.token_version+1`,
    [email.toLowerCase(), name, await auth.hash(password)]);
  console.log('Owner ready:', email);
  await db.close();
})().catch(e => { console.error(e); process.exit(1); });
