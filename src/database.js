const Database = require("better-sqlite3");

const databasePath =
    process.env.DATABASE_PATH || "./data/league.db";

const db = new Database(databasePath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

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
        restricted_limit INTEGER,
        status TEXT NOT NULL DEFAULT 'draft',
        starts_at TEXT,
        ends_at TEXT
    );

    CREATE TABLE IF NOT EXISTS arenas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'testing',
        description TEXT
    );

    CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        winner_id INTEGER NOT NULL,
        loser_id INTEGER NOT NULL,
        winner_score INTEGER NOT NULL,
        loser_score INTEGER NOT NULL,
        regulation_id INTEGER NOT NULL,
        arena_id INTEGER NOT NULL,
        season_id INTEGER NOT NULL,
        evidence_url TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        submitted_by INTEGER NOT NULL,
        confirmed_at TEXT,
        approved_by INTEGER,
        played_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(winner_id) REFERENCES users(id),
        FOREIGN KEY(loser_id) REFERENCES users(id),
        FOREIGN KEY(regulation_id) REFERENCES regulations(id),
        FOREIGN KEY(arena_id) REFERENCES arenas(id),
        FOREIGN KEY(season_id) REFERENCES seasons(id),
        FOREIGN KEY(submitted_by) REFERENCES users(id),
        FOREIGN KEY(approved_by) REFERENCES users(id)
    );
`);

function upsertDiscordUser(profile) {
    const statement = db.prepare(`
        INSERT INTO users (
            discord_id,
            username,
            display_name,
            avatar
        )
        VALUES (
            @discordId,
            @username,
            @displayName,
            @avatar
        )
        ON CONFLICT(discord_id) DO UPDATE SET
            username = excluded.username,
            display_name = excluded.display_name,
            avatar = excluded.avatar,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *
    `);
    return statement.get(profile);
}

function getUserById(id) {
    return db
        .prepare("SELECT * FROM users WHERE id = ?")
        .get(id);
}

module.exports = {
    db,
    upsertDiscordUser,
    getUserById
};