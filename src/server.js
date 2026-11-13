require('dotenv').config();
const express=require('express');
const session=require('express-session');
const passport=require('passport');
const DiscordStrategy=require('passport-discord').Strategy;
const cors=require('cors');
const helmet=require('helmet');
const rateLimit=require('express-rate-limit');
const {db,upsertUser,getUserById}=require('./database');
const { startBot } = require('./bot');

const app=express();
const production=process.env.NODE_ENV==='production';
const frontendUrl = process.env.FRONTEND_URL;
if (!frontendUrl) {
    throw new Error(
        "FRONTEND_URL is missing."
    );
}
const frontendOrigin = new URL(frontendUrl).origin;
if(production) app.set('trust proxy',1);
app.use(helmet({
    crossOriginResourcePolicy:{
        policy:'cross-origin'
    }
    ,contentSecurityPolicy:false
}));
app.use(
    cors({
        origin: frontendOrigin,
        credentials: true,
        methods: [
            'GET',
            'POST',
            'PUT',
            'PATCH',
            'DELETE',
            'OPTIONS'
        ],
        allowedHeaders: [
            "Content-Type"
        ]
    })
);
app.use(rateLimit({
    windowMs:15*60*1000,limit:200
}));
app.use(express.json());
app.use(express.urlencoded({
    extended:false
}));
app.use(session({
    secret:process.env.SESSION_SECRET,resave:false,saveUninitialized:false,cookie:{
        httpOnly:true,secure:production,sameSite:production?'none':'lax',maxAge:7*24*60*60*1000
    }
}));
app.use(passport.initialize());
app.use(passport.session());

function requireLogin(req, res, next) {
    if (!req.isAuthenticated()) {
        return res.status(401).json({
            error: 'You must be signed in.'
        });
    }
    next();
}
function requireAdmin(req, res, next) {
    if (!req.isAuthenticated()) {
        return res.status(401).json({
            error: 'You must be signed in.'
        });
    }
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            error: 'Administrator permission required.'
        });
    }
    next();
}

passport.serializeUser((u,d)=>d(null,u.id));
passport.deserializeUser((id,d)=>{
    try{
        d(null,getUserById(id)||false)
    }
    catch(e){
        d(e)
    }
});

passport.use(new DiscordStrategy({
    clientID:process.env.DISCORD_CLIENT_ID,clientSecret:process.env.DISCORD_CLIENT_SECRET,callbackURL:process.env.DISCORD_CALLBACK_URL,scope:['identify']
}
,(_a,_r,p,d)=>{
    try{
        d(null,upsertUser({
            discordId:p.id,username:p.username,displayName:p.global_name||p.displayName||p.username,avatar:p.avatar
        }))
    }
    catch(e){
        d(e)
    }
}));

app.get('/',(_req,res)=>res.json({
    service:'Yeeps Arena API',status:'online'
}));
app.get('/health',(_req,res)=>res.json({
    ok:true
}));
app.get('/auth/discord',passport.authenticate('discord'));
app.get('/auth/discord/callback',passport.authenticate('discord',{
    failureRedirect:`${frontendUrl}?login=failed
    `}
),(req,res)=>res.redirect(`${frontendUrl}?login=success`));
app.post('/auth/logout',(req,res,next)=>req.logout(e=>e?next(e):req.session.destroy(()=>{
    res.clearCookie('connect.sid',{
        secure:production,sameSite:production?'none':'lax'
    });
    res.json({
        ok:true
    })
})));

app.get('/api/me',(req,res)=>req.user?res.json({
    signedIn:true,user:{
        id:req.user.id,discordId:req.user.discord_id,username:req.user.username,displayName:req.user.display_name,avatar:req.user.avatar,role:req.user.role
    }
}):res.status(401).json({
    signedIn:false
}));

app.get('/api/leaderboard',(_req,res)=>{
    const season=db.prepare(`SELECT id,name,starts_at,ends_at FROM seasons WHERE status='active' ORDER BY id DESC LIMIT 1`).get();
    if(!season)return res.status(404).json({
        error:'No active season was found.'
    }); 
    const rows=db.prepare(`SELECT u.id,u.display_name displayName,u.discord_id discordId,u.avatar,r.rating,r.wins,r.losses,r.matches_played matchesPlayed FROM ratings r JOIN users u ON u.id=r.user_id WHERE r.season_id=? AND u.status='active' ORDER BY r.rating DESC,r.wins DESC,r.losses ASC,u.display_name`).all(season.id); 
    res.json({
        season,players:rows.map((p,i)=>({
            ...p,rank:i+1,winRate:p.wins+p.losses?Math.round(p.wins/(p.wins+p.losses)*1000)/10:0
        }))
    });
});

