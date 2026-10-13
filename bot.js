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
const crypto = require('crypto');

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
const JOIN_LOG_CHANNEL_ID = '1559611526212751481';
const PRODUCT = 'Vexora External + Bypass';
const STATUS_INTERVAL = 8000;

// ===== Verify config =====
const VERIFY_SITE_URL = process.env.VERIFY_SITE_URL || 'https://vexora-verify.onrender.com';
const VERIFY_WEBHOOK_SECRET = process.env.VERIFY_WEBHOOK_SECRET || 'verander-dit';

const TICKET_CATEGORIES = {
  support: { naam: 'Support', prefix: 'support', categoryId: '1559570734664122488', emoji: '🎫', kleur: 0x3498db },
  purchase: { naam: 'Purchase', prefix: 'purchase', categoryId: '1559570790398042133', emoji: '🛒', kleur: 0x00ff88 },
  bug: { naam: 'Bug', prefix: 'bug', categoryId: '1559570848279429290', emoji: '⚠️', kleur: 0xff4444 },
};

// Tijdelijke verify tokens
const verifyTokens = new Map();
const TOKEN_LIFETIME = 15 * 60 * 1000;

function maakVerifyToken(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  verifyTokens.set(token, { userId, expiresAt: Date.now() + TOKEN_LIFETIME });
  const nu = Date.now();
  for (const [t, data] of verifyTokens) {
    if (data.expiresAt < nu) verifyTokens.delete(t);
  }
  return token;
}
// =========================

// ===== HTTP server =====
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', bot: client.user?.tag || 'starting' }));
  }

  if (req.method === 'POST' && req.url === '/verify') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { userId, token, ip, secret } = data;

        if (secret !== VERIFY_WEBHOOK_SECRET) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'unauthorized' }));
        }

        if (!userId || !token) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'missing params' }));
        }

        const tokenData = verifyTokens.get(token);
        if (!tokenData) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'invalid token' }));
        }

        if (tokenData.expiresAt < Date.now()) {
          verifyTokens.delete(token);
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'token expired' }));
        }

        if (tokenData.userId !== userId) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'token mismatch' }));
        }

        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId).catch(() => null);

        if (!member) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'member not found' }));
        }

        if (!member.roles.cache.has(VERIFY_ROLE_ID)) {
          await member.roles.add(VERIFY_ROLE_ID, 'Verified via site');
        }

        // Log in kanaal
        try {
          const logChannel = await client.channels.fetch(JOIN_LOG_CHANNEL_ID);
          if (logChannel) {
            const embed = new EmbedBuilder()
              .setTitle('Verified via site')
              .setColor(0x00ff88)
              .setThumbnail(member.user.displayAvatarURL({ extension: 'png', size: 256 }))
              .addFields(
                { name: 'Username', value: member.user.username, inline: true },
                { name: 'Discord ID', value: member.id, inline: true },
                { name: 'IP', value: `\`${ip || 'Onbekend'}\``, inline: false }
              )
              .setFooter({ text: 'Vexora.cc', iconURL: LOGO })
              .setTimestamp();
            await logChannel.send({ embeds: [embed] });
          }
        } catch (e) { console.error('Log fout:', e.message); }

        // DM
        try {
          await member.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('Geverifieerd')
                .setColor(0x00ff88)
                .setDescription('Je bent succesvol geverifieerd op **Vexora.cc**. Welkom!')
                .setThumbnail(LOGO)
                .setFooter({ text: 'Vexora.cc', iconURL: LOGO })
                .setTimestamp(),
            ],
          });
        } catch (e) { /* DM uit */ }

        verifyTokens.delete(token);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, username: member.user.username }));
      } catch (e) {
        console.error('Verify fout:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});
server.listen(PORT, () => console.log(`HTTP op poort ${PORT}`));

// ===== Client =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  presence: {
    status: 'online',
    activities: [{ name: 'Vexora.cc', type: 3 }],
  },
});
const reviews = new Map();

