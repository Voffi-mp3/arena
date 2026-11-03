function createCell(text, className = "") {
    const cell = document.createElement("td");
    cell.textContent = text;

    if (className) {
        cell.className = className;
    }

    return cell;
}

function createPlayerCell(player) {
    const cell = document.createElement("td");
    const wrapper = document.createElement("div");

    wrapper.className = "leaderboard-player";

    if (player.avatar) {
        const image = document.createElement("img");

        image.src =
            `https://cdn.discordapp.com/avatars/` +
            `${player.discordId}/${player.avatar}.png`;

        image.alt = "";
        image.width = 40;
        image.height = 40;
        image.loading = "lazy";

        wrapper.appendChild(image);
    }

    const name = document.createElement("strong");
    name.textContent = player.displayName;

    wrapper.appendChild(name);
    cell.appendChild(wrapper);

    return cell;
}

function getRankClass(rank) {
    if (rank === 1) {
        return "rank-first";
    }

    if (rank === 2) {
        return "rank-second";
    }

    if (rank === 3) {
        return "rank-third";
    }

    return "";
}

async function loadLeaderboard() {
    const loading = document.querySelector(
        "#leaderboard-loading"
    );

    const errorBox = document.querySelector(
        "#leaderboard-error"
    );

    const table = document.querySelector(
        "#leaderboard-table"
    );

    const body = document.querySelector(
        "#leaderboard-body"
    );

    const seasonName = document.querySelector(
        "#season-name"
    );

    try {
        const response = await fetch("/api/leaderboard");

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "The leaderboard could not be loaded."
            );
        }

        seasonName.textContent =
            `${data.season.name} Leaderboard`;

        body.replaceChildren();

        if (data.players.length === 0) {
            loading.textContent =
                "No players have joined this season yet.";

            return;
        }

        for (const player of data.players) {
            const row = document.createElement("tr");

            row.appendChild(
                createCell(
                    `#${player.rank}`,
                    getRankClass(player.rank)
                )
            );

            row.appendChild(createPlayerCell(player));

            row.appendChild(
                createCell(player.rating, "rating-value")
            );

            row.appendChild(createCell(player.wins));
            row.appendChild(createCell(player.losses));

            row.appendChild(
                createCell(player.matchesPlayed)
            );

            row.appendChild(
                createCell(`${player.winRate}%`)
            );

            body.appendChild(row);
        }

        loading.hidden = true;
        table.hidden = false;
    } catch (error) {
        console.error(error);

        loading.hidden = true;
        errorBox.hidden = false;
        errorBox.textContent = error.message;
    }
}

loadLeaderboard();