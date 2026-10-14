require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  AttachmentBuilder,
  REST,
  Routes,
} = require('discord.js');
const http = require('http');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const GIST_ID = process.env.GIST_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const LOGO = 'https://cdn.discordapp.com/attachments/1557498332262301716/1558123583371481139/Vexora.png?ex=6ace3faa&is=6accee2a&hm=c27628f8d9c71dab36f1041308bc32a630c03fadc49bf418913598bd4944c7ea&';
const PORT = process.env.PORT || 3000;

// ===== Instellingen =====
const REVIEW_CHANNEL_ID = '1559313542509887569';
const REQUIRED_ROLE_ID = '1556357822998913094';
const PURCHASE_ROLE_ID = '1559485646991654922';
const PURCHASE_LOG_CHANNEL_ID = '1559485972440293386';
const SUGGESTIE_CHANNEL_ID = '1557502689271619726';
const VERIFY_CHANNEL_ID = '1554510752482726015';
const VERIFY_ROLE_ID = '1554510750092099690';
const PRICING_CHANNEL_ID = '1559555369209045012';
const TICKET_PANEL_CHANNEL_ID = '1559557702915588238';
const TICKET_SUPPORT_ROLE_ID = '1554510750092099688';
const TICKET_TRANSCRIPT_CHANNEL_ID = '1554510754852511845';
const LEGIT_CHANNEL_ID = '1559585421489344513';
const VOTE_LOG_CHANNEL_ID = '1559588394336653332';
const PRODUCT = 'Vexora External + Bypass';
const STATUS_INTERVAL = 8000;

const TICKET_CATEGORIES = {
  support: { naam: 'Support', prefix: 'support', categoryId: '1559570734664122488', emoji: '🎫', kleur: 0x3498db },
  purchase: { naam: 'Purchase', prefix: 'purchase', categoryId: '1559570790398042133', emoji: '🛒', kleur: 0x00ff88 },
  bug: { naam: 'Bug', prefix: 'bug', categoryId: '1559570848279429290', emoji: '⚠️', kleur: 0xff4444 },
};

// ===== HTTP server + keep-alive =====
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('ok');
}).listen(PORT);

const SELF_URL = process.env.RENDER_EXTERNAL_URL;
if (SELF_URL) {
  setInterval(() => fetch(SELF_URL).catch(() => {}), 12 * 60 * 1000);
  console.log(`Keep-alive self-ping gestart voor ${SELF_URL}`);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  presence: { status: 'online', activities: [{ name: 'Vexora.cc', type: 3 }] },
});
const reviews = new Map();

// ===== Plans =====
const PLANS = {
  '1 week': 8.5 * 24 * 60 * 60 * 1000,
  '1 maand': 30.5 * 24 * 60 * 60 * 1000,
  'lifetime': null,
};

function planDuurMs(plan) { return PLANS[plan]; }

function formatDuur(ms) {
  if (ms === null) return 'Lifetime';
  const dagen = Math.floor(ms / (24 * 60 * 60 * 1000));
  const uren = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (dagen > 0 && uren > 0) return `${dagen}d ${uren}u`;
  if (dagen > 0) return `${dagen}d`;
  return `${uren}u`;
}

function formatResterend(eindTijd) {
  if (eindTijd === null) return 'Lifetime';
  const over = eindTijd - Date.now();
  if (over <= 0) return 'Verlopen';
  const dagen = Math.floor(over / (24 * 60 * 60 * 1000));
  const uren = Math.floor((over % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minuten = Math.floor((over % (60 * 60 * 1000)) / (60 * 1000));
  if (dagen > 0) return `${dagen}d ${uren}u`;
  if (uren > 0) return `${uren}u ${minuten}m`;
  return `${minuten}m`;
}

// ===== Giveaway tijd parsen =====
function parseGiveawayTime(input) {
  const match = String(input).trim().toLowerCase().match(/^(\d+)\s*(s|m|h|d|w)$/);
  if (!match) return null;
  const n = parseInt(match[1]);
  const unit = match[2];
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };
  return n * multipliers[unit];
}

function formatGiveawayDuur(ms) {
  if (ms >= 7 * 24 * 60 * 60 * 1000) return `${Math.round(ms / (7*24*60*60*1000))}w`;
  if (ms >= 24 * 60 * 60 * 1000) return `${Math.round(ms / (24*60*60*1000))}d`;
  if (ms >= 60 * 60 * 1000) return `${Math.round(ms / (60*60*1000))}h`;
  if (ms >= 60 * 1000) return `${Math.round(ms / (60*1000))}m`;
  return `${Math.round(ms / 1000)}s`;
}

// ===== Commands =====
const commands = [
  {
    name: 'review',
    description: 'Schrijf een review voor Vexora External + Bypass',
    options: [{ name: 'extra', description: 'Vertel kort je ervaring', type: 3, required: true }],
  },
  {
    name: 'purchase',
    description: 'Ken een tijdelijke rol toe aan een gebruiker',
    options: [
      { name: 'user', description: 'De gebruiker', type: 6, required: true },
      {
        name: 'plan', description: 'Welk plan', type: 3, required: true,
        choices: [
          { name: '1 week', value: '1 week' },
          { name: '1 maand', value: '1 maand' },
          { name: 'Lifetime', value: 'lifetime' },
        ],
      },
      { name: 'key', description: 'De key/licentie voor de klant', type: 3, required: true },
    ],
  },
  {
    name: 'removelicense',
    description: 'Verwijder de actieve licentie van een gebruiker',
    options: [{ name: 'user', description: 'De gebruiker', type: 6, required: true }],
  },
  {
    name: 'suggestie',
    description: 'Plaats een suggestie',
    options: [{ name: 'tekst', description: 'Wat is je suggestie?', type: 3, required: true }],
  },
  { name: 'refresh', description: 'Plaats het overzicht opnieuw' },
  {
    name: 'removekruis',
    description: 'Verwijder een aantal kruisjes (❌) van de legit poll',
    options: [{ name: 'aantal', description: 'Hoeveel kruisjes wil je verwijderen?', type: 4, required: true, min_value: 1 }],
  },
  {
    name: 'giveaway',
    description: 'Start een giveaway',
    options: [
      { name: 'winners', description: 'Aantal winnaars', type: 4, required: true, min_value: 1, max_value: 50 },
      { name: 'item', description: 'Wat is de prijs?', type: 3, required: true },
      { name: 'time', description: 'Duur (bijv. 30s, 5m, 1h, 1d, 1w)', type: 3, required: true },
    ],
  },
];

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('commands geladen');
  } catch (e) { console.error(e); }
})();

// ===== Gist storage =====
async function leesGist() {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`Gist read faalde: ${res.status}`);
  const data = await res.json();
  const parsed = JSON.parse(data.files['reviews.json'].content);
  return {
    counter: parsed.counter || 0,
    purchases: parsed.purchases || [],
    suggestions: parsed.suggestions || {},
    tickets: parsed.tickets || {},
    overzichtMessageId: parsed.overzichtMessageId || null,
    legitVotes: parsed.legitVotes || { approve: [], reject: [] },
    legitMessageId: parsed.legitMessageId || null,
    giveaways: parsed.giveaways || {},
  };
}

