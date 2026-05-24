import 'dotenv/config';
import { Telegraf } from 'telegraf';

import { start } from './commands/start.js';
import { help } from './commands/help.js';
import { callSkill } from './openclaw.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('Missing TELEGRAM_BOT_TOKEN. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const bot = new Telegraf(token);

bot.command('start', start);
bot.command('help', help);

bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  try {
    const result = await callSkill('summarize_text', { text, bullets: 3 });
    const bullets = result.summary.map((line) => `• ${line}`).join('\n');
    await ctx.reply(bullets || '(no summary)');
  } catch (err) {
    console.error('skill error:', err);
    await ctx.reply('Skill failed. Check the bot logs.');
  }
});

bot.launch().then(() => console.log('2BFT telegram bot is running.'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
