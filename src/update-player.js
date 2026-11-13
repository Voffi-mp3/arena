
require("dotenv").config();

const { db } = require("./database");

const discordId = "DISCORD_ID";

const newRating = 1000;
const newWins = 0;
const newLosses = 0;

const role = "admin"; // admin, owner, moderator, tester, player, remember to add the rest of the ones you make oki

try {
    if (!/^\d{17,20}$/.test(discordId)) {
        throw new Error("Invalid Discord ID.");
    }

    if (
        typeof role !== "string" ||
        !/^[a-z][a-z0-9_-]{0,31}$/i.test(role)
    ) {
        throw new Error("Invalid role.");
    }

    if (
        !Number.isFinite(newRating) ||
        !Number.isInteger(newWins) ||
        !Number.isInteger(newLosses) ||
        newWins < 0 ||
        newLosses < 0
    ) {
        throw new Error("Invalid player statistics.");
    }

    const player = db.prepare(`
        SELECT
            id,
            display_name AS displayName,
            role
        FROM users
        WHERE discord_id = ?
    `).get(discordId);

    if (!player) {
        throw new Error(
            "Player not found. The player must sign in first."
        );
    }

    const season = db.prepare(`
        SELECT id, name
        FROM seasons
        WHERE status = 'active'
        ORDER BY id DESC
        LIMIT 1
    `).get();

    const updatePlayer = db.transaction(() => {
        db.prepare(`
            UPDATE users
            SET role = ?
            WHERE id = ?
        `).run(role, player.id);

        if (!season) return null;

        db.prepare(`
            INSERT OR IGNORE INTO ratings (
                user_id,
                season_id,
                rating,
                wins,
                losses,
                matches_played
            )
            VALUES (?, ?, 1000, 0, 0, 0)
        `).run(player.id, season.id);

        db.prepare(`
            UPDATE ratings
            SET
                rating = ?,
                wins = ?,
                losses = ?,
                matches_played = ?
            WHERE user_id = ?
              AND season_id = ?
        `).run(
            newRating,
            newWins,
            newLosses,
            newWins + newLosses,
            player.id,
            season.id
        );

        return db.prepare(`
            SELECT
                users.display_name AS displayName,
                ratings.rating,
                ratings.wins,
                ratings.losses,
                ratings.matches_played AS matchesPlayed
            FROM ratings
            JOIN users ON users.id = ratings.user_id
            WHERE users.id = ?
              AND ratings.season_id = ?
        `).get(player.id, season.id);
    });

    const updated = updatePlayer();

    console.log("Player updated successfully!");

    console.log("Account role:");
    console.table([{
        username: player.displayName,
        oldRole: player.role,
        newRole: role
    }]);

    if (updated) {
        console.log("Player statistics:");
        console.table([updated]);
    } else {
        console.log("Role updated, but no active season exists.");
    }

} catch (error) {
    console.error("Update failed:", error.message);
    process.exitCode = 1;

} finally {
    db.close();
}
