(() => {
    const api = window.ARENA_CONFIG.API_BASE;
    let players = [];
    const body = document.querySelector('#rank-body');
    const message = document.querySelector('#rank-msg');
    const search = document.querySelector('#player-search');

    function fallback(name) {
        const element = document.createElement('span');
        element.className = 'fallback';
        element.textContent = name?.charAt(0).toUpperCase() || '?';
        return element;
    }

    function avatar(player) {
    const frame =
        document.createElement("span");

    frame.className =
        "profile-avatar-frame";

    const frameValue =
        player.cosmetics
            ?.avatarFrame
            ?.value || "";

    const isColorFrame =
        /^#[0-9a-f]{6}$/i.test(
            frameValue
        );

    const isImageFrame =
        /^img\/avatar-rings\/[a-z0-9._-]+\.(png|webp|gif)$/i.test(
            frameValue
        );

    if (isColorFrame) {
        frame.classList.add(
            "profile-avatar-frame-color"
        );

        frame.style.setProperty(
            "--avatar-frame-color",
            frameValue
        );
    }

    let profilePicture;

    if (
        player.avatar &&
        player.discordId
    ) {
        profilePicture =
            document.createElement("img");

        profilePicture.className =
            "avatar";

        profilePicture.alt = "";
        profilePicture.loading = "lazy";

        profilePicture.src =
            "https://cdn.discordapp.com/avatars/" +
            `${player.discordId}/` +
            `${player.avatar}.png?size=128`;

        profilePicture.addEventListener(
            "error",
            () => {
                profilePicture.replaceWith(
                    fallback(
                        player.baseDisplayName ||
                        player.displayName
                    )
                );
            }
        );
    } else {
        profilePicture = fallback(
            player.baseDisplayName ||
            player.displayName
        );
    }

    frame.appendChild(profilePicture);

    if (isImageFrame) {
        const decoration =
            document.createElement("img");

        decoration.className =
            "avatar-frame-decoration";

        decoration.alt = "";
        decoration.loading = "eager";
        decoration.src = frameValue;

        decoration.addEventListener(
            "error",
            () => {
                console.error(
                    "Avatar decoration failed to load:",
                    decoration.src
                );
            }
        );

        frame.appendChild(decoration);
    }

    return frame;
}
    function cell(value) { 
        const td = document.createElement('td'); 
        td.textContent = String(value); 
        return td; 
    }

    function playerCell(player) { 
        const td=document.createElement('td'),wrap=document.createElement('div'),name=document.createElement('strong'); 
        wrap.className='player'; 
        name.textContent=player.displayName||'Unknown player'; 
        wrap.append(avatar(player),name); 
        td.append(wrap); 
        return td; 
    }

    function render(list) {
        body.replaceChildren();
        if (!list.length) { 
            message.textContent = players.length 
                ? 'No players match this search.' 
                : 'No ranked players yet.'; 
            return;
        }

        message.textContent = '';
        list.forEach(player => { 
            const row=document.createElement('tr'); 
            row.append(cell(`#${player.rank}`),playerCell(player),cell(player.rating??1000),cell(player.wins??0),cell(player.losses??0),cell(player.matchesPlayed??0),cell(`${player.winRate??0}%`)); 
            body.append(row); 
        });
    }

    async function load() {
        try {
           const response=await fetch(`${api}/api/leaderboard`),data=await response.json();
           if(!response.ok)throw new Error(data.error||'Leaderboard unavailable.');
           players=data.players||[];
           document.querySelector('#season').textContent=`${data.season.name} Rankings`;
           document.querySelector('#players').textContent=players.length;
           document.querySelector('#matches').textContent=Math.floor(players.reduce((sum,p)=>sum+Number(p.matchesPlayed||0),0)/2);
           document.querySelector('#high').textContent=players.length?Math.max(...players.map(p=>Number(p.rating||0))):0;
           render(players);
        } catch(error) { 
            console.error(error); 
            message.textContent=error.message; 
        }
    }

    search?.addEventListener('input',()=>{
        const q=search.value.trim().toLowerCase();
        render(players.filter(p=>(p.displayName||'').toLowerCase().includes(q)||(p.baseDisplayName||'').toLowerCase().includes(q)));
    });
    load();
})();
