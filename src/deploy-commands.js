require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const cosmeticOption = option => option.setName('cosmetic').setDescription('Cosmetic code').setRequired(true).setAutocomplete(true);
const commands = [
    new SlashCommandBuilder().setName('cw').setDescription('Shows information about YEEPSARENA.'),
    new SlashCommandBuilder().setName('guidelines').setDescription('Shows the Yeeps Arena guidelines.'),
    new SlashCommandBuilder().setName('regulation').setDescription('Shows the active regulation.'),
    new SlashCommandBuilder().setName('rankings').setDescription('Shows the leaderboard.').addIntegerOption(o => o.setName('amount').setDescription('Players to show').setMinValue(1).setMaxValue(10)),
    new SlashCommandBuilder().setName('profile').setDescription('Shows a profile.').addUserOption(o => o.setName('player').setDescription('Player to view')),
    new SlashCommandBuilder().setName('compare').setDescription('Compares two players.').addUserOption(o => o.setName('player2').setDescription('Second player').setRequired(true)).addUserOption(o => o.setName('player1').setDescription('First player')),
    new SlashCommandBuilder().setName('rank').setDescription('Shows rank and rating.').addUserOption(o => o.setName('player').setDescription('Player to check')),
    new SlashCommandBuilder().setName('tokens').setDescription('Shows a Token balance.').addUserOption(o => o.setName('player').setDescription('Player to view')),
    new SlashCommandBuilder().setName('claim').setDescription('Redeems a six-character weekly quest code.').addStringOption(o => o.setName('code').setDescription('Six-character code').setMinLength(6).setMaxLength(6).setRequired(true)),
    new SlashCommandBuilder().setName('store').setDescription('Cosmetic store.')
        .addSubcommand(s => s.setName('browse').setDescription('Shows purchasable cosmetics.'))
        .addSubcommand(s => s.setName('preview').setDescription('Previews a cosmetic.').addStringOption(cosmeticOption))
        .addSubcommand(s => s.setName('buy').setDescription('Buys a cosmetic.').addStringOption(cosmeticOption))
        .addSubcommand(s => s.setName('owned').setDescription('Shows your cosmetics.')),
    new SlashCommandBuilder().setName('equip').setDescription('Manages equipped cosmetics.')
        .addSubcommand(s => s.setName('cosmetic').setDescription('Equips an owned cosmetic.').addStringOption(cosmeticOption))
        .addSubcommand(s => s.setName('clear').setDescription('Clears one cosmetic slot.').addStringOption(o => o.setName('slot').setDescription('Slot').setRequired(true).addChoices({name:'Avatar frame',value:'avatar_frame'},{name:'Title prefix',value:'title_prefix'},{name:'Title suffix',value:'title_suffix'}))),
    new SlashCommandBuilder().setName('tokens-admin').setDescription('Owner and administrator Token tools.')
        .addSubcommand(s => s.setName('give').setDescription('Gives Tokens to one player.').addUserOption(o => o.setName('player').setDescription('Recipient').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Tokens').setMinValue(1).setMaxValue(100000).setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason').setMaxLength(200).setRequired(true)))
        .addSubcommand(s => s.setName('give-all').setDescription('Gives Tokens to every active player.').addIntegerOption(o => o.setName('amount').setDescription('Tokens each').setMinValue(1).setMaxValue(100000).setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason').setMaxLength(200).setRequired(true)).addStringOption(o => o.setName('reference').setDescription('Unique grant ID').setMaxLength(100).setRequired(true)))
        .addSubcommand(s => s.setName('create-code').setDescription('Creates a weekly quest code.').addIntegerOption(o => o.setName('amount').setDescription('Tokens').setMinValue(1).setMaxValue(100000).setRequired(true)).addIntegerOption(o => o.setName('uses').setDescription('Maximum uses').setMinValue(1).setMaxValue(10000).setRequired(true)).addIntegerOption(o => o.setName('expires-hours').setDescription('Hours until expiration').setMinValue(1).setMaxValue(8760).setRequired(true)).addStringOption(o => o.setName('description').setDescription('Quest description').setMaxLength(200).setRequired(true))),
    new SlashCommandBuilder().setName('ping').setDescription('Checks whether the bot is online.')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
(async () => {
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commands });
    console.log(`Registered ${commands.length} global commands.`);
    if (process.env.DISCORD_GUILD_ID) await rest.put(Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID), { body: [] });
})().catch(error => { console.error(error); process.exitCode = 1; });
