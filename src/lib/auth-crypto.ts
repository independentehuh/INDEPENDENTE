import crypto from 'node:crypto';
import firebaseConfig from '../../firebase-applet-config.json';

const getSigningSecret = (): string => {
  return (
    process.env.SESSION_SECRET ||
    crypto
      .createHash('sha256')
      .update(`${firebaseConfig.projectId}:${firebaseConfig.apiKey}:independente-session-v1`)
      .digest('hex')
  );
};

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuffer = Buffer.from(keyHex, 'hex');
  const derived = crypto.scryptSync(password, salt, 64);
  if (keyBuffer.length !== derived.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derived);
}

export interface PartnerSessionPayload {
  userId: number;
  uid: string;
  email: string;
  displayName: string;
  roleSlug: string;
  organizationId: number;
  exp: number;
}

export function signPartnerToken(payload: Omit<PartnerSessionPayload, 'exp'>): string {
  const fullPayload: PartnerSessionPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const data = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(data)
    .digest('base64url');
  return `prt.${data}.${sig}`;
}

export function verifyPartnerToken(token: string): PartnerSessionPayload | null {
  try {
    if (!token.startsWith('prt.')) return null;
    const [, data, sig] = token.split('.');
    if (!data || !sig) return null;
    const expectedSig = crypto
      .createHmac('sha256', getSigningSecret())
      .update(data)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as PartnerSessionPayload;
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function generateReferenceNumber(prefix: string): string {
  const year = new Date().getFullYear();
  const code = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${year}-${code}`;
}

export function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  const bytes = crypto.randomBytes(10);
  for (let i = 0; i < 10; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return `${result.slice(0, 5)}-${result.slice(5, 10)}`;
}

export function hashAccessCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  const salt = crypto.randomBytes(12).toString('hex');
  const hash = crypto
    .createHmac('sha256', getSigningSecret())
    .update(`${salt}:${normalized}`)
    .digest('hex');
  return `${salt}:${hash}`;
}

export function verifyAccessCode(code: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, hashHex] = parts;
  const normalized = code.trim().toUpperCase();
  const expected = crypto
    .createHmac('sha256', getSigningSecret())
    .update(`${salt}:${normalized}`)
    .digest('hex');
  const a = Buffer.from(hashHex, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 72);
}
