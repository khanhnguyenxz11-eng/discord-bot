const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const express = require("express");
const fs = require("fs");

/* ================= CHỐNG CRASH ================= */

process.on("uncaughtException", err => console.log("UNCAUGHT:", err));
process.on("unhandledRejection", err => console.log("UNHANDLED:", err));

/* ================= ENV ================= */

const TOKEN = process.env.TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const PRICE = Number(process.env.PRICE) || 150000;

const BANK_CODE = process.env.BANK_CODE;
const BANK_ACC = process.env.BANK_ACC;
const BANK_NAME = process.env.BANK_NAME;

/* ================= FILE JSON SAFE ================= */

function loadJSON(path, defaultData) {
  try {
    if (!fs.existsSync(path)) {
      fs.writeFileSync(path, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }
    return JSON.parse(fs.readFileSync(path));
  } catch {
    return defaultData;
  }
}

function saveJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

let stock = loadJSON("stock.json", { vip: [] });
let users = loadJSON("users.json", {});
if (!stock.vip) stock.vip = [];

/* ================= DISCORD ================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("clientReady", () => {
  console.log("Bot online:", client.user.tag);
});

/* ================= PANEL ================= */

async function sendPanel(channel) {

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("buy")
      .setLabel("🛒 Mua VIP")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("deposit")
      .setLabel("💳 Nạp tiền")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("balance")
      .setLabel("💰 Số dư")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("add")
      .setLabel("➕ Thêm SP")
      .setStyle(ButtonStyle.Danger)
  );

  channel.send({
    content:
      `📦 Kho hiện có: ${stock.vip.length}\n` +
      `💵 Giá VIP: ${PRICE}`,
    components: [row]
  });
}

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (message.content === "!panel") {
    sendPanel(message.channel);
  }
});

/* ================= INTERACTION ================= */

client.on("interactionCreate", async interaction => {

  if (interaction.isButton()) {

    /* ===== MUA ===== */
    if (interaction.customId === "buy") {

      const userId = interaction.user.id;
      if (!users[userId]) users[userId] = { balance: 0 };

      if (users[userId].balance < PRICE)
        return interaction.reply({ content: "❌ Không đủ tiền.", ephemeral: true });

      if (stock.vip.length === 0)
        return interaction.reply({ content: "❌ Hết hàng.", ephemeral: true });

      const product = stock.vip.shift();
      users[userId].balance -= PRICE;

      saveJSON("stock.json", stock);
      saveJSON("users.json", users);

      return interaction.reply({
        content:
          `✅ Mua thành công!\n\n🎁 Key:\n${product}\n\n💰 Số dư còn: ${users[userId].balance}`,
        ephemeral: true
      });
    }

    /* ===== SỐ DƯ ===== */
    if (interaction.customId === "balance") {

      const userId = interaction.user.id;
      if (!users[userId]) users[userId] = { balance: 0 };

      return interaction.reply({
        content: `💰 Số dư của bạn: ${users[userId].balance}`,
        ephemeral: true
      });
    }

    /* ===== NẠP TIỀN ===== */
    if (interaction.customId === "deposit") {

      const userId = interaction.user.id;
      const contentNap = `nap ${userId}`;

      const qr =
        `https://cdn.discordapp.com/attachments/1424762608694853809/1475780351157862411/IMG_1910.png?ex=699ebb0e&is=699d698e&hm=4164cfb5191cf49a1566af3efcf123d5065cfc80cc2bb00333b4bad5ef8c70b3&` +
        `?amount=0&addInfo=${contentNap}&accountName=${encodeURIComponent(BANK_NAME)}`;

      return interaction.reply({
        content:
          `💳 HƯỚNG DẪN NẠP TIỀN\n\n` +
          `🏦 Ngân hàng: ${BANK_CODE}\n` +
          `💳 STK: ${BANK_ACC}\n` +
          `👤 Tên: ${BANK_NAME}\n\n` +
          `📌 Nội dung bắt buộc:\n${contentNap}\n\n` +
          `📷 QR:\n${qr}`,
        ephemeral: true
      });
    }

    /* ===== THÊM SP ===== */
    if (interaction.customId === "add") {

      if (interaction.user.id !== ADMIN_ID)
        return interaction.reply({ content: "❌ Không có quyền.", ephemeral: true });

      const modal = new ModalBuilder()
        .setCustomId("add_modal")
        .setTitle("Thêm sản phẩm");

      const input = new TextInputBuilder()
        .setCustomId("keys")
        .setLabel("Mỗi dòng 1 key")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));

      return interaction.showModal(modal);
    }
  }

  /* ===== MODAL ===== */

  if (interaction.isModalSubmit()) {

    if (interaction.customId === "add_modal") {

      const data = interaction.fields.getTextInputValue("keys");
      const newKeys = data.split("\n").map(x => x.trim()).filter(x => x);

      stock.vip.push(...newKeys);
      saveJSON("stock.json", stock);

      return interaction.reply({
        content: `✅ Đã thêm ${newKeys.length} sản phẩm\n📦 Kho: ${stock.vip.length}`,
        ephemeral: true
      });
    }
  }
});

/* ================= WEBHOOK ================= */

const app = express();
app.use(express.json());

app.post("/webhook", async (req, res) => {

  try {

    if (req.headers["authorization"] !== WEBHOOK_SECRET)
      return res.sendStatus(403);

    const amount = Number(req.body.amount_in);
    const content = req.body.transaction_content;

    if (!content) return res.sendStatus(200);

    const userId = content.match(/\d{17,20}/)?.[0];
    if (!userId) return res.sendStatus(200);

    if (!users[userId]) users[userId] = { balance: 0 };

    users[userId].balance += amount;
    saveJSON("users.json", users);

    try {
      const user = await client.users.fetch(userId);
      user.send(`✅ Nạp thành công ${amount}\n💰 Số dư mới: ${users[userId].balance}`);
    } catch {}

    res.sendStatus(200);

  } catch (err) {
    console.log("Webhook lỗi:", err);
    res.sendStatus(500);
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server chạy...");
});

client.login(TOKEN);
