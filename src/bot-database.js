const { db } = require('./database');

function getActiveSeason() {
    return db.prepare("SELECT * FROM seasons WHERE status = 'active' ORDER BY id DESC LIMIT 1").get();
}

function getActiveRegulation() {
    return db.prepare("SELECT * FROM regulations WHERE status = 'active' ORDER BY id DESC LIMIT 1").get();
}

function getRankings(seasonId, amount) {
    return db.prepare(`
        SELECT
            u.discord_id AS discordId,
            u.display_name AS displayName,
            r.rating,
            r.wins,
            r.losses,
            r.matches_played AS matchesPlayed
        FROM ratings r
        JOIN users u ON u.id = r.user_id
        WHERE r.season_id = ? AND u.status = 'active'
        ORDER BY r.rating DESC, r.wins DESC, r.losses ASC, u.display_name ASC
        LIMIT ?
    `).all(seasonId, amount);
}

function getProfile(discordId, seasonId) {
    return db.prepare(`
        SELECT
            u.display_name AS displayName,
            u.role,
            r.rating,
            r.wins,
            r.losses,
            r.matches_played AS matchesPlayed
        FROM users u
        LEFT JOIN ratings r ON r.user_id = u.id AND r.season_id = ?
        WHERE u.discord_id = ?
    `).get(seasonId, discordId);
}

function getArenas() {
    return db.prepare(`
        SELECT name, status, description
        FROM arenas
        ORDER BY CASE status WHEN 'approved' THEN 1 WHEN 'testing' THEN 2 ELSE 3 END, name
    `).all();
}

module.exports = {
    getActiveSeason,
    getActiveRegulation,
    getRankings,
    getProfile,
    getArenas
};
