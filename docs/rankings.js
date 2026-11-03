const API=window.ARENA_CONFIG.API_BASE;
let players=[];
const body=document.querySelector('#rank-body'),
msg=document.querySelector('#rank-msg'),
search=document.querySelector('#player-search');

function td(text,cls='') {
    const x=document.createElement('td');
    x.textContent=text;
    x.className=cls;
    return x
}

function playerCell(p) {
    const x=document.createElement('td'),
    d=document.createElement('div');
    d.className='player';
    if(p.avatar) {
        const i=document.createElement('img');
        i.className='avatar';
        i.alt='';
        i.src=`https://cdn.discordapp.com/avatars/${p.discordId}/${p.avatar}.png`;
        d.append(i)
    } else {
        const f=document.createElement('span');
        f.className='fallback';
        f.textContent=p.displayName[0];
        d.append(f)
    }
    const s=document.createElement('strong');
    s.textContent=p.displayName;
    d.append(s);
    x.append(d);
    return x
}

function render(list) {
    body.replaceChildren();
    if(!list.length) {
        msg.textContent='No players match this search.';
        return
    }
    msg.textContent='';
    list.forEach(p=>{
        const tr=document.createElement('tr');
        tr.append(td(`#${p.rank}`),
        playerCell(p),
        td(p.rating),
        td(p.wins),
        td(p.losses),
        td(p.matchesPlayed),
        td(`${p.winRate}%`));
        body.append(tr)
    })
}

fetch(`${API}/api/leaderboard`).then(async r=>{
    const d=await r.json();
    if(!r.ok)throw new Error(d.error);
    players=d.players||[];
    document.querySelector('#season').textContent=`${d.season.name} Rankings`;
    document.querySelector('#players').textContent=players.length;
    document.querySelector('#matches').textContent=Math.floor(players.reduce((a,p)=>a+p.matchesPlayed,0)/2);
    document.querySelector('#high').textContent=players.length?Math.max(...players.map(p=>p.rating)):0;render(players)
}).catch(e=>msg.textContent=e.message||'Leaderboard unavailable.');
    search?.addEventListener('input',()=>{
        const q=search.value.trim().toLowerCase();
        render(players.filter(p=>p.displayName.toLowerCase().includes(q)))
    })
