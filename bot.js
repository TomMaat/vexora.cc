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
  PermissionFlagsBits,
} = require('discord.js');
const http = require('http');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const LOGO = 'https://cdn.discordapp.com/attachments/1557498332262301716/1558123583371481139/Vexora.png?ex=6ace3faa&is=6accee2a&hm=c27628f8d9c71dab36f1041308bc32a630c03fadc49bf418913598bd4944c7ea&'; // ← directe link hier
const PORT = process.env.PORT || 3000;

// ===== Instellingen =====
const REVIEW_CHANNEL_ID = '1559313542509887569'; // ← kanaal ID waar /review werkt
const REQUIRED_ROLE_ID = '1556357822998913094';  // ← rol ID die je nodig hebt
// =========================

http.createServer((req, res) => {
  res.writeHead(200);
  res.end('ok');
}).listen(PORT);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const reviews = new Map();

const commands = [{
  name: 'review',
  description: 'Schrijf een review',
  options: [
    { name: 'product', description: 'Welk product?', type: 3, required: true },
    { name: 'extra', description: 'Extra opmerking', type: 3, required: false },
  ],
  default_member_permissions: null,
}];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('commands geladen');
  } catch (e) {
    console.error(e);
  }
})();

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
    // Check kanaal
    if (i.channelId !== REVIEW_CHANNEL_ID) {
      return i.reply({
        content: `Je kunt alleen in <#${REVIEW_CHANNEL_ID}> een review plaatsen.`,
        ephemeral: true,
      });
    }

    // Check rol
    if (!i.member.roles.cache.has(REQUIRED_ROLE_ID)) {
      return i.reply({
        content: `Je hebt de <@&${REQUIRED_ROLE_ID}> rol nodig om een review te plaatsen.`,
        ephemeral: true,
      });
    }

    const product = i.options.getString('product');
    const extra = i.options.getString('extra') || '';

    reviews.set(i.user.id, { product, extra, rating: null });

    const embed = new EmbedBuilder()
      .setTitle('Review aanmaken')
      .setDescription(`**Product:** ${product}\n\nKies een aantal sterren.`)
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

      const embed = new EmbedBuilder()
        .setTitle('Nieuwe Review')
        .setColor(0xffd700)
        .setTimestamp()
        .setAuthor({
          name: i.user.displayName,
          iconURL: i.user.displayAvatarURL(),
        })
        .addFields(
          { name: 'Product', value: review.product },
          { name: 'Beoordeling', value: `${sterren(review.rating)} (${review.rating}/5)` },
          { name: 'Extra', value: review.extra || 'Geen' }
        )
        .setThumbnail(LOGO)
        .setFooter({ text: 'Review Bot', iconURL: client.user.displayAvatarURL() });

      await i.update({ components: [] });
      await i.channel.send({ embeds: [embed] });
      reviews.delete(i.user.id);
    }
  }
});

client.once('ready', () => {
  console.log(`online als ${client.user.tag}`);
});

client.login(TOKEN);
