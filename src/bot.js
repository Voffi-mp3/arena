const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const database = require('./bot-database');

function startBot() {
    if (!process.env.DISCORD_BOT_TOKEN) {
        console.log('Discord bot disabled because DISCORD_BOT_TOKEN is missing.');
        return null;
    }

    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    const blue = 0x66d9ff;
    const gold = 0xffd45c;
    const purple = 0x927cff;

    client.once('ready', readyClient => {
        console.log(`Discord bot online as ${readyClient.user.tag}`);
    });

    client.on('error', error => {
        console.error('Discord client error:', error);
    });

    client.on('interactionCreate', async interaction => {
        if (!interaction.isChatInputCommand()) return;

        try {
            if (interaction.commandName === 'ping') {
                await interaction.reply({ content: `Online • ${client.ws.ping} ms`, ephemeral: true });
                return;
            }

            if (interaction.commandName === 'cw') {
                const embed = new EmbedBuilder()
                    .setColor(blue)
                    .setTitle('The Yeeps Arena')
                    .addFields(
                        { name: 'CW name', value: '`ARENA`', inline: true },
                        { name: 'Website', value: process.env.WEBSITE_URL || 'Coming soon' }
                    );
                await interaction.reply({ embeds: [embed] });
                return;
            }

            if (interaction.commandName === 'guidelines') {
                const text = [
                    '1. Be respectful to other players.',
                    '2. Do not harass, threaten, or repeatedly target someone.',
                    '3. Do not spam messages, mentions, or voice channels.',
                    '4. Do not pretend to be staff or impersonate anyone.',
                    '5. Do not use staff-only tools without permission.',
                    '6. Regulation matches must follow the active regulation.',
                    '7. Report exploits privately instead of teaching others to abuse them.',
                    "8. Follow Discord's and Yeeps' Terms of Service."
                ].join('\n\n');
                await interaction.reply({ embeds: [new EmbedBuilder().setColor(purple).setTitle('Server Guidelines').setDescription(text)] });
                return;
            }

            if (interaction.commandName === 'regulation') {
                const regulation = database.getActiveRegulation();
                if (!regulation) {
                    await interaction.reply({ content: 'No active regulation.', ephemeral: true });
                    return;
                }
                const embed = new EmbedBuilder()
                    .setColor(blue)
                    .setTitle(`Regulation ${regulation.code}: ${regulation.name}`)
                    .setDescription(regulation.description || 'No description.')
                    .addFields(
                        { name: 'Status', value: regulation.status, inline: true },
                        { name: 'Format', value: regulation.format || '1v1', inline: true },
                        { name: 'Restricted limit', value: `${regulation.restricted_limit ?? 0} per ${regulation.restricted_scope || 'loadout'}`, inline: true },
                        { name: 'Match rules', value: 'Best of three • Approved arenas only • Both players agree before starting' }
                    );
                await interaction.reply({ embeds: [embed] });
                return;
            }

            const season = database.getActiveSeason();
            if (!season) {
                await interaction.reply({ content: 'No active season.', ephemeral: true });
                return;
            }

            if (interaction.commandName === 'rankings') {
                const amount = interaction.options.getInteger('amount') || 10;
                const players = database.getRankings(season.id, amount);
                const medals = ['🥇', '🥈', '🥉'];
                const description = players.length
                    ? players.map((player, index) => `${medals[index] || `**#${index + 1}**`} <@${player.discordId}> • **${player.rating}** • ${player.wins}-${player.losses}`).join('\n')
                    : 'No ranked players yet.';
                const embed = new EmbedBuilder()
                    .setColor(gold)
                    .setTitle(`${season.name} Rankings`)
                    .setDescription(description)
                    .setFooter({ text: 'Only approved matches affect ratings.' });
                await interaction.reply({ embeds: [embed] });
                return;
            }

            if (interaction.commandName === 'profile') {
                const user = interaction.options.getUser('player') || interaction.user;
                const player = database.getProfile(user.id, season.id);
                if (!player) {
                    await interaction.reply({ content: `${user} has not joined the website yet.`, ephemeral: true });
                    return;
                }
                const wins = player.wins || 0;
                const losses = player.losses || 0;
                const matches = player.matchesPlayed || 0;
                const winRate = wins + losses ? ((wins / (wins + losses)) * 100).toFixed(1) : '0.0';
                const embed = new EmbedBuilder()
                    .setColor(purple)
                    .setTitle(player.displayName)
                    .setThumbnail(user.displayAvatarURL({ size: 128 }))
                    .addFields(
                        { name: 'Rating', value: String(player.rating || 1000), inline: true },
                        { name: 'Record', value: `${wins}-${losses}`, inline: true },
                        { name: 'Matches', value: String(matches), inline: true },
                        { name: 'Win rate', value: `${winRate}%`, inline: true },
                        { name: 'Role', value: player.role, inline: true }
                    );
                await interaction.reply({ embeds: [embed] });
                return;
            }
        } catch (error) {
            console.error(`Command ${interaction.commandName} failed:`, error);
            const response = { content: 'Command failed.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(response);
            else await interaction.reply(response);
        }
    });

    client.login(process.env.DISCORD_BOT_TOKEN).catch(error => {
        console.error('Discord bot login failed:', error);
    });

    return client;
}

module.exports = { startBot };
