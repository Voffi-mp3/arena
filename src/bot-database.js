const crypto = require('crypto');
const { db } = require('./database');

function getActiveSeason() { 
    return db.prepare("SELECT * FROM seasons WHERE status='active' ORDER BY id DESC LIMIT 1").get(); 
}

function getActiveRegulation() { 
    return db.prepare("SELECT * FROM regulations WHERE status='active' ORDER BY id DESC LIMIT 1").get(); 
}

function getWebsiteUser(discordId) { 
    return db.prepare(`SELECT id,discord_id AS discordId,display_name AS displayName,role,status FROM users WHERE discord_id=?`).get(discordId); 
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
        JOIN users u ON u.id=r.user_id 
        WHERE r.season_id=? AND u.status='active' 
        ORDER BY r.rating DESC,r.wins DESC,r.losses ASC,u.display_name ASC 
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
        LEFT JOIN ratings r ON r.user_id=u.id AND r.season_id=? 
        WHERE u.discord_id=?
    `).get(seasonId, discordId); 
}

function getArenas() { 
    return db.prepare(`
        SELECT 
            name,
            status,
            description 
        FROM arenas 
        ORDER BY CASE status WHEN 'approved' THEN 1 WHEN 'testing' THEN 2 ELSE 3 END,name
    `).all(); 
} 

function ensureTokenBalance(userId) {
    db.prepare(`INSERT OR IGNORE INTO token_balances(user_id) VALUES(?)`).run(userId);
    return db.prepare(`
        SELECT 
            balance,
            lifetime_earned AS lifetimeEarned,
            lifetime_spent AS lifetimeSpent 
        FROM token_balances 
        WHERE user_id=?
    `).get(userId);
}

function getTokens(discordId) {
    const user = getWebsiteUser(discordId);
    return user ? { 
        user, ...ensureTokenBalance(user.id) 
    } : null;
}

function getStoreCosmetics() { 
    return db.prepare(`
        SELECT 
            id,
            code,
            name,
            description,
            cosmetic_type AS cosmeticType,
            price,
            value 
        FROM cosmetics 
        WHERE active=1 
        ORDER BY sort_order,price,name
    `).all(); 
}

function getCosmeticByCode(code) {
    return db.prepare(`
        SELECT
            c.id,
            c.code,
            c.name,
            c.description,
            c.cosmetic_type AS cosmeticType,
            c.price,
            c.value,
            c.active,
            c.stock_limit AS stockLimit,
            c.available_from AS availableFrom,
            c.available_until AS availableUntil,
            c.limited_label AS limitedLabel,
            COUNT(uc.user_id) AS sold,
            CASE
                WHEN c.stock_limit IS NULL
                    THEN NULL
                ELSE MAX(
                    0,
                    c.stock_limit -
                    COUNT(uc.user_id)
                )
            END AS remaining
        FROM cosmetics c
        LEFT JOIN user_cosmetics uc
            ON uc.cosmetic_id = c.id
        WHERE c.code = ? COLLATE NOCASE
        GROUP BY c.id
    `).get(code);
}

function getCosmeticAvailability(cosmetic) {
    if (!cosmetic || cosmetic.active !== 1) {
        return {
            available: false,
            reason: "INACTIVE"
        };
    }

    const now = new Date();

    if (
        cosmetic.availableFrom &&
        now < new Date(
            `${cosmetic.availableFrom}Z`
        )
    ) {
        return {
            available: false,
            reason: "NOT_STARTED"
        };
    }

    if (
        cosmetic.availableUntil &&
        now > new Date(
            `${cosmetic.availableUntil}Z`
        )
    ) {
        return {
            available: false,
            reason: "EXPIRED"
        };
    }

    if (
        cosmetic.stockLimit !== null &&
        cosmetic.remaining <= 0
    ) {
        return {
            available: false,
            reason: "SOLD_OUT"
        };
    }

    return {
        available: true,
        reason: null
    };
}

function getOwnedCosmetics(discordId) { 
    return db.prepare(`
        SELECT 
            c.id,
            c.code,
            c.name,
            c.description,
            c.cosmetic_type AS cosmeticType,
            c.price,
            c.value,
        CASE WHEN ec.cosmetic_id=c.id THEN 1 ELSE 0 END AS equipped 
        FROM users u 
        JOIN user_cosmetics uc ON uc.user_id=u.id 
        JOIN cosmetics c ON c.id=uc.cosmetic_id 
        LEFT JOIN equipped_cosmetics ec ON ec.user_id=u.id 
            AND ec.cosmetic_type=c.cosmetic_type 
            AND ec.cosmetic_id=c.id 
        WHERE u.discord_id=? 
        ORDER BY c.cosmetic_type,c.name
    `).all(discordId); 
}

function getEquippedCosmetics(discordId) { 
    return Object.fromEntries(db.prepare(`
        SELECT 
            c.code,
            c.name,
            c.cosmetic_type AS cosmeticType,
            c.value 
        FROM users u 
        JOIN equipped_cosmetics ec ON ec.user_id=u.id 
        JOIN cosmetics c ON c.id=ec.cosmetic_id 
        WHERE u.discord_id=?
    `).all(discordId).map(c => [c.cosmeticType, c])); 
}

function formatCosmeticName(name, equipped) { 
    return [
        equipped.title_prefix?.value, 
        name, 
        equipped.title_suffix?.value
    ].filter(Boolean).join(' '); 
}

function purchaseCosmetic(discordId, code) {
    return db.transaction(() => {
        const user = getWebsiteUser(discordId);
        if (!user) throw new Error('USER_NOT_FOUND');
        if (user.status !== 'active') throw new Error('USER_INACTIVE');

        const cosmetic = getCosmeticByCode(code);
        const availability =getCosmeticAvailability(cosmetic);

        if (!availability.available) {
            throw new Error(
                availability.reason
            );
        }
        if (!cosmetic || cosmetic.active !== 1) throw new Error('COSMETIC_NOT_FOUND');

        const balance = ensureTokenBalance(user.id);
        if (db.prepare(`
            SELECT 1 
            FROM user_cosmetics 
            WHERE user_id=? AND cosmetic_id=?
            `).get(user.id, cosmetic.id)) throw new Error('ALREADY_OWNED');
        if (balance.balance < cosmetic.price) { 
            const error = new Error('INSUFFICIENT_TOKENS'); 
            error.available = balance.balance; 
            error.required = cosmetic.price; 
            throw error; 
        }

        const currentStock = db.prepare(`
            SELECT
                c.stock_limit AS stockLimit,
            COUNT(uc.user_id) AS sold
            FROM cosmetics c
            LEFT JOIN user_cosmetics uc
                ON uc.cosmetic_id = c.id
            WHERE c.id = ?
            GROUP BY c.id
        `).get(cosmetic.id);

        if (
            currentStock.stockLimit !== null &&
            currentStock.sold >=
                currentStock.stockLimit
        ) {
            throw new Error("SOLD_OUT");
        }

        db.prepare(`
            UPDATE 
                token_balances 
            SET 
                balance=balance-?,
                lifetime_spent=lifetime_spent+?,
                updated_at=CURRENT_TIMESTAMP 
            WHERE user_id=?
            `).run(cosmetic.price, cosmetic.price, user.id);

        db.prepare(`
            INSERT INTO user_cosmetics(user_id,cosmetic_id) VALUES(?,?)
            `).run(user.id, cosmetic.id);

        db.prepare(`
            INSERT INTO token_transactions(
                user_id,
                amount,
                transaction_type,
                description
                ) VALUES(?,?,'purchase',?)
            `).run(user.id, -cosmetic.price, `Purchased ${cosmetic.name}`);

        return { 
            cosmetic, balance: ensureTokenBalance(user.id).balance 
        };
    })();
}

function equipCosmetic(discordId, code) {
    return db.transaction(() => {
        const user = getWebsiteUser(discordId);
        if (!user) throw new Error('USER_NOT_FOUND');
        const cosmetic = getCosmeticByCode(code);
        if (!cosmetic) throw new Error('COSMETIC_NOT_FOUND');
        if (!db.prepare(`
            SELECT 1 
            FROM user_cosmetics 
            WHERE user_id=? AND cosmetic_id=?
            `).get(user.id, cosmetic.id)) throw new Error('NOT_OWNED');

        db.prepare(`
            INSERT INTO equipped_cosmetics(user_id,cosmetic_type,cosmetic_id) 
            VALUES(?,?,?) 
            ON CONFLICT(user_id,cosmetic_type) DO UPDATE SET 
                cosmetic_id=excluded.cosmetic_id,
                equipped_at=CURRENT_TIMESTAMP
            `).run(user.id, cosmetic.cosmeticType, cosmetic.id);

        return cosmetic;
    })();
}

function clearCosmeticSlot(discordId, slot) {
    if (![
        'avatar_frame',
        'title_prefix',
        'title_suffix'
    ].includes(slot)) throw new Error('INVALID_SLOT');

    const user = getWebsiteUser(discordId);
    if (!user) throw new Error('USER_NOT_FOUND');
    db.prepare(`DELETE FROM equipped_cosmetics WHERE user_id=? AND cosmetic_type=?`).run(user.id, slot);
}

const claimCharacters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function normalizeClaimCode(code) { 
    return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); 
}

function hashClaimCode(code) {
    if (!process.env.CLAIM_CODE_SECRET) throw new Error('CLAIM_SECRET_MISSING');
    return crypto.createHmac('sha256', process.env.CLAIM_CODE_SECRET).update(normalizeClaimCode(code)).digest('hex');
}

function generateClaimCode() { 
    let code = ''; 
    for (let i = 0; i < 6; i += 1) code += claimCharacters[crypto.randomInt(0, claimCharacters.length)];
    return code; 
}

function createClaimCode({amount, maxUses, expiresHours, description, createdByDiscordId}) {
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000) throw new Error('INVALID_AMOUNT');
    if (!Number.isSafeInteger(maxUses) || maxUses < 1 || maxUses > 10000) throw new Error('INVALID_MAX_USES');
    const creator = getWebsiteUser(createdByDiscordId);
    for (;;) {
        const code = generateClaimCode();
        try {
            db.prepare(`INSERT INTO claim_codes(code_hash,amount,max_uses,expires_at,description,created_by) VALUES(?,?,?,datetime('now','+' || ? || ' hours'),?,?)`).run(hashClaimCode(code), amount, maxUses, expiresHours, description, creator?.id ?? null);
            return { code, amount, maxUses, expiresHours };
        } catch (error) { if (error.code !== 'SQLITE_CONSTRAINT_UNIQUE') throw error; }
    }
}

function claimCode(discordId, rawCode) {
    const normalized = normalizeClaimCode(rawCode);
    if (!/^[A-Z0-9]{6}$/.test(normalized)) throw new Error('INVALID_CODE');
    return db.transaction(() => {
        const user = getWebsiteUser(discordId);
        if (!user) throw new Error('USER_NOT_FOUND');
        if (user.status !== 'active') throw new Error('USER_INACTIVE');

        const code = db.prepare(`SELECT * FROM claim_codes WHERE code_hash=?`).get(hashClaimCode(normalized));
        if (!code || code.active !== 1) throw new Error('CODE_NOT_FOUND');
        if (code.expires_at && new Date(`${code.expires_at}Z`) <= new Date()) throw new Error('CODE_EXPIRED');
        if (code.uses >= code.max_uses) throw new Error('CODE_FULLY_USED');
        if (db.prepare(`SELECT 1 FROM claim_code_uses WHERE code_id=? AND user_id=?`).get(code.id, user.id)) throw new Error('ALREADY_CLAIMED');
        ensureTokenBalance(user.id);
        db.prepare(`INSERT INTO claim_code_uses(code_id,user_id) VALUES(?,?)`).run(code.id, user.id);
        db.prepare(`UPDATE claim_codes SET uses=uses+1,active=CASE WHEN uses+1>=max_uses THEN 0 ELSE active END WHERE id=?`).run(code.id);
        db.prepare(`UPDATE token_balances SET balance=balance+?,lifetime_earned=lifetime_earned+?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?`).run(code.amount, code.amount, user.id);
        db.prepare(`INSERT INTO token_transactions(user_id,amount,transaction_type,description,reference_key) VALUES(?,?,'claim',?,?)`).run(user.id, code.amount, code.description, `claim:${code.id}`);
        return { amount: code.amount, description: code.description, balance: ensureTokenBalance(user.id).balance };
    })();
}

function giveTokens({ recipientDiscordId, amount, description, createdByDiscordId, referenceKey = null }) {
    return db.transaction(() => {
        const user = getWebsiteUser(recipientDiscordId);
        if (!user) throw new Error('USER_NOT_FOUND');
        if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000) throw new Error('INVALID_AMOUNT');
        const creator = getWebsiteUser(createdByDiscordId);
        ensureTokenBalance(user.id);
        db.prepare(`INSERT INTO token_transactions(user_id,amount,transaction_type,description,reference_key,created_by) VALUES(?,?,'admin_grant',?,?,?)`).run(user.id, amount, description, referenceKey, creator?.id ?? null);
        db.prepare(`UPDATE token_balances SET balance=balance+?,lifetime_earned=lifetime_earned+?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?`).run(amount, amount, user.id);
        return ensureTokenBalance(user.id);
    })();
}

function giveTokensToAll({ amount, description, createdByDiscordId, referenceKey }) {
    return db.transaction(() => {
        const creator = getWebsiteUser(createdByDiscordId);
        const users = db.prepare(`SELECT id FROM users WHERE status='active'`).all();
        let rewarded = 0, skipped = 0;
        for (const user of users) {
            ensureTokenBalance(user.id);
            try { 
                db.prepare(`INSERT INTO token_transactions(user_id,amount,transaction_type,description,reference_key,created_by) VALUES(?,?,'admin_grant_all',?,?,?)`).run(user.id, amount, description, referenceKey, creator?.id ?? null); 
            } catch (error) { 
                if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') { 
                    skipped += 1; continue; 
                } throw error; 
            }
            db.prepare(`UPDATE token_balances SET balance=balance+?,lifetime_earned=lifetime_earned+?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?`).run(amount, amount, user.id);
            rewarded += 1;
        }
        return { rewarded, skipped };
    })();
}

module.exports = { 
    getActiveSeason,
    getActiveRegulation,
    getRankings,
    getProfile,
    getArenas,
    getWebsiteUser,
    getTokens,
    getStoreCosmetics,
    getCosmeticByCode,
    getOwnedCosmetics,
    getEquippedCosmetics,
    formatCosmeticName,
    purchaseCosmetic,
    equipCosmetic,
    clearCosmeticSlot,
    createClaimCode,
    claimCode,
    giveTokens,
    giveTokensToAll 
};
