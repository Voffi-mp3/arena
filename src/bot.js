const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');
const database = require('./bot-database');

function startBot() {
    if (!process.env.DISCORD_BOT_TOKEN) {
        console.log('Discord bot disabled because DISCORD_BOT_TOKEN is missing.');
        return null;
    }

    const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
    const roleColors = {
        '1571822840658001960': 0xf2c4af,
        '1571822880453431336': 0xcea3d3,
        '1571822908299542608': 0xa5afd6
    };
    const LightSteel = 0x97acb4;

const matchedRole = roleEmojis.find(r => member?.roles.cache.has(r.roleId));
const embedColor = matchedRole ? roleColors[matchedRole.roleId] : LightSteel;

    client.once('ready', readyClient => {
        console.log(`Discord bot online as ${readyClient.user.tag}`);
        readyClient.user.setActivity({
            name: 'Compeating In',
            type: ActivityType.Custom,
            state: 'Yeeps PvP'
        });
    });

    client.on('error', error => {
        console.error('Discord client error:', error);
    });

    client.on('interactionCreate', async interaction => {
        if (!interaction.isChatInputCommand()) return;

        try {
            const roleEmojis = [
                { roleId: '1571822840658001960', emoji: '<:PeachYeep:1571297882978525344>' },
                { roleId: '1571822880453431336', emoji: '<:PurpleYeep:1571297860736000161>' },
                { roleId: '1571822908299542608', emoji: '<:BlueYeep:1571297876535939143>' }
            ];
            const defaultYeep = '<:Yeep:1571297852515295262>';
            
            const getYeepEmoji = (member) => {
                const matched = roleEmojis.find(r => member?.roles.cache.has(r.roleId));
                return matched ? matched.emoji : defaultYeep;
            };

            if (interaction.commandName === 'ping') {
                await interaction.reply({ content: `Online • ${client.ws.ping} ms`, ephemeral: true });
                return;
            }

            if (interaction.commandName === 'cw') {
                const embed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle('The Yeeps Arena')
                    .addFields(
                        { name: 'CW name', value: '`YEEPSARENA`', inline: true },
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
                await interaction.reply({ embeds: [new EmbedBuilder().setColor(purple).setTitle('Yeeps Arena Guidelines').setDescription(text)] });
                return;
            }

            if (interaction.commandName === 'regulation') {
                const regulation = database.getActiveRegulation();
                if (!regulation) {
                    await interaction.reply({ content: 'No active regulation.', ephemeral: true });
                    return;
                }
                const embed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle(`Regulation ${regulation.code}: ${regulation.name}`)
                    .setDescription(regulation.description || 'No description.')
                    .addFields(
                        { name: 'Status', value: regulation.status, inline: true },
                        { name: 'Format', value: regulation.format || '1v1', inline: true },
                        { name: 'Restricted limit', value: `${regulation.restricted_limit ?? 0} per ${regulation.restricted_scope || 'loadout'}`, inline: true },
                        { name: 'Match rules', value: 'Best of three • Both players agree before starting' }
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
                await interaction.deferReply();
            
                const amount = interaction.options.getInteger('amount') || 10;
                const players = database.getRankings(season.id, amount);
                const medals = ['🥇', '🥈', '🥉'];
            
                const userIds = players.map(p => p.discordId);
                const members = (interaction.guild && userIds.length)
                    ? await interaction.guild.members.fetch({ user: userIds }).catch(() => new Map())
                    : new Map();
            
                const description = players.length
                    ? players.map((player, index) => {
                        const yeep = getYeepEmoji(members.get(player.discordId));
                        return `${medals[index] || `**#${index + 1}**`} ${yeep} <@${player.discordId}> • <:Build:1571297875000955041> **${player.rating}** • <:Recent:1571297859402465391> ${player.wins}-${player.losses}`;
                    }).join('\n')
                    : 'No ranked players yet.';
            
                const embed = new EmbedBuilder()
                    .setColor(purple)
                    .setTitle(`${season.name} Rankings <:Hunt:1571297863676334202>`)
                    .setDescription(description)
                    .setFooter({ text: 'Only approved matches affect ratings.' });
            
                await interaction.editReply({ embeds: [embed] });
                return;
            }

            if (interaction.commandName === 'profile') {
                const user = interaction.options.getUser('player') || interaction.user;
                const player = database.getProfile(user.id, season.id);
                if (!player) {
                    await interaction.reply({ content: `<:Yeep:1571297852515295262> ${user} has not joined the website yet.`, ephemeral: true });
                    return;
                }

                const member = interaction.guild
                    ? await interaction.guild.members.fetch(user.id).catch(() => null)
                    : null;
                const yeep = getYeepEmoji(member);

                const wins = player.wins || 0;
                const losses = player.losses || 0;
                const matches = player.matchesPlayed || 0;
                const winRate = wins + losses ? ((wins / (wins + losses)) * 100).toFixed(1) : '0.0';
                const embed = new EmbedBuilder()
                    .setColor(purple)
                    .setTitle(`${yeep} ${player.displayName}`)
                    .setThumbnail(user.displayAvatarURL({ size: 128 }))
                    .addFields(
                        { name: `<:Build:1571297875000955041> Rating`, value: String(player.rating || 1000), inline: true },
                        { name: `<:Recent:1571297859402465391> Record`, value: `${wins}-${losses}`, inline: true },
                        { name: `<:FFA:1571297869779177553> Matches`, value: String(matches), inline: true },
                        { name: `<:Hunt:1571297863676334202> Win rate`, value: `${winRate}%`, inline: true },
                        { name: `<:Gear:1571297866218213549> Role`, value: player.role, inline: true }
                    );
                await interaction.reply({ embeds: [embed] });
                return;
            }

            if (interaction.commandName === 'compare') {
                const user1 = interaction.options.getUser('player1') || interaction.user;
                const user2 = interaction.options.getUser('player2');
            
                const p1 = database.getProfile(user1.id, season.id);
                const p2 = database.getProfile(user2.id, season.id);
            
                if (!p1 || !p2) {
                    await interaction.reply({ 
                        content: `${defaultYeep} Both players must be registered on the website to compare stats.`, 
                        ephemeral: true 
                    });
                    return;
                }
            
                const members = interaction.guild
                    ? await interaction.guild.members.fetch({ user: [user1.id, user2.id] }).catch(() => new Map())
                    : new Map();
            
                const yeep1 = getYeepEmoji(members.get(user1.id));
                const yeep2 = getYeepEmoji(members.get(user2.id));
            
                const embed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle(`${yeep1} ${p1.displayName}  <:Hunt:1571297863676334202>  ${yeep2} ${p2.displayName}`)
                    .addFields(
                        { name: '<:Build:1571297875000955041> Rating', value: `**${p1.rating || 1000}** vs **${p2.rating || 1000}**`, inline: true },
                        { name: '<:Recent:1571297859402465391> Record', value: `${p1.wins || 0}-${p1.losses || 0} vs ${p2.wins || 0}-${p2.losses || 0}`, inline: true }
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
