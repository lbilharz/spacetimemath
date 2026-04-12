import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleAuthEmail } from './utils/auth-email.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleAuthEmail(req, res, 'recovery');
}
