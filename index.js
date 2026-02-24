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

const app = express();
app.use(express.json());

/* =========================
   ENV (Railway Variables)
========================= */

const TOKEN = process.env.TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const STK = process.env.STK;
const PRICE = 150000;
const BANK = "ICB"; // VietinBank

/* =========================
   DATA TẠM (có thể nâng cấp DB)
========================= */

let stock = { vip: [] };
let orders = {};

/* =========================
   DISCORD BOT
========================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", () => {
  console.log("Bot online:", client.user.tag);
});

/* =========================
   PANEL
========================= */

client.on("messageCreate", async message => {
  if (message.content === "!panel") {

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("buy")
        .setLabel("🛒 Mua VIP")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("add")
        .setLabel("➕ Thêm sản phẩm")
        .setStyle(ButtonStyle.Success)
    );

    message.channel.send({
      content: `📦 Kho hiện có: ${stock.vip.length} sản phẩm`,
      components: [row]
    });
  }
});

/* =========================
   BUTTON + MODAL
========================= */

client.on("interactionCreate", async interaction => {

  if (interaction.isButton()) {

    /* ===== MUA ===== */
    if (interaction.customId === "buy") {

      if (stock.vip.length === 0)
        return interaction.reply({ content: "❌ Hết hàng.", ephemeral: true });

      const orderId = Date.now().toString();

      orders[orderId] = {
        userId: interaction.user.id,
        status: "pending"
      };

      const qr =
        `https://qr.sepay.vn/img?acc=${STK}&bank=${BANK}&amount=${PRICE}&des=${orderId}`;

      return interaction.reply({
        content:
          `🧾 Mã đơn: ${orderId}\n` +
          `💰 Giá: ${PRICE}\n` +
          `📌 Nội dung CK: ${orderId}\n\n${qr}`,
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
        .setCustomId("product")
        .setLabel("Nhập key sản phẩm")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      return interaction.showModal(modal);
    }
  }

  /* ===== SUBMIT MODAL ===== */
  if (interaction.isModalSubmit()) {

    if (interaction.customId === "add_modal") {

      const key = interaction.fields.getTextInputValue("product");

      stock.vip.push(key);

      return interaction.reply({
        content: `✅ Đã thêm sản phẩm.\nKho hiện có: ${stock.vip.length}`,
        ephemeral: true
      });
    }
  }
});

/* =========================
   WEBHOOK SEPAY
========================= */

app.post("/webhook", async (req, res) => {

  try {

    const data = req.body;

    console.log("Webhook nhận:", data);

    const orderId = data.transaction_content;
    const amount = data.amount_in;

    if (!orderId || !orders[orderId]) {
      return res.sendStatus(200);
    }

    if (amount == PRICE && stock.vip.length > 0) {

      const product = stock.vip.shift();

      const user = await client.users.fetch(orders[orderId].userId);

      await user.send(
        `✅ Thanh toán thành công!\n\n🎁 Sản phẩm của bạn:\n${product}`
      );

      delete orders[orderId];

      console.log("Đã gửi sản phẩm cho đơn:", orderId);
    }

    res.sendStatus(200);

  } catch (err) {
    console.log("Lỗi webhook:", err);
    res.sendStatus(500);
  }

});

/* =========================
   START SERVER
========================= */

app.listen(process.env.PORT || 3000, () => {
  console.log("Server webhook đang chạy...");
});

client.once("clientReady", () => {
  console.log("Bot online:", client.user.tag);
});

client.login(process.env.TOKEN);
