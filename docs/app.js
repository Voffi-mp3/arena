(() => {
    const apiBase =
        window.ARENA_CONFIG.API_BASE;

    document
        .querySelectorAll("[data-year]")
        .forEach(element => {
            element.textContent =
                new Date().getFullYear();
        });

    function createAvatar(user) {
        if (user.avatar && user.discordId) {
            const image =
                document.createElement("img");

            image.className = "avatar";
            image.alt = "";
            image.src =
                "https://cdn.discordapp.com/avatars/" +
                `${user.discordId}/${user.avatar}.png`;

            return image;
        }

        const fallback =
            document.createElement("span");

        fallback.className = "fallback";
        fallback.textContent =
            user.displayName
                ?.charAt(0)
                .toUpperCase() || "?";

        return fallback;
    }

    function showSignedOut() {
        document
            .querySelectorAll("[data-login]")
            .forEach(element => {
                element.classList.remove("hidden");
            });

        document
            .querySelectorAll("[data-account]")
            .forEach(element => {
                element.classList.add("hidden");
                element.replaceChildren();
            });

        document
            .querySelectorAll("[data-logout]")
            .forEach(element => {
                element.classList.add("hidden");
            });
    }

    function showSignedIn(user) {
        document
            .querySelectorAll("[data-login]")
            .forEach(element => {
                element.classList.add("hidden");
            });

        document
            .querySelectorAll("[data-account]")
            .forEach(element => {
                element.classList.remove("hidden");
                element.replaceChildren();

                const avatar = createAvatar(user);
                const label =
                    document.createElement("span");

                label.textContent =
                    `${user.displayName} · ${user.role}`;

                element.append(avatar, label);
            });

        document
            .querySelectorAll("[data-logout]")
            .forEach(element => {
                element.classList.remove("hidden");
                element.textContent = "Sign out";
            });
    }

    async function loadAccount() {
        try {
            const response = await fetch(
                `${apiBase}/api/me`,
                {
                    credentials: "include"
                }
            );

            if (!response.ok) {
                showSignedOut();
                return;
            }

            const data = await response.json();

            if (!data.signedIn || !data.user) {
                showSignedOut();
                return;
            }

            showSignedIn(data.user);
        } catch (error) {
            console.error(
                "Account request failed:",
                error
            );

            showSignedOut();
        }
    }

    document
        .querySelectorAll("[data-login]")
        .forEach(element => {
            element.href =
                `${apiBase}/auth/discord`;
        });

    document
        .querySelectorAll("[data-logout]")
        .forEach(button => {
            button.addEventListener(
                "click",
                async () => {
                    button.disabled = true;
                    button.textContent =
                        "Signing out...";

                    try {
                        await fetch(
                            `${apiBase}/auth/logout`,
                            {
                                method: "POST",
                                credentials: "include"
                            }
                        );
                    } catch (error) {
                        console.error(
                            "Sign-out failed:",
                            error
                        );
                    }

                    showSignedOut();
                    button.disabled = false;
                    button.textContent =
                        "Sign out";
                }
            );
        });

    loadAccount();
})();