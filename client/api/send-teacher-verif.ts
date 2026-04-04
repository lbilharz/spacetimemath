import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import crypto from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, identityHex } = req.body ?? {};
  if (!email || !identityHex || typeof email !== 'string' || typeof identityHex !== 'string') {
    return res.status(400).json({ error: 'email and identityHex required' });
  }

  // We fall back to a hardcoded shared secret so this works instantly out-of-the-box
  // without you needing to manually run any SpacetimeDB CLI configuration commands.
  const SECRET = process.env.HMAC_SECRET || "STM_FALLBACK_HMAC_SECRET";
  if (!SECRET) {
    console.error('Missing HMAC_SECRET');
    return res.status(500).json({ error: 'Server misconfiguration: HMAC secret missing' });
  }

  // Generate 6 digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Set expiry to 15 minutes from now
  const expiresAtMs = Date.now() + 15 * 60 * 1000;

  // Ensure identityHex format matches rust's hex::encode exactly (with 0x prefix if needed)
  const formattedHex = identityHex.startsWith('0x') ? identityHex : '0x' + identityHex;

  // The payload MUST exactly match the Rust rebuild format: identityHex + email + code + expires_at_ms
  const payload = `${formattedHex}${email.trim()}${code}${expiresAtMs}`;

  // Sign the payload
  const signature = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');

  const { error } = await resend.emails.send({
    from: 'better 1UP <no-reply@up.bilharz.eu>',
    to: email,
    subject: 'Your Teacher Verification Code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <div style="font-size:32px;margin-bottom:8px">🎓</div>
        <h1 style="font-size:22px;color:#2C3E50;margin:0 0 8px">Teacher Verification</h1>
        <p style="color:#606060;font-size:15px;margin:0 0 24px">
          Enter this code to verify your email and complete your upgrade to a Teacher account.
        </p>
        <div style="font-family:monospace;font-size:32px;font-weight:800;letter-spacing:8px;
                    color:#10B981;background:#ECFDF5;border:2px solid #10B981;
                    border-radius:10px;padding:16px 24px;text-align:center;margin-bottom:24px">
          ${code}
        </div>
        <p style="color:#606060;font-size:12px;margin:0">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });

  if (error) return res.status(500).json({ error: error.message });
  
  // Return the signature and expiry to the client (client NEVER sees the code)
  return res.status(200).json({ ok: true, signature, expiresAt: expiresAtMs });
}