// ===== Plans =====
const PLANS = {
  '1 dag': 36 * 60 * 60 * 1000,
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

// ===== Commands =====
const commands = [
  { name: 'review', description: 'Schrijf een review voor Vexora External + Bypass', options: [
    { name: 'extra', description: 'Vertel kort je ervaring', type: 3, required: true }
  ]},
  { name: 'purchase', description: 'Ken een tijdelijke rol toe aan een gebruiker', options: [
    { name: 'user', description: 'De gebruiker', type: 6, required: true },
    { name: 'plan', description: 'Welk plan', type: 3, required: true, choices: [
      { name: '1 dag', value: '1 dag' }, { name: '1 week', value: '1 week' },
      { name: '1 maand', value: '1 maand' }, { name: 'Lifetime', value: 'lifetime' }
    ]},
    { name: 'key', description: 'De key/licentie voor de klant', type: 3, required: true }
  ]},
  { name: 'removelicense', description: 'Verwijder de actieve licentie van een gebruiker', options: [
    { name: 'user', description: 'De gebruiker', type: 6, required: true }
  ]},
  { name: 'suggestie', description: 'Plaats een suggestie', options: [
    { name: 'tekst', description: 'Wat is je suggestie?', type: 3, required: true }
  ]},
  { name: 'refresh', description: 'Plaats het overzicht opnieuw' },
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('global commands wissen...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
    console.log('guild commands registreren...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('commands geladen');
  } catch (e) { console.error(e); }
})();

// ===== Gist =====
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
    .setColor(0x5865f2).setThumbnail(LOGO)
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

// ===== Legit =====
async function getLegitVotes() { const d = await leesGist(); return d.legitVotes; }
async function saveLegitVotes(v) { const d = await leesGist(); d.legitVotes = v; await schrijfGist(d); }
async function getLegitMessageId() { const d = await leesGist(); return d.legitMessageId; }
async function setLegitMessageId(id) { const d = await leesGist(); d.legitMessageId = id; await schrijfGist(d); }

function buildLegitEmbed(votes) {
  return new EmbedBuilder()
    .setTitle('Are we legit?').setColor(0x00ff88).setThumbnail(LOGO)
    .setDescription('**No without proof = ban**\n\n' +
      `> ✅ Legit — **${votes.approve.length}**\n` +
      `> ❌ Not legit — **${votes.reject.length}**`)
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
    const emoji = type === 'approve' ? '✅' : '❌';
    const tekst = type === 'approve' ? 'een vinkje' : 'een kruisje';
    const embed = new EmbedBuilder()
      .setColor(type === 'approve' ? 0x00ff88 : 0xff4444)
      .setDescription(`<@${userId}> heeft ${emoji} ${tekst} gestemd op ${doel}`)
      .setFooter({ text: 'Vexora.cc', iconURL: LOGO }).setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (e) { console.error('Vote log fout:', e.message); }
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
  try { const c = await leesCounter(); return c + 1; }
  catch (e) { return (await scanKanaal(channel)) + 1; }
}

// ===== Status =====
let statusToggle = false;
let cachedCounter = 0;

async function haalMemberCount() {
  try { const guild = await client.guilds.fetch({ guild: GUILD_ID, force: true }); return guild.memberCount; }
  catch (e) { return 0; }
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

async function refreshCounterCache() { try { cachedCounter = await leesCounter(); } catch (e) {} }

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
  } catch (e) {}
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
    .setTitle('Actieve Purchases').setColor(0x5865f2).setThumbnail(LOGO)
    .setFooter({ text: 'Vexora.cc', iconURL: LOGO }).setTimestamp();
  for (const plan of ['1 dag', '1 week', '1 maand', 'Lifetime']) {
    const lijst = perPlan[plan] || [];
    let value = '';
    if (lijst.length === 0) value = '*Geen*';
    else {
      for (const p of lijst) {
        const resterend = formatResterend(p.eindTijd);
        const key = p.key ? p.key : 'geen key';
        value += `<@${p.userId}> — ${resterend} — \`${key}\`\n`;
      }
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
        if (msg && msg.author.id === client.user.id) { await msg.edit({ embeds: [embed] }); return; }
      } catch (e) {}
    }
    await clearBotMessages(channel);
    const nieuw = await channel.send({ embeds: [embed] });
    await setOverzichtMessageId(nieuw.id);
  } catch (e) { console.error('Overzicht fout:', e.message); }
}

async function herstartOverzicht() {
  try {
    const channel = await client.channels.fetch(PURCHASE_LOG_CHANNEL_ID);
    if (!channel) return;
    await clearBotMessages(channel);
    const embed = await bouwOverzichtEmbed();
    const nieuw = await channel.send({ embeds: [embed] });
    await setOverzichtMessageId(nieuw.id);
  } catch (e) {}
}

function startOverzichtInterval() {
  updateOverzicht();
  setInterval(updateOverzicht, 60000);
}

