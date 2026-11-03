const API=window.ARENA_CONFIG.API_BASE;
document.querySelectorAll('[data-year]').forEach(e=>e.textContent=new Date().getFullYear());
function avatar(user) {
    const wrap=document.createElement('span');
    if(user.avatar) {
        const img=document.createElement('img');
        img.className='avatar';
        img.alt='';
        img.src=`https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png`;
        wrap.append(img)
    } else {
        wrap.className='fallback';
        wrap.textContent=(user.displayName||'?')[0].toUpperCase()
    }
    return wrap
}
async function loadAccount() {
    const login=document.querySelectorAll('[data-login]'), 
    signed=document.querySelectorAll('[data-signed]');
    try{const r=await fetch(`${API}/api/me`,{credentials:'include'});
    if(!r.ok)throw new Error('signed-out');
    const {user}=await r.json();
    login.forEach(e=>e.classList.add('hidden'));
    signed.forEach(e=>{e.classList.remove('hidden');
        e.replaceChildren(avatar(user));
        const t=document.createElement('span');
        t.textContent=`${user.displayName} · ${user.role}`;
        e.append(t)})}catch(e){signed.forEach(x=>x.classList.add('hidden'));
            login.forEach(x=>x.classList.remove('hidden'))
        }
    }
document.querySelectorAll('[data-login]').forEach(a=>a.href=`${API}/auth/discord`);
document.querySelectorAll('[data-logout]').forEach(b=>b.addEventListener('click',async()=>{
    await fetch(`${API}/auth/logout`,{
        method:'POST',credentials:'include'
    }
);
location.reload()
}));
loadAccount();
