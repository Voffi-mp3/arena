const {
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