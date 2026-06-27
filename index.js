import fs from 'fs';
import axios from 'axios';
import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import chalk from 'chalk';

// Linux logo for terminal
const linuxLogo = `
        .--.
       |o_o |
       |:_/ |
      //   \ \
     (|     | )
    /'\_   _/`\
    \___)=(___/
`;

// Load config
const config = JSON.parse(fs.readFileSync('./owner.json', 'utf-8'));
const { owner_id, owner_username, owner_name, telegram_token, ai_models, prompt_control } = config;

// Console log bot info
console.log(chalk.green(linuxLogo));
console.log(chalk.cyan.bold('A1 Zero - Multi-model AI Chatbot'));
console.log(chalk.yellow(`Bot Name: ${owner_name}`));
console.log(chalk.yellow(`Bot Username: ${owner_username}`));
console.log(chalk.yellow(`Owner ID: ${owner_id}`));

// Express minimal UI
const app = express();
app.get('/', (req, res) => {
  res.send(`<html><head><title>A1 Zero Chatbot</title><style>body{background:#18181b;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;}h1{font-size:2.5rem;}small{color:#aaa;}button{background:#222;border:none;padding:10px 20px;border-radius:8px;color:#fff;font-size:1rem;margin:5px;cursor:pointer;transition:background 0.2s;}button:hover{background:#444;}</style></head><body><h1>A1 Zero 🤖</h1><p>Multi-model AI Chatbot<br><small>by Sovereign Nakamoto Network</small></p><div><button onclick='window.open("https://t.me/zeronetwork_bot")'>Chat on Telegram</button></div></body></html>`);
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(chalk.blue(`Web UI running at http://localhost:${PORT}`)));

// Telegram bot setup
const bot = new Telegraf(telegram_token);

// Helper: Check if user is owner
const isOwner = (id) => String(id) === String(owner_id);

// Helper: Model switcher
const getModelApi = (model, text) => {
  let url = ai_models[model];
  if (!url) url = ai_models['sonar-reasoning-pro'];
  // Bard uses 'query', others use 'text' or 'content'
  if (model === 'bard') return url + encodeURIComponent(text);
  if (model === 'sonar-reasoning-pro') return url + encodeURIComponent(text);
  return url + encodeURIComponent(text);
};

// Command: /start
bot.start((ctx) => {
  ctx.reply(`👋 Selamat datang di *A1 Zero*\!\nAI Chatbot multi model\!\n\nKetik pesan atau gunakan tombol di bawah\!`, {
    parse_mode: 'MarkdownV2',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('Owner', 'OWNER'), Markup.button.callback('Cek Ping', 'PING'), Markup.button.callback('Cekid', 'CEKID')],
      [Markup.button.callback('Model: Sonar', 'MODEL_sonar-reasoning-pro'), Markup.button.callback('Model: Deepseek', 'MODEL_deepseek'), Markup.button.callback('Model: Hermes', 'MODEL_hermes'), Markup.button.callback('Model: Bard', 'MODEL_bard')]
    ])
  });
});

// State: user model
const userModel = {};

// Handle model switch
bot.action(/MODEL_(.+)/, (ctx) => {
  const model = ctx.match[1];
  userModel[ctx.from.id] = model;
  ctx.answerCbQuery(`Model diganti ke: ${model}`);
});

// Owner button
bot.action('OWNER', (ctx) => {
  ctx.reply(`👑 Owner: ${owner_name}\nUsername: ${owner_username}\nID: ${owner_id}`);
});

// Cek Ping
bot.action('PING', async (ctx) => {
  const start = Date.now();
  await ctx.reply('⏳ Ping...');
  const ms = Date.now() - start;
  ctx.reply(`🏓 Pong: ${ms}ms`);
});

// Cekid
bot.action('CEKID', (ctx) => {
  const u = ctx.from;
  ctx.reply(`🆔 Profil:\nNama: ${u.first_name || ''} ${u.last_name || ''}\nUsername: @${u.username || '-'}\nID: ${u.id}`);
});

// Group command support
bot.on('new_chat_members', (ctx) => {
  ctx.reply('👋 Halo, selamat datang di grup! Saya A1 Zero, AI Chatbot.');
});
bot.on('left_chat_member', (ctx) => {
  ctx.reply('👋 Sampai jumpa!');
});

// Main chat handler
bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  const userId = ctx.from.id;
  // Only owner can use /prompt
  if (text.startsWith('/prompt')) {
    if (!isOwner(userId)) return ctx.reply('❌ Hanya owner yang bisa mengontrol prompt.');
    return ctx.reply('Prompt control aktif.');
  }
  // Model selection
  const model = userModel[userId] || 'sonar-reasoning-pro';
  ctx.reply('🤖 Sedang mengetik...');
  try {
    const apiUrl = getModelApi(model, text);
    const { data } = await axios.get(apiUrl);
    // Try to extract response
    let aiReply = data?.result || data?.response || data?.text || JSON.stringify(data);
    // Clean up for Telegram mobile
    aiReply = aiReply.replace(/[\*\_\[\]\(\)\~\`\>\#\+\=\|\{\}\!]/g, '');
    ctx.reply(aiReply, { reply_to_message_id: ctx.message.message_id });
  } catch (e) {
    ctx.reply('❌ Gagal mendapatkan respon AI.');
  }
});

// Start bot
bot.launch();

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));