async function schrijfGist(data) {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ files: { 'reviews.json': { content: JSON.stringify(data, null, 2) } } }),
  });
  if (!res.ok) throw new Error(`Gist write faalde: ${res.status}`);
}

async function leesCounter() { const d = await leesGist(); return d.counter; }
async function schrijfCounter(n) { const d = await leesGist(); d.counter = n; await schrijfGist(d); }

// ===== Purchase =====
async function getPurchases() { const d = await leesGist(); return d.purchases; }
async function savePurchases(p) { const d = await leesGist(); d.purchases = p; await schrijfGist(d); }

async function addPurchase(userId, plan, key) {
  const purchases = await getPurchases();
  const duur = planDuurMs(plan);
  const eindTijd = duur === null ? null : Date.now() + duur;
  const filtered = purchases.filter(p => p.userId !== userId);
  filtered.push({ userId, plan, key, eindTijd, gestart: Date.now() });
  await savePurchases(filtered);
  return { eindTijd, duur };
}

async function removePurchase(userId) {
  const purchases = await getPurchases();
  const filtered = purchases.filter(p => p.userId !== userId);
  await savePurchases(filtered);
  return purchases.find(p => p.userId === userId);
}

// ===== Suggestie =====
async function getSuggestions() { const d = await leesGist(); return d.suggestions; }
async function saveSuggestions(s) { const d = await leesGist(); d.suggestions = s; await schrijfGist(d); }

function buildSuggestieEmbed(s) {
  return new EmbedBuilder()
    .setTitle('Nieuwe Suggestie')
    .setColor(0x5865f2)
    .setThumbnail(LOGO)
    .setDescription(s.tekst)
    .addFields(
      { name: 'Door', value: `<@${s.auteurId}>`, inline: true },
      { name: 'Stemmen', value: `✅ ${s.approve.length}  •  ❌ ${s.reject.length}`, inline: true }
    )
    .setFooter({ text: 'Vexora.cc', iconURL: LOGO })
    .setTimestamp(s.gestart);
}

function buildSuggestieRow(messageId, s) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`suggest_approve_${messageId}`).setLabel(`✅ ${s.approve.length}`).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`suggest_reject_${messageId}`).setLabel(`❌ ${s.reject.length}`).setStyle(ButtonStyle.Secondary)
  );
}

// ===== Legit poll =====
async function getLegitVotes() { const d = await leesGist(); return d.legitVotes; }
async function saveLegitVotes(v) { const d = await leesGist(); d.legitVotes = v; await schrijfGist(d); }
async function getLegitMessageId() { const d = await leesGist(); return d.legitMessageId; }
async function setLegitMessageId(id) { const d = await leesGist(); d.legitMessageId = id; await schrijfGist(d); }

function buildLegitEmbed(votes) {
  return new EmbedBuilder()
    .setTitle('Are we legit?')
    .setColor(0x00ff88)
    .setDescription(
      '**No without proof = ban**\n\n' +
      `> ✅ Legit — **${votes.approve.length}**\n` +
      `> ❌ Not legit — **${votes.reject.length}**`
    )
    .setThumbnail(LOGO)
    .setFooter({ text: 'Vexora.cc', iconURL: LOGO });
}

function buildLegitRow(votes) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('legit_approve').setLabel(`✅ ${votes.approve.length}`).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('legit_reject').setLabel(`❌ ${votes.reject.length}`).setStyle(ButtonStyle.Secondary)
  );
}

// ===== Vote log =====
async function logVote(userId, type, doel) {
  try {
    const channel = await client.channels.fetch(VOTE_LOG_CHANNEL_ID);
    if (!channel) return;
    const embed = new EmbedBuilder()
      .setColor(type === 'approve' ? 0x00ff88 : 0xff4444)
      .setDescription(`<@${userId}> heeft ${type === 'approve' ? '✅ een vinkje' : '❌ een kruisje'} gestemd op ${doel}`)
      .setFooter({ text: 'Vexora.cc', iconURL: LOGO })
      .setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (e) { console.error('Kon vote log niet sturen:', e.message); }
}

// ===== Review nummer =====
async function scanKanaal(channel) {
  let hoogste = 0, laatsteId = null, doorzoeken = true;
  while (doorzoeken) {
    const opties = { limit: 100 };
    if (laatsteId) opties.before = laatsteId;
    const berichten = await channel.messages.fetch(opties);
    if (berichten.size === 0) break;
    for (const msg of berichten.values()) {
      for (const embed of msg.embeds) {
        if (embed.title && embed.title.startsWith('Review #')) {
          const n = parseInt(embed.title.replace('Review #', ''));
          if (!isNaN(n) && n > hoogste) hoogste = n;
        }
      }
    }
    laatsteId = berichten.last().id;
    if (berichten.size < 100) doorzoeken = false;
  }
  return hoogste;
}

async function volgendNummer(channel) {
  try { return (await leesCounter()) + 1; }
  catch (e) { return (await scanKanaal(channel)) + 1; }
}

// ===== Status =====
let statusToggle = false;
let cachedCounter = 0;

async function haalMemberCount() {
  try {
    const guild = await client.guilds.fetch({ guild: GUILD_ID, force: true });
    return guild.memberCount;
  } catch (e) { return 0; }
}

async function updateStatus() {
  try {
    if (statusToggle) {
      const members = await haalMemberCount();
      client.user.setActivity(`${members} Members`, { type: 3 });
    } else {
      client.user.setActivity(`${cachedCounter} Reviews`, { type: 3 });
    }
    statusToggle = !statusToggle;
  } catch (e) {}
}

async function refreshCounterCache() {
  try { cachedCounter = await leesCounter(); } catch (e) {}
}

function startStatusInterval() {
  refreshCounterCache();
  updateStatus();
  setInterval(refreshCounterCache, 60000);
  setInterval(updateStatus, STATUS_INTERVAL);
}

// ===== Rol verval =====
async function checkRolVerval() {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const purchases = await getPurchases();
    const nu = Date.now();
    for (const p of purchases) {
      if (p.eindTijd === null || p.eindTijd > nu) continue;
      try {
        const member = await guild.members.fetch(p.userId);
        if (member && member.roles.cache.has(REQUIRED_ROLE_ID)) {
          await member.roles.remove(REQUIRED_ROLE_ID, 'Plan verlopen');
        }
      } catch (e) {}
    }
    const nogActief = purchases.filter(p => p.eindTijd === null || p.eindTijd > nu);
    if (nogActief.length !== purchases.length) await savePurchases(nogActief);
  } catch (e) { console.error('Fout bij checkRolVerval:', e.message); }
}

function startVervalInterval() {
  checkRolVerval();
  setInterval(checkRolVerval, 60000);
}

// ===== Kanaal schoonmaken =====
async function clearBotMessages(channel) {
  let laatsteId = null, doorzoeken = true;
  while (doorzoeken) {
    const opties = { limit: 100 };
    if (laatsteId) opties.before = laatsteId;
    const berichten = await channel.messages.fetch(opties);
    if (berichten.size === 0) break;
    const vanBot = berichten.filter(m => m.author.id === client.user.id);
    for (const msg of vanBot.values()) await msg.delete().catch(() => {});
    laatsteId = berichten.last().id;
    if (berichten.size < 100) doorzoeken = false;
  }
}

