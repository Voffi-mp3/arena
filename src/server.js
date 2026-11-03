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
const frontend=process.env.FRONTEND_URL;
if(production) app.set('trust proxy',1);
app.use(helmet({
    crossOriginResourcePolicy:{
        policy:'cross-origin'
    }
    ,contentSecurityPolicy:false
}));
app.use(cors({
    origin:frontend,credentials:true,methods:['GET','POST','OPTIONS'],allowedHeaders:['Content-Type']
}));
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
    failureRedirect:`${frontend}?login=failed
    `}
),(req,res)=>res.redirect(`${frontend}?login=success`));
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

app.use((e,_req,res,_next)=>{
    console.error(e);
    res.status(500).json({
        error:'Server error.'
    })
});

startBot();
app.listen(Number(process.env.PORT)||3000,()=>console.log(`Yeeps Arena API on port ${process.env.PORT||3000}`));
