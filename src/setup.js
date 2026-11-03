require('dotenv').config();
const {db}=require('./database');
const tx=db.transaction(()=>{
 db.prepare(`INSERT OR IGNORE INTO seasons(id,name,status,starts_at,ends_at) VALUES(1,'Preseason','active',CURRENT_TIMESTAMP,'2026-11-30 23:59:59')`).run();
 db.prepare(`INSERT INTO regulations(code,name,description,format,restricted_limit,restricted_scope,status,starts_at,ends_at)
 VALUES('N-R','New Update, Restricted','Items from the newest update are the main focus. Older legal items may also be used.','1v1',1,'loadout','active',CURRENT_TIMESTAMP,'2026-11-30 23:59:59')
 ON CONFLICT(code) DO UPDATE SET name=excluded.name,description=excluded.description,format=excluded.format,restricted_limit=excluded.restricted_limit,restricted_scope=excluded.restricted_scope,status=excluded.status,ends_at=excluded.ends_at`).run();
 db.prepare(`INSERT OR IGNORE INTO ratings(user_id,season_id,rating,wins,losses,matches_played) SELECT id,1,1000,0,0,0 FROM users WHERE status='active'`).run();
 ['Arena 1','Arena 2'].forEach((name,i)=>db.prepare(`INSERT INTO arenas(name,status,description) VALUES(?,?,?) ON CONFLICT(name) DO NOTHING`).run(name,'testing',i?'Cover-focused 1v1 arena.':'Balanced 1v1 prototype arena.'));
});
tx();
console.log('Setup complete. Sign in once, then rerun npm run setup to create your rating.');
