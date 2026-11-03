(() => {
    const regulationsApi = window.ARENA_CONFIG.API_BASE;

function set(id,v) {
    document.querySelector(id).textContent=v??'Not published'
}

function list(id,items,empty) {
    const el=document.querySelector(id);
    el.replaceChildren();
    if(!items.length) {
        const p=document.createElement('p');
        p.className='muted';
        p.textContent=empty;
        el.append(p);
        return
    }
    items.forEach(i=>{
        const c=document.createElement('article');
        c.className='card';
        const h=document.createElement('h3');
        h.textContent=i.name;
        const p=document.createElement('p');
        p.textContent=[i.category,i.notes].filter(Boolean).join(' · ');
        c.append(h,p);
        el.append(c)
    })
}

fetch(`${regulationsApi}/api/regulation`).then(async r=>{
    const d=await r.json();
    if(!r.ok)throw new Error(d.error);
    const x=d.regulation;
    set('#rcode',x.code);
    set('#rname',x.name);
    set('#rdesc',x.description);
    set('#rformat',x.format);
    set('#rlimit',`${x.restrictedLimit} per ${x.restrictedScope}`);
    set('#rstatus',x.status);
    set('#rend',x.endsAt?new Date(x.endsAt.replace(' ','T')+'Z').toLocaleDateString(): 'No end date');
    list('#legal',d.legalItems||[],'No legal items have been published yet.');
    list('#restricted',d.restrictedItems||[],'No restricted items have been published yet.');
    list('#banned',d.bannedItems||[],'No banned items have been published yet.')
})
.catch(()=>document.querySelector('#reg-msg').textContent='The active regulation has not been published on the website yet.');

})();