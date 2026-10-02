require("dotenv").config();
const axios = require("axios");

async function getChatId() {
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates`
    );

    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error(
      "Telegram error:",
      error.response?.data || error.message
    );
  }
}

getChatId();