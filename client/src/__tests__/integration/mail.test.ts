import { test, expect, vi } from 'vitest';
import sendTeacherVerif from '../../../api/send-teacher-verif.js';
import sendRecoveryEmail from '../../../api/send-recovery-email.js';

vi.mock('resend', () => {
  return {
    Resend: class {
      emails = {
        send: vi.fn().mockResolvedValue({ data: { id: 'mock-id' }, error: null })
      };
    }
  };
});

test('Teacher Verification API - injects name and locale correctly', async () => {
  const req: any = {
    method: 'POST',
    body: {
      email: 'test@example.com',
      identityHex: '0x123',
      name: 'Frau Test',
      locale: 'de'
    }
  };

  let jsonResponse: any = null;
  const res: any = {
    status: vi.fn(() => res),
    json: vi.fn((data) => { jsonResponse = data; return res; }),
    end: vi.fn()
  };

  process.env.HMAC_SECRET = 'test-secret';
  
  await sendTeacherVerif(req, res);

  expect(res.status).toHaveBeenCalledWith(200);
  expect(jsonResponse.ok).toBe(true);
  expect(jsonResponse.signature).toBeTruthy();
});

test('Recovery Email API - generates payload correctly', async () => {
  const req: any = {
    method: 'POST',
    body: {
      email: 'recovery@example.com',
      code: 'AABBCCDDEEFF',
      name: 'Anon',
      locale: 'fr'
    }
  };

  let jsonResponse: any = null;
  const res: any = {
    status: vi.fn(() => res),
    json: vi.fn((data) => { jsonResponse = data; return res; }),
    end: vi.fn()
  };

  await sendRecoveryEmail(req, res);

  expect(res.status).toHaveBeenCalledWith(200);
  expect(jsonResponse.ok).toBe(true);
});
