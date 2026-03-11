import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, code } = req.body ?? {};
  if (!email || !code || typeof email !== 'string' || typeof code !== 'string') {
    return res.status(400).json({ error: 'email and code required' });
  }

  const restoreUrl = `https://noggin.bettermarks.com/?restore=${encodeURIComponent(code)}`;

  const { error } = await resend.emails.send({
    from: 'noggin <onboarding@resend.dev>',
    to: email,
    subject: 'Your noggin recovery key',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <div style="font-size:32px;margin-bottom:8px">🧠</div>
        <h1 style="font-size:22px;color:#2C3E50;margin:0 0 8px">Your noggin recovery key</h1>
        <p style="color:#606060;font-size:15px;margin:0 0 24px">
          Use this to restore your account on any device. Keep it safe.
        </p>
        <div style="font-family:monospace;font-size:28px;font-weight:800;letter-spacing:6px;
                    color:#FBBA00;background:#F5F4F0;border:2px solid #FBBA00;
                    border-radius:10px;padding:16px 24px;text-align:center;margin-bottom:24px">
          ${code}
        </div>
        <a href="${restoreUrl}"
           style="display:block;background:#FBBA00;color:#2C3E50;font-weight:700;
                  text-decoration:none;text-align:center;padding:14px;border-radius:10px;
                  font-size:16px;margin-bottom:24px">
          Restore my account →
        </a>
        <p style="color:#606060;font-size:12px;margin:0">
          Or go to <a href="https://noggin.bettermarks.com" style="color:#606060">noggin.bettermarks.com</a>
          and enter the code manually under "Restore account".
        </p>
      </div>
    `,
  });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
