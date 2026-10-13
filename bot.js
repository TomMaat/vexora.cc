require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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
const PRODUCT = 'Vexora External + Bypass';
const STATUS_INTERVAL = 8000;
// =========================

http.createServer((req, res) => {
  res.writeHead(200);
  res.end('ok');
}).listen(PORT);

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
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

function planDuurMs(plan) {
  return PLANS[plan];
}

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
// ==============

// ===== Commands =====
const commands = [
  {
    name: 'review',
    description: 'Schrijf een review voor Vexora External + Bypass',
    options: [
      { name: 'extra', description: 'Vertel kort je ervaring', type: 3, required: true },
    ],
  },
  {
    name: 'purchase',
    description: 'Ken een tijdelijke rol toe aan een gebruiker',
    options: [
      { name: 'user', description: 'De gebruiker', type: 6, required: true },
      {
        name: 'plan',
        description: 'Welk plan',
        type: 3,
        required: true,
        choices: [
          { name: '1 dag', value: '1 dag' },
          { name: '1 week', value: '1 week' },
          { name: '1 maand', value: '1 maand' },
          { name: 'Lifetime', value: 'lifetime' },
        ],
      },
      { name: 'key', description: 'De key/licentie voor de klant', type: 3, required: true },
    ],
  },
  {
    name: 'suggestie',
    description: 'Plaats een suggestie',
    options: [
      { name: 'tekst', description: 'Wat is je suggestie?', type: 3, required: true },
    ],
  },
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('global commands wissen...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });

    console.log('guild commands registreren...');
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('commands geladen');
  } catch (e) {
    console.error(e);
  }
})();

// ===== Gist storage =====
async function leesGist() {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) throw new Error(`Gist read faalde: ${res.status}`);
  const data = await res.json();
  const content = data.files['reviews.json'].content;
  const parsed = JSON.parse(content);
  return {
    counter: parsed.counter || 0,
    purchases: parsed.purchases || [],
    suggestions: parsed.suggestions || {},
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
    body: JSON.stringify({
      files: {
        'reviews.json': { content: JSON.stringify(data, null, 2) },
      },
    }),
  });
  if (!res.ok) throw new Error(`Gist write faalde: ${res.status}`);
}

async function leesCounter() {
  const data = await leesGist();
  return data.counter;
}

async function schrijfCounter(n) {
  const data = await leesGist();
  data.counter = n;
  await schrijfGist(data);
}

// ===== Purchase =====
async function getPurchases() {
  const data = await leesGist();
  return data.purchases;
}

async function savePurchases(purchases) {
  const data = await leesGist();
  data.purchases = purchases;
  await schrijfGist(data);
}

async function addPurchase(userId, plan, key) {
  const purchases = await getPurchases();
  const duur = planDuurMs(plan);
  const eindTijd = duur === null ? null : Date.now() + duur;

  const filtered = purchases.filter(p => p.userId !== userId);
  filtered.push({
    userId,
    plan,
    key,
    eindTijd,
    gestart: Date.now(),
  });

  await savePurchases(filtered);
  return { eindTijd, duur };
}

// ===== Suggestie =====
async function getSuggestions() {
  const data = await leesGist();
  return data.suggestions;
}

async function saveSuggestions(suggestions) {
  const data = await leesGist();
  data.suggestions = suggestions;
  await schrijfGist(data);
}

function buildSuggestieEmbed(s) {
  const approveCount = s.approve.length;
  const rejectCount = s.reject.length;

  return new EmbedBuilder()
    .setTitle('Nieuwe Suggestie')
    .setColor(0x5865f2)
    .setThumbnail(LOGO)
    .setDescription(s.tekst)
    .addFields(
      { name: 'Door', value: `<@${s.auteurId}>`, inline: true },
      { name: 'Stemmen', value: `✅ ${approveCount}  •  ❌ ${rejectCount}`, inline: true }
    )
    .setFooter({ text: 'Vexora.cc', iconURL: LOGO })
    .setTimestamp(s.gestart);
}

function buildSuggestieRow(messageId, s) {
  const approveBtn = new ButtonBuilder()
    .setCustomId(`suggest_approve_${messageId}`)
    .setLabel(`✅ ${s.approve.length}`)
    .setStyle(ButtonStyle.Secondary);

  const rejectBtn = new ButtonBuilder()
    .setCustomId(`suggest_reject_${messageId}`)
    .setLabel(`❌ ${s.reject.length}`)
    .setStyle(ButtonStyle.Secondary);

  return new ActionRowBuilder().addComponents(approveBtn, rejectBtn);
}