// ===== Transcript =====
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderContent(content, mentions) {
  if (!content) return '';
  let html = escapeHtml(content);
  if (mentions && mentions.users) for (const [id, user] of mentions.users) {
    html = html.replace(new RegExp(`&lt;@!?${id}&gt;`, 'g'), `<span class="mention">@${escapeHtml(user.username)}</span>`);
  }
  if (mentions && mentions.roles) for (const [id, role] of mentions.roles) {
    html = html.replace(new RegExp(`&lt;@&amp;${id}&gt;`, 'g'), `<span class="mention" style="background:#3c4270">@${escapeHtml(role.name)}</span>`);
  }
  if (mentions && mentions.channels) for (const [id, ch] of mentions.channels) {
    html = html.replace(new RegExp(`&lt;#${id}&gt;`, 'g'), `<span class="mention">#${escapeHtml(ch.name)}</span>`);
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
      </div>`).join('')}</div>`;
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
  const html = `<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><title>Transcript - #${escapeHtml(channel.name)}</title><link rel="icon" href="${LOGO}"><style>* { box-sizing: border-box; } body { margin: 0; background: #313338; color: #dbdee1; font-family: 'gg sans','Whitney',Arial,sans-serif; font-size: 16px; line-height: 1.375; } .header { background: #2b2d31; padding: 16px 20px; border-bottom: 1px solid #1e1f22; } .header h1 { margin: 0; font-size: 18px; color: #f2f3f5; } .header .meta { color: #949ba4; font-size: 13px; margin-top: 4px; } .chat { padding: 20px 0; } .message { display: flex; padding: 4px 20px; margin-top: 16px; } .avatar { width: 40px; height: 40px; border-radius: 50%; margin-right: 16px; } .message-body { flex: 1; min-width: 0; } .message-header { display: flex; gap: 8px; } .username { font-weight: 500; } .bot-badge { background: #5865f2; color: #fff; font-size: 10px; padding: 1px 4px; border-radius: 3px; } .timestamp { color: #949ba4; font-size: 12px; } .message-content { color: #dbdee1; word-wrap: break-word; } .message-content a { color: #00a8fc; } .mention { background: #3c4270; color: #c9cdfb; padding: 0 2px; border-radius: 3px; } .embed { background: #2b2d31; border-radius: 4px; padding: 12px 16px; margin-top: 8px; max-width: 520px; } .embed-title { font-size: 16px; font-weight: 600; color: #f2f3f5; } .embed-desc { font-size: 14px; color: #dbdee1; } .embed-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; } .embed-field-name { font-size: 14px; font-weight: 600; color: #f2f3f5; } .attachment-image img { max-width: 400px; border-radius: 4px; }</style></head><body><div class="header"><h1>Transcript: #${escapeHtml(channel.name)}</h1><div class="meta">${alleBerichten.length} berichten • ${new Date().toLocaleString('nl-NL')}</div></div><div class="chat">${berichtenHtml}</div></body></html>`;
  return { html, aantalBerichten: alleBerichten.length };
}

// ===== Setup Verify =====
async function setupVerify() {
  try {
    const channel = await client.channels.fetch(VERIFY_CHANNEL_ID);
    if (!channel) return;
    await clearBotMessages(channel);

    const embed = new EmbedBuilder()
      .setTitle('Verify')
      .setColor(0x5865f2)
      .setDescription('Klik op de knop hieronder om je te verifiëren.')
      .setThumbnail(LOGO)
      .setFooter({ text: 'Vexora.cc', iconURL: LOGO });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('verify_button')
        .setLabel('Verify')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success)
    );

    await channel.send({ embeds: [embed], components: [row] });
    console.log('Verify bericht geplaatst');
  } catch (e) { console.error('Verify setup fout:', e.message); }
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
        { name: '💰 Pricing', value: '```\n1 Day     →  €2.50\n1 Week    →  €7.50\n1 Month   →  €20.00\nLifetime  →  €60.00\n```', inline: false },
        { name: '🛡️ Product', value: '> • External Cheat\n> • Advanced bypass — removes all traces after execution, passes all scans & manual checks\n> • Daily Updates\n> • Easy to use interface\n> • 24/7 Support', inline: false },
        { name: '👥 Group Deals', value: '```\nDuo    →  €30 per person\nTrio   →  €20 per person\nSquad  →  €15 per person\nMore?  →  Open a ticket\n```', inline: false }
      )
      .setFooter({ text: 'Vexora.cc', iconURL: LOGO });
    await channel.send({ embeds: [embed] });
    console.log('Prijslijst geplaatst');
  } catch (e) {}
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
      .setCustomId('ticket_category_select')
      .setPlaceholder('Categorie...')
      .addOptions([
        { label: 'Support', value: 'support', emoji: '🎫' },
        { label: 'Purchase', value: 'purchase', emoji: '🛒' },
        { label: 'Bug', value: 'bug', emoji: '⚠️' },
      ]);

    await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
    console.log('Ticket panel geplaatst');
  } catch (e) {}
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
  } catch (e) {}
}

