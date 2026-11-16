require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
    new SlashCommandBuilder().setName('cw').setDescription('Shows information about the YEEPSARENA Community World.'),
    new SlashCommandBuilder().setName('guidelines').setDescription('Shows the Yeeps Arena server guidelines.'),
    new SlashCommandBuilder().setName('regulation').setDescription('Shows the active PvP regulation.'),
    new SlashCommandBuilder()
        .setName('rankings')
        .setDescription('Shows the leaderboard.')
        .addIntegerOption(option => option.setName('amount').setDescription('Players to show').setMinValue(1).setMaxValue(10)),
    new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Shows a profile.')
        .addUserOption(option => option.setName('player').setDescription('Player to view')),
    new SlashCommandBuilder()
        .setName('compare')
        .setDescription('Compares the stats of two players.')
        .addUserOption(option => option.setName('player2').setDescription('Opponent to compare against').setRequired(true))
        .addUserOption(option => option.setName('player1').setDescription('First player (defaults to you)')),
    new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Shows a player’s current rank and rating.')
    .addUserOption(option => option.setName('player').setDescription('Player to check')),
    new SlashCommandBuilder().setName('ping').setDescription('Checks whether the bot is online.')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
    try {
        await rest.put(
            Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
            { body: commands }
        );
        console.log(`Registered ${commands.length} global commands.`);
        if (process.env.DISCORD_GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
                { body: [] }
            );
            console.log('Cleared old guild commands.');
        }
    } catch (error) {
        console.error(error);
        process.exitCode = 1;
    }
})();
