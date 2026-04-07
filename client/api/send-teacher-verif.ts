import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import crypto from 'crypto';
import { renderEmailTemplate } from './utils/email-template.js';
import { getTranslation } from './utils/locales.js';
import { logoBase64 } from './utils/logo-base64.js';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, identityHex, name, locale = 'en' } = req.body ?? {};
  if (!email || !identityHex || typeof email !== 'string' || typeof identityHex !== 'string') {
    return res.status(400).json({ error: 'email and identityHex required' });
  }

  const SECRET = process.env.HMAC_SECRET || "STM_FALLBACK_HMAC_SECRET";
  if (!SECRET) {
    console.error('Missing HMAC_SECRET');
    return res.status(500).json({ error: 'Server misconfiguration: HMAC secret missing' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAtMs = Date.now() + 15 * 60 * 1000;
  const formattedHex = identityHex.startsWith('0x') ? identityHex : '0x' + identityHex;
  const payload = `${formattedHex}${email.trim()}${code}${expiresAtMs}`;
  const signature = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');

  const dictionary = getTranslation(locale).email.teacher;
  
  const greeting = name 
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
}
