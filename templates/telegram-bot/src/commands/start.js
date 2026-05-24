export async function start(ctx) {
  const name = ctx.from?.first_name ?? 'there';
  await ctx.reply(
    `Hey ${name} — this is a 2BFT (2 Boys From Town) Telegram bot template, ` +
      `wired to an OpenClaw skill.\n\n` +
      `Send me any text and I'll return a 3-bullet summary.\n` +
      `Type /help to see what I can do.`,
  );
}
