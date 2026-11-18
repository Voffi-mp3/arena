function getLeaderboardWithCosmetics(db) {
    const season = db.prepare(`SELECT id,name,starts_at,ends_at FROM seasons WHERE status='active' ORDER BY id DESC LIMIT 1`).get();
    if (!season) return null;
    const rows = db.prepare(`
        SELECT
            u.id,
            u.display_name AS baseDisplayName,
            u.discord_id AS discordId,
            u.avatar,
            r.rating,
            r.wins,
            r.losses,
            r.matches_played AS matchesPlayed,
            prefix.value AS titlePrefix,
            suffix.value AS titleSuffix,
            frame.value AS avatarFrame
        FROM ratings r
        JOIN users u ON u.id=r.user_id
        LEFT JOIN equipped_cosmetics ep ON ep.user_id=u.id AND ep.cosmetic_type='title_prefix'
        LEFT JOIN cosmetics prefix ON prefix.id=ep.cosmetic_id
        LEFT JOIN equipped_cosmetics es ON es.user_id=u.id AND es.cosmetic_type='title_suffix'
        LEFT JOIN cosmetics suffix ON suffix.id=es.cosmetic_id
        LEFT JOIN equipped_cosmetics ef ON ef.user_id=u.id AND ef.cosmetic_type='avatar_frame'
        LEFT JOIN cosmetics frame ON frame.id=ef.cosmetic_id
        WHERE r.season_id=? AND u.status='active'
        ORDER BY r.rating DESC,r.wins DESC,r.losses ASC,u.display_name
    `).all(season.id);
    const players = rows.map((player, index) => ({
        id: player.id,
        discordId: player.discordId,
        avatar: player.avatar,
        displayName: [player.titlePrefix, player.baseDisplayName, player.titleSuffix].filter(Boolean).join(' '),
        baseDisplayName: player.baseDisplayName,
        rating: player.rating,
        wins: player.wins,
        losses: player.losses,
        matchesPlayed: player.matchesPlayed,
        winRate: player.wins + player.losses ? Math.round(player.wins / (player.wins + player.losses) * 1000) / 10 : 0,
        rank: index + 1,
        cosmetics: { avatarFrame: player.avatarFrame ? { value: player.avatarFrame } : null }
    }));
    return { season, players };
}
module.exports = { getLeaderboardWithCosmetics };
