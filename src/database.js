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
`);

function hasColumn(tableName, columnName) {
    const columns = db
        .prepare(`PRAGMA table_info(${tableName})`)
        .all();

    return columns.some(column => {
        return column.name === columnName;
    });
}

function addColumnIfMissing(
    tableName,
    columnName,
    definition
) {
    if (hasColumn(tableName, columnName)) {
        return;
    }

    db.exec(
        `ALTER TABLE ${tableName} ` +
        `ADD COLUMN ${columnName} ${definition}`
    );

    console.log(
        `Added ${tableName}.${columnName}`
    );
}

addColumnIfMissing(
    "regulations",
    "format",
    "TEXT NOT NULL DEFAULT '1v1'"
);

addColumnIfMissing(
    "regulations",
    "restricted_scope",
    "TEXT NOT NULL DEFAULT 'loadout'"
);

function upsertUser(profile) {
 return db.prepare(`INSERT INTO users(discord_id,username,display_name,avatar)
 VALUES(@discordId,@username,@displayName,@avatar)
 ON CONFLICT(discord_id) DO UPDATE SET username=excluded.username,display_name=excluded.display_name,avatar=excluded.avatar,updated_at=CURRENT_TIMESTAMP
 RETURNING *`).get(profile);
}
function getUserById(id){ return db.prepare('SELECT * FROM users WHERE id=?').get(id); }
module.exports = { db, upsertUser, getUserById };
