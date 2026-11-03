const {
    db,
    upsertDiscordUser,
    getUserById
} = require("./database");


require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
    app.set("trust proxy", 1);
}

app.use(
    helmet({
        contentSecurityPolicy: false
    })
);

app.use(
    rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 200,
        standardHeaders: true,
        legacyHeaders: false
    })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        }
    })
);

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    try {
        const user = getUserById(id);
        done(null, user || false);
    } catch (error) {
        done(error);
    }
});

passport.use(
    new DiscordStrategy(
        {
            clientID: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
            callbackURL: process.env.DISCORD_CALLBACK_URL,
            scope: ["identify"]
        },
        (accessToken, refreshToken, profile, done) => {
            try {
                const user = upsertDiscordUser({
                    discordId: profile.id,
                    username: profile.username,
                    displayName:
                        profile.global_name ||
                        profile.displayName ||
                        profile.username,
                    avatar: profile.avatar
                });
                done(null, user);
            } catch (error) {
                done(error);
            }
        }
    )
);

app.get(
    "/auth/discord",
    passport.authenticate("discord")
);

app.get(
    "/auth/discord/callback",
    passport.authenticate("discord", {
        failureRedirect: "/?login=failed"
    }),
    (req, res) => {
        res.redirect("/?login=success");
    }
);

app.post("/auth/logout", (req, res, next) => {
    req.logout(error => {
        if (error) {
            return next(error);
        }
        req.session.destroy(() => {
            res.clearCookie("connect.sid");
            res.redirect("/");
        });
    });
});

app.get("/api/me", (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            signedIn: false
        });
    }
    res.json({
        signedIn: true,
        user: {
            id: req.user.id,
            discordId: req.user.discord_id,
            username: req.user.username,
            displayName: req.user.display_name,
            avatar: req.user.avatar,
            role: req.user.role
        }
    });
});

app.get("/api/leaderboard", (req, res) => {
    try {
        const activeSeason = db.prepare(`
            SELECT
                id,
                name,
                starts_at,
                ends_at
            FROM seasons
            WHERE status = 'active'
            ORDER BY id DESC
            LIMIT 1
        `).get();
        if (!activeSeason) {
            return res.status(404).json({
                error: "No active season was found."
            });
        }
        const players = db.prepare(`
            SELECT
                users.id,
                users.display_name AS displayName,
                users.avatar,
                users.discord_id AS discordId,
                ratings.rating,
                ratings.wins,
                ratings.losses,
                ratings.matches_played AS matchesPlayed
            FROM ratings
            JOIN users
                ON users.id = ratings.user_id
            WHERE
                ratings.season_id = ?
                AND users.status = 'active'
            ORDER BY
                ratings.rating DESC,
                ratings.wins DESC,
                ratings.losses ASC,
                users.display_name ASC
        `).all(activeSeason.id);
        const leaderboard = players.map((player, index) => {
            const completedMatches =
                player.wins + player.losses;
            const winRate = completedMatches > 0
                ? Math.round(
                    (player.wins / completedMatches) * 1000
                ) / 10
                : 0;
            return {
                rank: index + 1,
                ...player,
                winRate
            };
        });
        res.json({
            season: activeSeason,
            players: leaderboard
        });
    } catch (error) {
        console.error("Leaderboard error:", error);

        res.status(500).json({
            error: "The leaderboard could not be loaded."
        });
    }
});

app.use(
    express.static(path.join(__dirname, "..", "public"))
);

app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({
        error: "An unexpected server error occurred."
    });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, "127.0.0.1", () => {
    console.log(`Website running at http://localhost:${port}`);
});