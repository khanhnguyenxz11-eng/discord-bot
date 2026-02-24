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

const axios = require("axios");
const fs = require("fs");

const TOKEN = "MTQ3NTcwOTU0NDU4NzA3MTUwOQ.GF0xEo.35uKqCL1jRfTVgkd7I21J8CofbeGWSO4fWaIqM"process.env.TOKEN;
const ADMIN_ID = "1109115161266110534";
const SEPAY_API_KEY = "RICIYKPFCHQTGAEMDMRXANHXX0UVL97GOB0EVCLPWGDFBDGZ6JF12LY2NRMQIMDQ";

const BANK = "ICB";
const STK = "105884390640";
const PRICE = 150000;

let stock = { vip: [] };
let orders = {};

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

/* PANEL */

client.on("messageCreate", async message => {
  if (message.content === "!panel") {

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("buy")
        .setLabel("🛒 Mua Key")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("add")
        .setLabel("➕ Add Key")
        .setStyle(ButtonStyle.Success)
    );

    message.channel.send({
      content: `Kho hiện có: ${stock.vip.length}`,
      components: [row]
    });
  }
});

/* BUTTON */

client.on("interactionCreate", async interaction => {

  if (interaction.isButton()) {

    // MUA
    if (interaction.customId === "buy") {

      if (stock.vip.length === 0)
        return interaction.reply({ content: "❌ Hết Key", ephemeral: true });

      const orderId = Date.now();

      orders[orderId] = {
        userId: interaction.user.id,
        status: "pending"
      };

      const qr = `https://qr.sepay.vn/img?acc=${STK}&bank=${BANK}&amount=${PRICE}&des=${orderId}`;

      return interaction.reply({
        content:
          `Mã đơn: ${orderId}\n` +
          `Giá: ${PRICE}\n` +
          `Nội dung CK: ${orderId}\n\n${qr}`,
        ephemeral: true
      });
    }

    // THÊM SP
    if (interaction.customId === "add") {

      if (interaction.user.id !== ADMIN_ID)
        return interaction.reply({ content: "Không có quyền", ephemeral: true });

      const modal = new ModalBuilder()
        .setCustomId("add_modal")
        .setTitle("Thêm sản phẩm");

      const input = new TextInputBuilder()
        .setCustomId("product")
        .setLabel("Nhập key")
        .setStyle(TextInputStyle.Paragraph);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      return interaction.showModal(modal);
    }
  }

  // SUBMIT FORM
  if (interaction.isModalSubmit()) {

    if (interaction.customId === "add_modal") {

      const key = interaction.fields.getTextInputValue("product");
      stock.vip.push(key);

      return interaction.reply({
        content: `Đã thêm. Kho hiện có: ${stock.vip.length}`,
        ephemeral: true
      });
    }
  }
});

/* CHECK GIAO DỊCH MỖI 15 GIÂY */

setInterval(async () => {

  for (const orderId in orders) {

    const order = orders[orderId];

    if (order.status === "pending") {

      try {

        const res = await axios.get(
          "https://my.sepay.vn/userapi/transactions/list",
          {
            headers: {
              Authorization: `Bearer ${SEPAY_API_KEY}`
            }
          }
        );

        const transactions = res.data.transactions;

        const found = transactions.find(
          tx =>
            tx.transaction_content.includes(orderId.toString()) &&
            tx.amount_in == PRICE
        );

        if (found && stock.vip.length > 0) {

          const product = stock.vip.shift();
          const user = await client.users.fetch(order.userId);

          await user.send(
            `Thanh toán thành công!\n\nSản phẩm:\n${product}`
          );

          delete orders[orderId];
        }

      } catch (err) {
        console.log("Lỗi API");
      }
    }
  }

}, 15000);

client.login(TOKEN);
