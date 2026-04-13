import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

// Disable default Vercel body parser to preserve raw payload for Svix HMAC verification
export const config = {
  api: {
    bodyParser: false,
  },
};

interface ResendWebhookEvent {
  type: string;
  data?: {
    email_id?: string;
    from?: string;
    subject?: string;
    to?: string[];
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const slackToken = process.env.SLACK_BOT_TOKEN;
    const resendKey = process.env.RESEND_API_KEY;
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    if (!slackToken || !resendKey || !webhookSecret) {
      console.error('Missing required environment variables (SLACK_BOT_TOKEN, RESEND_API_KEY, RESEND_WEBHOOK_SECRET)');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const rawBodyBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', chunk => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
    const rawBody = rawBodyBuffer.toString('utf8');

    const resend = new Resend(resendKey);
    let event: ResendWebhookEvent;

    try {
      // Use Resend's native webhook verification against the exact raw bytestream
      resend.webhooks.verify({
        payload: rawBody,
        headers: {
          id: (req.headers['svix-id'] as string) || '',
          timestamp: (req.headers['svix-timestamp'] as string) || '',
          signature: (req.headers['svix-signature'] as string) || '',
        },
        webhookSecret,
      });
      // Verification succeeded, safely parse the payload
      event = JSON.parse(rawBody) as ResendWebhookEvent;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Webhook signature verification failed:', message, {
        rawBodyLength: rawBody.length,
        rawBodyPreview: rawBody.slice(0, 120),
        hasSvixId: !!req.headers['svix-id'],
        hasSvixTimestamp: !!req.headers['svix-timestamp'],
        hasSvixSignature: !!req.headers['svix-signature'],
        secretPrefix: webhookSecret.slice(0, 6),
      });
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    // We only care about inbound emails
    if (event?.type !== 'email.received') {
      return res.status(200).json({ ok: true, message: 'Ignored non-received event' });
    }

    const { email_id, from, subject, to } = event.data || {};
    let messageText = 'No plain text body found.';

    if (email_id) {
      try {
        const { data: fullEmail } = await resend.emails.receiving.get(email_id);
        if (fullEmail?.text) {
          messageText = fullEmail.text;
        } else if (fullEmail?.html) {
          // Fallback if Resend returns HTML but no text
          messageText = fullEmail.html.replace(/<[^>]*>?/gm, ' ').trim();
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Failed to fetch full email body from Resend:', message);
        messageText = '(Failed to fetch email body)';
      }
    }
    
    // Using Slack Block Kit for a cleaner layout
    const slackChannel = process.env.SLACK_FEEDBACK_CHANNEL || 'C0ASCULQAGM';
    const sender = from || '(unknown sender)';
    const slackMessage = {
      channel: slackChannel,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `📧 ${subject ? subject.substring(0, 140) : 'New Incoming Email'}`,
            emoji: true
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*From:*\n${sender}`
            },
            {
              type: 'mrkdwn',
              text: `*To:*\n${(to || []).join(', ')}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Subject:*\n${subject || '(No Subject)'}`
          }
        },
        {
          type: 'divider'
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: messageText.length > 2500 ? messageText.substring(0, 2500) + '... (truncated)' : messageText
          }
        }
      ]
    };

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${slackToken}`
      },
      body: JSON.stringify(slackMessage),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to relay to Slack, HTTP error:', errorText);
      return res.status(500).json({ error: 'Failed to relay to Slack' });
    }

    const responseData = await response.json();
    if (!responseData.ok) {
      console.error('Slack API error:', responseData);
      return res.status(500).json({ error: 'Slack API execution failed' }); // avoid leaking Slack specifics to Resend webhook response
    }

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Resend webhook runtime error:', message);
    return res.status(500).json({ error: 'Internal server error processing webhook' });
  }
}
