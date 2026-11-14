// ============================================
// SMS GATEWAY - Teammate 4
// ============================================
//
// ASSIGNMENT: Build standalone SMS gateway
//
// FILES TO CREATE:
// - src/index.ts (Express server)
// - src/smsProvider.ts
// - src/messageQueue.ts
// - src/chunker.ts
// - src/types.ts
//
// DEPENDENCIES:
// - twilio (or Africa's Talking SDK)
// - express
// - dotenv
//
// REQUIREMENTS:
// - Handle incoming SMS
// - Queue responses
// - Chunk messages (160 chars)
// - Retry failed sends
// - Connect to main app API
// ============================================

import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Incoming SMS webhook
app.post('/sms', async (req, res) => {
  const { From, Body } = req.body;

  console.log('SMS received:', { from: From, body: Body });

  // TODO:
  // 1. Forward to AI API
  // 2. Chunk response
  // 3. Send reply

  res.type('text/xml');
  res.send('<Response></Response>');
});

// Start server
app.listen(PORT, () => {
  console.log(`SMS Gateway running on port ${PORT}`);
});

export { app };
