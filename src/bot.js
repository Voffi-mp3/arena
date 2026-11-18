const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');
const database = require('./bot-database');

function cosmeticColor(equipped, fallback) {
    const value = equipped.avatar_frame?.value;
    return value && /^#[0-9a-f]{6}$/i.test(value) 
        ? parseInt(value.slice(1), 16) 
        : fallback;
}

function startBot() {
    if (!process.env.DISCORD_BOT_TOKEN) return null;
    const client = new Client({ 
        intents: [
            GatewayIntentBits.Guilds, 
            GatewayIntentBits.GuildMembers
        ] 
    });
    
    const roleEmojis = [
        {
            roleId:'1571822840658001960',
            emoji:'<:PeachYeep:1571297882978525344>'
        },
        {
            roleId:'1571822880453431336',
            emoji:'<:PurpleYeep:1571297860736000161>'
        },
        {
            roleId:'1571822908299542608',
            emoji:'<:BlueYeep:1571297876535939143>'
        }
    ];

    const roleColors = {
        '1571822840658001960':0xf2c4af,
        '1571822880453431336':0xcea3d3,
        '1571822908299542608':0xa5afd6
    };

    const defaultYeep = '<:Yeep:1571297852515295262>';

    const getYeep = member => roleEmojis.find(r => member?.roles.cache.has(r.roleId))?.emoji || defaultYeep;
    const baseColor = member => roleColors[roleEmojis.find(r => member?.roles.cache.has(r.roleId))?.roleId] || 0x97acb4;
    const canAdmin = id => { 
        const user = database.getWebsiteUser(id); 
        return user?.status === 'active' && ['owner','admin'].includes(user.role); 
    };

    client.once('ready', c => {
        console.log(`Discord bot online as ${c.user.tag}`); 
        c.user.setPresence({
            activities:[
                {
                    name:'Yeeps PvP',
                    type:ActivityType.Playing
                }
            ],
            status:'online'
        }); 
    });

    client.on('interactionCreate', async interaction => {
        try {
            if (interaction.isAutocomplete()) {
                if (interaction.options.getFocused(true).name !== 'cosmetic') return interaction.respond([]);
                const q = String(interaction.options.getFocused() || '').toLowerCase();
                const list = interaction.commandName === 'equip' 
                    ? database.getOwnedCosmetics(interaction.user.id) 
                    : database.getStoreCosmetics();
                return interaction.respond(list.filter(
                    c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
                ).slice(0,25).map(c => ({
                    name:`${c.name}${c.price != null ? ` (${c.price} Tokens)` : ''}`,value:c.code
                })));
            }
            if (!interaction.isChatInputCommand()) return;
            const member = interaction.member;
            const fallbackColor = baseColor(member);

            if (interaction.commandName === 'ping') return interaction.reply({
                content:`Online • ${client.ws.ping} ms`,ephemeral:true
            });

            if (interaction.commandName === 'tokens') {
                const user = interaction.options.getUser('player') || interaction.user;
                const tokens = database.getTokens(user.id);
                if (!tokens) return interaction.reply({
                    content:`${defaultYeep} ${user} has not joined the website yet.`,
                    ephemeral:true
                });

                return interaction.reply({
                    embeds:[
                        new EmbedBuilder()
                            .setColor(fallbackColor)
                            .setTitle(`${tokens.user.displayName}'s Tokens`)
                            .addFields({name:'Balance',value:`**${tokens.balance}**`,
                                inline:true
                            },
                            {
                                name:'Lifetime earned',
                                value:`**${tokens.lifetimeEarned}**`,
                                inline:true
                            },
                            {
                                name:'Lifetime spent',
                                value:`**${tokens.lifetimeSpent}**`,
                                inline:true
                            }
                        )
                    ],    
                    ephemeral:user.id===interaction.user.id
                });
            }
            if (interaction.commandName === 'claim') {
                try { 
                    const r = database.claimCode(
                        interaction.user.id, 
                        interaction.options.getString('code',true)
                    ); 
                    return interaction.reply({
                        embeds:[
                            new EmbedBuilder()
                                .setColor(0x48d597)
                                .setTitle('Quest reward claimed')
                                .setDescription(`You received **${r.amount} Tokens**.`)
                                .addFields(
                                    {
                                        name:'Reward',
                                        value:r.description
                                    },
                                    {
                                        name:'Balance',
                                        value:`${r.balance} Tokens`
                                    }
                                )
                            ]
                            ,ephemeral:true
                        }); 
                    }
                catch (e) { 
                    const m={
                        INVALID_CODE:'Enter a valid six-character code.',
                        USER_NOT_FOUND:'Sign in to the website first.',
                        USER_INACTIVE:'Your account is inactive.',
                        CODE_NOT_FOUND:'That code is invalid.',
                        CODE_EXPIRED:'That code expired.',
                        CODE_FULLY_USED:'That code has no uses remaining.',
                        ALREADY_CLAIMED:'You already claimed this code.',
                        CLAIM_SECRET_MISSING:'Claim codes are not configured.'
                    }; 
                    return interaction.reply(
                        {content:m[e.message]||'The code could not be claimed.',
                            ephemeral:true
                        }); 
                    }
                }
            if (interaction.commandName === 'store') {
                const sub = interaction.options.getSubcommand();
                if (sub === 'browse') {
                    const tokens=database.getTokens(interaction.user.id); 
                    if(!tokens)return interaction.reply({
                        content:'Sign in to the website first.',
                        ephemeral:true
                    });

                    const lines=database.getStoreCosmetics().map(c=>`**${c.name}** \`${c.code}\`\n${c.description}\n${c.cosmeticType.replace('_',' ')} • **${c.price} Tokens**`);
                    return interaction.reply({
                        embeds:[
                            new EmbedBuilder()
                                .setColor(fallbackColor)
                                .setTitle('Yeeps Arena Store')
                                .setDescription(lines.join('\n\n')||'Store empty.')
                                .setFooter(
                                    {
                                        text:`Balance: ${tokens.balance} Tokens`
                                    }
                                )
                        ]
                        ,ephemeral:true
                    });
                }
                if (sub === 'preview') {
                    const c=database.getCosmeticByCode(interaction.options.getString('cosmetic',true));
                    if(!c)return interaction.reply({
                        content:'Cosmetic unavailable.',
                        ephemeral:true
                    });
                    const color=c.cosmeticType==='avatar_frame'&&/^#[0-9a-f]{6}$/i.test(c.value)?parseInt(c.value.slice(1),16):fallbackColor;
                    const preview=c.cosmeticType==='title_prefix'
                        ?`${c.value} Voffi`
                        :c.cosmeticType==='title_suffix'
                        ?`Voffi ${c.value}`
                        :`Avatar ring color: ${c.value}`;
                    return interaction.reply({
                        embeds:[
                            new EmbedBuilder()
                                .setColor(color)
                                .setTitle(`Preview: ${c.name}`)
                                .setDescription(c.description)
                                .addFields(
                                    {
                                        name:'Price',
                                        value:`${c.price} Tokens`,
                                        inline:true
                                    },
                                    {
                                        name:'Preview',
                                        value:preview
                                    }
                                )
                        ],
                        ephemeral:true
                    });
                }
                if (sub === 'owned') {
                    const list=database.getOwnedCosmetics(interaction.user.id);
                     return interaction.reply({
                        embeds:[
                            new EmbedBuilder()
                                .setColor(fallbackColor)
                                .setTitle('Your Cosmetics')
                                .setDescription(list.length?list.map(c=>`**${c.name}** \`${c.code}\`${c.equipped?' • **Equipped**':''}`).join('\n'):'You own no cosmetics.')
                        ],
                        ephemeral:true
                    });
                }
                try {
                    const r=database.purchaseCosmetic(interaction.user.id,interaction.options.getString('cosmetic',true)); 
                    return interaction.reply({
                        content:`Bought **${r.cosmetic.name}**. Balance: **${r.balance} Tokens**.`,
                        ephemeral:true
                    }); 
                }
                catch(e){
                    const m={
                        USER_NOT_FOUND:'Sign in first.',
                        USER_INACTIVE:'Your account is inactive.',
                        COSMETIC_NOT_FOUND:'Cosmetic unavailable.',
                        ALREADY_OWNED:'You already own that cosmetic.',
                        INSUFFICIENT_TOKENS:`You need ${e.required} Tokens but have ${e.available}.`
                    };
                    return interaction.reply({
                        content:m[e.message]||'Purchase failed.',
                        ephemeral:true
                    });
                }
            }
            if (interaction.commandName === 'equip') {
                if (interaction.options.getSubcommand()==='clear') { 
                    try{
                        database.clearCosmeticSlot(interaction.user.id,interaction.options.getString(
                            'slot',
                            true
                        ));
                        return interaction.reply({
                            content:'Cosmetic slot cleared.',
                            ephemeral:true
                        });
                    }catch{
                        return interaction.reply({
                            content:'Could not clear that slot.',
                            ephemeral:true
                        });
                    } 
                }
                try{
                    const c=database.equipCosmetic(interaction.user.id,interaction.options.getString('cosmetic',true));
                    return interaction.reply({
                        content:`Equipped **${c.name}**.`,
                        ephemeral:true
                    });
                }catch(e){
                    const m={
                        USER_NOT_FOUND:'Sign in first.',
                        COSMETIC_NOT_FOUND:'Cosmetic not found.',
                        NOT_OWNED:'You do not own that cosmetic.'
                    };
                    return interaction.reply({
                        content:m[e.message]||'Could not equip.',
                        ephemeral:true
                    });
                }
            }
            if (interaction.commandName === 'tokens-admin') {
                if (!canAdmin(interaction.user.id)) return interaction.reply({
                    content:'Owner or administrator permission required.',
                    ephemeral:true
                });
                const sub=interaction.options.getSubcommand();
                if(sub==='give'){
                    const p=interaction.options.getUser(
                        'player',
                        true
                    ),
                    a=interaction.options.getInteger(
                        'amount',
                        true
                    ),
                    reason=interaction.options.getString(
                        'reason',
                        true
                    );
                    const r=database.giveTokens({
                        recipientDiscordId:p.id,
                        amount:a,
                        description:reason,
                        createdByDiscordId:interaction.user.id
                    });
                    return interaction.reply({
                        content:`Gave **${a} Tokens** to ${p}. New balance: **${r.balance}**.`,
                        ephemeral:true
                    });
                }
                if(sub==='give-all'){
                    const r=database.giveTokensToAll({
                        amount:interaction.options.getInteger(
                            'amount',
                            true
                        ),
                        description:interaction.options.getString(
                            'reason',
                            true
                        ),
                        referenceKey:interaction.options.getString(
                            'reference',
                            true
                        ),
                        createdByDiscordId:interaction.user.id
                    });
                    return interaction.reply({
                        content:`Rewarded **${r.rewarded}** players. Skipped **${r.skipped}** duplicates.`,
                        ephemeral:true
                    });
                }
                const r=database.createClaimCode({
                    amount:interaction.options.getInteger(
                        'amount',
                        true
                    ),
                    maxUses:interaction.options.getInteger(
                        'uses',
                        true
                    ),
                    expiresHours:interaction.options.getInteger(
                        'expires-hours',
                        true
                    ),
                    description:interaction.options.getString(
                        'description',
                        true
                    ),
                    createdByDiscordId:interaction.user.id
                });
                return interaction.reply({
                    content:`Code: \`${r.code}\`\nReward: **${r.amount} Tokens**\nUses: **${r.maxUses}**\nExpires in **${r.expiresHours} hours**.`,
                    ephemeral:true
                });
            }

            const season=database.getActiveSeason(); 
            if(!season)return interaction.reply({
                content:'No active season.',
                ephemeral:true
            });

            if(interaction.commandName==='profile'||interaction.commandName==='rank'){
                const user=interaction.options.getUser('player')||interaction.user;
                const p=database.getProfile(user.id,season.id);
                if(!p)return interaction.reply({
                    content:`${defaultYeep} ${user} has not joined the website yet.`,
                    ephemeral:true
                });
                const equipped=database.getEquippedCosmetics(user.id),
                    display=database.formatCosmeticName(p.displayName,equipped),
                    color=cosmeticColor(equipped,fallbackColor),
                    tokens=database.getTokens(user.id);
                const wins=p.wins||0,losses=p.losses||0,matches=p.matchesPlayed||0;
                if(interaction.commandName==='rank'){
                    const rank=database.getRankings(season.id,1000).findIndex(x=>x.discordId===user.id);
                    return interaction.reply({
                        embeds:[
                            new EmbedBuilder()
                                .setColor(color)
                                .setAuthor(
                                    {
                                        name:`${display} • ${rank>=0?`#${rank+1}`:'Unranked'} • ${p.rating||1000}`,
                                        iconURL:user.displayAvatarURL({size:128})
                                    }
                                )
                                .setDescription(`**Rating:** ${p.rating||1000} • **Tokens:** ${tokens?.balance||0}`)
                        ]
                    });
                }
                return interaction.reply({
                    embeds:[
                        new EmbedBuilder()
                            .setColor(color)
                            .setTitle(display)
                            .setThumbnail(user.displayAvatarURL({size:128}))
                            .addFields(
                                {
                                    name:'Rating',
                                    value:String(p.rating||1000),
                                    inline:true
                                },
                                {
                                    name:'Record',
                                    value:`${wins}-${losses}`,
                                    inline:true
                                },
                                {
                                    name:'Matches',
                                    value:String(matches),
                                    inline:true
                                },
                                {
                                    name:'Tokens',
                                    value:String(tokens?.balance||0),
                                    inline:true
                                },
                                {
                                    name:'Role',
                                    value:p.role,
                                    inline:true
                                }
                            )
                    ]
                });
            }
            if(interaction.commandName==='rankings'){
                await interaction.deferReply();
                const players=database.getRankings(season.id,interaction.options.getInteger('amount')||10);
                const lines=players.map((p,i)=>{
                    const eq=database.getEquippedCosmetics(p.discordId),
                    name=database.formatCosmeticName(p.displayName,eq);
                return `${['🥇','🥈','🥉'][i]||`**#${i+1}**`} <@${p.discordId}> **${name}** • **${p.rating}** • ${p.wins}-${p.losses}`;
                });
                return interaction.editReply({embeds:[new EmbedBuilder().setColor(fallbackColor).setTitle(`${season.name} Rankings`).setDescription(lines.join('\n')||'No ranked players yet.')]});
            }
            if(interaction.commandName==='cw')return interaction.reply({
                embeds:[
                    new EmbedBuilder()
                        .setColor(fallbackColor)
                        .setTitle('The Yeeps Arena')
                        .addFields(
                            {
                                name:'CW name',
                                value:'`YEEPSARENA`',
                                inline:true
                            },
                            {
                                name:'Website',
                                value:process.env.WEBSITE_URL||'Coming soon'
                            }
                        )
                ]
            });
            if(interaction.commandName==='regulation'){
                const r=database.getActiveRegulation();
                return interaction.reply({
                    embeds:[
                        new EmbedBuilder()
                            .setColor(fallbackColor)
                            .setTitle(`Regulation ${r.code}: ${r.name}`)
                            .setDescription(r.description||'No description.')
                    ]
                });
            }
            if(interaction.commandName==='guidelines')return interaction.reply({
                embeds:[
                    new EmbedBuilder()
                        .setColor(fallbackColor)
                        .setTitle('Yeeps Arena Guidelines')
                        .setDescription('1. Be respectful.\n2. Do not harass or spam.\n3. Do not impersonate staff.\n4. Follow the active regulation.\n5. Report exploits privately.')
                ]
            });
        } catch(error){
            console.error(error);
            const response={
                content:'Command failed.'
                ,ephemeral:true
            };
            if(interaction.replied||interaction.deferred)await interaction.followUp(response);
            else await interaction.reply(response);
        }
    });
    client.login(process.env.DISCORD_BOT_TOKEN).catch(console.error);
    return client;
}
module.exports={startBot};
