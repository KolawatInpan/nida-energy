const axios = require('axios');

/**
 * Send a Telegram message.
 * @param {Object} opts
 * @param {string} opts.text - message body
 * @param {string|null} [opts.parseMode] - e.g. 'HTML'
 * @param {string|null} [opts.chatId] - per-user chat id (overrides env default)
 */
async function sendTelegramMessage({ text, parseMode = null, chatId = null } = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const defaultChatId = process.env.TELEGRAM_CHAT_ID;
  const target = chatId || defaultChatId;
  if (!token || !target) {
    throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = {
    chat_id: target,
    text: String(text || ''),
    disable_web_page_preview: true,
  };
  if (parseMode) payload.parse_mode = parseMode;

  try {
    const res = await axios.post(url, payload, { timeout: 5000 });
    return res.data;
  } catch (err) {
    // Provide clearer error for the caller without leaking token
    const status = err?.response?.status;
    const data = err?.response?.data;
    const msg = `Telegram API error${status ? ` (status ${status})` : ''}${data ? `: ${JSON.stringify(data)}` : ''}`;
    const e = new Error(msg);
    e.original = err;
    throw e;
  }
}

module.exports = {
  sendTelegramMessage,
};