// ===== Overzicht =====
async function getOverzichtMessageId() { const d = await leesGist(); return d.overzichtMessageId; }
async function setOverzichtMessageId(id) { const d = await leesGist(); d.overzichtMessageId = id; await schrijfGist(d); }

async function bouwOverzichtEmbed() {
  const purchases = await getPurchases();
  const perPlan = {};
  for (const plan of Object.keys(PLANS)) perPlan[plan] = [];
  for (const p of purchases) {
    const planNaam = p.plan === 'lifetime' ? 'Lifetime' : p.plan;
    if (!perPlan[planNaam]) perPlan[planNaam] = [];
    perPlan[planNaam].push(p);
  }
  const embed = new EmbedBuilder()
    .setTitle('Actieve Purchases')
    .setColor(0x5865f2)
    .setThumbnail(LOGO)
    .setFooter({ text: 'Vexora.cc', iconURL: LOGO })
    .setTimestamp();
  for (const plan of ['1 week', '1 maand', 'Lifetime']) {
    const lijst = perPlan[plan] || [];
    let value = lijst.length === 0 ? '*Geen*' : '';
    for (const p of lijst) {
      const resterend = formatResterend(p.eindTijd);
      const key = p.key ? p.key : 'geen key';
      value += `<@${p.userId}> — ${resterend} — \`${key}\`\n`;
    }
    if (value.length > 1024) value = value.slice(0, 1020) + '...';
    embed.addFields({ name: `**${plan}** (${lijst.length})`, value, inline: false });
  }
  return embed;
}

async function updateOverzicht() {
  try {
    const channel = await client.channels.fetch(PURCHASE_LOG_CHANNEL_ID);
    if (!channel) return;
    const embed = await bouwOverzichtEmbed();
    const messageId = await getOverzichtMessageId();
    if (messageId) {
      try {
        const msg = await channel.messages.fetch(messageId);
        if (msg && msg.author.id === client.user.id) {
          await msg.edit({ embeds: [embed] });
          return;
        }
      } catch (e) {}
    }
    await clearBotMessages(channel);
    const nieuw = await channel.send({ embeds: [embed] });
    await setOverzichtMessageId(nieuw.id);
  } catch (e) { console.error('Kon overzicht niet updaten:', e.message); }
}

async function herstartOverzicht() {
  try {
    const channel = await client.channels.fetch(PURCHASE_LOG_CHANNEL_ID);
    if (!channel) return;
    await clearBotMessages(channel);
    const embed = await bouwOverzichtEmbed();
    const nieuw = await channel.send({ embeds: [embed] });
    await setOverzichtMessageId(nieuw.id);
  } catch (e) { console.error('Kon overzicht niet herstarten:', e.message); }
}

function startOverzichtInterval() {
  updateOverzicht();
  setInterval(updateOverzicht, 60000);
}

// ===== Giveaway =====
async function getGiveaways() { const d = await leesGist(); return d.giveaways; }
async function saveGiveaways(g) { const d = await leesGist(); d.giveaways = g; await schrijfGist(d); }

function buildGiveawayEmbed(g) {
  return new EmbedBuilder()
    .setTitle('🎉 Giveaway 🎉')
    .setColor(0xff73fa)
    .setThumbnail(LOGO)
    .setDescription(
      `**Prijs:** ${g.item}\n` +
      `**Winnaars:** ${g.winners}\n` +
      `**Eindigt:** <t:${Math.floor(g.eindTijd / 1000)}:R>\n\n` +
      `Reageer met 🎉 om mee te doen!`
    )
    .setFooter({ text: `Vexora.cc • Gehost door ${g.hostTag || 'onbekend'}`, iconURL: LOGO })
    .setTimestamp(g.gestart);
}

function buildGiveawayEndedEmbed(g, winnaars) {
  let winnaarTekst = 'Geen deelnemers';
  if (winnaars.length > 0) {
    winnaarTekst = winnaars.map(id => `<@${id}>`).join(', ');
  }
  return new EmbedBuilder()
    .setTitle('🎉 Giveaway Afgelopen 🎉')
    .setColor(0x00ff88)
    .setThumbnail(LOGO)
    .setDescription(
      `**Prijs:** ${g.item}\n` +
      `**Winnaars:** ${winnaarTekst}\n\n` +
      `Gefeliciteerd! 🎊`
    )
    .setFooter({ text: 'Vexora.cc', iconURL: LOGO })
    .setTimestamp();
}

async function eindigGiveaway(messageId, kanaalId) {
  try {
    const giveaways = await getGiveaways();
    const g = giveaways[messageId];
    if (!g) return;

    const channel = await client.channels.fetch(kanaalId).catch(() => null);
    if (!channel) {
      delete giveaways[messageId];
      await saveGiveaways(giveaways);
      return;
    }

    const msg = await channel.messages.fetch(messageId).catch(() => null);
    if (!msg) {
      delete giveaways[messageId];
      await saveGiveaways(giveaways);
      return;
    }

    // Verzamel deelnemers uit 🎉 reacties
    const reaction = msg.reactions.cache.get('🎉');
    let deelnemers = [];
    if (reaction) {
      const users = await reaction.users.fetch();
      deelnemers = users.filter(u => !u.bot).map(u => u.id);
    }

    // Kies winnaars
    const winnaars = [];
    const pool = [...deelnemers];
    const aantal = Math.min(g.winners, pool.length);
    for (let k = 0; k < aantal; k++) {
      const idx = Math.floor(Math.random() * pool.length);
      winnaars.push(pool.splice(idx, 1)[0]);
    }

    // Update embed
    await msg.edit({ embeds: [buildGiveawayEndedEmbed(g, winnaars)] }).catch(() => {});

    // Announcement
    if (winnaars.length > 0) {
      await channel.send({
        content: `🎉 Gefeliciteerd ${winnaars.map(id => `<@${id}>`).join(', ')}! Jullie hebben **${g.item}** gewonnen!`,
      }).catch(() => {});

      // DM naar winnaars
      for (const id of winnaars) {
        try {
          const user = await client.users.fetch(id);
          await user.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('🎉 Je hebt een giveaway gewonnen!')
                .setColor(0x00ff88)
                .setThumbnail(LOGO)
                .setDescription(`Gefeliciteerd! Je hebt **${g.item}** gewonnen in de giveaway van **Vexora.cc**!`)
                .setFooter({ text: 'Vexora.cc', iconURL: LOGO })
                .setTimestamp(),
            ],
          });
        } catch (e) {}
      }
    } else {
      await channel.send({ content: `😢 Niemand heeft meegedaan aan de giveaway voor **${g.item}**.` }).catch(() => {});
    }

    // Verwijder uit storage
    delete giveaways[messageId];
    await saveGiveaways(giveaways);
  } catch (e) {
    console.error('Eindig giveaway fout:', e.message);
  }
}