// ===== Review nummer =====
async function scanKanaal(channel) {
  let hoogste = 0;
  let laatsteId = null;
  let doorzoeken = true;

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
  try {
    const c = await leesCounter();
    return c + 1;
  } catch (e) {
    console.error('Gist faalde, val terug op kanaal scan:', e.message);
    const hoogste = await scanKanaal(channel);
    return hoogste + 1;
  }
}

// ===== Status =====
let statusToggle = false;
let cachedCounter = 0;

async function haalMemberCount() {
  try {
    const guild = await client.guilds.fetch({ guild: GUILD_ID, force: true });
    return guild.memberCount;
  } catch (e) {
    console.error('Kon memberCount niet ophalen:', e.message);
    return 0;
  }
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
  } catch (e) {
    console.error('Kon status niet updaten:', e.message);
  }
}

async function refreshCounterCache() {
  try {
    cachedCounter = await leesCounter();
  } catch (e) {
    console.error('Kon counter niet cachen:', e.message);
  }
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
      if (p.eindTijd === null) continue;
      if (p.eindTijd > nu) continue;

      try {
        const member = await guild.members.fetch(p.userId);
        if (member && member.roles.cache.has(REQUIRED_ROLE_ID)) {
          await member.roles.remove(REQUIRED_ROLE_ID, 'Plan verlopen');
          console.log(`Rol verwijderd van ${member.user.tag} (plan verlopen)`);
        }
      } catch (e) {
        console.error(`Kon rol niet verwijderen voor ${p.userId}:`, e.message);
      }
    }

    const nogActief = purchases.filter(p => p.eindTijd === null || p.eindTijd > nu);
    if (nogActief.length !== purchases.length) {
      await savePurchases(nogActief);
    }
  } catch (e) {
    console.error('Fout bij checkRolVerval:', e.message);
  }
}

function startVervalInterval() {
  checkRolVerval();
  setInterval(checkRolVerval, 60000);
}

// ===== Overzicht =====
async function updateOverzicht() {
  try {
    const channel = await client.channels.fetch(PURCHASE_LOG_CHANNEL_ID);
    if (!channel) return;

    const purchases = await getPurchases();

    const perPlan = {};
    for (const plan of Object.keys(PLANS)) {
      perPlan[plan] = [];
    }

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

    for (const plan of ['1 dag', '1 week', '1 maand', 'Lifetime']) {
      const lijst = perPlan[plan] || [];
      let value = '';

      if (lijst.length === 0) {
        value = '*Geen*';
      } else {
        for (const p of lijst) {
          const resterend = formatResterend(p.eindTijd);
          const key = p.key ? p.key : 'geen key';
          value += `<@${p.userId}> — ${resterend} — \`${key}\`\n`;
        }
      }

      if (value.length > 1024) {
        value = value.slice(0, 1020) + '...';
      }

      embed.addFields({ name: `**${plan}** (${lijst.length})`, value, inline: false });
    }

    const berichten = await channel.messages.fetch({ limit: 20 });
    const eigenBericht = berichten.find(m => m.author.id === client.user.id && m.embeds.length > 0);

    if (eigenBericht) {
      await eigenBericht.edit({ embeds: [embed] });
    } else {
      await channel.send({ embeds: [embed] });
    }
  } catch (e) {
    console.error('Kon overzicht niet updaten:', e.message);
  }
}

function startOverzichtInterval() {
  updateOverzicht();
  setInterval(updateOverzicht, 60000);
}

// ===== Helpers =====
function sterren(n) {
  return '⭐'.repeat(n) + '☆'.repeat(5 - n);
}

function sterRow(gekozen) {
  const row = new ActionRowBuilder();
  for (let i = 1; i <= 5; i++) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`star_${i}`)
        .setLabel(`${i} ⭐`)
        .setStyle(gekozen === i ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(gekozen !== null && gekozen !== i)
    );
  }
  return row;
}

function submitRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('submit')
      .setLabel('Verstuur')
      .setStyle(ButtonStyle.Primary)
  );
}

