const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const databasePath = path.resolve(process.env.DATABASE_PATH || './data/league.db');
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const db = new Database(databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        display_name TEXT NOT NULL,
        avatar TEXT,
        role TEXT NOT NULL DEFAULT 'player',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS seasons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'planned',
        starts_at TEXT,
        ends_at TEXT
    );
    CREATE TABLE IF NOT EXISTS ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        season_id INTEGER NOT NULL,
        rating INTEGER NOT NULL DEFAULT 1000,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        matches_played INTEGER NOT NULL DEFAULT 0,
        UNIQUE(user_id, season_id),
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(season_id) REFERENCES seasons(id)
    );
    CREATE TABLE IF NOT EXISTS regulations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        format TEXT NOT NULL DEFAULT '1v1',
        restricted_limit INTEGER,
        restricted_scope TEXT NOT NULL DEFAULT 'loadout',
        status TEXT NOT NULL DEFAULT 'draft',
        starts_at TEXT,
        ends_at TEXT
    );
    CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        category TEXT,
        notes TEXT
    );
    CREATE TABLE IF NOT EXISTS regulation_items (
        regulation_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        notes TEXT,
        PRIMARY KEY(regulation_id,item_id),
        FOREIGN KEY(regulation_id) REFERENCES regulations(id),
        FOREIGN KEY(item_id) REFERENCES items(id)
    );
    CREATE TABLE IF NOT EXISTS arenas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'testing',
        description TEXT
    );
    CREATE TABLE IF NOT EXISTS regulation_item_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        regulation_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        item_name TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT,
        old_notes TEXT,
        new_notes TEXT,
        changed_by INTEGER,
        changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS token_balances (
        user_id INTEGER PRIMARY KEY,
        balance INTEGER NOT NULL DEFAULT 0 CHECK(balance >= 0),
        lifetime_earned INTEGER NOT NULL DEFAULT 0 CHECK(lifetime_earned >= 0),
        lifetime_spent INTEGER NOT NULL DEFAULT 0 CHECK(lifetime_spent >= 0),
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS token_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        transaction_type TEXT NOT NULL,
        description TEXT NOT NULL,
        reference_key TEXT,
        created_by INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS token_transactions_reference_unique
    ON token_transactions(user_id, reference_key)
    WHERE reference_key IS NOT NULL;
    CREATE TABLE IF NOT EXISTS cosmetics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE COLLATE NOCASE,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        cosmetic_type TEXT NOT NULL CHECK(cosmetic_type IN ('avatar_frame','title_prefix','title_suffix')),
        price INTEGER NOT NULL CHECK(price >= 0),
        value TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS user_cosmetics (
        user_id INTEGER NOT NULL,
        cosmetic_id INTEGER NOT NULL,
        purchased_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(user_id, cosmetic_id),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(cosmetic_id) REFERENCES cosmetics(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS equipped_cosmetics (
        user_id INTEGER NOT NULL,
        cosmetic_type TEXT NOT NULL,
        cosmetic_id INTEGER NOT NULL,
        equipped_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(user_id, cosmetic_type),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(cosmetic_id) REFERENCES cosmetics(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS claim_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code_hash TEXT NOT NULL UNIQUE,
        amount INTEGER NOT NULL CHECK(amount > 0),
        max_uses INTEGER NOT NULL DEFAULT 1 CHECK(max_uses > 0),
        uses INTEGER NOT NULL DEFAULT 0 CHECK(uses >= 0),
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
        expires_at TEXT,
        description TEXT NOT NULL,
        created_by INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS claim_code_uses (
        code_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(code_id, user_id),
        FOREIGN KEY(code_id) REFERENCES claim_codes(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
`);

addColumnIfMissing(
    "cosmetics",
    "stock_limit",
    "INTEGER"
);

addColumnIfMissing(
    "cosmetics",
    "available_from",
    "TEXT"
);

addColumnIfMissing(
    "cosmetics",
    "available_until",
    "TEXT"
);

addColumnIfMissing(
    "cosmetics",
    "limited_label",
    "TEXT"
);

function hasColumn(tableName, columnName) {
    return db.prepare(`PRAGMA table_info(${tableName})`).all().some(column => column.name === columnName);
}

function addColumnIfMissing(tableName, columnName, definition) {
    if (!hasColumn(tableName, columnName)) db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

addColumnIfMissing('regulations', 'format', "TEXT NOT NULL DEFAULT '1v1'");
addColumnIfMissing('regulations', 'restricted_scope', "TEXT NOT NULL DEFAULT 'loadout'");

const cosmetics = [
    ['the-yeep','The Yeep','Displays "The Yeep" after your name.','title_suffix',100,'The Yeep',10],
    ['the-dueler','The Dueler','Displays "The Dueler" after your name.','title_suffix',250,'The Dueler',20],
    ['gladiator','Gladiator','Displays Galdiator before your name.','title_prefix',400,'Gladiator',30],
    ['peach-ring','Peach Avatar Ring','Adds a peach ring around your avatar.','avatar_frame',200,'#f2c4af',40],
    ['purple-ring','Purple Avatar Ring','Adds a purple ring around your avatar.','avatar_frame',200,'#cea3d3',50],
    ['blue-ring','Blue Avatar Ring','Adds a blue ring around your avatar.','avatar_frame',200,'#a5afd6',60],
    ['winter-2026','Winter 2026 Ring','Adds a animated winter ring around your avatar.','avatar_frame',1000,'img/avatar-rings/winter2026.gif',1]
];

db.prepare(`
    UPDATE cosmetics
    SET
        available_from = '2026-11-18 00:00:00',
        available_until = '2026-02-01 00:00:00',
        limited_label = 'Winter 2026 Limited',
        active = 1
    WHERE code = 'winter-2026'
`).run();

const seedCosmetic = db.prepare(`
    INSERT INTO cosmetics(
        code,
        name,
        description,
        cosmetic_type,
        price,
        value,
        sort_order
    ) 
    VALUES(?,?,?,?,?,?,?) 
    ON CONFLICT(code) DO UPDATE SET 
        name=excluded.name,
        description=excluded.description,
        cosmetic_type=excluded.cosmetic_type,
        price=excluded.price,
        value=excluded.value,
        sort_order=excluded.sort_order
    `);
db.transaction(() => cosmetics.forEach(cosmetic => seedCosmetic.run(...cosmetic)))();

function upsertUser(profile) {
    const user = db.prepare(`
        INSERT INTO users(
            discord_id,
            username,
            display_name,
            avatar
        ) 
        VALUES(
            @discordId,
            @username,
            @displayName,
            @avatar
        ) 
        ON CONFLICT(discord_id) DO UPDATE SET 
            username=excluded.username,
            display_name=excluded.display_name,
            avatar=excluded.avatar,
            updated_at=CURRENT_TIMESTAMP RETURNING *
    `).get(profile);
    db.prepare(`INSERT OR IGNORE INTO token_balances(user_id) VALUES(?)`).run(user.id);
    const season = db.prepare(`SELECT id FROM seasons WHERE status='active' ORDER BY id DESC LIMIT 1`).get();
    if (season) db.prepare(`INSERT OR IGNORE INTO ratings(user_id,season_id,rating,wins,losses,matches_played) VALUES(?,?,1000,0,0,0)`).run(user.id, season.id);
    return user;
}

function getUserById(id) {
    return db.prepare('SELECT * FROM users WHERE id=?').get(id);
}

module.exports = { db, upsertUser, getUserById };
