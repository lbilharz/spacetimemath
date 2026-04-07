import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import QRCode from 'qrcode';
import { renderEmailTemplate } from './utils/email-template.js';
import { getTranslation } from './utils/locales.js';
import { logoBase64 } from './utils/logo-base64.js';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, code, name, locale = 'en' } = req.body ?? {};
  if (!email || !code || typeof email !== 'string' || typeof code !== 'string') {
    return res.status(400).json({ error: 'email and code required' });
  }

  const appUrl = process.env.APP_URL ?? 'https://up.bilharz.eu';
  const restoreUrl = `${appUrl}/?restore=${encodeURIComponent(code)}`;

  // Generate robust inline Base64 QR code locally to protect IP/GDPR anonymity
  const qrDataUrl = await QRCode.toDataURL(restoreUrl, {
    color: { dark: '#2C3E50', light: '#ffffff' },
    margin: 1,
    width: 140
  });

  const dictionary = getTranslation(locale).email.recovery;
  
  const greeting = name 
     ? dictionary.greeting_name.replace('{{name}}', name) 
     : dictionary.greeting_anon;
     
  const orManual = dictionary.orManual
     .replace('{{appUrl}}', appUrl)
     .replace('{{appDomain}}', appUrl.replace(/^https?:\/\//, ''));

  const contentHtml = `
    <h1 style="font-size:20px;color:#2C3E50;margin:0 0 16px;">${greeting}</h1>
    <p style="color:#606060;font-size:15px;margin:0 0 24px;">${dictionary.body}</p>
    
    <div style="font-family:monospace;font-size:28px;font-weight:800;letter-spacing:6px;
                color:#FBBA00;background:#Fefdfa;border:2px solid #FBBA00;
                border-radius:10px;padding:16px 24px;text-align:center;margin-bottom:24px;">
      ${code}
    </div>

    <!-- QR Code Section -->
    <div style="text-align:center;margin-bottom:24px;">
      <img src="cid:qrcode" width="140" height="140" alt="QR Code" style="border-radius:8px;border:1px solid #e0dfdb;padding:4px;" />
    </div>

    <a href="${restoreUrl}"
       style="display:block;background:#FBBA00;color:#2C3E50;font-weight:700;
              text-decoration:none;text-align:center;padding:14px;border-radius:10px;
              font-size:16px;margin-bottom:24px;">
      ${dictionary.button}
    </a>
    
    <p style="color:#606060;font-size:13px;margin:0;line-height:1.5;text-align:center;">
      ${orManual}
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
    attachments: [
      {
        filename: 'logo.png',
        content: Buffer.from(logoBase64, 'base64'),
        contentId: 'logo' // Must use inline CID
      },
      {
        filename: 'qrcode.png',
        content: Buffer.from(qrDataUrl.split(',')[1], 'base64'),
        contentId: 'qrcode' // Native inline render for QR
      }
    ]
  });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