async function herstelGiveaways() {
  try {
    const giveaways = await getGiveaways();
    const nu = Date.now();
    for (const [messageId, g] of Object.entries(giveaways)) {
      const over = g.eindTijd - nu;
      if (over <= 0) {
        await eindigGiveaway(messageId, g.kanaalId);
      } else {
        setTimeout(() => eindigGiveaway(messageId, g.kanaalId), over);
        console.log(`Giveaway hersteld: ${g.item} (eindigt over ${formatGiveawayDuur(over)})`);
      }
    }
  } catch (e) { console.error('Kon giveaways niet herstellen:', e.message); }
}

// ===== Transcript =====
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderContent(content, mentions) {
  if (!content) return '';
  let html = escapeHtml(content);
  if (mentions && mentions.users) {
    for (const [id, user] of mentions.users) {
      html = html.replace(new RegExp(`&lt;@!?${id}&gt;`, 'g'), `<span class="mention">@${escapeHtml(user.username)}</span>`);
    }
  }
  if (mentions && mentions.roles) {
    for (const [id, role] of mentions.roles) {
      html = html.replace(new RegExp(`&lt;@&amp;${id}&gt;`, 'g'), `<span class="mention" style="background:#3c4270">@${escapeHtml(role.name)}</span>`);
    }
  }
  if (mentions && mentions.channels) {
    for (const [id, ch] of mentions.channels) {
      html = html.replace(new RegExp(`&lt;#${id}&gt;`, 'g'), `<span class="mention">#${escapeHtml(ch.name)}</span>`);
    }
  }
  html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank">$1</a>');
  html = html.replace(/```([\s\S]*?)```/g, '<pre class="codeblock">$1</pre>');
  html = html.replace(/`([^`]+)`/g, '<code class="inline">$1</code>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function renderEmbed(e) {
  const kleur = e.color ? `#${e.color.toString(16).padStart(6, '0')}` : '#5865f2';
  let velden = '';
  if (e.fields && e.fields.length > 0) {
    velden = `<div class="embed-fields">${e.fields.map(f =>
      `<div class="embed-field" style="grid-column: span ${f.inline ? 1 : 2}">
        <div class="embed-field-name">${escapeHtml(f.name)}</div>
        <div class="embed-field-value">${renderContent(f.value)}</div>
      </div>`
    ).join('')}</div>`;
  }
  return `<div class="embed" style="border-left:4px solid ${kleur}">
    <div class="embed-grid">
      <div class="embed-main">
        ${e.author ? `<div class="embed-author">${e.author.iconURL ? `<img src="${e.author.iconURL}" class="embed-author-icon">` : ''}${escapeHtml(e.author.name)}</div>` : ''}
        ${e.title ? `<div class="embed-title">${escapeHtml(e.title)}</div>` : ''}
        ${e.description ? `<div class="embed-desc">${renderContent(e.description)}</div>` : ''}
        ${velden}
        ${e.footer ? `<div class="embed-footer">${e.footer.iconURL ? `<img src="${e.footer.iconURL}" class="embed-footer-icon">` : ''}${escapeHtml(e.footer.text)}</div>` : ''}
      </div>
      ${e.thumbnail ? `<img src="${e.thumbnail.url}" class="embed-thumb">` : ''}
    </div>
    ${e.image ? `<img src="${e.image.url}" class="embed-image">` : ''}
  </div>`;
}

function renderAttachments(attachments) {
  if (!attachments || attachments.size === 0) return '';
  return [...attachments.values()].map(a => {
    const isImage = a.contentType && a.contentType.startsWith('image/');
    if (isImage) return `<div class="attachment-image"><a href="${a.url}" target="_blank"><img src="${a.url}" alt="${escapeHtml(a.name)}"></a></div>`;
    return `<div class="attachment"><a href="${a.url}" target="_blank">📎 ${escapeHtml(a.name)}</a></div>`;
  }).join('');
}

async function maakTranscript(channel) {
  let alleBerichten = [], laatsteId = null, doorzoeken = true;
  while (doorzoeken) {
    const opties = { limit: 100 };
    if (laatsteId) opties.before = laatsteId;
    const berichten = await channel.messages.fetch(opties);
    if (berichten.size === 0) break;
    alleBerichten.push(...berichten.values());
    laatsteId = berichten.last().id;
    if (berichten.size < 100) doorzoeken = false;
  }
  alleBerichten.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const berichtenHtml = alleBerichten.map(m => {
    const avatar = m.author.displayAvatarURL({ extension: 'png', size: 64 });
    const tijd = new Date(m.createdTimestamp).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const botBadge = m.author.bot ? '<span class="bot-badge">BOT</span>' : '';
    return `<div class="message">
      <img class="avatar" src="${avatar}" alt="avatar">
      <div class="message-body">
        <div class="message-header">
          <span class="username" style="color:${m.member && m.member.displayHexColor && m.member.displayHexColor !== '#000000' ? m.member.displayHexColor : '#ffffff'}">${escapeHtml(m.author.username)}</span>
          ${botBadge}
          <span class="timestamp">${tijd}</span>
        </div>
        ${m.content ? `<div class="message-content">${renderContent(m.content, m.mentions)}</div>` : ''}
        ${m.embeds && m.embeds.length > 0 ? m.embeds.map(renderEmbed).join('') : ''}
        ${renderAttachments(m.attachments)}
      </div>
    </div>`;
  }).join('');
  const html = `<!DOCTYPE html>
<html lang="nl"><head><meta charset="UTF-8"><title>Transcript - #${escapeHtml(channel.name)}</title><link rel="icon" href="${LOGO}">
<style>
* { box-sizing: border-box; }
body { margin: 0; background: #313338; color: #dbdee1; font-family: 'gg sans', 'Whitney', 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.375; }
.header { background: #2b2d31; padding: 16px 20px; border-bottom: 1px solid #1e1f22; position: sticky; top: 0; z-index: 10; }
.header h1 { margin: 0; font-size: 18px; color: #f2f3f5; }
.header .meta { color: #949ba4; font-size: 13px; margin-top: 4px; }
.chat { padding: 20px 0; }
.message { display: flex; padding: 4px 20px; margin-top: 16px; }
.message:hover { background: #2e3035; }
.avatar { width: 40px; height: 40px; border-radius: 50%; margin-right: 16px; flex-shrink: 0; }
.message-body { flex: 1; min-width: 0; }
.message-header { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
.username { font-weight: 500; font-size: 16px; }
.bot-badge { background: #5865f2; color: #fff; font-size: 10px; font-weight: 600; padding: 1px 4px; border-radius: 3px; letter-spacing: 0.5px; }
.timestamp { color: #949ba4; font-size: 12px; }
.message-content { color: #dbdee1; word-wrap: break-word; white-space: pre-wrap; }
.message-content a { color: #00a8fc; text-decoration: none; }
.mention { background: #3c4270; color: #c9cdfb; padding: 0 2px; border-radius: 3px; font-weight: 500; }
.inline { background: #2b2d31; padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 14px; }
.codeblock { background: #2b2d31; padding: 8px 12px; border-radius: 4px; font-family: monospace; font-size: 14px; overflow-x: auto; margin: 4px 0; white-space: pre-wrap; }
.embed { background: #2b2d31; border-radius: 4px; padding: 12px 16px; margin-top: 8px; max-width: 520px; }
.embed-grid { display: flex; gap: 12px; }
.embed-main { flex: 1; min-width: 0; }
.embed-author { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: #f2f3f5; margin-bottom: 4px; }
.embed-author-icon { width: 24px; height: 24px; border-radius: 50%; }
.embed-title { font-size: 16px; font-weight: 600; color: #f2f3f5; margin-bottom: 4px; }
.embed-desc { font-size: 14px; color: #dbdee1; margin-bottom: 8px; }
.embed-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
.embed-field-name { font-size: 14px; font-weight: 600; color: #f2f3f5; margin-bottom: 2px; }
.embed-field-value { font-size: 14px; color: #dbdee1; }
.embed-thumb { width: 80px; height: 80px; border-radius: 4px; flex-shrink: 0; object-fit: cover; }
.embed-image { max-width: 100%; border-radius: 4px; margin-top: 8px; }
.embed-footer { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #949ba4; margin-top: 8px; }
.embed-footer-icon { width: 20px; height: 20px; border-radius: 50%; }
.attachment { margin-top: 6px; font-size: 14px; }
.attachment a { color: #00a8fc; text-decoration: none; }
.attachment-image { margin-top: 8px; }
.attachment-image img { max-width: 400px; max-height: 300px; border-radius: 4px; }
</style></head><body>
<div class="header"><h1>Transcript: #${escapeHtml(channel.name)}</h1><div class="meta">${alleBerichten.length} berichten • Gegenereerd op ${new Date().toLocaleString('nl-NL')}</div></div>
<div class="chat">${berichtenHtml}</div>
</body></html>`;
  return { html, aantalBerichten: alleBerichten.length };
}

