export async function help(ctx) {
  await ctx.reply(
    [
      'Commands:',
      '/start — onboarding',
      '/help  — this message',
      '',
      'Anything else you send gets routed to the OpenClaw summarize_text skill.',
    ].join('\n'),
  );
}
