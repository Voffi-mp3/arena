require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
    new SlashCommandBuilder().setName('cw').setDescription('Shows information about the ARENA Community World.'),
    new SlashCommandBuilder().setName('guidelines').setDescription('Shows the Yeeps Arena server guidelines.'),
    new SlashCommandBuilder().setName('regulation').setDescription('Shows the active PvP regulation.'),
    new SlashCommandBuilder()
        .setName('rankings')
        .setDescription('Shows the active-season leaderboard.')
        .addIntegerOption(option => option.setName('amount').setDescription('Players to show').setMinValue(1).setMaxValue(10)),
    new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Shows a competitive profile.')
        .addUserOption(option => option.setName('player').setDescription('Player to view')),
    new SlashCommandBuilder().setName('ping').setDescription('Checks whether the bot is online.')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

rest.put(
    Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
    { body: commands }
).then(() => {
    console.log(`Registered ${commands.length} commands.`);
}).catch(error => {
    console.error(error);
    process.exitCode = 1;
});
