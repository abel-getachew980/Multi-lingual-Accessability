import express, { type NextFunction, type Request, type Response } from 'express';
import { HttpAiClient } from './aiClient';
import { loadConfig, type GatewayConfig } from './config';
import { HttpHelpClient } from './helpClient';
import { MessageHandler } from './messageHandler';
import { MessageQueue } from './messageQueue';
import { InMemoryOptOutStore } from './optOutStore';
import { SlidingWindowRateLimiter } from './rateLimiter';
import { InMemorySessionStore } from './sessionManager';
import { createSmsProvider } from './smsProvider';
import { isValidTwilioSignature } from './twilioSignature';
import { buildTwiml } from './twiml';
import type { InboundSms } from './types';

export interface Gateway {
  app: express.Express;
  handler: MessageHandler;
  queue: MessageQueue;
  config: GatewayConfig;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Accepts Twilio (`From`/`Body`), Africa's Talking (`from`/`text`) and plain
 * JSON payloads so the gateway can be exercised with curl during development.
 */
export function normalizeInbound(body: Record<string, unknown>): InboundSms | null {
  const from = readString(body.From) ?? readString(body.from);
  const text =
    readString(body.Body) ?? readString(body.text) ?? readString(body.body);

  if (!from || text === undefined) return null;

  return {
    from,
    body: text,
    to: readString(body.To) ?? readString(body.to),
    messageId:
      readString(body.MessageSid) ??
      readString(body.messageId) ??
      readString(body.id),
    receivedAt: new Date(),
  };
}

/** Twilio signs only string parameters, so filter anything else out. */
export function stringParams(body: Record<string, unknown>): Record<string, string> {
  const params: Record<string, string> = {};

  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') params[key] = value;
  }

  return params;
}

export function createGateway(config: GatewayConfig = loadConfig()): Gateway {
  const provider = createSmsProvider({
    provider: config.provider,
    twilio: config.twilio,
  });

  const queue = new MessageQueue({
    send: (message) => provider.send(message),
    onError: (error, message, attempts) => {
      console.error(
        `[sms] could not deliver to ${message.to} after ${attempts} attempt(s)`,
        error,
      );
    },
  });

  const handler = new MessageHandler({
    ai: new HttpAiClient({
      baseUrl: config.ai.baseUrl,
      provider: config.ai.provider,
      timeoutMs: config.sms.aiTimeoutMs,
    }),
    help: new HttpHelpClient({
      url: config.help.url,
      timeoutMs: config.help.timeoutMs,
    }),
    optOuts: new InMemoryOptOutStore(),
    sessions: new InMemorySessionStore(config.sms.sessionTtlMs),
    limiter: new SlidingWindowRateLimiter(
      config.sms.rateLimitMax,
      config.sms.rateLimitWindowMs,
    ),
    config: config.sms,
    onAiError: (error, question) => {
      console.error(`[sms] AI request failed for "${question.slice(0, 60)}"`, error);
    },
    onHelpError: (error, phoneNumber) => {
      console.error(`[sms] help request failed for ${phoneNumber}`, error);
    },
  });

  const app = express();
  app.disable('x-powered-by');
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));
  app.use(express.json({ limit: '32kb' }));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      provider: config.provider,
      replyMode: config.sms.replyMode,
      queueSize: queue.size,
    });
  });

  app.post('/sms', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;

      if (config.twilio.authToken && config.twilio.webhookUrl) {
        const signature = req.get('X-Twilio-Signature');
        const valid = isValidTwilioSignature(
          config.twilio.authToken,
          signature,
          config.twilio.webhookUrl,
          stringParams(body),
        );

        if (!valid) {
          console.warn('[sms] rejected webhook with an invalid Twilio signature');
          res.status(403).type('text/plain').send('Invalid signature');
          return;
        }
      }

      const inbound = normalizeInbound(body);
      if (!inbound) {
        res.status(400).type('text/plain').send('Missing From/Body parameters');
        return;
      }

      const result = await handler.handle(inbound);

      if (config.sms.replyMode === 'api') {
        for (const message of result.messages) {
          queue.enqueue({ to: inbound.from, body: message });
        }
        res.type('text/xml').send(buildTwiml([]));
        return;
      }

      res.type('text/xml').send(buildTwiml(result.messages));
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[sms] unhandled error', error);
    res.status(500).type('text/plain').send('SMS gateway error');
  });

  return { app, handler, queue, config };
}

function start(): void {
  const config = loadConfig();

  if (config.twilio.authToken && !config.twilio.webhookUrl) {
    console.warn(
      '[sms] TWILIO_WEBHOOK_URL is not set, so webhook signatures will not be verified.',
    );
  }

  const gateway = createGateway(config);

  const server = gateway.app.listen(config.port, () => {
    console.log(
      `[sms] gateway listening on http://localhost:${config.port} ` +
        `(provider=${config.provider}, replyMode=${config.sms.replyMode})`,
    );
  });

  const shutdown = (signal: string): void => {
    console.log(`[sms] received ${signal}, shutting down`);
    gateway.queue.stop();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (require.main === module) {
  start();
}
