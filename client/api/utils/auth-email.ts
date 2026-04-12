import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import crypto from 'crypto';
import { renderEmailTemplate } from './email-template.js';
import { getTranslation } from './locales.js';
import { logoBase64 } from './logo-base64.js';
import { checkRateLimit } from './rate-limit.js';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function handleAuthEmail(
  req: VercelRequest,
  res: VercelResponse,
  dictionaryKey: 'teacher' | 'recovery'
) {
  try {
    // Enable CORS for Capacitor / external clients
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') return res.status(405).end();

    const { email, identityHex, name, locale = 'en' } = req.body ?? {};
    if (!email || !identityHex || typeof email !== 'string' || typeof identityHex !== 'string') {
      return res.status(400).json({ error: 'email and identityHex required' });
    }

    const ip = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || 'unknown';
    if (!checkRateLimit(`ip:${ip}`, 5) || !checkRateLimit(`email:${email}`, 3)) {
      return res.status(429).json({ error: 'Too many requests, please try again later.' });
    }

    const SECRET = process.env.HMAC_SECRET;
    if (!SECRET) {
      console.error('Missing HMAC_SECRET environment variable is required.');
      return res.status(500).json({ error: 'Server misconfiguration: HMAC secret missing' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAtMs = Date.now() + 15 * 60 * 1000;
    const formattedHex = identityHex.startsWith('0x') ? identityHex : '0x' + identityHex;
    const payload = `${formattedHex}${email.trim()}${code}${expiresAtMs}`;
    const signature = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');

    const dictionary = getTranslation(locale).email[dictionaryKey];

    const greeting = name && dictionary.greeting_name
       ? dictionary.greeting_name.replace('{{name}}', name)
       : dictionary.greeting_anon;

    const contentHtml = `
      <h1 style="font-size:20px;color:#2C3E50;margin:0 0 16px;">${greeting}</h1>
      <p style="color:#606060;font-size:15px;margin:0 0 24px;">${dictionary.body}</p>

      <div style="font-family:monospace;font-size:32px;font-weight:800;letter-spacing:8px;
                  color:#10B981;background:#ECFDF5;border:2px solid #10B981;
                  border-radius:10px;padding:16px 24px;text-align:center;margin-bottom:24px;">
        ${code}
      </div>

      <p style="color:#8c8c8c;font-size:13px;margin:0;line-height:1.5;text-align:center;">
        ${dictionary.ignore}
      </p>
    `;

    const html = renderEmailTemplate({
      title: dictionary.subject,
      preheader: dictionary.body,
      contentHtml,
      locale
    });

    const { error } = await resend.emails.send({
      from: 'Better 1UP <no-reply@up.bilharz.eu>',
      to: email,
      subject: dictionary.subject,
      html,
      attachments: [{
        filename: 'logo.png',
        content: Buffer.from(logoBase64, 'base64'),
        contentId: 'logo'
      }]
    });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, signature, expiresAt: expiresAtMs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(`Crash inside send-${dictionaryKey}:`, err);
    return res.status(500).json({ error: 'Function crashed!', trace: stack || message });
  }
}