app.get('/api/regulation',(_req,res)=>{
    const r=db.prepare(`SELECT id,code,name,description,format,restricted_limit restrictedLimit,restricted_scope restrictedScope,status,starts_at startsAt,ends_at endsAt FROM regulations WHERE status='active' ORDER BY id DESC LIMIT 1`).get(); 
    if(!r)return res.status(404).json({
        error:'No active regulation.'
    }); 
    const items=db.prepare(`SELECT i.name,i.category,COALESCE(ri.notes,i.notes) notes,ri.status FROM regulation_items ri JOIN items i ON i.id=ri.item_id WHERE ri.regulation_id=? ORDER BY i.name`).all(r.id); 
    const pick=s=>items.filter(i=>i.status===s).map(({
        status,...x
    })=>x); 
    res.json({
        regulation:r,legalItems:pick('legal'),restrictedItems:pick('restricted'),bannedItems:pick('banned')
    });
});

app.get('/api/arenas',(_req,res)=>res.json({
    arenas:db.prepare(`SELECT id,name,status,description FROM arenas ORDER BY name`).all()
}));

const VALID_ITEM_STATUSES = [
    'legal',
    'restricted',
    'banned'
];

function validId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

app.get('/api/regulation/:id/items', (req, res) => {
    const regulationId = validId(req.params.id);

    if (!regulationId) {
        return res.status(400).json({ error: 'Invalid regulation ID.' });
    }

    const regulation = db.prepare(
        'SELECT id FROM regulations WHERE id = ?'
    ).get(regulationId);

    if (!regulation) {
        return res.status(404).json({ error: 'Regulation not found.' });
    }

    const items = db.prepare(`
        SELECT
            i.id,
            i.name,
            i.category,
            COALESCE(ri.notes, i.notes) AS notes,
            ri.status
        FROM regulation_items ri
        JOIN items i ON i.id = ri.item_id
        WHERE ri.regulation_id = ?
        ORDER BY i.name
    `).all(regulationId);

    res.json({ items });
});

app.post(
    '/api/regulation/:id/items',
    requireAdmin,
    (req, res) => {
        const regulationId = validId(req.params.id);
        const {
            name,
            category = null,
            notes = null,
            regulationNotes = null,
            status
        } = req.body || {};

        if (!regulationId) {
            return res.status(400).json({
                error: 'Invalid regulation ID.'
            });
        }

        if (typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({
                error: 'Item name is required.'
            });
        }

        if (!VALID_ITEM_STATUSES.includes(status)) {
            return res.status(400).json({
                error: 'Invalid item status.'
            });
        }

        if (
            (category !== null && typeof category !== 'string') ||
            (notes !== null && typeof notes !== 'string') ||
            (regulationNotes !== null && typeof regulationNotes !== 'string')
        ) {
            return res.status(400).json({
                error: 'Invalid item fields.'
            });
        }

        try {
            const createItem = db.transaction(() => {
                const regulation = db.prepare(
                    'SELECT id FROM regulations WHERE id = ?'
                ).get(regulationId);

                if (!regulation) {
                    throw new Error('REGULATION_NOT_FOUND');
                }

                const result = db.prepare(`
                    INSERT INTO items (name, category, notes)
                    VALUES (?, ?, ?)
                `).run(
                    name.trim(),
                    category,
                    notes
                );

                const itemId = Number(result.lastInsertRowid);

                db.prepare(`
                    INSERT INTO regulation_items
                    (regulation_id, item_id, status, notes)
                    VALUES (?, ?, ?, ?)
                `).run(
                    regulationId,
                    itemId,
                    status,
                    regulationNotes
                );

                db.prepare(`
                    INSERT INTO regulation_item_history
                    (regulation_id, item_id, item_name,
                     old_status, new_status, new_notes, changed_by)
                    VALUES (?, ?, ?, NULL, ?, ?, ?)
                `).run(
                    regulationId,
                    itemId,
                    name.trim(),
                    status,
                    regulationNotes,
                    req.user.id
                );

                return itemId;
            });

            const itemId = createItem();

            res.status(201).json({
                success: true,
                itemId
            });
        } catch (error) {
            if (error.message === 'REGULATION_NOT_FOUND') {
                return res.status(404).json({
                    error: 'Regulation not found.'
                });
            }

            console.error('Create item failed:', error);

            res.status(500).json({
                error: 'Could not create item.'
            });
        }
    }
);

