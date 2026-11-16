const DEFAULT_BOT_PATH = '/telegram';

function webhookPath(): string {
  const raw = (process.env.TELEGRAM_WEBHOOK_PATH ?? DEFAULT_BOT_PATH).trim();
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return path.replace(/\/+$/, '') || DEFAULT_BOT_PATH;
}

/**
 * Builds the standalone bot's webhook URL.
 *
 * Accepts a base URL (`http://bot:3002`) or one that already ends in the
 * webhook path (`http://bot:3002/telegram`), so either value works in
 * `TELEGRAM_BOT_URL`.
 */
export function botEndpoint(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const path = webhookPath();

  return base.endsWith(path) ? base : `${base}${path}`;
}
