// ============================================
// TELEGRAM BOT - Teammate 3
// ============================================
//
// ASSIGNMENT: Build standalone Telegram bot
//
// FILES TO CREATE:
// - src/index.ts (main entry)
// - src/messageHandler.ts
// - src/keyboardBuilder.ts
// - src/sessionManager.ts
// - src/types.ts
//
// DEPENDENCIES:
// - grammy or telegraf (Telegram framework)
// - dotenv
//
// REQUIREMENTS:
// - Handle text and voice messages
// - Language switcher (Amharic/English)
// - Session management
// - Connect to main app API
// - Rate limiting
// ============================================

import { Bot } from 'grammy';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || '');

// Start command
bot.command('start', async (ctx) => {
  await ctx.reply(
    'Welcome to AI Tutor! 👋\n' +
    'ወደ AI Tutor እንኳን በደህና መጡ!\n\n' +
    'Choose language / ቋንቋ ይምረጡ:\n' +
    '/am - Amharic (አማርኛ)\n' +
    '/en - English'
  );
});

// Language commands
bot.command('am', async (ctx) => {
  await ctx.reply('ቋንቋ ወደ አማርኛ ተቀይሯል። ጥያቄዎን ይጻፉ።');
});

bot.command('en', async (ctx) => {
  await ctx.reply('Language set to English. Type your question.');
});

// Handle text messages
bot.on('message:text', async (ctx) => {
  // TODO: Forward to AI API
  await ctx.reply('Processing your question... ጥያቄዎን በማስተናገድ ላይ...');
});

// Handle voice messages
bot.on('message:voice', async (ctx) => {
  // TODO: Transcribe and process
  await ctx.reply('Processing voice message... የድምጽ መልእክት በማስተናገድ ላይ...');
});

// Start bot
if (process.env.TELEGRAM_BOT_TOKEN) {
  bot.start();
  console.log('Telegram bot started');
} else {
  console.warn('TELEGRAM_BOT_TOKEN not set. Bot not started.');
}

export { bot };