// ===== Verify =====
async function setupVerify() {
  try {
    const channel = await client.channels.fetch(VERIFY_CHANNEL_ID);
    if (!channel) return;
    await clearBotMessages(channel);
    const embed = new EmbedBuilder()
      .setTitle('Verify').setColor(0x5865f2)
      .setDescription('Klik hieronder om toegang te krijgen tot de server.')
      .setThumbnail(LOGO).setFooter({ text: 'Vexora.cc', iconURL: LOGO });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('verify_button').setLabel('Verify').setEmoji('✅').setStyle(ButtonStyle.Success)
    );
    await channel.send({ embeds: [embed], components: [row] });
  } catch (e) { console.error('Kon verify niet opzetten:', e.message); }
}

// ===== Prijslijst =====
async function setupPricing() {
  try {
    const channel = await client.channels.fetch(PRICING_CHANNEL_ID);
    if (!channel) return;
    await clearBotMessages(channel);
    const embed = new EmbedBuilder()
      .setTitle('Vexora.cc Private').setColor(0x5865f2).setThumbnail(LOGO)
      .setDescription('> Premium external cheat met advanced bypass.\n> ⚡ Snelle levering • 🔒 Veilig • 🕐 24/7 Support')
      .addFields(
        { name: '💰 Pricing', value: '```\n1 Week    →  €7.50\n1 Month   →  €20.00\nLifetime  →  €60.00\n```', inline: false },
        { name: '🛡️ Product', value: '> • External Cheat\n> • Advanced bypass — removes all traces after execution\n> • Daily Updates\n> • Easy to use interface\n> • 24/7 Support', inline: false },
        { name: '👥 Group Deals', value: '```\nDuo    →  €30 per person\nTrio   →  €20 per person\nSquad  →  €15 per person\nMore?  →  Open a ticket\n```', inline: false }
      )
      .setFooter({ text: 'Vexora.cc', iconURL: LOGO });
    await channel.send({ embeds: [embed] });
  } catch (e) { console.error('Kon prijslijst niet plaatsen:', e.message); }
}

// ===== Ticket panel =====
async function setupTicketPanel() {
  try {
    const channel = await client.channels.fetch(TICKET_PANEL_CHANNEL_ID);
    if (!channel) return;
    await clearBotMessages(channel);
    const embed = new EmbedBuilder()
      .setTitle('Tickets').setColor(0x5865f2)
      .setDescription('Kies hieronder een categorie om een ticket te openen.\n\n> ⚡ Snelle levering\n> 🔒 Veilig & betrouwbaar\n> 🕐 24/7 Support')
      .setThumbnail(LOGO).setFooter({ text: 'Vexora.cc', iconURL: LOGO });
    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticket_category_select').setPlaceholder('Categorie...')
      .addOptions([
        { label: 'Support', value: 'support', emoji: '🎫' },
        { label: 'Purchase', value: 'purchase', emoji: '🛒' },
        { label: 'Bug', value: 'bug', emoji: '⚠️' },
      ]);
    const row = new ActionRowBuilder().addComponents(menu);
    await channel.send({ embeds: [embed], components: [row] });
  } catch (e) { console.error('Kon ticket panel niet plaatsen:', e.message); }
}

// ===== Legit poll =====
async function setupLegitPoll() {
  try {
    const channel = await client.channels.fetch(LEGIT_CHANNEL_ID);
    if (!channel) return;
    const votes = await getLegitVotes();
    const embed = buildLegitEmbed(votes);
    const row = buildLegitRow(votes);
    const messageId = await getLegitMessageId();
    if (messageId) {
      try {
        const msg = await channel.messages.fetch(messageId);
        if (msg && msg.author.id === client.user.id) {
          await msg.edit({ embeds: [embed], components: [row] });
          return;
        }
      } catch (e) {}
    }
    await clearBotMessages(channel);
    const nieuw = await channel.send({ embeds: [embed], components: [row] });
    await setLegitMessageId(nieuw.id);
  } catch (e) { console.error('Kon legit poll niet plaatsen:', e.message); }
}

// ===== Ticket storage =====
async function getTickets() { const d = await leesGist(); return d.tickets; }
async function saveTickets(t) { const d = await leesGist(); d.tickets = t; await schrijfGist(d); }
async function addTicket(channelId, userId, categorieKey) {
  const t = await getTickets();
  t[channelId] = { userId, categorie: categorieKey, gestart: Date.now() };
  await saveTickets(t);
}
async function removeTicket(channelId) {
  const t = await getTickets();
  delete t[channelId];
  await saveTickets(t);
}

// ===== Helpers =====
function sterren(n) { return '⭐'.repeat(n) + '☆'.repeat(5 - n); }

function sterRow(gekozen) {
  const row = new ActionRowBuilder();
  for (let i = 1; i <= 5; i++) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`star_${i}`).setLabel(`${i} ⭐`)
        .setStyle(gekozen === i ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(gekozen !== null && gekozen !== i)
    );
  }
  return row;
}

function submitRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('submit').setLabel('Verstuur').setStyle(ButtonStyle.Primary)
  );
}

