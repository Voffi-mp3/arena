(() => {
    const rankingsApi =
        window.ARENA_CONFIG.API_BASE;

    let players = [];

    const body = document.querySelector("#rank-body");
    const message = document.querySelector("#rank-msg");
    const search = document.querySelector("#player-search");

    function createCell(text, className = "") {
        const cell = document.createElement("td");

        cell.textContent = String(text);
        cell.className = className;

        return cell;
    }

    function createFallbackAvatar(displayName) {
        const fallback = document.createElement("span");

        fallback.className = "fallback";
        fallback.textContent =
            displayName?.charAt(0).toUpperCase() || "?";

        return fallback;
    }

    function createPlayerCell(player) {
        const cell = document.createElement("td");
        const wrapper = document.createElement("div");

        wrapper.className = "player";

        if (
            player.avatar &&
            player.discordId
        ) {
            const image = document.createElement("img");

            image.className = "avatar";
            image.alt = "";
            image.loading = "lazy";
            image.src =
                "https://cdn.discordapp.com/avatars/" +
                `${player.discordId}/${player.avatar}.png`;

            image.addEventListener("error", () => {
                image.replaceWith(
                    createFallbackAvatar(
                        player.displayName
                    )
                );
            });

            wrapper.appendChild(image);
        } else {
            wrapper.appendChild(
                createFallbackAvatar(
                    player.displayName
                )
            );
        }

        const name = document.createElement("strong");

        name.textContent =
            player.displayName || "Unknown player";

        wrapper.appendChild(name);
        cell.appendChild(wrapper);

        return cell;
    }

    function renderPlayers(playerList) {
        body.replaceChildren();

        if (playerList.length === 0) {
            message.textContent =
                players.length === 0
                    ? "No ranked players yet."
                    : "No players match this search.";

            return;
        }

        message.textContent = "";

        for (const player of playerList) {
            const row = document.createElement("tr");

            row.appendChild(
                createCell(`#${player.rank}`)
            );

            row.appendChild(
                createPlayerCell(player)
            );

            row.appendChild(
                createCell(player.rating ?? 1000)
            );

            row.appendChild(
                createCell(player.wins ?? 0)
            );

            row.appendChild(
                createCell(player.losses ?? 0)
            );

            row.appendChild(
                createCell(player.matchesPlayed ?? 0)
            );

            row.appendChild(
                createCell(
                    `${player.winRate ?? 0}%`
                )
            );

            body.appendChild(row);
        }
    }

    function updateSummary(data) {
        const seasonElement =
            document.querySelector("#season");

        const playersElement =
            document.querySelector("#players");

        const matchesElement =
            document.querySelector("#matches");

        const highestElement =
            document.querySelector("#high");

        seasonElement.textContent =
            `${data.season.name} Rankings`;

        playersElement.textContent =
            String(players.length);

        const totalPlayerMatches = players.reduce(
            (total, player) => {
                return total +
                    Number(player.matchesPlayed || 0);
            },
            0
        );

        matchesElement.textContent =
            String(
                Math.floor(totalPlayerMatches / 2)
            );

        const ratings = players.map(player => {
            return Number(player.rating || 0);
        });

        highestElement.textContent =
            ratings.length > 0
                ? String(Math.max(...ratings))
                : "0";
    }

    async function loadLeaderboard() {
        message.textContent =
            "Loading rankings...";

        try {
            const response = await fetch(
                `${rankingsApi}/api/leaderboard`
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "The leaderboard could not be loaded."
                );
            }

            if (
                !data.season ||
                !Array.isArray(data.players)
            ) {
                throw new Error(
                    "The leaderboard response is invalid."
                );
            }

            players = data.players;

            updateSummary(data);
            renderPlayers(players);
        } catch (error) {
            console.error(
                "Leaderboard error:",
                error
            );

            message.textContent =
                error.message ||
                "The leaderboard is unavailable.";
        }
    }

    search?.addEventListener("input", () => {
        const query =
            search.value.trim().toLowerCase();

        const filteredPlayers = players.filter(
            player => {
                return (
                    player.displayName || ""
                )
                    .toLowerCase()
                    .includes(query);
            }
        );

        renderPlayers(filteredPlayers);
    });

    loadLeaderboard();
})();