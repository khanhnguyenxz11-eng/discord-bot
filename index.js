const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  EmbedBuilder
} = require("discord.js");

const express = require("express");
const fs = require("fs");

const app = express();
app.use(express.json());

const TOKEN = process.env.TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

/* =========================
   SẢN PHẨM
========================= */

const PRODUCTS = {
  vip: { name: "Ngày", price: 15000 },
  pro: { name: "Tháng", price: 150000 }
};

/* =========================
   DATA
========================= */

let data = {
  stock: { Ngày: [], Tháng: [] },
  users: {},
  orders: {},
  panel: null
};

function saveData() {
  fs.writeFileSync("data.json", JSON.stringify(data));
}

function loadData() {
  if (fs.existsSync("data.json")) {
    data = JSON.parse(fs.readFileSync("data.json"));
  }
}

loadData();

/* =========================
   BOT
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
   TẠO PANEL
========================= */

async function sendPanel(channel) {

  const embed = new EmbedBuilder()
    .setTitle("🛒 SHOP HỆ THỐNG")
    .setColor("#00bfff")
    .setDescription("Chọn sản phẩm bên dưới để mua")
    .addFields(
      {
        name: "🔥 Ngày",
        value: `Giá: ${PRODUCTS.vip.price}\nKho: ${data.stock.vip.length}`,
        inline: true
      },
      {
        name: "💎 Tháng",
        value: `Giá: ${PRODUCTS.pro.price}\nKho: ${data.stock.pro.length}`,
        inline: true
      }
    )
    .setFooter({ text: "Hệ thống tự động • Thanh toán ví" });

  const select = new StringSelectMenuBuilder()
    .setCustomId("select_product")
    .setPlaceholder("Chọn sản phẩm để mua")
    .addOptions(
      {
        label: "Mua Ngày",
        value: "Ngày",
        description: "Sản phẩm key Ngày"
      },
      {
        label: "Mua Tháng",
        value: "Tháng",
        description: "Sản phẩm key Tháng"
      }
    );

  const row1 = new ActionRowBuilder().addComponents(select);

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("deposit")
      .setLabel("💰 Nạp tiền")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("balance")
      .setLabel("📊 Số dư")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("add_product")
      .setLabel("➕ Thêm SP")
      .setStyle(ButtonStyle.Danger)
  );

  if (data.panel) {
    try {
      const msg = await channel.messages.fetch(data.panel);
      await msg.edit({ embeds: [embed], components: [row1, row2] });
      return;
    } catch {}
  }

  const message = await channel.send({
    embeds: [embed],
    components: [row1, row2]
  });

  data.panel = message.id;
  saveData();
}

/* =========================
   COMMAND
========================= */

client.on("messageCreate", async message => {
  if (message.content === "!panel") {
    await sendPanel(message.channel);
  }
});

/* =========================
   INTERACTION
========================= */

client.on("interactionCreate", async interaction => {

  const userId = interaction.user.id;

  if (!data.users[userId])
    data.users[userId] = { balance: 0 };

  /* ===== SELECT MENU ===== */

  if (interaction.isStringSelectMenu()) {

    const type = interaction.values[0];
    const product = PRODUCTS[type];

    if (!product || data.stock[type].length === 0)
      return interaction.reply({ content: "❌ Hết hàng.", ephemeral: true });

    if (data.users[userId].balance < product.price)
      return interaction.reply({ content: "❌ Không đủ số dư.", ephemeral: true });

    const key = data.stock[type].shift();
    data.users[userId].balance -= product.price;

    saveData();

    await interaction.reply({
      content:
        `✅ Mua thành công ${product.name}\n\n${key}\n\n💰 Còn lại: ${data.users[userId].balance}`,
      ephemeral: true
    });

    await sendPanel(interaction.channel);
  }

  /* ===== BUTTON ===== */

  if (interaction.isButton()) {

    if (interaction.customId === "balance") {
      return interaction.reply({
        content: `💰 Số dư: ${data.users[userId].balance}`,
        ephemeral: true
      });
    }

    if (interaction.customId === "deposit") {

      const orderId = Date.now().toString();

      data.orders[orderId] = {
        userId,
        type: "deposit"
      };

      saveData();

      return interaction.reply({
        content:
          `🧾 Mã nạp: ${orderId}\n📌 Nội dung CK: ${orderId}`,
        ephemeral: true
      });
    }

    if (interaction.customId === "add_product") {

      if (userId !== ADMIN_ID)
        return interaction.reply({ content: "❌ Không có quyền.", ephemeral: true });

      const modal = new ModalBuilder()
        .setCustomId("add_modal")
        .setTitle("Thêm sản phẩm");

      const typeInput = new TextInputBuilder()
        .setCustomId("type")
        .setLabel("Loại (vip hoặc pro)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const keyInput = new TextInputBuilder()
        .setCustomId("keys")
        .setLabel("Mỗi dòng 1 key")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(typeInput),
        new ActionRowBuilder().addComponents(keyInput)
      );

      return interaction.showModal(modal);
    }
  }

  /* ===== MODAL ===== */

  if (interaction.isModalSubmit()) {

    if (interaction.customId === "add_modal") {

      if (userId !== ADMIN_ID)
        return interaction.reply({ content: "❌ Không có quyền.", ephemeral: true });

      const type = interaction.fields.getTextInputValue("type").toLowerCase();
      const keysRaw = interaction.fields.getTextInputValue("keys");

      if (!data.stock[type])
        return interaction.reply({ content: "❌ Loại không tồn tại.", ephemeral: true });

      const keys = keysRaw.split("\n").map(k => k.trim()).filter(Boolean);

      data.stock[type].push(...keys);

      saveData();

      await interaction.reply({
        content: `✅ Đã thêm ${keys.length} sản phẩm.`,
        ephemeral: true
      });

      await sendPanel(interaction.channel);
    }
  }

});

/* =========================
   WEBHOOK
========================= */

app.post("/webhook", async (req, res) => {

  if (req.headers["x-secret"] !== WEBHOOK_SECRET)
    return res.sendStatus(403);

  const { transaction_content, amount_in } = req.body;
  if (!transaction_content || !amount_in)
    return res.sendStatus(200);

  const match = transaction_content.match(/\d+/);
  if (!match) return res.sendStatus(200);

  const orderId = match[0];
  const order = data.orders[orderId];
  if (!order) return res.sendStatus(200);

  if (order.type === "deposit") {
    data.users[order.userId].balance += Number(amount_in);
    delete data.orders[orderId];
    saveData();
  }

  res.sendStatus(200);
});

app.listen(process.env.PORT || 3000);
client.login(TOKEN);
