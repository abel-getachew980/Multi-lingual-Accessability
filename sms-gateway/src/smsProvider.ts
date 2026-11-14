import twilio from 'twilio';
import type { OutboundSms, SmsProviderName } from './types';

export interface SmsProvider {
  readonly name: SmsProviderName;
  send(message: OutboundSms): Promise<void>;
}

/**
 * Development provider. Writes the exact SMS that would be sent to the
 * console, so the whole flow can be exercised without paying for messages.
 */
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console' as const;

  async send(message: OutboundSms): Promise<void> {
    console.info(`[sms:console] -> ${message.to}: ${message.body}`);
  }
}

export interface TwilioProviderConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export class TwilioSmsProvider implements SmsProvider {
  readonly name = 'twilio' as const;
  private readonly client: ReturnType<typeof twilio>;

  constructor(private readonly config: TwilioProviderConfig) {
    this.client = twilio(config.accountSid, config.authToken);
  }

  async send(message: OutboundSms): Promise<void> {
    await this.client.messages.create({
      to: message.to,
      from: this.config.fromNumber,
      body: message.body,
    });
  }
}

export interface SmsProviderOptions {
  provider: SmsProviderName;
  twilio?: Partial<TwilioProviderConfig>;
}

export function createSmsProvider(options: SmsProviderOptions): SmsProvider {
  if (options.provider === 'console') {
    return new ConsoleSmsProvider();
  }

  const { accountSid, authToken, fromNumber } = options.twilio ?? {};

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error(
      'SMS_PROVIDER=twilio requires SMS_ACCOUNT_SID, SMS_AUTH_TOKEN and SMS_FROM_NUMBER',
    );
  }

  return new TwilioSmsProvider({ accountSid, authToken, fromNumber });
}
