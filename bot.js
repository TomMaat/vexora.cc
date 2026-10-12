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
const PRODUCT = 'Vexora External + Bypass';
const FRAME_MS = 400;      // tijd per letter (hoger = langzamer)
const HOLD_MS = 2000;      // tijd dat de volledige tekst blijft staan
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

const commands = [{
  name: 'review',
  description: 'Schrijf een review voor Vexora External + Bypass',
  options: [
    { name: 'extra', description: 'Vertel kort je ervaring', type: 3, required: true },
  ],
}];

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

// ===== Review nummer: Gist eerst, kanaal als fallback =====
async function leesCounter() {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) throw new Error(`Gist read faalde: ${res.status}`);
  const data = await res.json();
  return JSON.parse(data.files['reviews.json'].content).counter || 0;
}

async function schrijfCounter(n) {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: { 'reviews.json': { content: JSON.stringify({ counter: n }) } },
    }),
  });
  if (!res.ok) throw new Error(`Gist write faalde: ${res.status}`);
}

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

// ===== Status fade animatie =====
let cachedCounter = 0;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fadeIn(tekst) {
  for (let i = 1; i <= tekst.length; i++) {
    client.user.setActivity(tekst.slice(0, i), { type: 3 });
    await sleep(FRAME_MS);
  }
}

async function fadeOut(tekst) {
  for (let i = tekst.length - 1; i >= 1; i--) {
    client.user.setActivity(tekst.slice(0, i), { type: 3 });
    await sleep(FRAME_MS);
  }
  client.user.setActivity('\u200b', { type: 3 });
}

async function toonMetFade(tekst) {
  await fadeIn(tekst);
  await sleep(HOLD_MS);
  await fadeOut(tekst);
  await sleep(500);
}

async function statusLoop() {
  while (true) {
    try {
      const guild = await client.guilds.fetch(GUILD_ID);

      await toonMetFade(`${cachedCounter} Reviews`);
      await toonMetFade(`${guild.memberCount} Members`);

      // Counter verversen
      try {
        cachedCounter = await leesCounter();
      } catch (e) {
        console.error('Counter refresh faalde:', e.message);
      }
    } catch (e) {
      console.error('Status loop fout:', e.message);
      await sleep(5000);
    }
  }
}
// ==========================================================

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

client.on('interactionCreate', async (i) => {
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

  if (i.isButton()) {
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

  try {
    cachedCounter = await leesCounter();
  } catch (e) {
    console.error('Kon counter niet laden:', e.message);
  }

  statusLoop();
});

client.login(TOKEN);