// ===== Interaction handler =====
client.on('interactionCreate', async (i) => {
  // /review
  if (i.isChatInputCommand() && i.commandName === 'review') {
    if (i.channelId !== REVIEW_CHANNEL_ID) return i.reply({ content: `Je kunt alleen in <#${REVIEW_CHANNEL_ID}> een review plaatsen.`, ephemeral: true });
    if (!i.member.roles.cache.has(REQUIRED_ROLE_ID)) return i.reply({ content: `Je hebt de <@&${REQUIRED_ROLE_ID}> rol nodig om een review te plaatsen.`, ephemeral: true });
    const extra = i.options.getString('extra');
    reviews.set(i.user.id, { product: PRODUCT, extra, rating: null });
    const embed = new EmbedBuilder().setTitle('Review aanmaken').setDescription(`**Product:** ${PRODUCT}\n\nKies een aantal sterren.`).setColor(0x5865f2).setThumbnail(LOGO);
    return i.reply({ embeds: [embed], components: [sterRow(null), submitRow()], ephemeral: true });
  }

  // /purchase
  if (i.isChatInputCommand() && i.commandName === 'purchase') {
    if (!i.member.roles.cache.has(PURCHASE_ROLE_ID)) return i.reply({ content: `Je hebt de <@&${PURCHASE_ROLE_ID}> rol nodig.`, ephemeral: true });
    await i.deferReply();
    const doelUser = i.options.getUser('user');
    const plan = i.options.getString('plan');
    const key = i.options.getString('key');
    const duur = planDuurMs(plan);
    if (duur === undefined) return i.editReply({ content: 'Onbekend plan.' });
    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      const member = await guild.members.fetch(doelUser.id);
      await member.roles.add(REQUIRED_ROLE_ID, `Purchase: ${plan}`);
      const { eindTijd } = await addPurchase(doelUser.id, plan, key);
      await updateOverzicht();
      const planTekst = plan === 'lifetime' ? 'Lifetime' : plan;
      const embed = new EmbedBuilder()
        .setTitle('Purchase Voltooid').setColor(0x00ff88).setThumbnail(LOGO)
        .setDescription(`Bedankt voor je aankoop, <@${doelUser.id}>!\n\nJe plan is actief en je key staat hieronder.`)
        .addFields(
          { name: 'Klant', value: `<@${doelUser.id}>`, inline: true },
          { name: 'Plan', value: planTekst, inline: true },
          { name: 'Duur', value: formatDuur(duur), inline: true },
          { name: 'Key', value: `\`\`\`${key}\`\`\``, inline: false },
          { name: 'Verloopt', value: eindTijd === null ? 'Nooit (Lifetime)' : `<t:${Math.floor(eindTijd/1000)}:F> (<t:${Math.floor(eindTijd/1000)}:R>)`, inline: false }
        )
        .setFooter({ text: 'Vexora.cc', iconURL: LOGO }).setTimestamp();
      await i.editReply({ embeds: [embed] });
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('Bedankt voor je aankoop!').setColor(0x00ff88).setThumbnail(LOGO)
          .setDescription(`Hey <@${doelUser.id}>,\n\nBedankt voor je aankoop van **${planTekst} Plan** voor **${PRODUCT}**!\n\nHier is je key:\n\`\`\`${key}\`\`\`\nBewaar deze goed!\n\nWil je een review achterlaten? Gebruik \`/review\`. 💙`)
          .setFooter({ text: 'Vexora.cc', iconURL: LOGO }).setTimestamp();
        await doelUser.send({ embeds: [dmEmbed] });
      } catch (e) {}
    } catch (e) { await i.editReply({ content: `Fout: ${e.message}` }); }
    return;
  }

  // /removelicense
  if (i.isChatInputCommand() && i.commandName === 'removelicense') {
    if (!i.member.roles.cache.has(PURCHASE_ROLE_ID)) return i.reply({ content: `Je hebt de <@&${PURCHASE_ROLE_ID}> rol nodig.`, ephemeral: true });
    await i.deferReply();
    const doelUser = i.options.getUser('user');
    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      const member = await guild.members.fetch(doelUser.id);
      const bestaande = await removePurchase(doelUser.id);
      if (!bestaande) return i.editReply({ content: `⚠️ <@${doelUser.id}> heeft geen actieve licentie.` });
      let rolVerwijderd = false;
      if (member.roles.cache.has(REQUIRED_ROLE_ID)) {
        await member.roles.remove(REQUIRED_ROLE_ID, 'Licentie verwijderd');
        rolVerwijderd = true;
      }
      await updateOverzicht();
      const embed = new EmbedBuilder().setTitle('Licentie Verwijderd').setColor(0xff4444).setThumbnail(LOGO)
        .addFields(
          { name: 'Klant', value: `<@${doelUser.id}>`, inline: true },
          { name: 'Plan', value: bestaande.plan === 'lifetime' ? 'Lifetime' : bestaande.plan, inline: true },
          { name: 'Key', value: bestaande.key ? `\`${bestaande.key}\`` : 'geen', inline: false },
          { name: 'Rol verwijderd', value: rolVerwijderd ? 'Ja' : 'Nee', inline: true }
        ).setFooter({ text: 'Vexora.cc', iconURL: LOGO }).setTimestamp();
      await i.editReply({ embeds: [embed] });
    } catch (e) { await i.editReply({ content: `Fout: ${e.message}` }); }
    return;
  }

  // /suggestie
  if (i.isChatInputCommand() && i.commandName === 'suggestie') {
    await i.deferReply({ ephemeral: true });
    const tekst = i.options.getString('tekst');
    try {
      const kanaal = await client.channels.fetch(SUGGESTIE_CHANNEL_ID);
      const placeholder = new EmbedBuilder().setTitle('Nieuwe Suggestie').setColor(0x5865f2).setThumbnail(LOGO).setDescription('Laden...').setFooter({ text: 'Vexora.cc', iconURL: LOGO }).setTimestamp();
      const bericht = await kanaal.send({ embeds: [placeholder] });
      const suggestions = await getSuggestions();
      suggestions[bericht.id] = { tekst, auteurId: i.user.id, approve: [], reject: [], gestart: Date.now() };
      await saveSuggestions(suggestions);
      const s = suggestions[bericht.id];
      await bericht.edit({ embeds: [buildSuggestieEmbed(s)], components: [buildSuggestieRow(bericht.id, s)] });
      await i.editReply({ content: `Je suggestie is geplaatst in <#${SUGGESTIE_CHANNEL_ID}>.` });
    } catch (e) { await i.editReply({ content: `Fout: ${e.message}` }); }
    return;
  }

  // /refresh
  if (i.isChatInputCommand() && i.commandName === 'refresh') {
    if (!i.member.roles.cache.has(PURCHASE_ROLE_ID)) return i.reply({ content: `Je hebt de <@&${PURCHASE_ROLE_ID}> rol nodig.`, ephemeral: true });
    await i.deferReply({ ephemeral: true });
    try {
      await herstartOverzicht();
      await i.editReply({ content: `Overzicht vernieuwd in <#${PURCHASE_LOG_CHANNEL_ID}>.` });
    } catch (e) { await i.editReply({ content: `Fout: ${e.message}` }); }
    return;
  }

  // /removekruis
  if (i.isChatInputCommand() && i.commandName === 'removekruis') {
    if (!i.member.roles.cache.has(PURCHASE_ROLE_ID)) return i.reply({ content: `Je hebt de <@&${PURCHASE_ROLE_ID}> rol nodig.`, ephemeral: true });
    await i.deferReply();
    const aantal = i.options.getInteger('aantal');
    try {
      const votes = await getLegitVotes();
      const huidig = votes.reject.length;
      if (huidig === 0) return i.editReply({ content: '⚠️ Er zijn momenteel geen kruisjes om te verwijderen.' });
      const teVerwijderen = Math.min(aantal, huidig);
      votes.reject.splice(huidig - teVerwijderen, teVerwijderen);
      await saveLegitVotes(votes);
      try {
        const channel = await client.channels.fetch(LEGIT_CHANNEL_ID);
        const messageId = await getLegitMessageId();
        if (messageId) {
          const msg = await channel.messages.fetch(messageId);
          if (msg && msg.author.id === client.user.id) {
            await msg.edit({ embeds: [buildLegitEmbed(votes)], components: [buildLegitRow(votes)] });
          }
        }
      } catch (e) {}
      try {
        const logChannel = await client.channels.fetch(VOTE_LOG_CHANNEL_ID);
        if (logChannel) {
          const embed = new EmbedBuilder().setColor(0xff4444)
            .setDescription(`🧹 <@${i.user.id}> heeft **${teVerwijderen}** kruisje(s) ❌ verwijderd uit de legit poll.`)
            .setFooter({ text: 'Vexora.cc', iconURL: LOGO }).setTimestamp();
          await logChannel.send({ embeds: [embed] });
        }
      } catch (e) {}
      const embed = new EmbedBuilder().setTitle('Kruisjes Verwijderd').setColor(0xff4444).setThumbnail(LOGO)
        .addFields(
          { name: 'Verwijderd', value: `${teVerwijderen}`, inline: true },
          { name: 'Resterend ❌', value: `${votes.reject.length}`, inline: true },
          { name: 'Totaal ✅', value: `${votes.approve.length}`, inline: true }
        ).setFooter({ text: 'Vexora.cc', iconURL: LOGO }).setTimestamp();
      if (teVerwijderen < aantal) embed.setDescription(`⚠️ Je vroeg om **${aantal}**, maar er waren er maar **${huidig}**.`);
      await i.editReply({ embeds: [embed] });
    } catch (e) { await i.editReply({ content: `Fout: ${e.message}` }); }
    return;
  }

  // /giveaway — ALLEEN VOOR TICKET SUPPORT ROL
  if (i.isChatInputCommand() && i.commandName === 'giveaway') {
    if (!i.member.roles.cache.has(TICKET_SUPPORT_ROLE_ID)) {
      return i.reply({
        content: `Je hebt de <@&${TICKET_SUPPORT_ROLE_ID}> rol nodig om een giveaway te starten.`,
        ephemeral: true,
      });
    }

    await i.deferReply();

    const winners = i.options.getInteger('winners');
    const item = i.options.getString('item');
    const timeStr = i.options.getString('time');
    const duurMs = parseGiveawayTime(timeStr);

    if (!duurMs || duurMs < 10 * 1000) {
      return i.editReply({ content: '⚠️ Ongeldige tijd. Gebruik formaat zoals `30s`, `5m`, `1h`, `1d`, `1w` (minimaal 10s).' });
    }
    if (duurMs > 30 * 24 * 60 * 60 * 1000) {
      return i.editReply({ content: '⚠️ Maximale duur is 30 dagen.' });
    }

    try {
      const eindTijd = Date.now() + duurMs;
      const giveaways = await getGiveaways();

      const giveawayData = {
        item,
        winners,
        eindTijd,
        gestart: Date.now(),
        kanaalId: i.channelId,
        hostId: i.user.id,
        hostTag: i.user.username,
      };

      const embed = buildGiveawayEmbed(giveawayData);
      const msg = await i.channel.send({ embeds: [embed] });
      await msg.react('🎉');

      giveawayData.messageId = msg.id;
      giveaways[msg.id] = giveawayData;
      await saveGiveaways(giveaways);

      setTimeout(() => eindigGiveaway(msg.id, i.channelId), duurMs);

      const bevestiging = new EmbedBuilder()
        .setTitle('Giveaway Gestart')
        .setColor(0x00ff88)
        .setThumbnail(LOGO)
        .addFields(
          { name: 'Prijs', value: item, inline: true },
          { name: 'Winnaars', value: `${winners}`, inline: true },
          { name: 'Duur', value: formatGiveawayDuur(duurMs), inline: true },
          { name: 'Eindigt', value: `<t:${Math.floor(eindTijd / 1000)}:F> (<t:${Math.floor(eindTijd / 1000)}:R>)`, inline: false }
        )
        .setFooter({ text: 'Vexora.cc', iconURL: LOGO })
        .setTimestamp();

      await i.editReply({ embeds: [bevestiging] });
    } catch (e) {
      console.error('Giveaway fout:', e);
      await i.editReply({ content: `Fout: ${e.message}` });
    }
    return;
  }

  // Ticket categorie select
  if (i.isStringSelectMenu() && i.customId === 'ticket_category_select') {
    await i.deferReply({ ephemeral: true });
    const keuze = i.values[0];
    const cat = TICKET_CATEGORIES[keuze];
    if (!cat) return i.editReply({ content: 'Onbekende categorie.' });
    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      const tickets = await getTickets();
      const bestaand = Object.entries(tickets).find(([_, t]) => t.userId === i.user.id);
      if (bestaand) return i.editReply({ content: `Je hebt al een open ticket: <#${bestaand[0]}>` });
      const kanaalNaam = `${cat.prefix}-${i.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
      const ticketChannel = await guild.channels.create({
        name: kanaalNaam,
        type: ChannelType.GuildText,
        parent: cat.categoryId,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
          { id: TICKET_SUPPORT_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] },
          { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] },
        ],
        topic: `Ticket van ${i.user.tag} — ${cat.naam}`,
      });
      await addTicket(ticketChannel.id, i.user.id, keuze);
      const embed = new EmbedBuilder().setTitle(cat.naam).setColor(cat.kleur)
        .setDescription(`<@${i.user.id}> — beschrijf hieronder je vraag.`)
        .setFooter({ text: 'Vexora.cc', iconURL: LOGO }).setTimestamp();
      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_close').setLabel('Sluiten').setEmoji('🔒').setStyle(ButtonStyle.Danger)
      );
      await ticketChannel.send({ content: `<@${i.user.id}> <@&${TICKET_SUPPORT_ROLE_ID}>`, embeds: [embed], components: [closeRow] });
      await i.editReply({ content: `Ticket aangemaakt: <#${ticketChannel.id}>` });
    } catch (e) { await i.editReply({ content: `Fout: ${e.message}` }); }
    return;
  }

  // Buttons
  if (i.isButton()) {
    if (i.customId === 'verify_button') {
      try {
        if (i.member.roles.cache.has(VERIFY_ROLE_ID)) return i.reply({ content: 'Je bent al geverifieerd.', ephemeral: true });
        await i.member.roles.add(VERIFY_ROLE_ID, 'Verified via knop');
        await i.reply({ content: '✅ Je bent geverifieerd! Welkom bij Vexora.cc.', ephemeral: true });
      } catch (e) { await i.reply({ content: `Fout: ${e.message}`, ephemeral: true }); }
      return;
    }

    if (i.customId === 'legit_approve' || i.customId === 'legit_reject') {
      try {
        const votes = await getLegitVotes();
        const userId = i.user.id;
        votes.approve = votes.approve.filter(id => id !== userId);
        votes.reject = votes.reject.filter(id => id !== userId);
        const type = i.customId === 'legit_approve' ? 'approve' : 'reject';
        if (type === 'approve') votes.approve.push(userId);
        else votes.reject.push(userId);
        await saveLegitVotes(votes);
        await i.update({ embeds: [buildLegitEmbed(votes)], components: [buildLegitRow(votes)] });
        await logVote(userId, type, '**Are we legit?**');
      } catch (e) { await i.reply({ content: `Fout: ${e.message}`, ephemeral: true }); }
      return;
    }

    if (i.customId === 'ticket_close') {
      try {
        const tickets = await getTickets();
        const ticket = tickets[i.channelId];
        if (!ticket) return i.reply({ content: 'Dit is geen actief ticket.', ephemeral: true });
        const isOwner = ticket.userId === i.user.id;
        const isStaff = i.member.roles.cache.has(TICKET_SUPPORT_ROLE_ID);
        if (!isOwner && !isStaff) return i.reply({ content: 'Je mag dit ticket niet sluiten.', ephemeral: true });
        await i.reply({ content: '🔒 Ticket wordt gesloten...' });
        try {
          const { html, aantalBerichten } = await maakTranscript(i.channel);
          const buffer = Buffer.from(html, 'utf-8');
          const attachment = new AttachmentBuilder(buffer, { name: `transcript-${i.channel.name}.html` });
          const transcriptChannel = await client.channels.fetch(TICKET_TRANSCRIPT_CHANNEL_ID);
          const cat = TICKET_CATEGORIES[ticket.categorie];
          const transcriptEmbed = new EmbedBuilder()
            .setTitle('Ticket Transcript').setColor(cat ? cat.kleur : 0x5865f2).setThumbnail(LOGO)
            .addFields(
              { name: 'Kanaal', value: `#${i.channel.name}`, inline: true },
              { name: 'Klant', value: `<@${ticket.userId}>`, inline: true },
              { name: 'Gesloten door', value: `<@${i.user.id}>`, inline: true },
              { name: 'Categorie', value: cat ? cat.naam : 'Onbekend', inline: true },
              { name: 'Berichten', value: `${aantalBerichten}`, inline: true }
            ).setFooter({ text: 'Vexora.cc', iconURL: LOGO }).setTimestamp();
          await transcriptChannel.send({ embeds: [transcriptEmbed], files: [attachment] });
        } catch (e) {}
        await removeTicket(i.channelId);
        setTimeout(async () => { try { await i.channel.delete('Ticket gesloten'); } catch (e) {} }, 5000);
      } catch (e) { await i.reply({ content: `Fout: ${e.message}`, ephemeral: true }); }
      return;
    }

    if (i.customId.startsWith('suggest_approve_') || i.customId.startsWith('suggest_reject_')) {
      const messageId = i.customId.split('_').pop();
      if (!i.member.roles.cache.has(REQUIRED_ROLE_ID)) return i.reply({ content: `Je hebt de <@&${REQUIRED_ROLE_ID}> rol nodig om te stemmen.`, ephemeral: true });
      try {
        const suggestions = await getSuggestions();
        const s = suggestions[messageId];
        if (!s) return i.reply({ content: 'Deze suggestie bestaat niet meer.', ephemeral: true });
        const isApprove = i.customId.startsWith('suggest_approve_');
        const userId = i.user.id;
        s.approve = s.approve.filter(id => id !== userId);
        s.reject = s.reject.filter(id => id !== userId);
        if (isApprove) s.approve.push(userId);
        else s.reject.push(userId);
        await saveSuggestions(suggestions);
        await i.update({ embeds: [buildSuggestieEmbed(s)], components: [buildSuggestieRow(messageId, s)] });
        await logVote(userId, isApprove ? 'approve' : 'reject', `suggestie: **${s.tekst.slice(0, 80)}${s.tekst.length > 80 ? '...' : ''}**`);
      } catch (e) { await i.reply({ content: `Fout: ${e.message}`, ephemeral: true }); }
      return;
    }

    const review = reviews.get(i.user.id);
    if (!review) return i.reply({ content: 'Deze review is verlopen. Gebruik /review opnieuw.', ephemeral: true });

    if (i.customId.startsWith('star_')) {
      const n = parseInt(i.customId.split('_')[1]);
      review.rating = n;
      return i.update({ components: [sterRow(n), submitRow()] });
    }

    if (i.customId === 'submit') {
      if (!review.rating) return i.reply({ content: 'Kies eerst een aantal sterren.', ephemeral: true });
      await i.deferUpdate();
      let nummer;
      try { nummer = await volgendNummer(i.channel); } catch (e) { nummer = '?'; }
      if (nummer !== '?') {
        try { await schrijfCounter(nummer); cachedCounter = nummer; } catch (e) {}
      }
      const embed = new EmbedBuilder()
        .setTitle(`Review #${nummer}`).setColor(0xffd700).setTimestamp()
        .setAuthor({ name: i.user.displayName, iconURL: i.user.displayAvatarURL() })
        .addFields(
          { name: 'Product', value: review.product },
          { name: 'Beoordeling', value: `${sterren(review.rating)} (${review.rating}/5)` },
          { name: 'Extra', value: review.extra }
        ).setThumbnail(LOGO).setFooter({ text: 'Vexora.cc', iconURL: LOGO });
      await i.editReply({ components: [] });
      await i.channel.send({ embeds: [embed] });
      reviews.delete(i.user.id);
    }
  }
});

// ===== Member leave =====
client.on('guildMemberRemove', async (member) => {
  if (member.guild.id !== GUILD_ID) return;
  try {
    const purchases = await getPurchases();
    const had = purchases.find(p => p.userId === member.id);
    if (!had) return;
    const filtered = purchases.filter(p => p.userId !== member.id);
    await savePurchases(filtered);
    await updateOverzicht();
  } catch (e) {}
});

// ===== Channel delete =====
client.on('channelDelete', async (channel) => {
  try {
    const tickets = await getTickets();
    if (tickets[channel.id]) {
      delete tickets[channel.id];
      await saveTickets(tickets);
    }
  } catch (e) {}
});

// ===== Ready =====
client.once('ready', async () => {
  console.log(`online als ${client.user.tag}`);
  startStatusInterval();
  startVervalInterval();

  await updateOverzicht();
  startOverzichtInterval();

  await setupVerify();
  await setupPricing();
  await setupTicketPanel();
  await setupLegitPoll();

  await herstelGiveaways();
});

client.login(TOKEN);