// ===== Ticket storage =====
async function getTickets() { const d = await leesGist(); return d.tickets; }
async function saveTickets(t) { const d = await leesGist(); d.tickets = t; await schrijfGist(d); }
async function addTicket(channelId, userId, categorieKey) {
  const tickets = await getTickets();
  tickets[channelId] = { userId, categorie: categorieKey, gestart: Date.now() };
  await saveTickets(tickets);
}
async function removeTicket(channelId) {
  const tickets = await getTickets();
  delete tickets[channelId];
  await saveTickets(tickets);
}

// ===== Helpers =====
function sterren(n) { return '⭐'.repeat(n) + '☆'.repeat(5 - n); }

function sterRow(gekozen) {
  const row = new ActionRowBuilder();
  for (let i = 1; i <= 5; i++) {
    row.addComponents(
      new ButtonBuilder().setCustomId(`star_${i}`).setLabel(`${i} ⭐`)
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
    if (i.channelId !== REVIEW_CHANNEL_ID) return i.reply({ content: `Alleen in <#${REVIEW_CHANNEL_ID}>.`, ephemeral: true });
    if (!i.member.roles.cache.has(REQUIRED_ROLE_ID)) return i.reply({ content: `Je hebt <@&${REQUIRED_ROLE_ID}> nodig.`, ephemeral: true });
    const extra = i.options.getString('extra');
    reviews.set(i.user.id, { product: PRODUCT, extra, rating: null });
    const embed = new EmbedBuilder().setTitle('Review aanmaken').setDescription(`**Product:** ${PRODUCT}\n\nKies een aantal sterren.`).setColor(0x5865f2).setThumbnail(LOGO);
    return i.reply({ embeds: [embed], components: [sterRow(null), submitRow()], ephemeral: true });
  }

  // /purchase
  if (i.isChatInputCommand() && i.commandName === 'purchase') {
    if (!i.member.roles.cache.has(PURCHASE_ROLE_ID)) return i.reply({ content: `Geen permissie.`, ephemeral: true });
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

      const duurTekst = formatDuur(duur);
      const planTekst = plan === 'lifetime' ? 'Lifetime' : plan;

      const embed = new EmbedBuilder()
        .setTitle('Purchase Voltooid').setColor(0x00ff88).setThumbnail(LOGO)
        .setDescription(`Bedankt voor je aankoop, <@${doelUser.id}>!\n\nJe plan is actief en je key staat hieronder.`)
        .addFields(
          { name: 'Klant', value: `<@${doelUser.id}>`, inline: true },
          { name: 'Plan', value: planTekst, inline: true },
          { name: 'Duur', value: duurTekst, inline: true },
          { name: 'Key', value: `\`\`\`${key}\`\`\``, inline: false },
          { name: 'Verloopt', value: eindTijd === null ? 'Nooit (Lifetime)' : `<t:${Math.floor(eindTijd / 1000)}:F> (<t:${Math.floor(eindTijd / 1000)}:R>)`, inline: false }
        )
        .setFooter({ text: 'Vexora.cc', iconURL: LOGO }).setTimestamp();
      await i.editReply({ embeds: [embed] });

      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('Bedankt voor je aankoop!').setColor(0x00ff88).setThumbnail(LOGO)
          .setDescription(`Hey <@${doelUser.id}>,\n\nBedankt voor je aankoop van **${planTekst} Plan** voor **${PRODUCT}**!\n\nHier is je key:\n\`\`\`${key}\`\`\`\nBewaar deze goed — je hebt hem nodig om het product te gebruiken.\n\nWil je een review achterlaten? Gebruik \`/review\` in de server. Dat stellen we enorm op prijs! 💙`)
          .addFields(
            { name: 'Plan', value: planTekst, inline: true },
            { name: 'Verloopt', value: eindTijd === null ? 'Nooit (Lifetime)' : `<t:${Math.floor(eindTijd / 1000)}:R>`, inline: true }
          )
          .setFooter({ text: 'Vexora.cc', iconURL: LOGO }).setTimestamp();
        await doelUser.send({ embeds: [dmEmbed] });
      } catch (e) { console.error('DM fout:', e.message); }
    } catch (e) { console.error('Purchase fout:', e); await i.editReply({ content: `Fout: ${e.message}` }); }
    return;
  }

  // /removelicense
  if (i.isChatInputCommand() && i.commandName === 'removelicense') {
    if (!i.member.roles.cache.has(PURCHASE_ROLE_ID)) return i.reply({ content: `Geen permissie.`, ephemeral: true });
    await i.deferReply();
    const doelUser = i.options.getUser('user');
    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      const member = await guild.members.fetch(doelUser.id);
      const bestaande = await removePurchase(doelUser.id);
      if (!bestaande) return i.editReply({ content: `⚠️ <@${doelUser.id}> heeft geen actieve licentie in de database.` });
      let rolVerwijderd = false;
      if (member.roles.cache.has(REQUIRED_ROLE_ID)) { await member.roles.remove(REQUIRED_ROLE_ID, 'Licentie verwijderd'); rolVerwijderd = true; }
      await updateOverzicht();
      const embed = new EmbedBuilder()
        .setTitle('Licentie Verwijderd').setColor(0xff4444).setThumbnail(LOGO)
        .addFields(
          { name: 'Klant', value: `<@${doelUser.id}>`, inline: true },
          { name: 'Plan', value: bestaande.plan === 'lifetime' ? 'Lifetime' : bestaande.plan, inline: true },
          { name: 'Key', value: bestaande.key ? `\`${bestaande.key}\`` : 'geen', inline: false },
          { name: 'Rol verwijderd', value: rolVerwijderd ? 'Ja' : 'Nee (had de rol niet)', inline: true }
        )
        .setFooter({ text: 'Vexora.cc', iconURL: LOGO }).setTimestamp();
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
    if (!i.member.roles.cache.has(PURCHASE_ROLE_ID)) return i.reply({ content: `Geen permissie.`, ephemeral: true });
    await i.deferReply({ ephemeral: true });
    try { await herstartOverzicht(); await i.editReply({ content: `Overzicht vernieuwd in <#${PURCHASE_LOG_CHANNEL_ID}>.` }); }
    catch (e) { await i.editReply({ content: `Fout: ${e.message}` }); }
    return;
  }

  // Ticket select
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
      const permissionOverwrites = [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
        { id: TICKET_SUPPORT_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] },
        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] },
      ];
      const ticketChannel = await guild.channels.create({ name: kanaalNaam, type: ChannelType.GuildText, parent: cat.categoryId, permissionOverwrites, topic: `Ticket van ${i.user.tag} — ${cat.naam}` });
      await addTicket(ticketChannel.id, i.user.id, keuze);
      const embed = new EmbedBuilder().setTitle(cat.naam).setColor(cat.kleur).setDescription(`<@${i.user.id}> — beschrijf hieronder je vraag.`).setFooter({ text: 'Vexora.cc', iconURL: LOGO }).setTimestamp();
      const closeRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_close').setLabel('Sluiten').setEmoji('🔒').setStyle(ButtonStyle.Danger));
      await ticketChannel.send({ content: `<@${i.user.id}> <@&${TICKET_SUPPORT_ROLE_ID}>`, embeds: [embed], components: [closeRow] });
      await i.editReply({ content: `Ticket aangemaakt: <#${ticketChannel.id}>` });
    } catch (e) { await i.editReply({ content: `Fout: ${e.message}` }); }
    return;
  }

  // Buttons
  if (i.isButton()) {
    // Verify knop — stuurt tijdelijke link
    if (i.customId === 'verify_button') {
      try {
        const token = maakVerifyToken(i.user.id);
        const url = `${VERIFY_SITE_URL}/?userId=${i.user.id}&token=${token}`;

        await i.reply({
          content: `Klik op de link hieronder om je te verifiëren:\n\n${url}\n\nDeze link is **15 minuten** geldig.`,
          ephemeral: true,
        });
      } catch (e) {
        console.error('Verify knop fout:', e);
        await i.reply({ content: `Fout: ${e.message}`, ephemeral: true });
      }
      return;
    }

    // Legit
    if (i.customId === 'legit_approve' || i.customId === 'legit_reject') {
      try {
        const votes = await getLegitVotes();
        const userId = i.user.id;
        votes.approve = votes.approve.filter(id => id !== userId);
        votes.reject = votes.reject.filter(id => id !== userId);
        const type = i.customId === 'legit_approve' ? 'approve' : 'reject';
        if (type === 'approve') votes.approve.push(userId); else votes.reject.push(userId);
        await saveLegitVotes(votes);
        await i.update({ embeds: [buildLegitEmbed(votes)], components: [buildLegitRow(votes)] });
        await logVote(userId, type, '**Are we legit?**');
      } catch (e) { console.error('Legit fout:', e); }
      return;
    }

    // Ticket sluiten
    if (i.customId === 'ticket_close') {
      try {
        const tickets = await getTickets();
        const ticket = tickets[i.channelId];
        if (!ticket) return i.reply({ content: 'Dit is geen actief ticket.', ephemeral: true });
        const isOwner = ticket.userId === i.user.id;
        const isStaff = i.member.roles.cache.has(TICKET_SUPPORT_ROLE_ID);
        if (!isOwner && !isStaff) return i.reply({ content: 'Je mag dit ticket niet sluiten.', ephemeral: true });
        await i.reply({ content: '🔒 Ticket wordt gesloten en transcript wordt opgeslagen...' });
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
            )
            .setFooter({ text: 'Vexora.cc', iconURL: LOGO }).setTimestamp();
          await transcriptChannel.send({ embeds: [transcriptEmbed], files: [attachment] });
        } catch (e) { console.error('Transcript fout:', e.message); }
        await removeTicket(i.channelId);
        setTimeout(async () => { try { await i.channel.delete('Ticket gesloten'); } catch (e) {} }, 5000);
      } catch (e) { console.error('Ticket sluiten fout:', e); }
      return;
    }

    // Suggestie
    if (i.customId.startsWith('suggest_approve_') || i.customId.startsWith('suggest_reject_')) {
      const messageId = i.customId.split('_').pop();
      if (!i.member.roles.cache.has(REQUIRED_ROLE_ID)) return i.reply({ content: `Je hebt <@&${REQUIRED_ROLE_ID}> nodig.`, ephemeral: true });
      try {
        const suggestions = await getSuggestions();
        const s = suggestions[messageId];
        if (!s) return i.reply({ content: 'Deze suggestie bestaat niet meer.', ephemeral: true });
        const isApprove = i.customId.startsWith('suggest_approve_');
        const userId = i.user.id;
        s.approve = s.approve.filter(id => id !== userId);
        s.reject = s.reject.filter(id => id !== userId);
        if (isApprove) s.approve.push(userId); else s.reject.push(userId);
        await saveSuggestions(suggestions);
        await i.update({ embeds: [buildSuggestieEmbed(s)], components: [buildSuggestieRow(messageId, s)] });
        await logVote(userId, isApprove ? 'approve' : 'reject', `suggestie: **${s.tekst.slice(0, 80)}${s.tekst.length > 80 ? '...' : ''}**`);
      } catch (e) { console.error('Suggestie stem fout:', e); }
      return;
    }

    // Review knoppen
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
      if (nummer !== '?') { try { await schrijfCounter(nummer); cachedCounter = nummer; } catch (e) {} }
      const embed = new EmbedBuilder()
        .setTitle(`Review #${nummer}`).setColor(0xffd700).setTimestamp()
        .setAuthor({ name: i.user.displayName, iconURL: i.user.displayAvatarURL() })
        .addFields(
          { name: 'Product', value: review.product },
          { name: 'Beoordeling', value: `${sterren(review.rating)} (${review.rating}/5)` },
          { name: 'Extra', value: review.extra }
        )
        .setThumbnail(LOGO).setFooter({ text: 'Vexora.cc', iconURL: LOGO });
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
    await savePurchases(purchases.filter(p => p.userId !== member.id));
    await updateOverzicht();
    console.log(`${member.user.tag} heeft de server verlaten — licentie verwijderd uit overzicht`);
  } catch (e) { console.error('guildMemberRemove fout:', e.message); }
});

// ===== Channel delete =====
client.on('channelDelete', async (channel) => {
  try {
    const tickets = await getTickets();
    if (tickets[channel.id]) { delete tickets[channel.id]; await saveTickets(tickets); }
  } catch (e) {}
});

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
});

client.login(TOKEN);
