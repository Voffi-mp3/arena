require("dotenv").config();

const { db } = require("./database");

const discordId = "ID";

const newRating = --;
const newWins = --;
const newLosses = --;

const season = db.prepare(`
    SELECT id, name
    FROM seasons
    WHERE status = 'active'
    ORDER BY id DESC
    LIMIT 1
`).get();

if (!season) {
    console.error("No active season exists.");
    process.exitCode = 1;
} else {
    const player = db.prepare(`
        SELECT
            id,
            display_name AS displayName
        FROM users
        WHERE discord_id = ?
    `).get(discordId);

    if (!player) {
        console.error(
            "Player not found. The player must sign in first."
        );

        process.exitCode = 1;
    } else {
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
        `).run(
            player.id,
            season.id
        );

        const result = db.prepare(`
            UPDATE ratings
            SET
                rating = ?,
                wins = ?,
                losses = ?,
                matches_played = ?
            WHERE
                user_id = ?
                AND season_id = ?
        `).run(
            newRating,
            newWins,
            newLosses,
            newWins + newLosses,
            player.id,
            season.id
        );

        const updated = db.prepare(`
            SELECT
                users.display_name AS displayName,
                ratings.rating,
                ratings.wins,
                ratings.losses,
                ratings.matches_played AS matchesPlayed
            FROM ratings
            JOIN users
                ON users.id = ratings.user_id
            WHERE
                ratings.user_id = ?
                AND ratings.season_id = ?
        `).get(
            player.id,
            season.id
        );

        console.log(
            result.changes === 1
                ? "Player updated successfully."
                : "No rating was changed."
        );

        console.table([updated]);
    }
}

db.close();