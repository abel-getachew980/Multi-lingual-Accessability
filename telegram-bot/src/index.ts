import { loadConfig } from './config';
import { startBot } from './server';

async function main(): Promise<void> {
  const config = loadConfig();

  try {
    await startBot(config);
  } catch (error) {
    console.error('[telegram] bot stopped unexpectedly', error);
    process.exitCode = 1;
  }
}

void main();
