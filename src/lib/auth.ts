import { Request, Response, NextFunction } from 'express';
import { eq, sql } from 'drizzle-orm';
import { adminAuth } from './firebase-admin.ts';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { verifyPartnerToken } from './auth-crypto.ts';

export interface AuthenticatedUser {
  id: number;
  uid: string;
  email: string;
  displayName: string;
  roleSlug: string;
  organizationId: number | null;
}

export interface AuthRequest extends Request {
  authUser?: AuthenticatedUser;
}

async function resolveOrCreateFirebaseUser(
  uid: string,
  email: string,
  name: string
): Promise<AuthenticatedUser> {
  const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
  if (existing.length > 0) {
    const u = existing[0];
    if (u.email !== email || (name && u.displayName !== name)) {
      const updated = await db
        .update(users)
        .set({
          email,
          displayName: name || u.displayName,
          updatedAt: new Date(),
        })
        .where(eq(users.uid, uid))
        .returning();
      return {
        id: updated[0].id,
        uid: updated[0].uid,
        email: updated[0].email,
        displayName: updated[0].displayName,
        roleSlug: updated[0].roleSlug,
        organizationId: updated[0].organizationId,
      };
    }
    return {
      id: u.id,
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      roleSlug: u.roleSlug,
      organizationId: u.organizationId,
    };
  }

  // Check if any super_admin exists yet; first authenticated owner becomes super_admin
  const adminCountRes = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.roleSlug, 'super_admin'));
  const hasSuperAdmin = (adminCountRes[0]?.count ?? 0) > 0;

  // Check if email matches an existing partner user record created before Google sign-in
  const byEmail = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (byEmail.length > 0) {
    const updated = await db
      .update(users)
      .set({
        uid,
        displayName: name || byEmail[0].displayName,
        updatedAt: new Date(),
      })
      .where(eq(users.id, byEmail[0].id))
      .returning();
    return {
      id: updated[0].id,
      uid: updated[0].uid,
      email: updated[0].email,
      displayName: updated[0].displayName,
      roleSlug: updated[0].roleSlug,
      organizationId: updated[0].organizationId,
    };
  }

  const assignedRole =
    !hasSuperAdmin || email.toLowerCase() === 'juancarlossumbad@gmail.com'
      ? 'super_admin'
      : 'public_visitor';

  const inserted = await db
    .insert(users)
    .values({
      uid,
      email,
      displayName: name || email.split('@')[0],
      roleSlug: assignedRole,
      emailVerified: true,
    })
    .onConflictDoUpdate({
      target: users.uid,
      set: {
        email,
        updatedAt: new Date(),
      },
    })
    .returning();

  return {
    id: inserted[0].id,
    uid: inserted[0].uid,
    email: inserted[0].email,
    displayName: inserted[0].displayName,
    roleSlug: inserted[0].roleSlug,
    organizationId: inserted[0].organizationId,
  };
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = authHeader.split('Bearer ')[1];

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email || `${decoded.uid}@independente.local`;
    const displayName = (decoded.name as string) || email.split('@')[0];
    const authUser = await resolveOrCreateFirebaseUser(decoded.uid, email, displayName);
    req.authUser = authUser;
    return next();
  } catch (err) {
    console.error('Firebase token verification failed:', err);
    return res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
};

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    if (token.startsWith('prt.')) {
      const partnerPayload = verifyPartnerToken(token);
      if (partnerPayload) {
        req.authUser = {
          id: partnerPayload.userId,
          uid: partnerPayload.uid,
          email: partnerPayload.email,
          displayName: partnerPayload.displayName,
          roleSlug: partnerPayload.roleSlug,
          organizationId: partnerPayload.organizationId,
        };
      }
      return next();
    }
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email || `${decoded.uid}@independente.local`;
    const displayName = (decoded.name as string) || email.split('@')[0];
    req.authUser = await resolveOrCreateFirebaseUser(decoded.uid, email, displayName);
  } catch {
    // Ignore invalid optional auth
  }
  return next();
};

export async function verifyBearerToken(token: string): Promise<AuthenticatedUser | null> {
  if (!token) return null;

  if (token.startsWith('prt.')) {
    const payload = verifyPartnerToken(token);
    if (!payload) return null;
    const dbUser = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
    if (dbUser.length === 0 || !dbUser[0].isActive) return null;
    return {
      id: dbUser[0].id,
      uid: dbUser[0].uid,
      email: dbUser[0].email,
      displayName: dbUser[0].displayName,
      roleSlug: dbUser[0].roleSlug,
      organizationId: dbUser[0].organizationId,
    };
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email || `${decoded.uid}@independente.local`;
    const displayName = (decoded.name as string) || email.split('@')[0];
    return await resolveOrCreateFirebaseUser(decoded.uid, email, displayName);
  } catch {
    return null;
  }
}

export const requireAnyAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = authHeader.split('Bearer ')[1];
  const authUser = await verifyBearerToken(token);
  if (!authUser) {
    return res.status(401).json({ error: 'Invalid, inactive, or expired authentication token' });
  }
  req.authUser = authUser;
  return next();
};

export const requireRoles = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (
      req.authUser.roleSlug === 'super_admin' ||
      allowedRoles.includes(req.authUser.roleSlug)
    ) {
      return next();
    }
    return res.status(403).json({
      error: 'Insufficient permissions for this administrative module',
    });
  };
};

export const requirePartnerAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Partner portal authentication required' });
  }
  const token = authHeader.split('Bearer ')[1];

  // Check Partner HMAC Token first
  if (token.startsWith('prt.')) {
    const payload = verifyPartnerToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired partner session' });
    }
    const dbUser = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
    if (dbUser.length === 0 || !dbUser[0].isActive || !dbUser[0].organizationId) {
      return res.status(403).json({ error: 'Partner account is inactive or unlinked' });
    }
    req.authUser = {
      id: dbUser[0].id,
      uid: dbUser[0].uid,
      email: dbUser[0].email,
      displayName: dbUser[0].displayName,
      roleSlug: dbUser[0].roleSlug,
      organizationId: dbUser[0].organizationId,
    };
    return next();
  }

  // Fallback: Firebase Auth token linked to a partner organization
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email || `${decoded.uid}@independente.local`;
    const displayName = (decoded.name as string) || email.split('@')[0];
    const authUser = await resolveOrCreateFirebaseUser(decoded.uid, email, displayName);
    if (!authUser.organizationId) {
      return res.status(403).json({
        error: 'This account is not affiliated with an approved partner organization',
      });
    }
    req.authUser = authUser;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid partner authentication token' });
  }
};
