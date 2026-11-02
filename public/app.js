async function loadAccount() {
    const login = document.querySelector("#discord-login");
    const details = document.querySelector("#account-details");
    const name = document.querySelector("#account-name");
    const avatar = document.querySelector("#account-avatar");
    const message = document.querySelector("#account-message");
    try {
        const response = await fetch("/api/me");
        if (!response.ok) {
            login.hidden = false;
            details.hidden = true;
            return;
        }
        const data = await response.json();
        const user = data.user;
        login.hidden = true;
        details.hidden = false;
        name.textContent = user.displayName;
        if (user.avatar) {
            avatar.src =
                `https://cdn.discordapp.com/avatars/` +
                `${user.discordId}/${user.avatar}.png`;
            avatar.alt =
                `${user.displayName}'s Discord avatar`;
            avatar.hidden = false;
        } else {
            avatar.hidden = true;
        }
    } catch (error) {
        console.error(error);
        message.textContent =
            "Your account could not be loaded.";
    }
}
loadAccount();