app.patch(
    '/api/regulation/:id/items/:itemId/status',
    requireAdmin,
    (req, res) => {
        const regulationId = validId(req.params.id);
        const itemId = validId(req.params.itemId);
        const { status, notes } = req.body || {};

        if (!regulationId || !itemId) {
            return res.status(400).json({
                error: 'Invalid ID.'
            });
        }

        if (!VALID_ITEM_STATUSES.includes(status)) {
            return res.status(400).json({
                error: 'Invalid item status.'
            });
        }

        if (
            Object.hasOwn(req.body, 'notes') &&
            notes !== null &&
            typeof notes !== 'string'
        ) {
            return res.status(400).json({
                error: 'Notes must be a string or null.'
            });
        }

        try {
            const updateStatus = db.transaction(() => {
                const current = db.prepare(`
                    SELECT i.name, ri.status, ri.notes
                    FROM regulation_items ri
                    JOIN items i ON i.id = ri.item_id
                    WHERE ri.regulation_id = ?
                      AND ri.item_id = ?
                `).get(regulationId, itemId);

                if (!current) {
                    throw new Error('ITEM_NOT_FOUND');
                }

                const nextNotes = Object.hasOwn(req.body, 'notes')
                    ? notes
                    : current.notes;

                db.prepare(`
                    UPDATE regulation_items
                    SET status = ?, notes = ?
                    WHERE regulation_id = ? AND item_id = ?
                `).run(
                    status,
                    nextNotes,
                    regulationId,
                    itemId
                );

                if (
                    current.status !== status ||
                    current.notes !== nextNotes
                ) {
                    db.prepare(`
                        INSERT INTO regulation_item_history
                        (regulation_id, item_id, item_name,
                         old_status, new_status, old_notes,
                         new_notes, changed_by)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        regulationId,
                        itemId,
                        current.name,
                        current.status,
                        status,
                        current.notes,
                        nextNotes,
                        req.user.id
                    );
                }
            });

            updateStatus();

            res.json({
                success: true,
                status
            });
        } catch (error) {
            if (error.message === 'ITEM_NOT_FOUND') {
                return res.status(404).json({
                    error: 'Item not found in this regulation.'
                });
            }

            console.error('Item status update failed:', error);

            res.status(500).json({
                error: 'Could not update item.'
            });
        }
    }
);

app.put('/api/items/:itemId', requireAdmin, (req, res) => {
    const itemId = validId(req.params.itemId);
    const { name, category = null, notes = null } = req.body || {};

    if (!itemId) {
        return res.status(400).json({ error: 'Invalid item ID.' });
    }

    if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
            error: 'Item name is required.'
        });
    }

    if (
        (category !== null && typeof category !== 'string') ||
        (notes !== null && typeof notes !== 'string')
    ) {
        return res.status(400).json({
            error: 'Invalid item fields.'
        });
    }

    const result = db.prepare(`
        UPDATE items
        SET name = ?, category = ?, notes = ?
        WHERE id = ?
    `).run(name.trim(), category, notes, itemId);

    if (!result.changes) {
        return res.status(404).json({
            error: 'Item not found.'
        });
    }

    res.json({ success: true });
});

app.delete(
    '/api/regulation/:id/items/:itemId',
    requireAdmin,
    (req, res) => {
        const regulationId = validId(req.params.id);
        const itemId = validId(req.params.itemId);
        if (!regulationId || !itemId) {
            return res.status(400).json({ error: 'Invalid ID.' });
        }
        try {
            const removeItem = db.transaction(() => {
                const current = db.prepare(`
                    SELECT i.name, ri.status, ri.notes
                    FROM regulation_items ri
                    JOIN items i ON i.id = ri.item_id
                    WHERE ri.regulation_id = ?
                      AND ri.item_id = ?
                `).get(regulationId, itemId);
                if (!current) {
                    throw new Error('ITEM_NOT_FOUND');
                }
                db.prepare(`
                    INSERT INTO regulation_item_history
                    (regulation_id, item_id, item_name,
                     old_status, new_status, old_notes,
                     new_notes, changed_by)
                    VALUES (?, ?, ?, ?, 'removed', ?, NULL, ?)
                `).run(
                    regulationId,
                    itemId,
                    current.name,
                    current.status,
                    current.notes,
                    req.user.id
                );
                db.prepare(`
                    DELETE FROM regulation_items
                    WHERE regulation_id = ? AND item_id = ?
                `).run(regulationId, itemId);
            });
            removeItem();
            res.json({ success: true });
        } catch (error) {
            if (error.message === 'ITEM_NOT_FOUND') {
                return res.status(404).json({
                    error: 'Item not found in this regulation.'
                });
            }
            console.error('Remove item failed:', error);
            res.status(500).json({
                error: 'Could not remove item.'
            });
        }
    }
);

app.use((e,_req,res,_next)=>{
    console.error(e);
    res.status(500).json({
        error:'Server error.'
    })
});

startBot();
app.listen(Number(process.env.PORT)||3000,()=>console.log(`Yeeps Arena API on port ${process.env.PORT||3000}`));