// ===== Interaction handler =====
client.on('interactionCreate', async (i) => {
  // ===== /review =====
  if (i.isChatInputCommand() && i.commandName === 'review') {
    if (i.channelId !== REVIEW_CHANNEL_ID) {
      return i.reply({
        content: `Je kunt alleen in <#${REVIEW_CHANNEL_ID}> een review plaatsen.`,
        ephemeral: true,
      });
    }

    if (!i.member.roles.cache.has(REQUIRED_ROLE_ID)) {
      return i.reply({
        content: `Je hebt de <@&${REQUIRED_ROLE_ID}> rol nodig om een review te plaatsen.`,
        ephemeral: true,
      });
    }

    const extra = i.options.getString('extra');
    reviews.set(i.user.id, { product: PRODUCT, extra, rating: null });

    const embed = new EmbedBuilder()
      .setTitle('Review aanmaken')
      .setDescription(`**Product:** ${PRODUCT}\n\nKies een aantal sterren.`)
      .setColor(0x5865f2)
      .setThumbnail(LOGO);

    return i.reply({
      embeds: [embed],
      components: [sterRow(null), submitRow()],
      ephemeral: true,
    });
  }

  // ===== /purchase =====
  if (i.isChatInputCommand() && i.commandName === 'purchase') {
    if (!i.member.roles.cache.has(PURCHASE_ROLE_ID)) {
      return i.reply({
        content: `Je hebt de <@&${PURCHASE_ROLE_ID}> rol nodig om dit te doen.`,
        ephemeral: true,
      });
    }

    await i.deferReply();

    const doelUser = i.options.getUser('user');
    const plan = i.options.getString('plan');
    const key = i.options.getString('key');
    const duur = planDuurMs(plan);

    if (duur === undefined) {
      return i.editReply({ content: 'Onbekend plan.' });
    }

    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      const member = await guild.members.fetch(doelUser.id);

      await member.roles.add(REQUIRED_ROLE_ID, `Purchase: ${plan}`);

      const { eindTijd } = await addPurchase(doelUser.id, plan, key);

      await updateOverzicht();

      const duurTekst = formatDuur(duur);

      const embed = new EmbedBuilder()
        .setTitle('Purchase Voltooid')
        .setColor(0x00ff88)
        .setThumbnail(LOGO)
        .setDescription(
          `Bedankt voor je aankoop, <@${doelUser.id}>!\n\n` +
          `Je plan is actief en je key staat hieronder.`
        )
        .addFields(
          { name: 'Klant', value: `<@${doelUser.id}>`, inline: true },
          { name: 'Plan', value: plan === 'lifetime' ? 'Lifetime' : plan, inline: true },
          { name: 'Duur', value: duurTekst, inline: true },
          { name: 'Key', value: `\`\`\`${key}\`\`\``, inline: false },
          {
            name: 'Verloopt',
            value: eindTijd === null
              ? 'Nooit (Lifetime)'
              : `<t:${Math.floor(eindTijd / 1000)}:F> (<t:${Math.floor(eindTijd / 1000)}:R>)`,
            inline: false,
          }
        )
        .setFooter({ text: 'Vexora.cc', iconURL: LOGO })
        .setTimestamp();

      await i.editReply({ embeds: [embed] });

      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('Bedankt voor je aankoop!')
          .setColor(0x00ff88)
          .setThumbnail(LOGO)
          .setDescription(
            `Hey <@${doelUser.id}>,\n\n` +
            `Bedankt voor het kopen van **${plan === 'lifetime' ? 'Lifetime' : plan}** bij Vexora!\n\n` +
            `Hier is je key:\n\`\`\`${key}\`\`\`\n` +
            `Bewaar deze goed — je hebt hem nodig om het product te gebruiken.\n\n` +
            `Wil je een review achterlaten? Gebruik \`/review\` in de server. Dat stellen we enorm op prijs! 💙`
          )
          .addFields(
            { name: 'Plan', value: plan === 'lifetime' ? 'Lifetime' : plan, inline: true },
            {
              name: 'Verloopt',
              value: eindTijd === null
                ? 'Nooit (Lifetime)'
                : `<t:${Math.floor(eindTijd / 1000)}:R>`,
              inline: true,
            }
          )
          .setFooter({ text: 'Vexora.cc', iconURL: LOGO })
          .setTimestamp();

        await doelUser.send({ embeds: [dmEmbed] });
      } catch (e) {
        console.error('Kon DM niet sturen naar', doelUser.tag, ':', e.message);
      }
    } catch (e) {
      console.error('Purchase fout:', e);
      await i.editReply({ content: `Fout: ${e.message}` });
    }
    return;
  }

  // ===== /suggestie =====
  if (i.isChatInputCommand() && i.commandName === 'suggestie') {
    await i.deferReply({ ephemeral: true });

    const tekst = i.options.getString('tekst');

    try {
      const kanaal = await client.channels.fetch(SUGGESTIE_CHANNEL_ID);

      const placeholder = new EmbedBuilder()
        .setTitle('Nieuwe Suggestie')
        .setColor(0x5865f2)
        .setThumbnail(LOGO)
        .setDescription('Laden...')
        .setFooter({ text: 'Vexora.cc', iconURL: LOGO })
        .setTimestamp();

      const bericht = await kanaal.send({ embeds: [placeholder] });

      const suggestions = await getSuggestions();
      suggestions[bericht.id] = {
        tekst,
        auteurId: i.user.id,
        approve: [],
        reject: [],
        gestart: Date.now(),
      };
      await saveSuggestions(suggestions);

      const s = suggestions[bericht.id];
      await bericht.edit({
        embeds: [buildSuggestieEmbed(s)],
        components: [buildSuggestieRow(bericht.id, s)],
      });

      await i.editReply({ content: `Je suggestie is geplaatst in <#${SUGGESTIE_CHANNEL_ID}>.` });
    } catch (e) {
      console.error('Suggestie fout:', e);
      await i.editReply({ content: `Fout: ${e.message}` });
    }
    return;
  }

  // ===== Buttons =====
  if (i.isButton()) {
    // Suggestie knoppen
    if (i.customId.startsWith('suggest_approve_') || i.customId.startsWith('suggest_reject_')) {
      const messageId = i.customId.split('_').pop();

      if (!i.member.roles.cache.has(REQUIRED_ROLE_ID)) {
        return i.reply({
          content: `Je hebt de <@&${REQUIRED_ROLE_ID}> rol nodig om te stemmen.`,
          ephemeral: true,
        });
      }

      try {
        const suggestions = await getSuggestions();
        const s = suggestions[messageId];

        if (!s) {
          return i.reply({ content: 'Deze suggestie bestaat niet meer.', ephemeral: true });
        }

        const isApprove = i.customId.startsWith('suggest_approve_');
        const userId = i.user.id;

        s.approve = s.approve.filter(id => id !== userId);
        s.reject = s.reject.filter(id => id !== userId);

        if (isApprove) {
          s.approve.push(userId);
        } else {
          s.reject.push(userId);
        }

        await saveSuggestions(suggestions);

        await i.update({
          embeds: [buildSuggestieEmbed(s)],
          components: [buildSuggestieRow(messageId, s)],
        });
      } catch (e) {
        console.error('Suggestie stem fout:', e);
        await i.reply({ content: `Fout: ${e.message}`, ephemeral: true });
      }
      return;
    }

    // Review knoppen
    const review = reviews.get(i.user.id);
    if (!review) {
      return i.reply({ content: 'Deze review is verlopen. Gebruik /review opnieuw.', ephemeral: true });
    }

    if (i.customId.startsWith('star_')) {
      const n = parseInt(i.customId.split('_')[1]);
      review.rating = n;
      return i.update({ components: [sterRow(n), submitRow()] });
    }

    if (i.customId === 'submit') {
      if (!review.rating) {
        return i.reply({ content: 'Kies eerst een aantal sterren.', ephemeral: true });
      }

      await i.deferUpdate();

      let nummer;
      try {
        nummer = await volgendNummer(i.channel);
      } catch (e) {
        console.error('Kon nummer niet bepalen:', e);
        nummer = '?';
      }

      if (nummer !== '?') {
        try {
          await schrijfCounter(nummer);
          cachedCounter = nummer;
        } catch (e) {
          console.error('Kon nummer niet opslaan:', e.message);
        }
      }

      const embed = new EmbedBuilder()
        .setTitle(`Review #${nummer}`)
        .setColor(0xffd700)
        .setTimestamp()
        .setAuthor({
          name: i.user.displayName,
          iconURL: i.user.displayAvatarURL(),
        })
        .addFields(
          { name: 'Product', value: review.product },
          { name: 'Beoordeling', value: `${sterren(review.rating)} (${review.rating}/5)` },
          { name: 'Extra', value: review.extra }
        )
        .setThumbnail(LOGO)
        .setFooter({ text: 'Vexora.cc', iconURL: LOGO });

      await i.editReply({ components: [] });
      await i.channel.send({ embeds: [embed] });
      reviews.delete(i.user.id);
    }
  }
});

client.once('ready', async () => {
  console.log(`online als ${client.user.tag}`);
  startStatusInterval();
  startVervalInterval();
  startOverzichtInterval();
});

client.login(TOKEN);
