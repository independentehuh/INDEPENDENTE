import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import multer from 'multer';
import QRCode from 'qrcode';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from './src/db/index.ts';
import {
  advocacyAreas,
  announcements,
  auditLogs,
  campaigns,
  citizenAttachments,
  citizenCaseUpdates,
  citizenCategories,
  citizenSubmissions,
  collaborationRequests,
  collaborativeProjects,
  contactMessages,
  documents,
  editorialCollaborations,
  eventRegistrations,
  events,
  internalChatMessages,
  mediaOutletMembers,
  mediaOutlets,
  membershipApplications,
  mobilizationMembers,
  mobilizationTasks,
  mobilizationUpdates,
  mobilizations,
  notifications,
  organizationAnnouncements,
  organizationApplications,
  organizationMembers,
  organizationRepresentatives,
  organizations,
  partnerActivities,
  partnerInquiries,
  partnershipAgreements,
  partnershipApplications,
  projectDocuments,
  projectParticipants,
  projectReports,
  projectTasks,
  publicationCategories,
  publications,
  referrals,
  roles,
  systemSettings,
  users,
} from './src/db/schema.ts';
import { ensureSeedData } from './src/db/seed.ts';
import {
  AuthRequest,
  optionalAuth,
  requireAnyAuth,
  requireAuth,
  requirePartnerAuth,
  requireRoles,
  verifyBearerToken,
} from './src/lib/auth.ts';
import {
  generateAccessCode,
  generateReferenceNumber,
  hashAccessCode,
  hashPassword,
  signPartnerToken,
  slugify,
  verifyAccessCode,
  verifyPassword,
} from './src/lib/auth-crypto.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Ensure local upload directories exist (public vs restricted Isanguni)
const PUBLIC_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads/public');
const ISANGUNI_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads/isanguni');
fs.mkdirSync(PUBLIC_UPLOAD_DIR, { recursive: true });
fs.mkdirSync(ISANGUNI_UPLOAD_DIR, { recursive: true });

app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));

// Simple in-memory rate limiter for public submissions
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, maxRequests = 25, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count += 1;
  return true;
}

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const makeUploader = (destDir: string) =>
  multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, destDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10);
        const safeName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
        cb(null, safeName);
      },
    }),
    limits: { fileSize: 8 * 1024 * 1024, files: 5 },
    fileFilter: (_req, file, cb) => {
      if (allowedMimeTypes.has(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Unsupported file type. Allowed: JPG, PNG, WEBP, PDF, TXT, DOC/DOCX.'));
      }
    },
  });

const publicUpload = makeUploader(PUBLIC_UPLOAD_DIR);
const isanguniUpload = makeUploader(ISANGUNI_UPLOAD_DIR);

// Serve ONLY public non-sensitive uploads
app.use('/uploads/public', express.static(PUBLIC_UPLOAD_DIR));

async function recordAudit(
  actorUid: string,
  actorEmail: string,
  actorRole: string,
  action: string,
  entityType: string,
  entityId: string | number,
  details = ''
) {
  try {
    await db.insert(auditLogs).values({
      actorUid,
      actorEmail,
      actorRole,
      action,
      entityType,
      entityId: String(entityId),
      details,
    });
  } catch (err) {
    console.error('Audit log insert failed:', err);
  }
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'independente-platform', timestamp: new Date().toISOString() });
});

// Lazy seed & bootstrap public metadata
app.get('/api/bootstrap', async (_req, res) => {
  try {
    await ensureSeedData();
    const [pubCats, citizenCats, areas, pubAnnouncements, publicDocs, settings] = await Promise.all([
      db.select().from(publicationCategories).orderBy(publicationCategories.sortOrder),
      db.select().from(citizenCategories).where(eq(citizenCategories.isActive, true)),
      db.select().from(advocacyAreas).where(eq(advocacyAreas.isActive, true)).orderBy(advocacyAreas.sortOrder),
      db.select().from(announcements).where(eq(announcements.audience, 'public')).orderBy(desc(announcements.id)),
      db.select().from(documents).where(eq(documents.accessLevel, 'public')).orderBy(desc(documents.id)),
      db.select().from(systemSettings),
    ]);

    res.json({
      publicationCategories: pubCats,
      citizenCategories: citizenCats,
      advocacyAreas: areas,
      announcements: pubAnnouncements,
      publicDocuments: publicDocs,
      settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
    });
  } catch (err) {
    console.error('Bootstrap error:', err);
    res.status(500).json({ error: 'Unable to load platform metadata.' });
  }
});

// Downloadable Institutional Documents (renders clean text charter/templates)
app.get('/api/documents/download/:docKey', async (req, res) => {
  const { docKey } = req.params;
  const templates: Record<string, { filename: string; content: string }> = {
    'charter-2026': {
      filename: 'INDEPENDENTE-Partnership-Charter-2026.txt',
      content: `INDEPENDENTE — AN INDEPENDENT CITIZENS NETWORK\nNETWORK PARTNERSHIP CHARTER & NONPARTISANSHIP COVENANT (2026)\n\n1. CORE PHILOSOPHY\n"An informed citizenry is an empowered citizenry."\nIndependent Minds. Informed Choices. Empowered Citizens.\n\n2. STRUCTURE\n- Central Network Secretariat & Executive Committee: Coordinating administrative body.\n- Affiliated Partner Organizations: Accredited organizations participating via approved MOU.\n- Individual Citizens: Open participation in public programs, forums, and Citizen Isanguni.\n\n3. NONPARTISAN COVENANT\nPartner organizations commit to evidence-based civic work, zero endorsement of partisan electoral slates under the INDEPENDENTE banner, and respect for diverse citizen viewpoints.\n`,
    },
    'mou-template': {
      filename: 'INDEPENDENTE-MOU-Template-2026.txt',
      content: `MEMORANDUM OF UNDERSTANDING (TEMPLATE)\nBetween INDEPENDENTE – An Independent Citizens Network and [PARTNER ORGANIZATION NAME]\n\nArticle I. Purpose and Nonpartisan Scope\nArticle II. Mutual Commitments & Joint Civic Initiatives\nArticle III. Data Privacy Compliance (Republic Act No. 10173)\nArticle IV. Representation, Duration, and Renewal\n`,
    },
    'accomplishment-template': {
      filename: 'INDEPENDENTE-Accomplishment-Report-Template.txt',
      content: `QUARTERLY COLLABORATIVE ACTIVITY & ACCOMPLISHMENT REPORT\nOrganization Name:\nActivity Title:\nDate & Location:\nNumber of Citizen Participants:\nSummary of Outcomes & Key Observations:\nSupporting Documentation Attached:\n`,
    },
    'privacy-protocol': {
      filename: 'INDEPENDENTE-RA10173-Data-Privacy-Protocol.txt',
      content: `CITIZEN ISANGUNI & NETWORK DATA PRIVACY PROTOCOL (RA 10173)\n\n1. Confidentiality & Minimization: Personal identifiers are optional or strictly shielded.\n2. Anonymous Submissions: No tracking metadata is exposed; access relies solely on hashed tracking codes.\n3. Referral Safeguards: No identifiable citizen record is shared externally without informed consent.\n4. Editorial Separation: Citizen Isanguni complaints are never automatically published as media articles.\n`,
    },
  };
  const doc = templates[docKey] || {
    filename: `independente-document-${slugify(docKey)}.txt`,
    content: `INDEPENDENTE — Official Network Document (${docKey})\nIssued by the INDEPENDENTE Secretariat.\n`,
  };
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${doc.filename}"`);
  res.send(doc.content);
});

// Unified Public Search (Excludes private partner records & confidential Citizen Isanguni cases!)
app.get('/api/search', async (req, res) => {
  try {
    await ensureSeedData();
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.json({ publications: [], advocacy: [], campaigns: [], organizations: [], events: [], announcements: [] });
    }
    const pattern = `%${q}%`;
    const [pubs, areas, camps, orgs, evts, anns] = await Promise.all([
      db
        .select()
        .from(publications)
        .where(
          and(
            eq(publications.status, 'published'),
            or(
              ilike(publications.title, pattern),
              ilike(publications.subheadline, pattern),
              ilike(publications.tags, pattern)
            )
          )
        )
        .limit(8),
      db
        .select()
        .from(advocacyAreas)
        .where(and(eq(advocacyAreas.isActive, true), or(ilike(advocacyAreas.title, pattern), ilike(advocacyAreas.summary, pattern))))
        .limit(6),
      db
        .select()
        .from(campaigns)
        .where(or(ilike(campaigns.title, pattern), ilike(campaigns.summary, pattern)))
        .limit(6),
      db
        .select({
          id: organizations.id,
          slug: organizations.slug,
          name: organizations.name,
          orgType: organizations.orgType,
          geographicCoverage: organizations.geographicCoverage,
          description: organizations.description,
          partnershipStatus: organizations.partnershipStatus,
        })
        .from(organizations)
        .where(
          and(
            eq(organizations.partnershipStatus, 'Active'),
            or(ilike(organizations.name, pattern), ilike(organizations.advocacyInterests, pattern), ilike(organizations.geographicCoverage, pattern))
          )
        )
        .limit(6),
      db
        .select()
        .from(events)
        .where(or(ilike(events.title, pattern), ilike(events.description, pattern), ilike(events.category, pattern)))
        .limit(6),
      db
        .select()
        .from(announcements)
        .where(and(eq(announcements.audience, 'public'), or(ilike(announcements.title, pattern), ilike(announcements.body, pattern))))
        .limit(4),
    ]);

    res.json({ publications: pubs, advocacy: areas, campaigns: camps, organizations: orgs, events: evts, announcements: anns });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed.' });
  }
});

// ==================== MEDIA & PUBLICATIONS ====================
app.get('/api/publications', async (req, res) => {
  try {
    await ensureSeedData();
    const category = String(req.query.category || '').trim();
    const tag = String(req.query.tag || '').trim();
    const q = String(req.query.q || '').trim();
    const outletSlug = String(req.query.outletSlug || '').trim();

    const outletsList = await db.select().from(mediaOutlets);
    const outletById = new Map(outletsList.map((o) => [o.id, o]));
    const outletBySlug = new Map(outletsList.map((o) => [o.slug, o]));

    const conditions = [eq(publications.status, 'published')];
    if (category && category !== 'all') {
      conditions.push(eq(publications.categorySlug, category));
    }
    if (outletSlug && outletSlug !== 'all') {
      const targetOutlet = outletBySlug.get(outletSlug);
      if (targetOutlet) {
        conditions.push(
          or(
            eq(publications.outletId, targetOutlet.id),
            eq(publications.coOutletId, targetOutlet.id)
          )!
        );
      }
    }
    if (tag) {
      conditions.push(ilike(publications.tags, `%${tag}%`));
    }
    if (q) {
      conditions.push(
        or(
          ilike(publications.title, `%${q}%`),
          ilike(publications.subheadline, `%${q}%`),
          ilike(publications.authorName, `%${q}%`)
        )!
      );
    }

    const rows = await db
      .select()
      .from(publications)
      .where(and(...conditions))
      .orderBy(desc(publications.publishedAt), desc(publications.id));

    res.json(
      rows.map((r) => {
        const outlet = r.outletId ? outletById.get(r.outletId) : null;
        const coOutlet = r.coOutletId ? outletById.get(r.coOutletId) : null;
        return {
          ...r,
          outletName: outlet?.name || 'INDEPENDENTE Network Desk',
          outletSlug: outlet?.slug || null,
          outletAbbreviation: outlet?.abbreviation || null,
          coOutletName: coOutlet?.name || null,
          coOutletSlug: coOutlet?.slug || null,
        };
      })
    );
  } catch (err) {
    console.error('Publications list error:', err);
    res.status(500).json({ error: 'Unable to fetch publications.' });
  }
});

app.get('/api/publications/:slug', async (req, res) => {
  try {
    await ensureSeedData();
    const { slug } = req.params;
    const found = await db
      .select()
      .from(publications)
      .where(and(eq(publications.slug, slug), eq(publications.status, 'published')))
      .limit(1);

    if (found.length === 0) {
      return res.status(404).json({ error: 'Publication not found.' });
    }
    const article = found[0];
    await db
      .update(publications)
      .set({ viewCount: article.viewCount + 1 })
      .where(eq(publications.id, article.id));

    const related = await db
      .select()
      .from(publications)
      .where(
        and(
          eq(publications.status, 'published'),
          eq(publications.categorySlug, article.categorySlug),
          sql`${publications.id} != ${article.id}`
        )
      )
      .orderBy(desc(publications.id))
      .limit(3);

    res.json({ ...article, viewCount: article.viewCount + 1, related });
  } catch (err) {
    console.error('Publication detail error:', err);
    res.status(500).json({ error: 'Unable to load publication.' });
  }
});

// ==================== ADVOCACY CENTER ====================
app.get('/api/advocacy', async (_req, res) => {
  try {
    await ensureSeedData();
    const [areas, allCampaigns] = await Promise.all([
      db.select().from(advocacyAreas).where(eq(advocacyAreas.isActive, true)).orderBy(advocacyAreas.sortOrder),
      db.select().from(campaigns).orderBy(desc(campaigns.id)),
    ]);
    res.json({ areas, campaigns: allCampaigns });
  } catch (err) {
    console.error('Advocacy list error:', err);
    res.status(500).json({ error: 'Unable to load advocacy center.' });
  }
});

app.get('/api/advocacy/:slug', async (req, res) => {
  try {
    await ensureSeedData();
    const found = await db.select().from(advocacyAreas).where(eq(advocacyAreas.slug, req.params.slug)).limit(1);
    if (found.length === 0) {
      return res.status(404).json({ error: 'Advocacy area not found.' });
    }
    const area = found[0];
    const [areaCampaigns, relatedPartners, relatedPubs, upcomingEvents] = await Promise.all([
      db.select().from(campaigns).where(eq(campaigns.advocacyAreaId, area.id)).orderBy(desc(campaigns.id)),
      db
        .select({
          id: organizations.id,
          slug: organizations.slug,
          name: organizations.name,
          orgType: organizations.orgType,
          geographicCoverage: organizations.geographicCoverage,
          logoUrl: organizations.logoUrl,
        })
        .from(organizations)
        .where(ilike(organizations.advocacyInterests, `%${area.title.split(' ')[0]}%`))
        .limit(6),
      db
        .select()
        .from(publications)
        .where(eq(publications.status, 'published'))
        .orderBy(desc(publications.id))
        .limit(4),
      db.select().from(events).where(eq(events.status, 'Upcoming')).orderBy(events.startAt).limit(4),
    ]);
    res.json({ area, campaigns: areaCampaigns, partners: relatedPartners, publications: relatedPubs, events: upcomingEvents });
  } catch (err) {
    console.error('Advocacy detail error:', err);
    res.status(500).json({ error: 'Unable to load advocacy details.' });
  }
});

// ==================== OUR NETWORK & PARTNERSHIP APPLICATIONS ====================
app.get('/api/organizations', async (req, res) => {
  try {
    await ensureSeedData();
    const orgType = String(req.query.orgType || '').trim();
    const location = String(req.query.location || '').trim();
    const advocacy = String(req.query.advocacy || '').trim();
    const status = String(req.query.status || '').trim();

    const conditions = [];
    if (orgType && orgType !== 'all') conditions.push(eq(organizations.orgType, orgType));
    if (location && location !== 'all') conditions.push(ilike(organizations.geographicCoverage, `%${location}%`));
    if (advocacy && advocacy !== 'all') conditions.push(ilike(organizations.advocacyInterests, `%${advocacy}%`));
    if (status && status !== 'all') conditions.push(eq(organizations.partnershipStatus, status));

    const rows = await db
      .select({
        id: organizations.id,
        slug: organizations.slug,
        name: organizations.name,
        orgType: organizations.orgType,
        description: organizations.description,
        mission: organizations.mission,
        vision: organizations.vision,
        advocacyInterests: organizations.advocacyInterests,
        geographicCoverage: organizations.geographicCoverage,
        officialRepresentative: organizations.officialRepresentative,
        website: organizations.website,
        socialLinks: organizations.socialLinks,
        logoUrl: organizations.logoUrl,
        partnershipDate: organizations.partnershipDate,
        partnershipStatus: organizations.partnershipStatus,
        affiliationStatus: organizations.affiliationStatus,
        membershipRequirements: organizations.membershipRequirements,
        acceptingMembers: organizations.acceptingMembers,
        isFeatured: organizations.isFeatured,
        isDemonstration: organizations.isDemonstration,
      })
      .from(organizations)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(organizations.isFeatured), organizations.name);

    res.json(rows);
  } catch (err) {
    console.error('Organizations directory error:', err);
    res.status(500).json({ error: 'Unable to load partner directory.' });
  }
});

app.get('/api/organizations/:slug', async (req, res) => {
  try {
    await ensureSeedData();
    const found = await db.select().from(organizations).where(eq(organizations.slug, req.params.slug)).limit(1);
    if (found.length === 0) return res.status(404).json({ error: 'Organization not found.' });
    const org = found[0];
    const [activities, relatedPubs] = await Promise.all([
      db
        .select({
          id: partnerActivities.id,
          title: partnerActivities.title,
          activityType: partnerActivities.activityType,
          description: partnerActivities.description,
          activityDate: partnerActivities.activityDate,
          accomplishmentSummary: partnerActivities.accomplishmentSummary,
          status: partnerActivities.status,
        })
        .from(partnerActivities)
        .where(and(eq(partnerActivities.organizationId, org.id), or(eq(partnerActivities.status, 'Completed'), eq(partnerActivities.status, 'Approved'))))
        .orderBy(desc(partnerActivities.id))
        .limit(6),
      db
        .select()
        .from(publications)
        .where(and(eq(publications.status, 'published'), ilike(publications.bodyMarkdown, `%${org.name.split(' ')[0]}%`)))
        .limit(4),
    ]);

    res.json({
      id: org.id,
      slug: org.slug,
      name: org.name,
      orgType: org.orgType,
      description: org.description,
      mission: org.mission,
      vision: org.vision,
      advocacyInterests: org.advocacyInterests,
      geographicCoverage: org.geographicCoverage,
      officialRepresentative: org.officialRepresentative,
      website: org.website,
      socialLinks: org.socialLinks,
      logoUrl: org.logoUrl,
      partnershipDate: org.partnershipDate,
      partnershipStatus: org.partnershipStatus,
      isDemonstration: org.isDemonstration,
      activities,
      relatedPublications: relatedPubs,
    });
  } catch (err) {
    console.error('Organization detail error:', err);
    res.status(500).json({ error: 'Unable to load organization profile.' });
  }
});

app.post('/api/partnerships/apply', publicUpload.single('supportingDoc'), async (req, res) => {
  try {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`apply:${ip}`, 10, 300_000)) {
      return res.status(429).json({ error: 'Too many applications submitted recently. Please try again later.' });
    }
    const {
      organizationName,
      orgType,
      officialAddress,
      websiteOrSocial,
      background,
      mission,
      vision,
      advocacyInterests,
      authorizedRep,
      position,
      officialEmail,
      contactNumber,
      proposedAreas,
      consentGiven,
    } = req.body;

    if (!organizationName || !orgType || !officialAddress || !background || !mission || !vision || !authorizedRep || !officialEmail || !contactNumber || !proposedAreas) {
      return res.status(400).json({ error: 'Please complete all required partnership application fields.' });
    }
    if (consentGiven !== 'true' && consentGiven !== true) {
      return res.status(400).json({ error: 'Consent and authorization confirmation is required.' });
    }

    const referenceCode = generateReferenceNumber('PRT');
    const supportingDocUrl = req.file ? `/uploads/public/${req.file.filename}` : '';

    const [created] = await db
      .insert(partnershipApplications)
      .values({
        referenceCode,
        organizationName: String(organizationName).trim(),
        orgType: String(orgType).trim(),
        officialAddress: String(officialAddress).trim(),
        websiteOrSocial: String(websiteOrSocial || '').trim(),
        background: String(background).trim(),
        mission: String(mission).trim(),
        vision: String(vision).trim(),
        advocacyInterests: String(advocacyInterests || '').trim(),
        authorizedRep: String(authorizedRep).trim(),
        position: String(position || 'Authorized Representative').trim(),
        officialEmail: String(officialEmail).trim().toLowerCase(),
        contactNumber: String(contactNumber).trim(),
        proposedAreas: String(proposedAreas).trim(),
        supportingDocUrl,
        consentGiven: true,
        status: 'Submitted',
      })
      .returning();

    await db.insert(notifications).values({
      recipientType: 'admin',
      title: 'New Partnership Application',
      message: `${created.organizationName} (${created.referenceCode}) submitted a partnership application.`,
      linkPath: '/admin',
    });

    res.status(201).json({
      referenceCode: created.referenceCode,
      status: created.status,
      organizationName: created.organizationName,
      message: 'Partnership application received and queued for initial Secretariat review.',
    });
  } catch (err) {
    console.error('Partnership apply error:', err);
    res.status(500).json({ error: 'Unable to submit partnership application.' });
  }
});

app.get('/api/partnerships/application-status', async (req, res) => {
  try {
    const ref = String(req.query.ref || '').trim().toUpperCase();
    if (!ref) return res.status(400).json({ error: 'Reference code is required.' });
    const found = await db
      .select({
        referenceCode: partnershipApplications.referenceCode,
        organizationName: partnershipApplications.organizationName,
        status: partnershipApplications.status,
        reviewNotes: partnershipApplications.reviewNotes,
        updatedAt: partnershipApplications.updatedAt,
      })
      .from(partnershipApplications)
      .where(eq(partnershipApplications.referenceCode, ref))
      .limit(1);

    if (found.length === 0) return res.status(404).json({ error: 'Application reference not found.' });
    res.json(found[0]);
  } catch (err) {
    console.error('Application status error:', err);
    res.status(500).json({ error: 'Unable to verify application status.' });
  }
});

// ==================== EVENTS & ACTIVITIES ====================
app.get('/api/events', async (req, res) => {
  try {
    await ensureSeedData();
    const status = String(req.query.status || '').trim();
    const format = String(req.query.format || '').trim();
    const category = String(req.query.category || '').trim();

    const conditions = [];
    if (status && status !== 'all') conditions.push(eq(events.status, status));
    if (format && format !== 'all') conditions.push(eq(events.format, format));
    if (category && category !== 'all') conditions.push(eq(events.category, category));

    const allEvents = await db
      .select()
      .from(events)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(events.startAt);

    const regCounts = await db
      .select({
        eventId: eventRegistrations.eventId,
        registeredSeats: sql<number>`coalesce(sum(${eventRegistrations.delegationSize}), 0)::int`,
      })
      .from(eventRegistrations)
      .where(sql`${eventRegistrations.status} != 'Cancelled'`)
      .groupBy(eventRegistrations.eventId);

    const countMap = new Map(regCounts.map((r) => [r.eventId, r.registeredSeats]));

    res.json(
      allEvents.map((ev) => ({
        ...ev,
        registeredSeats: countMap.get(ev.id) || 0,
        availableSlots: Math.max(0, ev.capacity - (countMap.get(ev.id) || 0)),
      }))
    );
  } catch (err) {
    console.error('Events list error:', err);
    res.status(500).json({ error: 'Unable to fetch events.' });
  }
});

app.post('/api/events/:id/register', async (req, res) => {
  try {
    const eventId = Number(req.params.id);
    const { registrationType, fullName, email, phone, organizationName, delegationSize } = req.body;
    if (!eventId || !fullName || !email) {
      return res.status(400).json({ error: 'Full name and email are required for registration.' });
    }
    const foundEvent = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
    if (foundEvent.length === 0) return res.status(404).json({ error: 'Event not found.' });
    const ev = foundEvent[0];

    const [{ taken }] = await db
      .select({ taken: sql<number>`coalesce(sum(${eventRegistrations.delegationSize}), 0)::int` })
      .from(eventRegistrations)
      .where(and(eq(eventRegistrations.eventId, eventId), sql`${eventRegistrations.status} != 'Cancelled'`));

    const seats = Math.max(1, Math.min(20, Number(delegationSize) || 1));
    if (taken + seats > ev.capacity) {
      return res.status(400).json({ error: 'Insufficient available slots for this event.' });
    }

    const qrToken = `IND-EVT-${eventId}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const [reg] = await db
      .insert(eventRegistrations)
      .values({
        eventId,
        registrationType: registrationType || 'Individual',
        fullName: String(fullName).trim(),
        email: String(email).trim().toLowerCase(),
        phone: String(phone || '').trim(),
        organizationName: String(organizationName || '').trim(),
        delegationSize: seats,
        qrToken,
        status: 'Confirmed',
      })
      .returning();

    const qrDataUrl = await QRCode.toDataURL(qrToken, { margin: 2, width: 220 });

    await db.insert(notifications).values({
      recipientType: 'public_user',
      title: `Registration Confirmed: ${ev.title}`,
      message: `Confirmed for ${reg.fullName} (${reg.delegationSize} seat/s). Check-in Code: ${qrToken}`,
      linkPath: '/events',
    });

    res.status(201).json({
      registration: reg,
      eventTitle: ev.title,
      startAt: ev.startAt,
      venueOrLink: ev.venueOrLink,
      qrDataUrl,
    });
  } catch (err) {
    console.error('Event registration error:', err);
    res.status(500).json({ error: 'Unable to complete event registration.' });
  }
});

// ==================== CITIZEN ISANGUNI ====================
app.get('/api/isanguni/categories', async (_req, res) => {
  try {
    await ensureSeedData();
    const cats = await db.select().from(citizenCategories).where(eq(citizenCategories.isActive, true));
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: 'Unable to load submission categories.' });
  }
});

app.post('/api/isanguni/submit', isanguniUpload.array('evidence', 5), async (req, res) => {
  try {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`isanguni:${ip}`, 12, 300_000)) {
      return res.status(429).json({ error: 'Submission rate limit reached. Please wait a few minutes.' });
    }

    const {
      subject,
      categorySlug,
      location,
      incidentDate,
      description,
      involvedParties,
      whyItMatters,
      requestedAction,
      privacyMode,
      reporterName,
      reporterEmail,
      reporterPhone,
      preferredContact,
      consentForReferral,
      truthfulnessConfirmed,
    } = req.body;

    if (!subject || !categorySlug || !location || !incidentDate || !description || !whyItMatters || !requestedAction) {
      return res.status(400).json({ error: 'Please complete all required concern fields.' });
    }
    if (truthfulnessConfirmed !== 'true' && truthfulnessConfirmed !== true) {
      return res.status(400).json({ error: 'Please confirm the truthfulness and good-faith declaration.' });
    }
    const mode = ['identified', 'confidential', 'anonymous'].includes(privacyMode)
      ? privacyMode
      : 'confidential';

    if (mode !== 'anonymous' && !reporterEmail && !reporterPhone) {
      return res.status(400).json({
        error: 'Identified and confidential submissions require an email or phone number for secure updates.',
      });
    }

    const referenceNumber = generateReferenceNumber('ISG');
    const plainAccessCode = generateAccessCode();
    const accessCodeHash = hashAccessCode(plainAccessCode);

    const [created] = await db
      .insert(citizenSubmissions)
      .values({
        referenceNumber,
        accessCodeHash,
        subject: String(subject).trim(),
        categorySlug: String(categorySlug).trim(),
        location: String(location).trim(),
        incidentDate: String(incidentDate).trim(),
        description: String(description).trim(),
        involvedParties: String(involvedParties || '').trim(),
        whyItMatters: String(whyItMatters).trim(),
        requestedAction: String(requestedAction).trim(),
        privacyMode: mode,
        reporterName: mode === 'anonymous' ? '' : String(reporterName || '').trim(),
        reporterEmail: mode === 'anonymous' ? '' : String(reporterEmail || '').trim(),
        reporterPhone: mode === 'anonymous' ? '' : String(reporterPhone || '').trim(),
        preferredContact: mode === 'anonymous' ? 'portal' : String(preferredContact || 'email'),
        consentForReferral: consentForReferral === 'true' || consentForReferral === true,
        status: 'RECEIVED',
        priority: 'Standard',
        isDemonstration: false,
      })
      .returning();

    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length > 0) {
      await db.insert(citizenAttachments).values(
        files.map((f) => ({
          submissionId: created.id,
          fileName: f.originalname,
          mimeType: f.mimetype,
          fileSize: f.size,
          storagePath: f.filename,
          uploadedByRole: 'reporter',
        }))
      );
    }

    await db.insert(citizenCaseUpdates).values({
      submissionId: created.id,
      authorRole: 'system',
      authorName: 'Citizen Isanguni Intake',
      updateType: 'status_change',
      message: `Submission received under ${mode} privacy mode. Initial screening queued.`,
      newStatus: 'RECEIVED',
      isPublicToReporter: true,
    });

    await db.insert(notifications).values({
      recipientType: 'admin',
      title: 'New Citizen Isanguni Submission',
      message: `Reference ${created.referenceNumber} (${created.categorySlug}) awaiting initial screening.`,
      linkPath: '/admin',
    });

    res.status(201).json({
      referenceNumber: created.referenceNumber,
      accessCode: plainAccessCode,
      submittedAt: created.createdAt,
      status: created.status,
      privacyMode: created.privacyMode,
    });
  } catch (err) {
    console.error('Citizen Isanguni submit error:', err);
    res.status(500).json({ error: 'Unable to submit concern. Please check attachments and required fields.' });
  }
});

app.post('/api/isanguni/track', async (req, res) => {
  try {
    const referenceNumber = String(req.body.referenceNumber || '').trim().toUpperCase();
    const accessCode = String(req.body.accessCode || '').trim().toUpperCase();

    if (!referenceNumber || !accessCode) {
      return res.status(400).json({ error: 'Reference number and secure access code are required.' });
    }

    const found = await db
      .select()
      .from(citizenSubmissions)
      .where(eq(citizenSubmissions.referenceNumber, referenceNumber))
      .limit(1);

    if (found.length === 0 || !verifyAccessCode(accessCode, found[0].accessCodeHash)) {
      return res.status(401).json({ error: 'Invalid reference number or access code.' });
    }

    const submission = found[0];
    const [updates, attachments] = await Promise.all([
      db
        .select({
          id: citizenCaseUpdates.id,
          authorRole: citizenCaseUpdates.authorRole,
          authorName: citizenCaseUpdates.authorName,
          updateType: citizenCaseUpdates.updateType,
          message: citizenCaseUpdates.message,
          previousStatus: citizenCaseUpdates.previousStatus,
          newStatus: citizenCaseUpdates.newStatus,
          createdAt: citizenCaseUpdates.createdAt,
        })
        .from(citizenCaseUpdates)
        .where(and(eq(citizenCaseUpdates.submissionId, submission.id), eq(citizenCaseUpdates.isPublicToReporter, true)))
        .orderBy(citizenCaseUpdates.createdAt),
      db
        .select({
          id: citizenAttachments.id,
          fileName: citizenAttachments.fileName,
          mimeType: citizenAttachments.mimeType,
          fileSize: citizenAttachments.fileSize,
          createdAt: citizenAttachments.createdAt,
        })
        .from(citizenAttachments)
        .where(eq(citizenAttachments.submissionId, submission.id)),
    ]);

    res.json({
      referenceNumber: submission.referenceNumber,
      subject: submission.subject,
      categorySlug: submission.categorySlug,
      location: submission.location,
      incidentDate: submission.incidentDate,
      privacyMode: submission.privacyMode,
      status: submission.status,
      consentForReferral: submission.consentForReferral,
      reporterFeedback: submission.reporterFeedback,
      reporterRating: submission.reporterRating,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
      updates,
      attachments,
    });
  } catch (err) {
    console.error('Isanguni track error:', err);
    res.status(500).json({ error: 'Unable to retrieve case status.' });
  }
});

app.post('/api/isanguni/followup', isanguniUpload.array('evidence', 3), async (req, res) => {
  try {
    const referenceNumber = String(req.body.referenceNumber || '').trim().toUpperCase();
    const accessCode = String(req.body.accessCode || '').trim().toUpperCase();
    const message = String(req.body.message || '').trim();
    const feedback = String(req.body.feedback || '').trim();
    const rating = req.body.rating ? Number(req.body.rating) : null;

    if (!referenceNumber || !accessCode) {
      return res.status(400).json({ error: 'Reference number and access code are required.' });
    }

    const found = await db
      .select()
      .from(citizenSubmissions)
      .where(eq(citizenSubmissions.referenceNumber, referenceNumber))
      .limit(1);

    if (found.length === 0 || !verifyAccessCode(accessCode, found[0].accessCodeHash)) {
      return res.status(401).json({ error: 'Invalid reference number or access code.' });
    }
    const submission = found[0];

    if (message) {
      await db.insert(citizenCaseUpdates).values({
        submissionId: submission.id,
        authorRole: 'reporter',
        authorName: submission.privacyMode === 'anonymous' ? 'Anonymous Reporter' : 'Concern Reporter',
        updateType: 'reporter_reply',
        message,
        isPublicToReporter: true,
      });
    }

    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length > 0) {
      await db.insert(citizenAttachments).values(
        files.map((f) => ({
          submissionId: submission.id,
          fileName: f.originalname,
          mimeType: f.mimetype,
          fileSize: f.size,
          storagePath: f.filename,
          uploadedByRole: 'reporter',
        }))
      );
      await db.insert(citizenCaseUpdates).values({
        submissionId: submission.id,
        authorRole: 'reporter',
        authorName: submission.privacyMode === 'anonymous' ? 'Anonymous Reporter' : 'Concern Reporter',
        updateType: 'reporter_reply',
        message: `Uploaded ${files.length} additional supporting file(s).`,
        isPublicToReporter: true,
      });
    }

    if (feedback || rating) {
      await db
        .update(citizenSubmissions)
        .set({
          reporterFeedback: feedback || submission.reporterFeedback,
          reporterRating: rating || submission.reporterRating,
          updatedAt: new Date(),
        })
        .where(eq(citizenSubmissions.id, submission.id));
    }

    await db
      .update(citizenSubmissions)
      .set({ updatedAt: new Date() })
      .where(eq(citizenSubmissions.id, submission.id));

    res.json({ ok: true, message: 'Follow-up recorded securely.' });
  } catch (err) {
    console.error('Isanguni followup error:', err);
    res.status(500).json({ error: 'Unable to submit follow-up.' });
  }
});

// Restricted attachment download for Citizen Isanguni
app.get('/api/isanguni/attachments/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const attachmentId = Number(req.params.id);
    const attRows = await db.select().from(citizenAttachments).where(eq(citizenAttachments.id, attachmentId)).limit(1);
    if (attRows.length === 0) return res.status(404).json({ error: 'Attachment not found.' });
    const att = attRows[0];

    const subRows = await db.select().from(citizenSubmissions).where(eq(citizenSubmissions.id, att.submissionId)).limit(1);
    if (subRows.length === 0) return res.status(404).json({ error: 'Submission not found.' });
    const sub = subRows[0];

    const isAuthorizedOfficer =
      req.authUser && ['super_admin', 'citizen_affairs_officer'].includes(req.authUser.roleSlug);
    const headerRef = String(req.headers['x-isanguni-ref'] || '').trim().toUpperCase();
    const headerCode = String(req.headers['x-isanguni-code'] || '').trim().toUpperCase();
    const isValidReporter =
      headerRef === sub.referenceNumber && headerCode && verifyAccessCode(headerCode, sub.accessCodeHash);

    if (!isAuthorizedOfficer && !isValidReporter) {
      return res.status(403).json({ error: 'Access denied to confidential attachment.' });
    }

    const filePath = path.join(ISANGUNI_UPLOAD_DIR, att.storagePath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File no longer available on disk.' });
    res.setHeader('Content-Type', att.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${att.fileName.replace(/"/g, '')}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('Attachment download error:', err);
    res.status(500).json({ error: 'Unable to download attachment.' });
  }
});

// ==================== PARTNER PORTAL (ISOLATED BY ORGANIZATION ID) ====================
app.post('/api/partner/login', async (req, res) => {
  try {
    await ensureSeedData();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const twoFactorCode = String(req.body.twoFactorCode || '').trim();

    if (!email || !password) {
      return res.status(400).json({ error: 'Official email and password are required.' });
    }

    const foundUsers = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (foundUsers.length === 0) {
      return res.status(401).json({ error: 'Invalid partner organization credentials.' });
    }
    const u = foundUsers[0];
    if (!u.isActive || !u.organizationId || !u.passwordHash) {
      return res.status(403).json({ error: 'Account is not activated for Partner Portal password login.' });
    }
    if (!verifyPassword(password, u.passwordHash)) {
      return res.status(401).json({ error: 'Invalid partner organization credentials.' });
    }
    if (u.twoFactorEnabled) {
      if (!twoFactorCode) {
        const tempCode = crypto.randomInt(100000, 999999).toString();
        await db.update(users).set({ twoFactorCode: tempCode }).where(eq(users.id, u.id));
        return res.status(200).json({
          requiresTwoFactor: true,
          message: 'Two-factor verification required. Enter your 6-digit verification code.',
        });
      }
      if (u.twoFactorCode !== twoFactorCode) {
        return res.status(401).json({ error: 'Invalid two-factor verification code.' });
      }
      await db.update(users).set({ twoFactorCode: null }).where(eq(users.id, u.id));
    }

    const token = signPartnerToken({
      userId: u.id,
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      roleSlug: u.roleSlug,
      organizationId: u.organizationId,
    });

    const orgRows = await db.select().from(organizations).where(eq(organizations.id, u.organizationId)).limit(1);

    await recordAudit(u.uid, u.email, u.roleSlug, 'PARTNER_LOGIN', 'organization', u.organizationId, 'Partner Portal login');

    res.json({
      token,
      user: {
        id: u.id,
        uid: u.uid,
        email: u.email,
        displayName: u.displayName,
        roleSlug: u.roleSlug,
        organizationId: u.organizationId,
        twoFactorEnabled: u.twoFactorEnabled,
      },
      organization: orgRows[0] || null,
    });
  } catch (err) {
    console.error('Partner login error:', err);
    res.status(500).json({ error: 'Partner login failed.' });
  }
});

app.post('/api/partner/request-reset', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email address is required.' });
    await db.insert(notifications).values({
      recipientType: 'admin',
      title: 'Partner Password Reset Request',
      message: `Password reset requested for partner email ${email}.`,
      linkPath: '/admin',
    });
    res.json({
      ok: true,
      message: 'If an active partner account matches that email, the Secretariat has logged a secure reset verification notice.',
    });
  } catch (err) {
    res.status(500).json({ error: 'Unable to log reset request.' });
  }
});

app.get('/api/partner/dashboard', requirePartnerAuth, async (req: AuthRequest, res) => {
  try {
    const orgId = req.authUser!.organizationId!;
    const [
      orgRows,
      reps,
      agreements,
      internalAnnouncements,
      upcomingEvents,
      activities,
      orgDocs,
      inquiries,
    ] = await Promise.all([
      db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1),
      db.select().from(organizationRepresentatives).where(eq(organizationRepresentatives.organizationId, orgId)),
      db.select().from(partnershipAgreements).where(eq(partnershipAgreements.organizationId, orgId)),
      db.select().from(announcements).where(or(eq(announcements.audience, 'partners'), eq(announcements.audience, 'public'))).orderBy(desc(announcements.id)),
      db.select().from(events).orderBy(events.startAt),
      db.select().from(partnerActivities).where(eq(partnerActivities.organizationId, orgId)).orderBy(desc(partnerActivities.id)),
      db
        .select()
        .from(documents)
        .where(
          or(
            eq(documents.accessLevel, 'public'),
            eq(documents.accessLevel, 'partners'),
            and(eq(documents.accessLevel, 'organization_only'), eq(documents.organizationId, orgId))
          )
        )
        .orderBy(desc(documents.id)),
      db.select().from(partnerInquiries).where(eq(partnerInquiries.organizationId, orgId)).orderBy(desc(partnerInquiries.id)),
    ]);

    const orgName = orgRows[0]?.name || '';
    const orgRegistrations = orgName
      ? await db.select().from(eventRegistrations).where(eq(eventRegistrations.organizationName, orgName))
      : [];

    res.json({
      user: req.authUser,
      organization: orgRows[0] || null,
      representatives: reps,
      agreements,
      announcements: internalAnnouncements,
      events: upcomingEvents,
      registrations: orgRegistrations,
      activities,
      documents: orgDocs,
      inquiries,
    });
  } catch (err) {
    console.error('Partner dashboard error:', err);
    res.status(500).json({ error: 'Unable to load partner portal dashboard.' });
  }
});

app.patch('/api/partner/profile', requirePartnerAuth, publicUpload.single('logo'), async (req: AuthRequest, res) => {
  try {
    const orgId = req.authUser!.organizationId!;
    const { description, mission, vision, advocacyInterests, geographicCoverage, officialEmail, contactNumber, website, socialLinks } = req.body;
    const updatePayload: Record<string, unknown> = {};
    if (description !== undefined) updatePayload.description = String(description).trim();
    if (mission !== undefined) updatePayload.mission = String(mission).trim();
    if (vision !== undefined) updatePayload.vision = String(vision).trim();
    if (advocacyInterests !== undefined) updatePayload.advocacyInterests = String(advocacyInterests).trim();
    if (geographicCoverage !== undefined) updatePayload.geographicCoverage = String(geographicCoverage).trim();
    if (officialEmail !== undefined) updatePayload.officialEmail = String(officialEmail).trim();
    if (contactNumber !== undefined) updatePayload.contactNumber = String(contactNumber).trim();
    if (website !== undefined) updatePayload.website = String(website).trim();
    if (socialLinks !== undefined) updatePayload.socialLinks = String(socialLinks).trim();
    if (req.file) updatePayload.logoUrl = `/uploads/public/${req.file.filename}`;

    const [updated] = await db.update(organizations).set(updatePayload).where(eq(organizations.id, orgId)).returning();
    await recordAudit(req.authUser!.uid, req.authUser!.email, req.authUser!.roleSlug, 'PARTNER_UPDATE_PROFILE', 'organization', orgId);
    res.json(updated);
  } catch (err) {
    console.error('Partner profile update error:', err);
    res.status(500).json({ error: 'Unable to update organization profile.' });
  }
});

app.post('/api/partner/representatives', requirePartnerAuth, async (req: AuthRequest, res) => {
  try {
    const orgId = req.authUser!.organizationId!;
    const { fullName, position, email, phone, partnerRole } = req.body;
    if (!fullName || !position || !email) {
      return res.status(400).json({ error: 'Representative name, position, and email are required.' });
    }
    const [created] = await db
      .insert(organizationRepresentatives)
      .values({
        organizationId: orgId,
        fullName: String(fullName).trim(),
        position: String(position).trim(),
        email: String(email).trim().toLowerCase(),
        phone: String(phone || '').trim(),
        partnerRole: String(partnerRole || 'Authorized Representative').trim(),
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Unable to add representative.' });
  }
});

app.delete('/api/partner/representatives/:id', requirePartnerAuth, async (req: AuthRequest, res) => {
  try {
    const orgId = req.authUser!.organizationId!;
    const id = Number(req.params.id);
    await db
      .delete(organizationRepresentatives)
      .where(and(eq(organizationRepresentatives.id, id), eq(organizationRepresentatives.organizationId, orgId)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Unable to remove representative.' });
  }
});

app.post('/api/partner/activities', requirePartnerAuth, publicUpload.single('photo'), async (req: AuthRequest, res) => {
  try {
    const orgId = req.authUser!.organizationId!;
    const { title, activityType, description, activityDate, accomplishmentSummary } = req.body;
    if (!title || !activityType || !description || !activityDate) {
      return res.status(400).json({ error: 'Title, type, date, and description are required.' });
    }
    const photoUrl = req.file ? `/uploads/public/${req.file.filename}` : '';
    const [created] = await db
      .insert(partnerActivities)
      .values({
        organizationId: orgId,
        title: String(title).trim(),
        activityType: String(activityType).trim(),
        description: String(description).trim(),
        activityDate: String(activityDate).trim(),
        accomplishmentSummary: String(accomplishmentSummary || '').trim(),
        photoUrl,
        status: activityType === 'Completed Activity Report' ? 'Completed' : 'Submitted',
      })
      .returning();

    await db.insert(notifications).values({
      recipientType: 'admin',
      title: 'Partner Activity Submitted',
      message: `${created.title} (${created.activityType}) submitted for Secretariat coordination.`,
      linkPath: '/admin',
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('Partner activity error:', err);
    res.status(500).json({ error: 'Unable to submit partner activity.' });
  }
});

app.post('/api/partner/inquiries', requirePartnerAuth, async (req: AuthRequest, res) => {
  try {
    const orgId = req.authUser!.organizationId!;
    const { subject, message } = req.body;
    if (!subject || !message) return res.status(400).json({ error: 'Subject and message are required.' });
    const [created] = await db
      .insert(partnerInquiries)
      .values({
        organizationId: orgId,
        senderEmail: req.authUser!.email,
        subject: String(subject).trim(),
        message: String(message).trim(),
        status: 'Open',
      })
      .returning();
    await db.insert(notifications).values({
      recipientType: 'admin',
      title: 'New Partner Secretariat Inquiry',
      message: `${created.subject} from ${req.authUser!.email}`,
      linkPath: '/admin',
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Unable to send inquiry.' });
  }
});

app.patch('/api/partner/security', requirePartnerAuth, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword, twoFactorEnabled } = req.body;
    const [u] = await db.select().from(users).where(eq(users.id, req.authUser!.id)).limit(1);
    if (!u) return res.status(404).json({ error: 'User not found.' });

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (newPassword) {
      if (u.passwordHash && (!currentPassword || !verifyPassword(currentPassword, u.passwordHash))) {
        return res.status(400).json({ error: 'Current password is incorrect.' });
      }
      if (String(newPassword).length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters.' });
      }
      updates.passwordHash = hashPassword(String(newPassword));
    }
    if (typeof twoFactorEnabled === 'boolean') {
      updates.twoFactorEnabled = twoFactorEnabled;
    }

    await db.update(users).set(updates).where(eq(users.id, u.id));
    res.json({ ok: true, message: 'Security settings updated.' });
  } catch (err) {
    res.status(500).json({ error: 'Unable to update security settings.' });
  }
});

// ==================== CONTACT ====================
app.post('/api/contact', async (req, res) => {
  try {
    const { fullName, email, subject, message } = req.body;
    if (!fullName || !email || !subject || !message) {
      return res.status(400).json({ error: 'All contact form fields are required.' });
    }
    const [created] = await db
      .insert(contactMessages)
      .values({
        fullName: String(fullName).trim(),
        email: String(email).trim(),
        subject: String(subject).trim(),
        message: String(message).trim(),
      })
      .returning();
    res.status(201).json({ ok: true, id: created.id });
  } catch (err) {
    res.status(500).json({ error: 'Unable to send contact message.' });
  }
});

// ==================== AUTH PROFILE & ADMIN MANAGEMENT ====================
app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeedData();
    const roleRows = await db.select().from(roles).where(eq(roles.slug, req.authUser!.roleSlug)).limit(1);
    res.json({
      user: req.authUser,
      role: roleRows[0] || null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Unable to load profile.' });
  }
});

const ADMIN_ALLOWED_ROLES = [
  'super_admin',
  'secretariat_admin',
  'executive_committee',
  'editor_in_chief',
  'editorial_staff',
  'advocacy_coordinator',
  'partnership_coordinator',
  'events_coordinator',
  'citizen_affairs_officer',
];

app.get('/api/admin/overview', requireAuth, requireRoles(ADMIN_ALLOWED_ROLES), async (req: AuthRequest, res) => {
  try {
    await ensureSeedData();
    const [
      pubStats,
      campStats,
      orgStats,
      appStats,
      evtStats,
      regStats,
      isanguniTotal,
      isanguniStatusCounts,
      isanguniCatCounts,
      recentLogs,
      adminNotifications,
      topPubs,
      outletStats,
      mobStats,
      orgAppStats,
      projStats,
    ] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          pending: sql<number>`count(*) filter (where ${publications.status} in ('draft','review'))::int`,
          published: sql<number>`count(*) filter (where ${publications.status} = 'published')::int`,
          totalReads: sql<number>`coalesce(sum(${publications.viewCount}), 0)::int`,
        })
        .from(publications),
      db
        .select({
          active: sql<number>`count(*) filter (where ${campaigns.status} = 'Active')::int`,
          total: sql<number>`count(*)::int`,
        })
        .from(campaigns),
      db
        .select({
          active: sql<number>`count(*) filter (where ${organizations.partnershipStatus} = 'Active')::int`,
          total: sql<number>`count(*)::int`,
        })
        .from(organizations),
      db
        .select({
          pending: sql<number>`count(*) filter (where ${partnershipApplications.status} not in ('Approved','Rejected'))::int`,
        })
        .from(partnershipApplications),
      db
        .select({
          upcoming: sql<number>`count(*) filter (where ${events.status} = 'Upcoming')::int`,
          total: sql<number>`count(*)::int`,
        })
        .from(events),
      db.select({ total: sql<number>`count(*)::int` }).from(eventRegistrations),
      db
        .select({
          total: sql<number>`count(*)::int`,
          awaitingScreening: sql<number>`count(*) filter (where ${citizenSubmissions.status} in ('RECEIVED','INITIAL SCREENING'))::int`,
          inProgress: sql<number>`count(*) filter (where ${citizenSubmissions.status} in ('UNDER REVIEW','FOR CLARIFICATION','FOR REFERRAL','ACTION INITIATED'))::int`,
          resolved: sql<number>`count(*) filter (where ${citizenSubmissions.status} in ('RESOLVED / ADDRESSED','CLOSED'))::int`,
        })
        .from(citizenSubmissions),
      db
        .select({ status: citizenSubmissions.status, count: sql<number>`count(*)::int` })
        .from(citizenSubmissions)
        .groupBy(citizenSubmissions.status),
      db
        .select({ category: citizenSubmissions.categorySlug, count: sql<number>`count(*)::int` })
        .from(citizenSubmissions)
        .groupBy(citizenSubmissions.categorySlug),
      db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(15),
      db.select().from(notifications).where(eq(notifications.recipientType, 'admin')).orderBy(desc(notifications.id)).limit(12),
      db.select({ id: publications.id, title: publications.title, categorySlug: publications.categorySlug, viewCount: publications.viewCount }).from(publications).orderBy(desc(publications.viewCount)).limit(5),
      db
        .select({
          total: sql<number>`count(*)::int`,
          active: sql<number>`count(*) filter (where ${mediaOutlets.status} = 'Active')::int`,
        })
        .from(mediaOutlets),
      db
        .select({
          active: sql<number>`count(*) filter (where ${mobilizations.status} = 'Active')::int`,
          pending: sql<number>`count(*) filter (where ${mobilizations.status} in ('Submitted','Initial Review','Verification'))::int`,
        })
        .from(mobilizations),
      db
        .select({
          pending: sql<number>`count(*) filter (where ${organizationApplications.status} not in ('Approved','Declined'))::int`,
        })
        .from(organizationApplications),
      db
        .select({
          active: sql<number>`count(*) filter (where ${collaborativeProjects.status} = 'Active Collaboration')::int`,
        })
        .from(collaborativeProjects),
    ]);

    res.json({
      kpis: {
        totalPublications: pubStats[0]?.total || 0,
        pendingEditorial: pubStats[0]?.pending || 0,
        publishedArticles: pubStats[0]?.published || 0,
        totalReads: pubStats[0]?.totalReads || 0,
        activeCampaigns: campStats[0]?.active || 0,
        registeredPartners: orgStats[0]?.active || 0,
        pendingApplications: appStats[0]?.pending || 0,
        upcomingEvents: evtStats[0]?.upcoming || 0,
        eventRegistrations: regStats[0]?.total || 0,
        totalCitizenSubmissions: isanguniTotal[0]?.total || 0,
        reportsAwaitingReview: isanguniTotal[0]?.awaitingScreening || 0,
        reportsUnderProcessing: isanguniTotal[0]?.inProgress || 0,
        reportsResolved: isanguniTotal[0]?.resolved || 0,
        registeredOutlets: outletStats[0]?.active || 0,
        activeMobilizations: mobStats[0]?.active || 0,
        pendingMobilizations: mobStats[0]?.pending || 0,
        pendingOrgApplications: orgAppStats[0]?.pending || 0,
        activeCollaborations: projStats[0]?.active || 0,
      },
      analytics: {
        isanguniByStatus: isanguniStatusCounts,
        isanguniByCategory: isanguniCatCounts,
        topPublications: topPubs,
      },
      recentAuditLogs: recentLogs,
      notifications: adminNotifications,
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({ error: 'Unable to load dashboard overview.' });
  }
});

// Admin upload helper
app.post('/api/admin/upload', requireAuth, requireRoles(ADMIN_ALLOWED_ROLES), publicUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  res.json({ url: `/uploads/public/${req.file.filename}`, fileName: req.file.originalname });
});

// Editorial Management
app.get('/api/admin/publications', requireAuth, requireRoles(['secretariat_admin', 'editor_in_chief', 'editorial_staff', 'super_admin']), async (_req, res) => {
  const rows = await db.select().from(publications).orderBy(desc(publications.id));
  res.json(rows);
});

app.post('/api/admin/publications', requireAuth, requireRoles(['secretariat_admin', 'editor_in_chief', 'editorial_staff', 'super_admin']), async (req: AuthRequest, res) => {
  try {
    const { title, subheadline, categorySlug, authorName, authorRole, featuredImageUrl, bodyMarkdown, referencesText, tags, status, scheduledFor, isFeatured } = req.body;
    if (!title || !subheadline || !categorySlug || !bodyMarkdown) {
      return res.status(400).json({ error: 'Title, subheadline, category, and body are required.' });
    }
    const canPublish = ['super_admin', 'secretariat_admin', 'editor_in_chief'].includes(req.authUser!.roleSlug);
    const requestedStatus = status || 'draft';
    const finalStatus = requestedStatus === 'published' && !canPublish ? 'review' : requestedStatus;

    const slug = `${slugify(title)}-${crypto.randomBytes(2).toString('hex')}`;
    const [created] = await db
      .insert(publications)
      .values({
        slug,
        title: String(title).trim(),
        subheadline: String(subheadline).trim(),
        categorySlug: String(categorySlug).trim(),
        authorName: String(authorName || req.authUser!.displayName).trim(),
        authorRole: String(authorRole || 'Editorial Staff').trim(),
        authorUid: req.authUser!.uid,
        featuredImageUrl: String(featuredImageUrl || '').trim(),
        bodyMarkdown: String(bodyMarkdown).trim(),
        referencesText: String(referencesText || '').trim(),
        tags: String(tags || '').trim(),
        status: finalStatus,
        publishedAt: finalStatus === 'published' ? new Date().toISOString().slice(0, 10) : null,
        scheduledFor: scheduledFor || null,
        isFeatured: Boolean(isFeatured),
      })
      .returning();

    await recordAudit(req.authUser!.uid, req.authUser!.email, req.authUser!.roleSlug, 'CREATE_PUBLICATION', 'publication', created.id, `${created.title} (${created.status})`);
    res.status(201).json(created);
  } catch (err) {
    console.error('Create publication error:', err);
    res.status(500).json({ error: 'Unable to create publication.' });
  }
});

app.patch('/api/admin/publications/:id', requireAuth, requireRoles(['secretariat_admin', 'editor_in_chief', 'editorial_staff', 'super_admin']), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { title, subheadline, categorySlug, bodyMarkdown, referencesText, tags, status, correctionNote, isFeatured } = req.body;
    const canPublish = ['super_admin', 'secretariat_admin', 'editor_in_chief'].includes(req.authUser!.roleSlug);
    if (status === 'published' && !canPublish) {
      return res.status(403).json({ error: 'Only Editor-in-Chief or Secretariat Admin can publish directly.' });
    }
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = String(title).trim();
    if (subheadline !== undefined) updates.subheadline = String(subheadline).trim();
    if (categorySlug !== undefined) updates.categorySlug = String(categorySlug).trim();
    if (bodyMarkdown !== undefined) updates.bodyMarkdown = String(bodyMarkdown).trim();
    if (referencesText !== undefined) updates.referencesText = String(referencesText).trim();
    if (tags !== undefined) updates.tags = String(tags).trim();
    if (correctionNote !== undefined) updates.correctionNote = String(correctionNote).trim();
    if (isFeatured !== undefined) updates.isFeatured = Boolean(isFeatured);
    if (status !== undefined) {
      updates.status = status;
      if (status === 'published') updates.publishedAt = new Date().toISOString().slice(0, 10);
    }

    const [updated] = await db.update(publications).set(updates).where(eq(publications.id, id)).returning();
    await recordAudit(req.authUser!.uid, req.authUser!.email, req.authUser!.roleSlug, 'UPDATE_PUBLICATION', 'publication', id, `status=${updated.status}`);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Unable to update publication.' });
  }
});

// Advocacy & Campaign Management
app.post('/api/admin/advocacy', requireAuth, requireRoles(['secretariat_admin', 'advocacy_coordinator', 'super_admin']), async (req: AuthRequest, res) => {
  try {
    const { title, summary, backgroundRationale, identifiedConcern, objectives, guidingPrinciples, interventions, citizenParticipation, heroImageUrl } = req.body;
    if (!title || !summary || !backgroundRationale || !objectives) {
      return res.status(400).json({ error: 'Title, summary, rationale, and objectives are required.' });
    }
    const [created] = await db
      .insert(advocacyAreas)
      .values({
        slug: `${slugify(title)}-${crypto.randomBytes(2).toString('hex')}`,
        title: String(title).trim(),
        summary: String(summary).trim(),
        backgroundRationale: String(backgroundRationale).trim(),
        identifiedConcern: String(identifiedConcern || summary).trim(),
        objectives: String(objectives).trim(),
        guidingPrinciples: String(guidingPrinciples || 'Nonpartisan accountability and citizen empowerment').trim(),
        interventions: String(interventions || '').trim(),
        citizenParticipation: String(citizenParticipation || '').trim(),
        heroImageUrl: String(heroImageUrl || '/src/assets/images/hero_civic_assembly_1795044498184.jpg'),
      })
      .returning();
    await recordAudit(req.authUser!.uid, req.authUser!.email, req.authUser!.roleSlug, 'CREATE_ADVOCACY', 'advocacy_area', created.id, created.title);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Unable to create advocacy area.' });
  }
});

app.post('/api/admin/campaigns', requireAuth, requireRoles(['secretariat_admin', 'advocacy_coordinator', 'super_admin']), async (req: AuthRequest, res) => {
  try {
    const { advocacyAreaId, title, summary, objectives, status, startDate, endDate, partnerOrgNames, participationSteps } = req.body;
    if (!advocacyAreaId || !title || !summary || !objectives || !startDate) {
      return res.status(400).json({ error: 'Advocacy area, title, summary, objectives, and start date are required.' });
    }
    const [created] = await db
      .insert(campaigns)
      .values({
        slug: `${slugify(title)}-${crypto.randomBytes(2).toString('hex')}`,
        advocacyAreaId: Number(advocacyAreaId),
        title: String(title).trim(),
        summary: String(summary).trim(),
        objectives: String(objectives).trim(),
        status: status || 'Active',
        startDate: String(startDate).trim(),
        endDate: String(endDate || '').trim(),
        partnerOrgNames: String(partnerOrgNames || '').trim(),
        participationSteps: String(participationSteps || 'Participate in public consultations and network workshops.').trim(),
      })
      .returning();
    await recordAudit(req.authUser!.uid, req.authUser!.email, req.authUser!.roleSlug, 'CREATE_CAMPAIGN', 'campaign', created.id, created.title);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Unable to create campaign.' });
  }
});

app.patch('/api/admin/campaigns/:id', requireAuth, requireRoles(['secretariat_admin', 'advocacy_coordinator', 'super_admin']), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    const [updated] = await db.update(campaigns).set({ status }).where(eq(campaigns.id, id)).returning();
    await recordAudit(req.authUser!.uid, req.authUser!.email, req.authUser!.roleSlug, 'UPDATE_CAMPAIGN', 'campaign', id, `status=${status}`);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Unable to update campaign.' });
  }
});

// Partnership Applications Review & Approval
app.get('/api/admin/applications', requireAuth, requireRoles(['secretariat_admin', 'partnership_coordinator', 'executive_committee', 'super_admin']), async (_req, res) => {
  const rows = await db.select().from(partnershipApplications).orderBy(desc(partnershipApplications.id));
  res.json(rows);
});

app.patch('/api/admin/applications/:id', requireAuth, requireRoles(['secretariat_admin', 'partnership_coordinator', 'super_admin']), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { status, reviewNotes } = req.body;
    const found = await db.select().from(partnershipApplications).where(eq(partnershipApplications.id, id)).limit(1);
    if (found.length === 0) return res.status(404).json({ error: 'Application not found.' });
    const appRow = found[0];

    let provisionedPartnerCreds: { email: string; temporaryPassword: string; organizationSlug: string } | null = null;

    if (status === 'Approved' && !appRow.approvedOrganizationId) {
      const orgSlug = `${slugify(appRow.organizationName)}-${crypto.randomBytes(2).toString('hex')}`;
      const [createdOrg] = await db
        .insert(organizations)
        .values({
          slug: orgSlug,
          name: appRow.organizationName,
          orgType: appRow.orgType,
          description: appRow.background,
          mission: appRow.mission,
          vision: appRow.vision,
          advocacyInterests: appRow.advocacyInterests,
          geographicCoverage: appRow.officialAddress,
          address: appRow.officialAddress,
          officialRepresentative: appRow.authorizedRep,
          officialEmail: appRow.officialEmail,
          contactNumber: appRow.contactNumber,
          website: appRow.websiteOrSocial || '',
          partnershipDate: new Date().toISOString().slice(0, 10),
          partnershipStatus: 'Active',
        })
        .returning();

      const tempPassword = `Ind${crypto.randomBytes(4).toString('hex')}!`;
      const [createdUser] = await db
        .insert(users)
        .values({
          uid: `partner-${orgSlug}`,
          email: appRow.officialEmail.toLowerCase(),
          displayName: appRow.authorizedRep,
          roleSlug: 'partner_admin',
          organizationId: createdOrg.id,
          passwordHash: hashPassword(tempPassword),
          emailVerified: true,
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: { organizationId: createdOrg.id, roleSlug: 'partner_admin' },
        })
        .returning();

      await db.insert(organizationRepresentatives).values({
        organizationId: createdOrg.id,
        userId: createdUser.id,
        fullName: appRow.authorizedRep,
        position: appRow.position,
        email: appRow.officialEmail.toLowerCase(),
        phone: appRow.contactNumber,
        partnerRole: 'Organization Administrator',
        isPrimary: true,
      });

      await db.insert(partnershipAgreements).values({
        organizationId: createdOrg.id,
        title: `Partnership Charter & Onboarding Agreement — ${createdOrg.name}`,
        agreementType: 'Partnership Charter',
        effectiveDate: new Date().toISOString().slice(0, 10),
        documentUrl: '/api/documents/download/charter-2026',
        status: 'Active',
      });

      await db
        .update(partnershipApplications)
        .set({
          status: 'Approved',
          reviewNotes: String(reviewNotes || appRow.reviewNotes || ''),
          reviewedByUid: req.authUser!.uid,
          approvedOrganizationId: createdOrg.id,
          updatedAt: new Date(),
        })
        .where(eq(partnershipApplications.id, id));

      provisionedPartnerCreds = {
        email: createdUser.email,
        temporaryPassword: tempPassword,
        organizationSlug: orgSlug,
      };
    } else {
      await db
        .update(partnershipApplications)
        .set({
          status,
          reviewNotes: String(reviewNotes || appRow.reviewNotes || ''),
          reviewedByUid: req.authUser!.uid,
          updatedAt: new Date(),
        })
        .where(eq(partnershipApplications.id, id));
    }

    await recordAudit(
      req.authUser!.uid,
      req.authUser!.email,
      req.authUser!.roleSlug,
      'REVIEW_PARTNERSHIP_APPLICATION',
      'partnership_application',
      id,
      `status=${status}`
    );

    res.json({ ok: true, status, provisionedPartnerCreds });
  } catch (err) {
    console.error('Review application error:', err);
    res.status(500).json({ error: 'Unable to update application.' });
  }
});

// Events Administration & QR Attendance
app.post('/api/admin/events', requireAuth, requireRoles(['secretariat_admin', 'events_coordinator', 'super_admin']), async (req: AuthRequest, res) => {
  try {
    const { title, description, objectives, category, format, startAt, endAt, venueOrLink, organizer, registrationDeadline, capacity, contactPerson } = req.body;
    if (!title || !description || !category || !format || !startAt || !endAt || !venueOrLink) {
      return res.status(400).json({ error: 'All core event fields are required.' });
    }
    const [created] = await db
      .insert(events)
      .values({
        slug: `${slugify(title)}-${crypto.randomBytes(2).toString('hex')}`,
        title: String(title).trim(),
        description: String(description).trim(),
        objectives: String(objectives || description).trim(),
        category: String(category).trim(),
        format: String(format).trim(),
        startAt: String(startAt).trim(),
        endAt: String(endAt).trim(),
        venueOrLink: String(venueOrLink).trim(),
        organizer: String(organizer || 'INDEPENDENTE Secretariat').trim(),
        registrationDeadline: String(registrationDeadline || startAt.slice(0, 10)),
        capacity: Number(capacity) || 150,
        contactPerson: String(contactPerson || 'events@independente.org'),
        posterUrl: '/src/assets/images/event_national_summit_1795044499688.jpg',
        status: 'Upcoming',
      })
      .returning();
    await recordAudit(req.authUser!.uid, req.authUser!.email, req.authUser!.roleSlug, 'CREATE_EVENT', 'event', created.id, created.title);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Unable to create event.' });
  }
});

app.get('/api/admin/events/:id/registrations', requireAuth, requireRoles(['secretariat_admin', 'events_coordinator', 'super_admin']), async (req, res) => {
  const rows = await db
    .select()
    .from(eventRegistrations)
    .where(eq(eventRegistrations.eventId, Number(req.params.id)))
    .orderBy(desc(eventRegistrations.id));
  res.json(rows);
});

app.post('/api/admin/events/checkin', requireAuth, requireRoles(['secretariat_admin', 'events_coordinator', 'super_admin']), async (req: AuthRequest, res) => {
  try {
    const qrToken = String(req.body.qrToken || '').trim().toUpperCase();
    const found = await db.select().from(eventRegistrations).where(eq(eventRegistrations.qrToken, qrToken)).limit(1);
    if (found.length === 0) return res.status(404).json({ error: 'QR registration token not found.' });
    const [updated] = await db
      .update(eventRegistrations)
      .set({ attended: true, attendedAt: new Date().toISOString() })
      .where(eq(eventRegistrations.id, found[0].id))
      .returning();
    await recordAudit(req.authUser!.uid, req.authUser!.email, req.authUser!.roleSlug, 'EVENT_QR_CHECKIN', 'event_registration', updated.id, qrToken);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Check-in failed.' });
  }
});

app.get('/api/admin/events/:id/export', requireAuth, requireRoles(['secretariat_admin', 'events_coordinator', 'super_admin']), async (req, res) => {
  const rows = await db.select().from(eventRegistrations).where(eq(eventRegistrations.eventId, Number(req.params.id)));
  const header = 'ID,Type,FullName,Email,Organization,DelegationSize,QRToken,Status,Attended,AttendedAt\n';
  const lines = rows
    .map((r) =>
      [r.id, r.registrationType, `"${r.fullName.replace(/"/g, '""')}"`, r.email, `"${(r.organizationName || '').replace(/"/g, '""')}"`, r.delegationSize, r.qrToken, r.status, r.attended, r.attendedAt || ''].join(',')
    )
    .join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="event-${req.params.id}-attendance.csv"`);
  res.send(header + lines);
});

// ==================== RESTRICTED CITIZEN ISANGUNI CASE MANAGEMENT ====================
// Strictly isolated: ONLY super_admin and citizen_affairs_officer!
app.get('/api/admin/isanguni', requireAuth, requireRoles(['super_admin', 'citizen_affairs_officer']), async (_req, res) => {
  const rows = await db.select().from(citizenSubmissions).orderBy(desc(citizenSubmissions.id));
  res.json(
    rows.map((r) => ({
      id: r.id,
      referenceNumber: r.referenceNumber,
      subject: r.subject,
      categorySlug: r.categorySlug,
      location: r.location,
      incidentDate: r.incidentDate,
      privacyMode: r.privacyMode,
      status: r.status,
      priority: r.priority,
      assignedOfficerName: r.assignedOfficerName,
      consentForReferral: r.consentForReferral,
      isDemonstration: r.isDemonstration,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
  );
});

app.get('/api/admin/isanguni/:id', requireAuth, requireRoles(['super_admin', 'citizen_affairs_officer']), async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const found = await db.select().from(citizenSubmissions).where(eq(citizenSubmissions.id, id)).limit(1);
  if (found.length === 0) return res.status(404).json({ error: 'Case not found.' });
  const c = found[0];
  const [updates, attachments, caseReferrals] = await Promise.all([
    db.select().from(citizenCaseUpdates).where(eq(citizenCaseUpdates.submissionId, id)).orderBy(citizenCaseUpdates.createdAt),
    db.select().from(citizenAttachments).where(eq(citizenAttachments.submissionId, id)),
    db.select().from(referrals).where(eq(referrals.submissionId, id)).orderBy(desc(referrals.id)),
  ]);
  await recordAudit(req.authUser!.uid, req.authUser!.email, req.authUser!.roleSlug, 'VIEW_ISANGUNI_CASE', 'citizen_submission', c.referenceNumber);
  res.json({ submission: c, updates, attachments, referrals: caseReferrals });
});

app.patch('/api/admin/isanguni/:id', requireAuth, requireRoles(['super_admin', 'citizen_affairs_officer']), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { status, priority, assignedOfficerName, statusNote } = req.body;
    const found = await db.select().from(citizenSubmissions).where(eq(citizenSubmissions.id, id)).limit(1);
    if (found.length === 0) return res.status(404).json({ error: 'Case not found.' });
    const prev = found[0];

    const [updated] = await db
      .update(citizenSubmissions)
      .set({
        status: status || prev.status,
        priority: priority || prev.priority,
        assignedOfficerName: assignedOfficerName !== undefined ? String(assignedOfficerName) : prev.assignedOfficerName,
        assignedOfficerUid: req.authUser!.uid,
        updatedAt: new Date(),
      })
      .where(eq(citizenSubmissions.id, id))
      .returning();

    if (status && status !== prev.status) {
      await db.insert(citizenCaseUpdates).values({
        submissionId: id,
        authorRole: 'officer',
        authorName: req.authUser!.displayName || 'Citizen Affairs Officer',
        updateType: 'status_change',
        message: statusNote || `Case status updated from ${prev.status} to ${status}.`,
        previousStatus: prev.status,
        newStatus: status,
        isPublicToReporter: true,
      });
    }

    await recordAudit(req.authUser!.uid, req.authUser!.email, req.authUser!.roleSlug, 'UPDATE_ISANGUNI_CASE', 'citizen_submission', prev.referenceNumber, `status=${updated.status}`);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Unable to update case.' });
  }
});

app.post('/api/admin/isanguni/:id/updates', requireAuth, requireRoles(['super_admin', 'citizen_affairs_officer']), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { updateType, message, isPublicToReporter } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required.' });
    const [created] = await db
      .insert(citizenCaseUpdates)
      .values({
        submissionId: id,
        authorRole: 'officer',
        authorName: req.authUser!.displayName || 'Citizen Affairs Officer',
        updateType: updateType || 'internal_note',
        message: String(message).trim(),
        isPublicToReporter: Boolean(isPublicToReporter),
      })
      .returning();
    await db.update(citizenSubmissions).set({ updatedAt: new Date() }).where(eq(citizenSubmissions.id, id));
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Unable to add case note.' });
  }
});

app.post('/api/admin/isanguni/:id/referrals', requireAuth, requireRoles(['super_admin', 'citizen_affairs_officer']), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { targetInstitutionName, referralReason, consentConfirmed } = req.body;
    if (!targetInstitutionName || !referralReason) {
      return res.status(400).json({ error: 'Target institution and referral rationale are required.' });
    }
    const found = await db.select().from(citizenSubmissions).where(eq(citizenSubmissions.id, id)).limit(1);
    if (found.length === 0) return res.status(404).json({ error: 'Case not found.' });
    const sub = found[0];

    if (sub.privacyMode !== 'anonymous' && !consentConfirmed && !sub.consentForReferral) {
      return res.status(400).json({
        error: 'Informed reporter consent must be confirmed before transmitting identifiable details for referral.',
      });
    }

    const [created] = await db
      .insert(referrals)
      .values({
        submissionId: id,
        targetInstitutionName: String(targetInstitutionName).trim(),
        referralReason: String(referralReason).trim(),
        consentConfirmed: Boolean(consentConfirmed || sub.consentForReferral || sub.privacyMode === 'anonymous'),
        status: 'Recommended',
        createdByUid: req.authUser!.uid,
      })
      .returning();

    // Note: Do NOT automatically mark as RESOLVED when referred! Move to FOR REFERRAL only.
    await db
      .update(citizenSubmissions)
      .set({ status: 'FOR REFERRAL', updatedAt: new Date() })
      .where(eq(citizenSubmissions.id, id));

    await db.insert(citizenCaseUpdates).values({
      submissionId: id,
      authorRole: 'officer',
      authorName: req.authUser!.displayName || 'Citizen Affairs Officer',
      updateType: 'referral_notice',
      message: `Prepared referral coordination with ${created.targetInstitutionName}. Case remains open pending institutional acknowledgment and outcome.`,
      previousStatus: sub.status,
      newStatus: 'FOR REFERRAL',
      isPublicToReporter: true,
    });

    await recordAudit(req.authUser!.uid, req.authUser!.email, req.authUser!.roleSlug, 'CREATE_REFERRAL', 'citizen_submission', sub.referenceNumber, created.targetInstitutionName);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Unable to record referral.' });
  }
});

// ==================== ADMIN: USERS, ROLES, ANNOUNCEMENTS, INQUIRIES, REPORTS ====================
app.get('/api/admin/users', requireAuth, requireRoles(['super_admin', 'secretariat_admin']), async (_req, res) => {
  const [userList, roleList, orgList] = await Promise.all([
    db
      .select({
        id: users.id,
        uid: users.uid,
        email: users.email,
        displayName: users.displayName,
        roleSlug: users.roleSlug,
        organizationId: users.organizationId,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.id)),
    db.select().from(roles),
    db.select({ id: organizations.id, name: organizations.name }).from(organizations),
  ]);
  res.json({ users: userList, roles: roleList, organizations: orgList });
});

app.patch('/api/admin/users/:id', requireAuth, requireRoles(['super_admin']), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { roleSlug, organizationId, isActive } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (roleSlug !== undefined) updates.roleSlug = roleSlug;
    if (organizationId !== undefined) updates.organizationId = organizationId ? Number(organizationId) : null;
    if (typeof isActive === 'boolean') updates.isActive = isActive;

    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    await recordAudit(req.authUser!.uid, req.authUser!.email, req.authUser!.roleSlug, 'UPDATE_USER_ROLE', 'user', id, `role=${updated.roleSlug}`);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Unable to update user role.' });
  }
});

app.post('/api/admin/announcements', requireAuth, requireRoles(['super_admin', 'secretariat_admin']), async (req: AuthRequest, res) => {
  const { title, body, audience, category, isPinned } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'Title and body are required.' });
  const [created] = await db
    .insert(announcements)
    .values({
      title: String(title).trim(),
      body: String(body).trim(),
      audience: audience === 'partners' ? 'partners' : 'public',
      category: String(category || 'Official Notice'),
      isPinned: Boolean(isPinned),
      publishedAt: new Date().toISOString().slice(0, 10),
      authorName: req.authUser!.displayName || 'INDEPENDENTE Secretariat',
    })
    .returning();
  await recordAudit(req.authUser!.uid, req.authUser!.email, req.authUser!.roleSlug, 'CREATE_ANNOUNCEMENT', 'announcement', created.id, created.title);
  res.status(201).json(created);
});

app.get('/api/admin/inquiries', requireAuth, requireRoles(['super_admin', 'secretariat_admin', 'partnership_coordinator']), async (_req, res) => {
  const rows = await db.select().from(partnerInquiries).orderBy(desc(partnerInquiries.id));
  res.json(rows);
});

app.patch('/api/admin/inquiries/:id', requireAuth, requireRoles(['super_admin', 'secretariat_admin', 'partnership_coordinator']), async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const { secretariatReply, status } = req.body;
  const [updated] = await db
    .update(partnerInquiries)
    .set({
      secretariatReply: String(secretariatReply || '').trim(),
      status: status || 'Responded',
      repliedByUid: req.authUser!.uid,
      updatedAt: new Date(),
    })
    .where(eq(partnerInquiries.id, id))
    .returning();
  res.json(updated);
});

// Anonymized & Aggregated Impact Report Export
app.get('/api/admin/reports/impact', requireAuth, requireRoles(ADMIN_ALLOWED_ROLES), async (req, res) => {
  const period = String(req.query.period || 'quarterly');
  const [pubAgg, orgAgg, evtAgg, isanguniAgg] = await Promise.all([
    db.select({ category: publications.categorySlug, count: sql<number>`count(*)::int`, views: sql<number>`coalesce(sum(${publications.viewCount}),0)::int` }).from(publications).where(eq(publications.status, 'published')).groupBy(publications.categorySlug),
    db.select({ region: organizations.geographicCoverage, count: sql<number>`count(*)::int` }).from(organizations).where(eq(organizations.partnershipStatus, 'Active')).groupBy(organizations.geographicCoverage),
    db.select({ status: events.status, count: sql<number>`count(*)::int` }).from(events).groupBy(events.status),
    db.select({ category: citizenSubmissions.categorySlug, status: citizenSubmissions.status, count: sql<number>`count(*)::int` }).from(citizenSubmissions).groupBy(citizenSubmissions.categorySlug, citizenSubmissions.status),
  ]);

  const lines = [
    `INDEPENDENTE — ANONYMIZED ${period.toUpperCase()} IMPACT REPORT`,
    `Generated At,${new Date().toISOString()}`,
    '',
    'SECTION,METRIC,COUNT,NOTES',
    ...pubAgg.map((p) => `Publications,${p.category},${p.count},Total views: ${p.views}`),
    ...orgAgg.map((o) => `Partner Coverage,"${o.region.replace(/"/g, '""')}",${o.count},Active organizations`),
    ...evtAgg.map((e) => `Events,${e.status},${e.count},Network activities`),
    ...isanguniAgg.map((c) => `Citizen Isanguni (Aggregated/Anonymized),${c.category} (${c.status}),${c.count},Personal data excluded per RA 10173`),
  ];

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="independente-${period}-impact-report.csv"`);
  res.send(lines.join('\n'));
});

app.get('/api/admin/settings', requireAuth, requireRoles(['super_admin', 'secretariat_admin']), async (_req, res) => {
  const rows = await db.select().from(systemSettings).orderBy(systemSettings.id);
  res.json(rows);
});

app.patch('/api/admin/settings', requireAuth, requireRoles(['super_admin']), async (req: AuthRequest, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'Setting key and value are required.' });
  const [updated] = await db
    .update(systemSettings)
    .set({ value: String(value), updatedAt: new Date() })
    .where(eq(systemSettings.key, String(key)))
    .returning();
  await recordAudit(req.authUser!.uid, req.authUser!.email, req.authUser!.roleSlug, 'UPDATE_SETTING', 'system_setting', key);
  res.json(updated);
});

// ==================== PART II: OPERATIONS CENTER (OP-01..OP-06) ====================
app.get('/api/operations/overview', optionalAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeedData();
    const [
      outletRows,
      pubAgg,
      areaCount,
      campRows,
      mobRows,
      orgRows,
      orgAppCount,
      partnerAppCount,
      evtRows,
      collabRows,
      isanguniCounts,
      recentLogs,
    ] = await Promise.all([
      db.select().from(mediaOutlets).orderBy(mediaOutlets.id),
      db.select({
        published: sql<number>`count(*) filter (where ${publications.status} = 'published')::int`,
        inReview: sql<number>`count(*) filter (where ${publications.status} in ('draft','review'))::int`,
        totalViews: sql<number>`coalesce(sum(${publications.viewCount}),0)::int`,
      }).from(publications),
      db.select({ count: sql<number>`count(*)::int` }).from(advocacyAreas).where(eq(advocacyAreas.isActive, true)),
      db.select().from(campaigns),
      db.select().from(mobilizations),
      db.select({
        id: organizations.id,
        name: organizations.name,
        affiliationStatus: organizations.affiliationStatus,
        partnershipStatus: organizations.partnershipStatus,
      }).from(organizations),
      db.select({ pending: sql<number>`count(*) filter (where ${organizationApplications.status} not in ('Approved','Declined'))::int` }).from(organizationApplications),
      db.select({ pending: sql<number>`count(*) filter (where ${partnershipApplications.status} not in ('Approved','Rejected'))::int` }).from(partnershipApplications),
      db.select().from(events),
      db.select().from(collaborativeProjects),
      db.select({
        total: sql<number>`count(*)::int`,
        awaiting: sql<number>`count(*) filter (where ${citizenSubmissions.status} in ('RECEIVED','INITIAL SCREENING'))::int`,
        resolved: sql<number>`count(*) filter (where ${citizenSubmissions.status} in ('RESOLVED / ADDRESSED','CLOSED'))::int`,
      }).from(citizenSubmissions),
      db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(10),
    ]);

    const isCitizenOfficer =
      req.authUser && ['super_admin', 'citizen_affairs_officer'].includes(req.authUser.roleSlug);
    const isStaff = req.authUser && ADMIN_ALLOWED_ROLES.includes(req.authUser.roleSlug);

    const divisions = [
      {
        code: 'OP-01',
        name: 'Media Operations',
        leadRole: 'Editor-in-Chief & Publication Administrators',
        mandate: 'Multi-publication registration, independent editorial newsrooms, fact-checking, and cross-outlet co-publishing.',
        metrics: [
          { label: 'Active Publications', value: outletRows.filter((o) => o.status === 'Active').length },
          { label: 'Published Stories', value: pubAgg[0]?.published || 0 },
          { label: 'In Editorial Queue', value: pubAgg[0]?.inReview || 0 },
          { label: 'Total Readership', value: pubAgg[0]?.totalViews || 0 },
        ],
        targetPage: 'media',
        highlights: outletRows.map((o) => `${o.name} (${o.abbreviation}) — ${o.category}`),
      },
      {
        code: 'OP-02',
        name: 'Advocacy Operations',
        leadRole: 'Advocacy Coordinator & Mobilization Organizers',
        mandate: 'Advocacy areas, public campaigns, Start a Mobilization vetting, and grassroots civic participation.',
        metrics: [
          { label: 'Advocacy Focus Areas', value: areaCount[0]?.count || 0 },
          { label: 'Active Campaigns', value: campRows.filter((c) => c.status === 'Active').length },
          { label: 'Active Mobilizations', value: mobRows.filter((m) => m.status === 'Active').length },
          { label: 'Pending Proposals', value: mobRows.filter((m) => ['Submitted', 'Initial Review', 'Verification'].includes(m.status)).length },
        ],
        targetPage: 'advocacy',
        highlights: mobRows.filter((m) => m.status === 'Active').map((m) => `${m.title} (${m.supportType})`),
      },
      {
        code: 'OP-03',
        name: 'Organizing Operations',
        leadRole: 'Secretariat & Organization Administrators',
        mandate: 'Establish an Organization review, membership directory, isolated organization workspaces, and internal leadership roles.',
        metrics: [
          { label: 'Total Organizations', value: orgRows.length },
          { label: 'Independent Orgs', value: orgRows.filter((o) => o.affiliationStatus === 'Independent Organization').length },
          { label: 'Affiliated Orgs', value: orgRows.filter((o) => o.affiliationStatus === 'Affiliated Organization').length },
          { label: 'Pending Establishment Apps', value: orgAppCount[0]?.pending || 0 },
        ],
        targetPage: 'network',
        highlights: orgRows.map((o) => `${o.name} — ${o.affiliationStatus}`),
      },
      {
        code: 'OP-04',
        name: 'Partnership Operations',
        leadRole: 'Partnership Coordinator & Secretariat',
        mandate: 'Official partner accreditation, MOU governance, inter-entity collaboration requests, and shared project workspaces.',
        metrics: [
          { label: 'Official Partners', value: orgRows.filter((o) => o.affiliationStatus === 'Official Partner Organization').length },
          { label: 'Pending Partner Apps', value: partnerAppCount[0]?.pending || 0 },
          { label: 'Active Joint Projects', value: collabRows.filter((c) => c.status === 'Active Collaboration').length },
          { label: 'Central Units', value: orgRows.filter((o) => o.affiliationStatus === 'Central Network Unit').length },
        ],
        targetPage: 'network',
        highlights: collabRows.map((c) => `${c.title} (${c.status})`),
      },
      {
        code: 'OP-05',
        name: 'Events Operations',
        leadRole: 'Events Coordinator & Host Chapters',
        mandate: 'Public conferences, forums, consultations, collaborative project events, and QR-verified attendance tracking.',
        metrics: [
          { label: 'Upcoming Events', value: evtRows.filter((e) => e.status === 'Upcoming').length },
          { label: 'Completed Activities', value: evtRows.filter((e) => e.status === 'Past').length },
          { label: 'Total Scheduled', value: evtRows.length },
          { label: 'Project-Linked Events', value: evtRows.filter((e) => e.projectId || e.mobilizationId).length },
        ],
        targetPage: 'events',
        highlights: evtRows.slice(0, 4).map((e) => `${e.title} (${e.startAt})`),
      },
      {
        code: 'OP-06',
        name: 'Citizen Affairs',
        leadRole: 'Citizen Affairs Officer (RA 10173 Isolated)',
        mandate: 'Confidential Citizen Isanguni intake, due-process screening, informed-consent referrals, and anonymized trend reporting.',
        metrics: [
          { label: 'Total Submissions (Count)', value: isanguniCounts[0]?.total || 0 },
          { label: 'Awaiting Screening', value: isanguniCounts[0]?.awaiting || 0 },
          { label: 'Resolved / Closed', value: isanguniCounts[0]?.resolved || 0 },
          { label: 'Access Mode', value: isCitizenOfficer ? 1 : 0 },
        ],
        targetPage: 'isanguni',
        highlights: [
          'Case identities and attachments strictly isolated to designated Citizen Affairs Officers under RA 10173.',
          isCitizenOfficer
            ? 'Your account holds Citizen Affairs clearance via Secretariat Admin Desk.'
            : 'Public view displays aggregate counts only; confidential case records are restricted.',
        ],
      },
    ];

    res.json({
      divisions,
      recentAuditSummary: isStaff
        ? recentLogs.map((l) => ({
            id: l.id,
            action: l.action,
            entityType: l.entityType,
            actorRole: l.actorRole,
            createdAt: l.createdAt,
          }))
        : [],
    });
  } catch (err) {
    console.error('Operations overview error:', err);
    res.status(500).json({ error: 'Unable to load Operations Center overview.' });
  }
});

// ==================== PART III: MULTI-PUBLICATION MEDIA OPERATIONS ====================
async function userHasOutletAccess(authUser: AuthRequest['authUser'], outletId: number): Promise<{ allowed: boolean; editorialRole: string }> {
  if (!authUser) return { allowed: false, editorialRole: '' };
  if (['super_admin', 'secretariat_admin', 'editor_in_chief'].includes(authUser.roleSlug)) {
    return { allowed: true, editorialRole: 'Network Editorial Overseer' };
  }
  const outlet = await db.select().from(mediaOutlets).where(eq(mediaOutlets.id, outletId)).limit(1);
  if (outlet.length > 0 && (outlet[0].adminUid === authUser.uid || (outlet[0].adminEmail || '').toLowerCase() === authUser.email.toLowerCase())) {
    return { allowed: true, editorialRole: 'Publication Administrator' };
  }
  const membership = await db
    .select()
    .from(mediaOutletMembers)
    .where(
      and(
        eq(mediaOutletMembers.outletId, outletId),
        eq(mediaOutletMembers.isActive, true),
        or(eq(mediaOutletMembers.uid, authUser.uid), eq(mediaOutletMembers.email, authUser.email.toLowerCase()))!
      )
    )
    .limit(1);
  if (membership.length > 0) {
    return { allowed: true, editorialRole: membership[0].editorialRole };
  }
  return { allowed: false, editorialRole: '' };
}

app.get('/api/media/outlets', async (_req, res) => {
  try {
    await ensureSeedData();
    const [outletsList, pubCounts, memberCounts] = await Promise.all([
      db.select().from(mediaOutlets).orderBy(mediaOutlets.id),
      db
        .select({
          outletId: publications.outletId,
          publishedCount: sql<number>`count(*) filter (where ${publications.status} = 'published')::int`,
          totalReads: sql<number>`coalesce(sum(${publications.viewCount}), 0)::int`,
        })
        .from(publications)
        .groupBy(publications.outletId),
      db
        .select({
          outletId: mediaOutletMembers.outletId,
          teamCount: sql<number>`count(*)::int`,
        })
        .from(mediaOutletMembers)
        .where(eq(mediaOutletMembers.isActive, true))
        .groupBy(mediaOutletMembers.outletId),
    ]);

    const pubMap = new Map(pubCounts.map((p) => [p.outletId, p]));
    const memMap = new Map(memberCounts.map((m) => [m.outletId, m.teamCount]));

    res.json(
      outletsList.map((o) => ({
        ...o,
        publishedCount: pubMap.get(o.id)?.publishedCount || 0,
        totalReads: pubMap.get(o.id)?.totalReads || 0,
        teamCount: memMap.get(o.id) || 0,
      }))
    );
  } catch (err) {
    console.error('List outlets error:', err);
    res.status(500).json({ error: 'Unable to list registered publications.' });
  }
});

app.get('/api/media/outlets/:slug', async (req, res) => {
  try {
    await ensureSeedData();
    const found = await db.select().from(mediaOutlets).where(eq(mediaOutlets.slug, req.params.slug)).limit(1);
    if (found.length === 0) return res.status(404).json({ error: 'Publication not found.' });
    const outlet = found[0];
    const [articles, team, collabs] = await Promise.all([
      db
        .select()
        .from(publications)
        .where(and(eq(publications.status, 'published'), or(eq(publications.outletId, outlet.id), eq(publications.coOutletId, outlet.id))))
        .orderBy(desc(publications.publishedAt), desc(publications.id)),
      db
        .select({
          id: mediaOutletMembers.id,
          displayName: mediaOutletMembers.displayName,
          editorialRole: mediaOutletMembers.editorialRole,
        })
        .from(mediaOutletMembers)
        .where(and(eq(mediaOutletMembers.outletId, outlet.id), eq(mediaOutletMembers.isActive, true))),
      db
        .select()
        .from(editorialCollaborations)
        .where(or(eq(editorialCollaborations.leadOutletId, outlet.id), eq(editorialCollaborations.partnerOutletId, outlet.id))),
    ]);

    res.json({ outlet, articles, editorialTeam: team, collaborations: collabs });
  } catch (err) {
    console.error('Outlet profile error:', err);
    res.status(500).json({ error: 'Unable to load publication profile.' });
  }
});

app.post('/api/media/outlets', requireAuth, requireRoles(['super_admin', 'secretariat_admin', 'editor_in_chief']), async (req: AuthRequest, res) => {
  try {
    const {
      name,
      abbreviation,
      logoUrl,
      coverImageUrl,
      description,
      editorialMission,
      category,
      primaryAudience,
      editorialContact,
      socialLinks,
      adminEmail,
      assignedTeamText,
      status,
    } = req.body;

    if (!name || !abbreviation || !description || !editorialMission || !category || !primaryAudience || !editorialContact) {
      return res.status(400).json({ error: 'All required publication registration fields must be completed.' });
    }

    const slug = `${slugify(name)}-${crypto.randomBytes(2).toString('hex')}`;
    const [created] = await db
      .insert(mediaOutlets)
      .values({
        slug,
        name: String(name).trim(),
        abbreviation: String(abbreviation).trim().toUpperCase(),
        logoUrl: String(logoUrl || '/assets/aistudio/Kampus_Independente_logo__1__80e86dcb.jpg').trim(),
        coverImageUrl: String(coverImageUrl || '/assets/aistudio/Kampus_Independente_logo_856d9f00.png').trim(),
        description: String(description).trim(),
        editorialMission: String(editorialMission).trim(),
        category: String(category).trim(),
        primaryAudience: String(primaryAudience).trim(),
        editorialContact: String(editorialContact).trim(),
        socialLinks: String(socialLinks || '').trim(),
        adminUid: req.authUser!.uid,
        adminEmail: String(adminEmail || req.authUser!.email).trim().toLowerCase(),
        status: status || 'Active',
      })
      .returning();

    await db.insert(mediaOutletMembers).values({
      outletId: created.id,
      userId: req.authUser!.id,
      uid: req.authUser!.uid,
      email: String(adminEmail || req.authUser!.email).trim().toLowerCase(),
      displayName: req.authUser!.displayName || 'Publication Administrator',
      editorialRole: 'Publication Administrator',
      isActive: true,
    });

    if (assignedTeamText) {
      const emails = String(assignedTeamText).split(',').map((s) => s.trim()).filter(Boolean);
      for (const em of emails) {
        await db.insert(mediaOutletMembers).values({
          outletId: created.id,
          email: em.toLowerCase(),
          displayName: em.split('@')[0],
          editorialRole: 'Staff Writer',
          isActive: true,
        });
      }
    }

    await recordAudit(req.authUser!.uid, req.authUser!.email, req.authUser!.roleSlug, 'CREATE_MEDIA_OUTLET', 'media_outlet', created.id, created.name);
    res.status(201).json(created);
  } catch (err) {
    console.error('Create media outlet error:', err);
    res.status(500).json({ error: 'Unable to create publication.' });
  }
});

app.get('/api/media/outlets/:id/editorial', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    const outletId = Number(req.params.id);
    const access = await userHasOutletAccess(req.authUser, outletId);
    if (!access.allowed) {
      return res.status(403).json({ error: 'Access denied: you are not assigned to this publication editorial workspace.' });
    }
    const [outletRows, articles, members, collabs] = await Promise.all([
      db.select().from(mediaOutlets).where(eq(mediaOutlets.id, outletId)).limit(1),
      db
        .select()
        .from(publications)
        .where(or(eq(publications.outletId, outletId), eq(publications.coOutletId, outletId)))
        .orderBy(desc(publications.id)),
      db.select().from(mediaOutletMembers).where(eq(mediaOutletMembers.outletId, outletId)),
      db
        .select()
        .from(editorialCollaborations)
        .where(or(eq(editorialCollaborations.leadOutletId, outletId), eq(editorialCollaborations.partnerOutletId, outletId)))
        .orderBy(desc(editorialCollaborations.id)),
    ]);

    if (outletRows.length === 0) return res.status(404).json({ error: 'Publication not found.' });
    res.json({
      outlet: outletRows[0],
      yourRole: access.editorialRole,
      articles,
      members,
      collaborations: collabs,
    });
  } catch (err) {
    console.error('Outlet editorial workspace error:', err);
    res.status(500).json({ error: 'Unable to load publication editorial workspace.' });
  }
});

app.post('/api/media/outlets/:id/articles', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    const outletId = Number(req.params.id);
    const access = await userHasOutletAccess(req.authUser, outletId);
    if (!access.allowed) {
      return res.status(403).json({ error: 'Access denied to this publication editorial desk.' });
    }
    const { title, subheadline, categorySlug, bodyMarkdown, referencesText, tags, status, coOutletId } = req.body;
    if (!title || !subheadline || !categorySlug || !bodyMarkdown) {
      return res.status(400).json({ error: 'Title, subheadline, category, and body are required.' });
    }
    const canPublish =
      ['super_admin', 'secretariat_admin', 'editor_in_chief'].includes(req.authUser!.roleSlug) ||
      ['Publication Administrator', 'Editor-in-Chief', 'Managing Editor'].includes(access.editorialRole);

    const reqStatus = status || 'draft';
    const finalStatus = reqStatus === 'published' && !canPublish ? 'review' : reqStatus;

    const [created] = await db
      .insert(publications)
      .values({
        slug: `${slugify(title)}-${crypto.randomBytes(2).toString('hex')}`,
        title: String(title).trim(),
        subheadline: String(subheadline).trim(),
        categorySlug: String(categorySlug).trim(),
        authorName: req.authUser!.displayName || req.authUser!.email,
        authorRole: access.editorialRole || 'Editorial Staff',
        authorUid: req.authUser!.uid,
        bodyMarkdown: String(bodyMarkdown).trim(),
        referencesText: String(referencesText || '').trim(),
        tags: String(tags || '').trim(),
        status: finalStatus,
        publishedAt: finalStatus === 'published' ? new Date().toISOString().slice(0, 10) : null,
        outletId,
        coOutletId: coOutletId ? Number(coOutletId) : null,
      })
      .returning();

    await recordAudit(req.authUser!.uid, req.authUser!.email, req.authUser!.roleSlug, 'OUTLET_CREATE_ARTICLE', 'publication', created.id, `outlet=${outletId}`);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Unable to save outlet manuscript.' });
  }
});

app.post('/api/media/outlets/:id/members', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    const outletId = Number(req.params.id);
    const access = await userHasOutletAccess(req.authUser, outletId);
    if (
      !access.allowed ||
      (!['Network Editorial Overseer', 'Publication Administrator', 'Editor-in-Chief'].includes(access.editorialRole) &&
        !['super_admin', 'secretariat_admin'].includes(req.authUser!.roleSlug))
    ) {
      return res.status(403).json({ error: 'Only Publication Administrators or Editors-in-Chief may manage editorial staff.' });
    }
    const { email, displayName, editorialRole } = req.body;
    if (!email || !displayName) return res.status(400).json({ error: 'Member name and email are required.' });
    const [created] = await db
      .insert(mediaOutletMembers)
      .values({
        outletId,
        email: String(email).trim().toLowerCase(),
        displayName: String(displayName).trim(),
        editorialRole: String(editorialRole || 'Staff Writer'),
        isActive: true,
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Unable to add editorial team member.' });
  }
});

app.post('/api/media/outlets/:id/collaborations', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    const leadOutletId = Number(req.params.id);
    const access = await userHasOutletAccess(req.authUser, leadOutletId);
    if (!access.allowed) return res.status(403).json({ error: 'Access denied to lead outlet.' });
    const { publicationId, partnerOutletId, collaborationNote } = req.body;
    if (!publicationId || !partnerOutletId) {
      return res.status(400).json({ error: 'Publication and partner outlet are required.' });
    }
    const [created] = await db
      .insert(editorialCollaborations)
      .values({
        publicationId: Number(publicationId),
        leadOutletId,
        partnerOutletId: Number(partnerOutletId),
        proposedByUid: req.authUser!.uid,
        collaborationNote: String(collaborationNote || '').trim(),
        status: 'Proposed',
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Unable to propose editorial collaboration.' });
  }
});

app.patch('/api/media/collaborations/:collabId', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    const collabId = Number(req.params.collabId);
    const { status } = req.body;
    const found = await db.select().from(editorialCollaborations).where(eq(editorialCollaborations.id, collabId)).limit(1);
    if (found.length === 0) return res.status(404).json({ error: 'Collaboration not found.' });
    const c = found[0];
    const partnerAccess = await userHasOutletAccess(req.authUser, c.partnerOutletId);
    if (!partnerAccess.allowed) return res.status(403).json({ error: 'Only receiving publication editors can respond.' });

    const [updated] = await db
      .update(editorialCollaborations)
      .set({ status: String(status) })
      .where(eq(editorialCollaborations.id, collabId))
      .returning();

    if (status === 'Accepted' || status === 'Published') {
      await db.update(publications).set({ coOutletId: c.partnerOutletId }).where(eq(publications.id, c.publicationId));
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Unable to update collaboration.' });
  }
});

// ==================== PART IV: EXPANDED ADVOCACY & MOBILIZATION OPERATIONS ====================
async function userHasMobilizationAccess(authUser: AuthRequest['authUser'], mobId: number): Promise<boolean> {
  if (!authUser) return false;
  if (['super_admin', 'secretariat_admin', 'advocacy_coordinator'].includes(authUser.roleSlug)) return true;
  const mobs = await db.select().from(mobilizations).where(eq(mobilizations.id, mobId)).limit(1);
  if (mobs.length > 0 && (mobs[0].proposedByUid === authUser.uid || mobs[0].proposedByEmail.toLowerCase() === authUser.email.toLowerCase())) {
    return true;
  }
  const member = await db
    .select()
    .from(mobilizationMembers)
    .where(
      and(
        eq(mobilizationMembers.mobilizationId, mobId),
        eq(mobilizationMembers.status, 'Approved'),
        inArray(mobilizationMembers.role, ['Organizer', 'Coordinator']),
        or(eq(mobilizationMembers.uid, authUser.uid), eq(mobilizationMembers.email, authUser.email.toLowerCase()))!
      )
    )
    .limit(1);
  return member.length > 0;
}

app.get('/api/mobilizations', async (req, res) => {
  try {
    await ensureSeedData();
    const areaId = Number(req.query.areaId || 0);
    const participationType = String(req.query.type || '').trim();
    const supportType = String(req.query.supportType || '').trim();
    const q = String(req.query.q || '').trim();

    const conditions = [inArray(mobilizations.status, ['Approved', 'Active', 'Completed'])];
    if (areaId > 0) conditions.push(eq(mobilizations.advocacyAreaId, areaId));
    if (participationType && participationType !== 'all') conditions.push(eq(mobilizations.participationType, participationType));
    if (supportType && supportType !== 'all') conditions.push(eq(mobilizations.supportType, supportType));
    if (q) {
      conditions.push(or(ilike(mobilizations.title, `%${q}%`), ilike(mobilizations.geographicScope, `%${q}%`), ilike(mobilizations.description, `%${q}%`))!);
    }

    const [rows, memberCounts] = await Promise.all([
      db.select().from(mobilizations).where(and(...conditions)).orderBy(desc(mobilizations.id)),
      db
        .select({
          mobilizationId: mobilizationMembers.mobilizationId,
          participantCount: sql<number>`count(*) filter (where ${mobilizationMembers.status} = 'Approved')::int`,
        })
        .from(mobilizationMembers)
        .groupBy(mobilizationMembers.mobilizationId),
    ]);

    const countMap = new Map(memberCounts.map((m) => [m.mobilizationId, m.participantCount]));
    res.json(
      rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        advocacyAreaId: r.advocacyAreaId,
        description: r.description,
        objectives: r.objectives,
        targetAudience: r.targetAudience,
        geographicScope: r.geographicScope,
        startDate: r.startDate,
        endDate: r.endDate,
        participationType: r.participationType,
        supportType: r.supportType,
        proposedByName: r.proposedByName,
        organizationId: r.organizationId,
        status: r.status,
        heroImageUrl: r.heroImageUrl,
        isDemonstration: r.isDemonstration,
        participantCount: countMap.get(r.id) || 0,
      }))
    );
  } catch (err) {
    console.error('Mobilizations list error:', err);
    res.status(500).json({ error: 'Unable to fetch mobilizations.' });
  }
});

app.get('/api/mobilizations/:slug', async (req, res) => {
  try {
    await ensureSeedData();
    const found = await db.select().from(mobilizations).where(eq(mobilizations.slug, req.params.slug)).limit(1);
    if (found.length === 0) return res.status(404).json({ error: 'Mobilization not found.' });
    const mob = found[0];
    const [publicUpdates, countRes, linkedEvents] = await Promise.all([
      db
        .select()
        .from(mobilizationUpdates)
        .where(and(eq(mobilizationUpdates.mobilizationId, mob.id), eq(mobilizationUpdates.isPublic, true)))
        .orderBy(desc(mobilizationUpdates.id)),
      db
        .select({ count: sql<number>`count(*) filter (where ${mobilizationMembers.status} = 'Approved')::int` })
        .from(mobilizationMembers)
        .where(eq(mobilizationMembers.mobilizationId, mob.id)),
      db.select().from(events).where(eq(events.mobilizationId, mob.id)),
    ]);

    res.json({
      mobilization: {
        ...mob,
        proposedByEmail: undefined,
      },
      participantCount: countRes[0]?.count || 0,
      updates: publicUpdates,
      events: linkedEvents,
    });
  } catch (err) {
    res.status(500).json({ error: 'Unable to load mobilization details.' });
  }
});

app.post('/api/mobilizations', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    const {
      title,
      advocacyAreaId,
      description,
      objectives,
      targetAudience,
      geographicScope,
      startDate,
      endDate,
      participationType,
      supportType,
      status,
    } = req.body;

    if (!title || !description || !objectives || !targetAudience || !geographicScope || !startDate || !participationType) {
      return res.status(400).json({ error: 'Please complete all required mobilization proposal fields.' });
    }

    const initialStatus = status === 'Draft' ? 'Draft' : 'Submitted';
    const [created] = await db
      .insert(mobilizations)
      .values({
        slug: `${slugify(title)}-${crypto.randomBytes(2).toString('hex')}`,
        title: String(title).trim(),
        advocacyAreaId: advocacyAreaId ? Number(advocacyAreaId) : null,
        description: String(description).trim(),
        objectives: String(objectives).trim(),
        targetAudience: String(targetAudience).trim(),
        geographicScope: String(geographicScope).trim(),
        startDate: String(startDate).trim(),
        endDate: String(endDate || '').trim(),
        participationType: String(participationType).trim(),
        supportType: supportType === 'INDEPENDENTE Supported' ? 'INDEPENDENTE Supported' : 'Independent Initiative',
        proposedByUid: req.authUser!.uid,
        proposedByName: req.authUser!.displayName || req.authUser!.email,
        proposedByEmail: req.authUser!.email,
        organizationId: req.authUser!.organizationId || null,
        status: initialStatus,
      })
      .returning();

    await db.insert(mobilizationMembers).values({
      mobilizationId: created.id,
      userId: req.authUser!.id,
      uid: req.authUser!.uid,
      fullName: req.authUser!.displayName || req.authUser!.email,
      email: req.authUser!.email,
      role: 'Organizer',
      status: 'Approved',
    });

    if (initialStatus === 'Submitted') {
      await db.insert(notifications).values({
        recipientType: 'admin',
        title: 'New Mobilization Proposal (OP-02)',
        message: `"${created.title}" submitted by ${created.proposedByName} (${created.supportType}).`,
        linkPath: '/admin',
      });
    }

    res.status(201).json(created);
  } catch (err) {
    console.error('Create mobilization error:', err);
    res.status(500).json({ error: 'Unable to submit mobilization proposal.' });
  }
});

app.post('/api/mobilizations/:id/join', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const mobId = Number(req.params.id);
    const { fullName, email, phone, role, skillsOrInterest } = req.body;
    const name = String(fullName || req.authUser?.displayName || '').trim();
    const em = String(email || req.authUser?.email || '').trim().toLowerCase();
    if (!name || !em) return res.status(400).json({ error: 'Full name and email are required to join.' });

    const mobRows = await db.select().from(mobilizations).where(eq(mobilizations.id, mobId)).limit(1);
    if (mobRows.length === 0) return res.status(404).json({ error: 'Mobilization not found.' });

    const [created] = await db
      .insert(mobilizationMembers)
      .values({
        mobilizationId: mobId,
        userId: req.authUser?.id || null,
        uid: req.authUser?.uid || '',
        fullName: name,
        email: em,
        phone: String(phone || '').trim(),
        role: role === 'Participant' ? 'Participant' : 'Volunteer',
        skillsOrInterest: String(skillsOrInterest || '').trim(),
        status: 'Pending',
      })
      .returning();

    res.status(201).json({
      id: created.id,
      status: created.status,
      message: `Application to join "${mobRows[0].title}" received and queued for organizer review.`,
    });
  } catch (err) {
    res.status(500).json({ error: 'Unable to join mobilization.' });
  }
});

app.get('/api/mobilizations/:id/workspace', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    const mobId = Number(req.params.id);
    const allowed = await userHasMobilizationAccess(req.authUser, mobId);
    if (!allowed) {
      return res.status(403).json({ error: 'Access denied: private Mobilization Workspace is restricted to organizers.' });
    }
    const [mobRows, members, tasks, updates] = await Promise.all([
      db.select().from(mobilizations).where(eq(mobilizations.id, mobId)).limit(1),
      db.select().from(mobilizationMembers).where(eq(mobilizationMembers.mobilizationId, mobId)).orderBy(desc(mobilizationMembers.id)),
      db.select().from(mobilizationTasks).where(eq(mobilizationTasks.mobilizationId, mobId)).orderBy(desc(mobilizationTasks.id)),
      db.select().from(mobilizationUpdates).where(eq(mobilizationUpdates.mobilizationId, mobId)).orderBy(desc(mobilizationUpdates.id)),
    ]);
    if (mobRows.length === 0) return res.status(404).json({ error: 'Mobilization not found.' });
    res.json({ mobilization: mobRows[0], members, tasks, updates });
  } catch (err) {
    res.status(500).json({ error: 'Unable to load mobilization workspace.' });
  }
});

app.patch('/api/mobilizations/:id/members/:memberId', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    const mobId = Number(req.params.id);
    if (!(await userHasMobilizationAccess(req.authUser, mobId))) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    const { status, role } = req.body;
    const updates: Record<string, unknown> = {};
    if (status) updates.status = String(status);
    if (role) updates.role = String(role);
    const [updated] = await db
      .update(mobilizationMembers)
      .set(updates)
      .where(and(eq(mobilizationMembers.id, Number(req.params.memberId)), eq(mobilizationMembers.mobilizationId, mobId)))
      .returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Unable to update mobilization member.' });
  }
});

app.post('/api/mobilizations/:id/tasks', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    const mobId = Number(req.params.id);
    if (!(await userHasMobilizationAccess(req.authUser, mobId))) return res.status(403).json({ error: 'Access denied.' });
    const { title, description, assignedTo, dueDate } = req.body;
    if (!title) return res.status(400).json({ error: 'Task title is required.' });
    const [created] = await db
      .insert(mobilizationTasks)
      .values({
        mobilizationId: mobId,
        title: String(title).trim(),
        description: String(description || '').trim(),
        assignedTo: String(assignedTo || 'Organizer Team').trim(),
        dueDate: String(dueDate || '').trim(),
        status: 'Pending',
        createdByUid: req.authUser!.uid,
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Unable to create task.' });
  }
});

app.patch('/api/mobilizations/:id/tasks/:taskId', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    const mobId = Number(req.params.id);
    if (!(await userHasMobilizationAccess(req.authUser, mobId))) return res.status(403).json({ error: 'Access denied.' });
    const { status } = req.body;
    const [updated] = await db
      .update(mobilizationTasks)
      .set({ status: String(status) })
      .where(and(eq(mobilizationTasks.id, Number(req.params.taskId)), eq(mobilizationTasks.mobilizationId, mobId)))
      .returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Unable to update task.' });
  }
});

app.post('/api/mobilizations/:id/updates', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    const mobId = Number(req.params.id);
    if (!(await userHasMobilizationAccess(req.authUser, mobId))) return res.status(403).json({ error: 'Access denied.' });
    const { updateType, title, content, eventDate, documentUrl, isPublic } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content are required.' });
    const [created] = await db
      .insert(mobilizationUpdates)
      .values({
        mobilizationId: mobId,
        authorUid: req.authUser!.uid,
        authorName: req.authUser!.displayName || req.authUser!.email,
        updateType: String(updateType || 'Progress Report'),
        title: String(title).trim(),
        content: String(content).trim(),
        eventDate: String(eventDate || '').trim(),
        documentUrl: String(documentUrl || '').trim(),
        isPublic: Boolean(isPublic),
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Unable to post mobilization update.' });
  }
});

app.get('/api/admin/mobilizations', requireAuth, requireRoles(['super_admin', 'secretariat_admin', 'advocacy_coordinator']), async (_req, res) => {
  const rows = await db.select().from(mobilizations).orderBy(desc(mobilizations.id));
  res.json(rows);
});

app.patch('/api/admin/mobilizations/:id', requireAuth, requireRoles(['super_admin', 'secretariat_admin', 'advocacy_coordinator']), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { status, supportType, reviewNotes } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (status !== undefined) updates.status = String(status);
    if (supportType !== undefined) updates.supportType = String(supportType);
    if (reviewNotes !== undefined) updates.reviewNotes = String(reviewNotes);
    const [updated] = await db.update(mobilizations).set(updates).where(eq(mobilizations.id, id)).returning();
    await recordAudit(req.authUser!.uid, req.authUser!.email, req.authUser!.roleSlug, 'REVIEW_MOBILIZATION', 'mobilization', id, `status=${updated.status}`);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Unable to update mobilization review status.' });
  }
});

// ==================== PART V: ORGANIZING OPERATIONS & ORGANIZATION HUB ====================
async function userHasOrgWorkspaceAccess(authUser: AuthRequest['authUser'], orgId: number): Promise<{ allowed: boolean; orgRole: string }> {
  if (!authUser) return { allowed: false, orgRole: '' };
  if (['super_admin', 'secretariat_admin'].includes(authUser.roleSlug)) {
    return { allowed: true, orgRole: 'Secretariat Overseer' };
  }
  const member = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.status, 'Active'),
        or(eq(organizationMembers.uid, authUser.uid), eq(organizationMembers.email, authUser.email.toLowerCase()))!
      )
    )
    .limit(1);
  if (member.length > 0) {
    return { allowed: true, orgRole: member[0].orgRole };
  }
  if (authUser.organizationId === orgId) {
    return {
      allowed: true,
      orgRole: authUser.roleSlug === 'partner_admin' ? 'Organization Administrator' : 'Ordinary Member',
    };
  }
  return { allowed: false, orgRole: '' };
}

const ORG_ADMIN_ROLES = ['Secretariat Overseer', 'Organization Administrator', 'President / Chairperson', 'Secretary'];

app.post('/api/org-hub/apply', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const {
      organizationName,
      orgType,
      location,
      description,
      mission,
      vision,
      objectives,
      proposedPrograms,
      advocacyInterests,
      orgStructure,
      membershipRequirements,
      founderName,
      founderEmail,
      founderContact,
      status,
    } = req.body;

    if (!organizationName || !orgType || !location || !description || !mission || !vision || !objectives || !founderName || !founderEmail) {
      return res.status(400).json({ error: 'Please complete all required organization establishment fields.' });
    }

    const referenceCode = generateReferenceNumber('ORG');
    const finalStatus = status === 'Draft' ? 'Draft' : 'Submitted';

    const [created] = await db
      .insert(organizationApplications)
      .values({
        referenceCode,
        organizationName: String(organizationName).trim(),
        orgType: String(orgType).trim(),
        location: String(location).trim(),
        description: String(description).trim(),
        mission: String(mission).trim(),
        vision: String(vision).trim(),
        objectives: String(objectives).trim(),
        proposedPrograms: String(proposedPrograms || 'Community education and citizen engagement').trim(),
        advocacyInterests: String(advocacyInterests || '').trim(),
        orgStructure: String(orgStructure || 'General Assembly & Executive Committee').trim(),
        membershipRequirements: String(membershipRequirements || 'Open to aligned civic members').trim(),
        founderUid: req.authUser?.uid || '',
        founderName: String(founderName).trim(),
        founderEmail: String(founderEmail).trim().toLowerCase(),
        founderContact: String(founderContact || '').trim(),
        status: finalStatus,
      })
      .returning();

    if (finalStatus === 'Submitted') {
      await db.insert(notifications).values({
        recipientType: 'admin',
        title: 'New Organization Establishment Application (OP-03)',
        message: `${created.organizationName} (${created.referenceCode}) submitted for Organizing Operations review.`,
        linkPath: '/admin',
      });
    }

    res.status(201).json({
      referenceCode: created.referenceCode,
      status: created.status,
      organizationName: created.organizationName,
      notice: 'Platform approval provides an independent INDEPENDENTE digital workspace; it does not replace statutory SEC/CDA/DILG registration.',
    });
  } catch (err) {
    console.error('Org apply error:', err);
    res.status(500).json({ error: 'Unable to submit organization establishment application.' });
  }
});

app.get('/api/org-hub/applications', requireAuth, requireRoles(['super_admin', 'secretariat_admin', 'partnership_coordinator']), async (_req, res) => {
  const rows = await db.select().from(organizationApplications).orderBy(desc(organizationApplications.id));
  res.json(rows);
});

app.patch('/api/org-hub/applications/:id', requireAuth, requireRoles(['super_admin', 'secretariat_admin', 'partnership_coordinator']), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { status, reviewNotes, affiliationStatus } = req.body;
    const found = await db.select().from(organizationApplications).where(eq(organizationApplications.id, id)).limit(1);
    if (found.length === 0) return res.status(404).json({ error: 'Organization application not found.' });
    const appRow = found[0];

    if (status === 'Approved' && !appRow.approvedOrganizationId) {
      const slug = `${slugify(appRow.organizationName)}-${crypto.randomBytes(2).toString('hex')}`;
      const [createdOrg] = await db
        .insert(organizations)
        .values({
          slug,
          name: appRow.organizationName,
          orgType: appRow.orgType,
          description: appRow.description,
          mission: appRow.mission,
          vision: appRow.vision,
          objectives: appRow.objectives,
          proposedPrograms: appRow.proposedPrograms,
          orgStructure: appRow.orgStructure,
          membershipRequirements: appRow.membershipRequirements,
          acceptingMembers: true,
          advocacyInterests: appRow.advocacyInterests,
          geographicCoverage: appRow.location,
          address: appRow.location,
          officialRepresentative: appRow.founderName,
          officialEmail: appRow.founderEmail,
          contactNumber: appRow.founderContact || 'Platform Contact',
          partnershipDate: new Date().toISOString().slice(0, 10),
          partnershipStatus: 'Active',
          affiliationStatus: affiliationStatus || 'Independent Organization',
        })
        .returning();

      await db.insert(organizationMembers).values({
        organizationId: createdOrg.id,
        uid: appRow.founderUid || '',
        email: appRow.founderEmail,
        fullName: appRow.founderName,
        orgRole: 'Organization Administrator',
        titleOrCommittee: 'Founding Administrator',
        status: 'Active',
      });

      await db
        .update(organizationApplications)
        .set({
          status: 'Approved',
          reviewNotes: String(reviewNotes || appRow.reviewNotes || ''),
          approvedOrganizationId: createdOrg.id,
          updatedAt: new Date(),
        })
        .where(eq(organizationApplications.id, id));

      await recordAudit(req.authUser!.uid, req.authUser!.email, req.authUser!.roleSlug, 'APPROVE_NEW_ORGANIZATION', 'organization', createdOrg.id, createdOrg.name);
      return res.json({ ok: true, status: 'Approved', organization: createdOrg });
    }

    const [updated] = await db
      .update(organizationApplications)
      .set({
        status: status || appRow.status,
        reviewNotes: reviewNotes !== undefined ? String(reviewNotes) : appRow.reviewNotes,
        updatedAt: new Date(),
      })
      .where(eq(organizationApplications.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error('Review org establishment error:', err);
    res.status(500).json({ error: 'Unable to update organization application.' });
  }
});

app.get('/api/org-hub/organizations', async (req, res) => {
  try {
    await ensureSeedData();
    const affiliation = String(req.query.affiliation || '').trim();
    const orgType = String(req.query.orgType || '').trim();
    const q = String(req.query.q || '').trim();

    const conditions = [eq(organizations.partnershipStatus, 'Active')];
    if (affiliation && affiliation !== 'all') conditions.push(eq(organizations.affiliationStatus, affiliation));
    if (orgType && orgType !== 'all') conditions.push(eq(organizations.orgType, orgType));
    if (q) {
      conditions.push(
        or(
          ilike(organizations.name, `%${q}%`),
          ilike(organizations.advocacyInterests, `%${q}%`),
          ilike(organizations.geographicCoverage, `%${q}%`)
        )!
      );
    }

    const [orgs, memCounts] = await Promise.all([
      db
        .select({
          id: organizations.id,
          slug: organizations.slug,
          name: organizations.name,
          orgType: organizations.orgType,
          description: organizations.description,
          mission: organizations.mission,
          vision: organizations.vision,
          advocacyInterests: organizations.advocacyInterests,
          geographicCoverage: organizations.geographicCoverage,
          officialRepresentative: organizations.officialRepresentative,
          affiliationStatus: organizations.affiliationStatus,
          membershipRequirements: organizations.membershipRequirements,
          acceptingMembers: organizations.acceptingMembers,
          partnershipDate: organizations.partnershipDate,
          isDemonstration: organizations.isDemonstration,
        })
        .from(organizations)
        .where(and(...conditions))
        .orderBy(desc(organizations.id)),
      db
        .select({
          organizationId: organizationMembers.organizationId,
          count: sql<number>`count(*) filter (where ${organizationMembers.status} = 'Active')::int`,
        })
        .from(organizationMembers)
        .groupBy(organizationMembers.organizationId),
    ]);

    const countMap = new Map(memCounts.map((m) => [m.organizationId, m.count]));
    res.json(orgs.map((o) => ({ ...o, memberCount: countMap.get(o.id) || 0 })));
  } catch (err) {
    res.status(500).json({ error: 'Unable to load Organization Hub directory.' });
  }
});

app.post('/api/org-hub/organizations/:id/join', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const orgId = Number(req.params.id);
    const { applicantName, applicantEmail, applicantPhone, motivation, skillsOrInterests } = req.body;
    const name = String(applicantName || req.authUser?.displayName || '').trim();
    const em = String(applicantEmail || req.authUser?.email || '').trim().toLowerCase();
    if (!name || !em || !motivation) {
      return res.status(400).json({ error: 'Name, email, and statement of motivation are required.' });
    }
    const orgRows = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    if (orgRows.length === 0) return res.status(404).json({ error: 'Organization not found.' });

    const [created] = await db
      .insert(membershipApplications)
      .values({
        organizationId: orgId,
        applicantUid: req.authUser?.uid || '',
        applicantName: name,
        applicantEmail: em,
        applicantPhone: String(applicantPhone || '').trim(),
        motivation: String(motivation).trim(),
        skillsOrInterests: String(skillsOrInterests || '').trim(),
        status: 'Submitted',
      })
      .returning();

    res.status(201).json({
      id: created.id,
      status: created.status,
      organizationName: orgRows[0].name,
      message: `Membership application submitted to ${orgRows[0].name}.`,
    });
  } catch (err) {
    res.status(500).json({ error: 'Unable to submit membership application.' });
  }
});

app.get('/api/org-hub/organizations/:id/workspace', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    const orgId = Number(req.params.id);
    const access = await userHasOrgWorkspaceAccess(req.authUser, orgId);
    if (!access.allowed) {
      return res.status(403).json({ error: 'Access denied: strictly isolated organization workspace.' });
    }
    const [orgRows, members, memApps, reps, internalAnns, docs, acts, orgEvents] = await Promise.all([
      db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1),
      db.select().from(organizationMembers).where(eq(organizationMembers.organizationId, orgId)).orderBy(organizationMembers.id),
      db.select().from(membershipApplications).where(eq(membershipApplications.organizationId, orgId)).orderBy(desc(membershipApplications.id)),
      db.select().from(organizationRepresentatives).where(eq(organizationRepresentatives.organizationId, orgId)),
      db.select().from(organizationAnnouncements).where(eq(organizationAnnouncements.organizationId, orgId)).orderBy(desc(organizationAnnouncements.id)),
      db
        .select()
        .from(documents)
        .where(
          or(
            eq(documents.accessLevel, 'public'),
            and(eq(documents.accessLevel, 'organization_only'), eq(documents.organizationId, orgId))
          )
        ),
      db.select().from(partnerActivities).where(eq(partnerActivities.organizationId, orgId)).orderBy(desc(partnerActivities.id)),
      db.select().from(events).where(eq(events.organizationId, orgId)).orderBy(events.startAt),
    ]);

    if (orgRows.length === 0) return res.status(404).json({ error: 'Organization not found.' });
    res.json({
      organization: orgRows[0],
      yourOrgRole: access.orgRole,
      members,
      membershipApplications: ORG_ADMIN_ROLES.includes(access.orgRole) ? memApps : memApps.filter((a) => a.applicantEmail.toLowerCase() === req.authUser!.email.toLowerCase()),
      representatives: reps,
      announcements: internalAnns,
      documents: docs,
      activities: acts,
      events: orgEvents,
    });
  } catch (err) {
    res.status(500).json({ error: 'Unable to load organization workspace.' });
  }
});

app.patch('/api/org-hub/organizations/:id/membership-applications/:appId', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    const orgId = Number(req.params.id);
    const appId = Number(req.params.appId);
    const access = await userHasOrgWorkspaceAccess(req.authUser, orgId);
    if (!access.allowed || !ORG_ADMIN_ROLES.includes(access.orgRole)) {
      return res.status(403).json({ error: 'Only organization administrators or officers can review membership applications.' });
    }
    const { status, reviewNotes } = req.body;
    const found = await db
      .select()
      .from(membershipApplications)
      .where(and(eq(membershipApplications.id, appId), eq(membershipApplications.organizationId, orgId)))
      .limit(1);
    if (found.length === 0) return res.status(404).json({ error: 'Membership application not found.' });
    const appRow = found[0];

    const [updated] = await db
      .update(membershipApplications)
      .set({
        status: String(status),
        reviewNotes: String(reviewNotes || ''),
        reviewedByUid: req.authUser!.uid,
        updatedAt: new Date(),
      })
      .where(eq(membershipApplications.id, appId))
      .returning();

    if (status === 'Approved') {
      await db.insert(organizationMembers).values({
        organizationId: orgId,
        uid: appRow.applicantUid || '',
        email: appRow.applicantEmail,
        fullName: appRow.applicantName,
        orgRole: 'Ordinary Member',
        titleOrCommittee: appRow.skillsOrInterests || 'General Member',
        status: 'Active',
      });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Unable to update membership application.' });
  }
});

app.patch('/api/org-hub/organizations/:id/members/:memberId', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    const orgId = Number(req.params.id);
    const access = await userHasOrgWorkspaceAccess(req.authUser, orgId);
    if (!access.allowed || !ORG_ADMIN_ROLES.includes(access.orgRole)) {
      return res.status(403).json({ error: 'Only Organization Administrators or Officers may assign roles.' });
    }
    const { orgRole, titleOrCommittee, status } = req.body;
    const updates: Record<string, unknown> = {};
    if (orgRole) updates.orgRole = String(orgRole);
    if (titleOrCommittee !== undefined) updates.titleOrCommittee = String(titleOrCommittee);
    if (status) updates.status = String(status);
    const [updated] = await db
      .update(organizationMembers)
      .set(updates)
      .where(and(eq(organizationMembers.id, Number(req.params.memberId)), eq(organizationMembers.organizationId, orgId)))
      .returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Unable to update member role.' });
  }
});

app.post('/api/org-hub/organizations/:id/announcements', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    const orgId = Number(req.params.id);
    const access = await userHasOrgWorkspaceAccess(req.authUser, orgId);
    if (!access.allowed) return res.status(403).json({ error: 'Access denied.' });
    const { title, body, category, eventDate, documentUrl } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'Title and body are required.' });
    const [created] = await db
      .insert(organizationAnnouncements)
      .values({
        organizationId: orgId,
        title: String(title).trim(),
        body: String(body).trim(),
        category: String(category || 'Internal Announcement'),
        eventDate: String(eventDate || '').trim(),
        documentUrl: String(documentUrl || '').trim(),
        authorUid: req.authUser!.uid,
        authorName: req.authUser!.displayName || req.authUser!.email,
      })
      .returning();
    broadcastToOrgRoom(orgId, { type: 'announcement:created', announcement: created });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Unable to post organization announcement.' });
  }
});

app.delete('/api/org-hub/organizations/:id/announcements/:annId', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    const orgId = Number(req.params.id);
    const annId = Number(req.params.annId);
    const access = await userHasOrgWorkspaceAccess(req.authUser, orgId);
    if (!access.allowed) return res.status(403).json({ error: 'Access denied.' });

    const existing = await db
      .select()
      .from(organizationAnnouncements)
      .where(and(eq(organizationAnnouncements.id, annId), eq(organizationAnnouncements.organizationId, orgId)))
      .limit(1);
    if (existing.length === 0) return res.status(404).json({ error: 'Announcement not found.' });

    const canDelete =
      ORG_ADMIN_ROLES.includes(access.orgRole) ||
      (existing[0].authorUid && existing[0].authorUid === req.authUser!.uid);
    if (!canDelete) {
      return res.status(403).json({ error: 'Only organization officers or the author may remove this announcement.' });
    }

    await db.delete(organizationAnnouncements).where(eq(organizationAnnouncements.id, annId));
    broadcastToOrgRoom(orgId, { type: 'announcement:deleted', announcementId: annId });
    res.json({ ok: true, id: annId });
  } catch (err) {
    res.status(500).json({ error: 'Unable to delete organization announcement.' });
  }
});

app.get('/api/operations/my-organizations', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeedData();
    const { isOversight, userOrgs } = await getUserAuthorizedOrganizations(req.authUser);
    res.json({ organizations: userOrgs, isOversight });
  } catch (err) {
    res.status(500).json({ error: 'Unable to load authorized organizations.' });
  }
});

app.get('/api/org-hub/organizations/:id/comms', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeedData();
    const orgId = Number(req.params.id);
    const access = await userHasOrgWorkspaceAccess(req.authUser, orgId);
    if (!access.allowed) {
      return res.status(403).json({ error: 'Access denied: strictly isolated organization communications.' });
    }
    const [orgRows, internalAnns, chatMsgs] = await Promise.all([
      db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1),
      db
        .select()
        .from(organizationAnnouncements)
        .where(eq(organizationAnnouncements.organizationId, orgId))
        .orderBy(desc(organizationAnnouncements.id)),
      db
        .select()
        .from(internalChatMessages)
        .where(eq(internalChatMessages.organizationId, orgId))
        .orderBy(internalChatMessages.id)
        .limit(200),
    ]);
    if (orgRows.length === 0) return res.status(404).json({ error: 'Organization not found.' });
    res.json({
      organization: orgRows[0],
      yourOrgRole: access.orgRole,
      announcements: internalAnns,
      messages: chatMsgs,
      onlineMembers: getOnlineMembersForOrg(orgId),
    });
  } catch (err) {
    res.status(500).json({ error: 'Unable to load organization announcements and chat.' });
  }
});

app.post('/api/org-hub/organizations/:id/chat', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    const orgId = Number(req.params.id);
    const access = await userHasOrgWorkspaceAccess(req.authUser, orgId);
    if (!access.allowed) return res.status(403).json({ error: 'Access denied.' });

    const channel = ['general', 'coordination', 'officers', 'announcements-discussion'].includes(
      String(req.body.channel || 'general')
    )
      ? String(req.body.channel || 'general')
      : 'general';
    const messageText = String(req.body.message || '').trim();
    if (!messageText) return res.status(400).json({ error: 'Message text is required.' });
    if (messageText.length > 2000) return res.status(400).json({ error: 'Message must be under 2000 characters.' });

    const [created] = await db
      .insert(internalChatMessages)
      .values({
        organizationId: orgId,
        channel,
        senderUid: req.authUser!.uid,
        senderName: req.authUser!.displayName || req.authUser!.email,
        senderRole: access.orgRole || 'Member',
        message: messageText,
      })
      .returning();

    broadcastToOrgRoom(orgId, { type: 'chat:message', message: created });
    res.status(201).json(created);
  } catch (err) {
    console.error('Send group chat error:', err);
    res.status(500).json({ error: 'Unable to send internal group chat message.' });
  }
});

app.patch('/api/admin/organizations/:id/affiliation', requireAuth, requireRoles(['super_admin', 'secretariat_admin', 'partnership_coordinator']), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { affiliationStatus, partnershipStatus } = req.body;
    const updates: Record<string, unknown> = {};
    if (affiliationStatus) updates.affiliationStatus = String(affiliationStatus);
    if (partnershipStatus) updates.partnershipStatus = String(partnershipStatus);
    const [updated] = await db.update(organizations).set(updates).where(eq(organizations.id, id)).returning();
    await recordAudit(req.authUser!.uid, req.authUser!.email, req.authUser!.roleSlug, 'UPDATE_ORG_AFFILIATION', 'organization', id, `affiliation=${updated.affiliationStatus}`);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Unable to update organization affiliation status.' });
  }
});

// ==================== PART VI: COLLABORATION & FIND COLLABORATORS ====================
app.get('/api/collaborations/discover', async (req, res) => {
  try {
    await ensureSeedData();
    const interest = String(req.query.interest || '').trim().toLowerCase();
    const location = String(req.query.location || '').trim().toLowerCase();
    const entityType = String(req.query.entityType || 'all').trim();

    const [orgs, outlets, mobs] = await Promise.all([
      db
        .select({
          id: organizations.id,
          slug: organizations.slug,
          name: organizations.name,
          orgType: organizations.orgType,
          advocacyInterests: organizations.advocacyInterests,
          geographicCoverage: organizations.geographicCoverage,
          affiliationStatus: organizations.affiliationStatus,
          description: organizations.description,
        })
        .from(organizations)
        .where(eq(organizations.partnershipStatus, 'Active')),
      db
        .select({
          id: mediaOutlets.id,
          slug: mediaOutlets.slug,
          name: mediaOutlets.name,
          category: mediaOutlets.category,
          primaryAudience: mediaOutlets.primaryAudience,
          description: mediaOutlets.description,
        })
        .from(mediaOutlets)
        .where(eq(mediaOutlets.status, 'Active')),
      db
        .select({
          id: mobilizations.id,
          slug: mobilizations.slug,
          title: mobilizations.title,
          participationType: mobilizations.participationType,
          geographicScope: mobilizations.geographicScope,
          description: mobilizations.description,
          supportType: mobilizations.supportType,
        })
        .from(mobilizations)
        .where(eq(mobilizations.status, 'Active')),
    ]);

    type MatchCandidate = {
      entityType: 'organization' | 'publication' | 'mobilization';
      entityId: number;
      slug: string;
      name: string;
      badge: string;
      focus: string;
      location: string;
      summary: string;
      matchScore: number;
    };

    const candidates: MatchCandidate[] = [];

    const scoreText = (focusText: string, locText: string) => {
      let score = 50;
      if (interest && focusText.toLowerCase().includes(interest)) score += 35;
      if (location && locText.toLowerCase().includes(location)) score += 25;
      return Math.min(100, score);
    };

    if (entityType === 'all' || entityType === 'organization') {
      for (const o of orgs) {
        if (interest && !`${o.advocacyInterests} ${o.description} ${o.name}`.toLowerCase().includes(interest)) continue;
        if (location && !o.geographicCoverage.toLowerCase().includes(location)) continue;
        candidates.push({
          entityType: 'organization',
          entityId: o.id,
          slug: o.slug,
          name: o.name,
          badge: `${o.affiliationStatus} · ${o.orgType}`,
          focus: o.advocacyInterests,
          location: o.geographicCoverage,
          summary: o.description,
          matchScore: scoreText(`${o.advocacyInterests} ${o.description}`, o.geographicCoverage),
        });
      }
    }

    if (entityType === 'all' || entityType === 'publication') {
      for (const p of outlets) {
        if (interest && !`${p.category} ${p.description} ${p.name}`.toLowerCase().includes(interest)) continue;
        candidates.push({
          entityType: 'publication',
          entityId: p.id,
          slug: p.slug,
          name: p.name,
          badge: `Media Publication · ${p.category}`,
          focus: p.primaryAudience,
          location: 'National & Campus Network',
          summary: p.description,
          matchScore: scoreText(`${p.category} ${p.description}`, 'National'),
        });
      }
    }

    if (entityType === 'all' || entityType === 'mobilization') {
      for (const m of mobs) {
        if (interest && !`${m.title} ${m.description} ${m.participationType}`.toLowerCase().includes(interest)) continue;
        if (location && !m.geographicScope.toLowerCase().includes(location)) continue;
        candidates.push({
          entityType: 'mobilization',
          entityId: m.id,
          slug: m.slug,
          name: m.title,
          badge: `Mobilization · ${m.supportType}`,
          focus: m.participationType,
          location: m.geographicScope,
          summary: m.description,
          matchScore: scoreText(`${m.title} ${m.description}`, m.geographicScope),
        });
      }
    }

    candidates.sort((a, b) => b.matchScore - a.matchScore);
    res.json(candidates);
  } catch (err) {
    res.status(500).json({ error: 'Unable to run collaborator discovery.' });
  }
});

app.get('/api/collaborations/requests', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    const isAdmin = ['super_admin', 'secretariat_admin', 'partnership_coordinator'].includes(req.authUser!.roleSlug);
    const rows = isAdmin
      ? await db.select().from(collaborationRequests).orderBy(desc(collaborationRequests.id))
      : await db
          .select()
          .from(collaborationRequests)
          .where(
            or(
              eq(collaborationRequests.senderUid, req.authUser!.uid),
              req.authUser!.organizationId ? eq(collaborationRequests.senderEntityId, req.authUser!.organizationId) : sql`false`,
              req.authUser!.organizationId ? eq(collaborationRequests.recipientEntityId, req.authUser!.organizationId) : sql`false`
            )
          )
          .orderBy(desc(collaborationRequests.id));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Unable to fetch collaboration requests.' });
  }
});

app.post('/api/collaborations/requests', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    const {
      senderType,
      senderEntityId,
      senderName,
      recipientType,
      recipientEntityId,
      recipientName,
      title,
      purpose,
      proposedScope,
      timeline,
    } = req.body;

    if (!recipientType || !recipientEntityId || !recipientName || !title || !purpose || !proposedScope || !timeline) {
      return res.status(400).json({ error: 'Please complete all collaboration request fields.' });
    }

    const [created] = await db
      .insert(collaborationRequests)
      .values({
        referenceCode: generateReferenceNumber('COL'),
        senderType: senderType || (req.authUser!.organizationId ? 'organization' : 'user'),
        senderEntityId: Number(senderEntityId || req.authUser!.organizationId || req.authUser!.id),
        senderName: String(senderName || req.authUser!.displayName || req.authUser!.email).trim(),
        senderUid: req.authUser!.uid,
        recipientType: String(recipientType),
        recipientEntityId: Number(recipientEntityId),
        recipientName: String(recipientName).trim(),
        title: String(title).trim(),
        purpose: String(purpose).trim(),
        proposedScope: String(proposedScope).trim(),
        timeline: String(timeline).trim(),
        status: 'Request Submitted',
      })
      .returning();

    await db.insert(notifications).values({
      recipientType: 'admin',
      organizationId: recipientType === 'organization' ? Number(recipientEntityId) : null,
      title: 'New Collaboration Request',
      message: `${created.senderName} proposed "${created.title}" to ${created.recipientName}.`,
      linkPath: '/network',
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('Create collaboration request error:', err);
    res.status(500).json({ error: 'Unable to submit collaboration request.' });
  }
});

app.patch('/api/collaborations/requests/:id', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { status, responseNotes } = req.body;
    const found = await db.select().from(collaborationRequests).where(eq(collaborationRequests.id, id)).limit(1);
    if (found.length === 0) return res.status(404).json({ error: 'Collaboration request not found.' });
    const reqRow = found[0];

    let projectId = reqRow.projectId;
    if ((status === 'Accepted' || status === 'Active Collaboration') && !projectId) {
      const [proj] = await db
        .insert(collaborativeProjects)
        .values({
          slug: `${slugify(reqRow.title)}-${crypto.randomBytes(2).toString('hex')}`,
          title: reqRow.title,
          summary: reqRow.purpose,
          objectives: reqRow.proposedScope,
          advocacyArea: 'Joint Civic Collaboration',
          geographicScope: 'Cross-Network',
          startDate: new Date().toISOString().slice(0, 10),
          status: 'Active Collaboration',
          leadEntityType: reqRow.senderType,
          leadEntityId: reqRow.senderEntityId,
          leadEntityName: reqRow.senderName,
          createdByUid: req.authUser!.uid,
        })
        .returning();

      projectId = proj.id;
      await db.insert(projectParticipants).values([
        { projectId: proj.id, entityType: reqRow.senderType, entityId: reqRow.senderEntityId, entityName: reqRow.senderName, role: 'Lead' },
        { projectId: proj.id, entityType: reqRow.recipientType, entityId: reqRow.recipientEntityId, entityName: reqRow.recipientName, role: 'Co-Organizer' },
      ]);
    }

    const [updated] = await db
      .update(collaborationRequests)
      .set({
        status: String(status || reqRow.status),
        responseNotes: responseNotes !== undefined ? String(responseNotes) : reqRow.responseNotes,
        projectId,
        updatedAt: new Date(),
      })
      .where(eq(collaborationRequests.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Unable to update collaboration request.' });
  }
});

// ==================== SHARED PROJECT WORKSPACE AUTHORIZATION & ROUTES ====================
const PROJECT_OVERSIGHT_ROLES = [
  'super_admin',
  'secretariat_admin',
  'executive_committee',
  'advocacy_coordinator',
  'partnership_coordinator',
];

async function getUserAuthorizedOrganizations(
  authUser: AuthRequest['authUser']
): Promise<{ isOversight: boolean; orgIds: number[]; userOrgs: Array<{ id: number; name: string }> }> {
  if (!authUser) return { isOversight: false, orgIds: [], userOrgs: [] };
  const isOversight = PROJECT_OVERSIGHT_ROLES.includes(authUser.roleSlug);
  const emailLower = authUser.email.toLowerCase();

  const [memberRows, repRows] = await Promise.all([
    db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.status, 'Active'),
          or(eq(organizationMembers.uid, authUser.uid), eq(organizationMembers.email, emailLower))!
        )
      ),
    db
      .select({ organizationId: organizationRepresentatives.organizationId })
      .from(organizationRepresentatives)
      .where(eq(organizationRepresentatives.email, emailLower)),
  ]);

  const idSet = new Set<number>();
  if (authUser.organizationId) idSet.add(authUser.organizationId);
  for (const r of memberRows) idSet.add(r.organizationId);
  for (const r of repRows) idSet.add(r.organizationId);
  const orgIds = Array.from(idSet);

  const userOrgs = isOversight
    ? await db
        .select({ id: organizations.id, name: organizations.name })
        .from(organizations)
        .where(eq(organizations.partnershipStatus, 'Active'))
        .orderBy(organizations.name)
    : orgIds.length > 0
      ? await db
          .select({ id: organizations.id, name: organizations.name })
          .from(organizations)
          .where(inArray(organizations.id, orgIds))
          .orderBy(organizations.name)
      : [];

  return { isOversight, orgIds, userOrgs };
}

async function userHasProjectAccess(
  authUser: AuthRequest['authUser'],
  projectId: number
): Promise<{ allowed: boolean; accessRole: string; orgNames: string[] }> {
  if (!authUser) return { allowed: false, accessRole: '', orgNames: [] };
  const [projRows, participants] = await Promise.all([
    db.select().from(collaborativeProjects).where(eq(collaborativeProjects.id, projectId)).limit(1),
    db.select().from(projectParticipants).where(eq(projectParticipants.projectId, projectId)),
  ]);
  if (projRows.length === 0) return { allowed: false, accessRole: '', orgNames: [] };
  const proj = projRows[0];

  const { isOversight, orgIds, userOrgs } = await getUserAuthorizedOrganizations(authUser);
  const orgNames = userOrgs.map((o) => o.name);

  if (isOversight) {
    return { allowed: true, accessRole: 'Operations Oversight', orgNames };
  }

  const matchedParticipant = participants.find(
    (p) =>
      (p.entityType === 'organization' && orgIds.includes(p.entityId)) ||
      (p.entityType === 'user' && p.entityId === authUser.id)
  );
  if (matchedParticipant) {
    return { allowed: true, accessRole: matchedParticipant.role, orgNames };
  }

  if (proj.leadEntityType === 'organization' && orgIds.includes(proj.leadEntityId)) {
    return { allowed: true, accessRole: 'Lead', orgNames };
  }
  if (proj.createdByUid && proj.createdByUid === authUser.uid) {
    return { allowed: true, accessRole: 'Lead', orgNames };
  }

  return { allowed: false, accessRole: '', orgNames };
}

app.get('/api/operations/shared-projects', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeedData();
    const { isOversight, orgIds, userOrgs } = await getUserAuthorizedOrganizations(req.authUser);

    const [allProjects, allParticipants, allTasks, allDocs, activePartnerOrgs] = await Promise.all([
      db.select().from(collaborativeProjects).orderBy(desc(collaborativeProjects.id)),
      db.select().from(projectParticipants),
      db.select().from(projectTasks),
      db.select().from(projectDocuments),
      db
        .select({
          id: organizations.id,
          name: organizations.name,
          orgType: organizations.orgType,
          geographicCoverage: organizations.geographicCoverage,
        })
        .from(organizations)
        .where(eq(organizations.partnershipStatus, 'Active'))
        .orderBy(organizations.name),
    ]);

    const visibleProjects = allProjects
      .map((proj) => {
        const projParts = allParticipants.filter((p) => p.projectId === proj.id);
        let accessRole = '';
        if (isOversight) {
          accessRole = 'Operations Oversight';
        } else {
          const mp = projParts.find(
            (p) =>
              (p.entityType === 'organization' && orgIds.includes(p.entityId)) ||
              (p.entityType === 'user' && p.entityId === req.authUser!.id)
          );
          if (mp) accessRole = mp.role;
          else if (proj.leadEntityType === 'organization' && orgIds.includes(proj.leadEntityId)) accessRole = 'Lead';
          else if (proj.createdByUid && proj.createdByUid === req.authUser!.uid) accessRole = 'Lead';
        }
        if (!accessRole) return null;

        const projTasks = allTasks.filter((t) => t.projectId === proj.id);
        const projDocs = allDocs.filter((d) => d.projectId === proj.id);
        const completedTasks = projTasks.filter((t) => t.status === 'Completed').length;
        const activeDocuments = projDocs.filter((d) => d.status !== 'Archived').length;
        const archivedDocuments = projDocs.filter((d) => d.status === 'Archived').length;

        return {
          ...proj,
          participantCount: projParts.length,
          totalTasks: projTasks.length,
          completedTasks,
          openTasks: projTasks.length - completedTasks,
          activeDocuments,
          archivedDocuments,
          accessRole,
        };
      })
      .filter(Boolean);

    res.json({
      projects: visibleProjects,
      userOrganizations: userOrgs,
      availablePartnerOrgs: activePartnerOrgs,
      isOversight,
    });
  } catch (err) {
    console.error('Load shared projects error:', err);
    res.status(500).json({ error: 'Unable to load authorized shared project workspaces.' });
  }
});

app.post('/api/operations/shared-projects', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeedData();
    const {
      title,
      summary,
      objectives,
      advocacyArea,
      geographicScope,
      startDate,
      endDate,
      leadOrganizationId,
      partnerOrgIds,
    } = req.body;

    if (!title || !summary || !objectives) {
      return res.status(400).json({ error: 'Initiative title, summary, and shared objectives are required.' });
    }

    const { isOversight, orgIds, userOrgs } = await getUserAuthorizedOrganizations(req.authUser);
    const chosenLeadId = Number(leadOrganizationId || userOrgs[0]?.id || 0);

    if (!isOversight && chosenLeadId && !orgIds.includes(chosenLeadId)) {
      return res.status(403).json({ error: 'You can only launch an initiative on behalf of an organization you belong to.' });
    }
    if (!chosenLeadId && !isOversight) {
      return res.status(403).json({
        error: 'An affiliated partner organization membership or Operations Center role is required to launch a joint initiative.',
      });
    }

    const leadOrgRows = chosenLeadId
      ? await db.select().from(organizations).where(eq(organizations.id, chosenLeadId)).limit(1)
      : [];
    const leadEntityType = leadOrgRows.length > 0 ? 'organization' : 'user';
    const leadEntityId = leadOrgRows.length > 0 ? leadOrgRows[0].id : req.authUser!.id;
    const leadEntityName =
      leadOrgRows.length > 0
        ? leadOrgRows[0].name
        : req.authUser!.displayName || req.authUser!.email;

    const [created] = await db
      .insert(collaborativeProjects)
      .values({
        slug: `${slugify(String(title))}-${crypto.randomBytes(2).toString('hex')}`,
        title: String(title).trim(),
        summary: String(summary).trim(),
        objectives: String(objectives).trim(),
        advocacyArea: String(advocacyArea || 'Good Governance and Accountability').trim(),
        geographicScope: String(geographicScope || 'National Network').trim(),
        startDate: String(startDate || new Date().toISOString().slice(0, 10)).trim(),
        endDate: String(endDate || '').trim(),
        status: 'Active Collaboration',
        leadEntityType,
        leadEntityId,
        leadEntityName,
        createdByUid: req.authUser!.uid,
      })
      .returning();

    const participantsToInsert: Array<{
      projectId: number;
      entityType: string;
      entityId: number;
      entityName: string;
      role: string;
    }> = [
      {
        projectId: created.id,
        entityType: leadEntityType,
        entityId: leadEntityId,
        entityName: leadEntityName,
        role: 'Lead',
      },
    ];

    const coOrgIds = Array.isArray(partnerOrgIds)
      ? partnerOrgIds.map((x: unknown) => Number(x)).filter((id) => Number.isFinite(id) && id > 0 && id !== chosenLeadId)
      : [];
    if (coOrgIds.length > 0) {
      const coOrgs = await db.select().from(organizations).where(inArray(organizations.id, coOrgIds));
      for (const co of coOrgs) {
        participantsToInsert.push({
          projectId: created.id,
          entityType: 'organization',
          entityId: co.id,
          entityName: co.name,
          role: 'Co-Organizer',
        });
      }
    }

    await db.insert(projectParticipants).values(participantsToInsert);
    await recordAudit(
      req.authUser!.uid,
      req.authUser!.email,
      req.authUser!.roleSlug,
      'CREATE_SHARED_PROJECT',
      'collaborative_project',
      created.id,
      `title=${created.title}; participants=${participantsToInsert.length}`
    );

    res.status(201).json(created);
  } catch (err) {
    console.error('Create shared project error:', err);
    res.status(500).json({ error: 'Unable to create joint advocacy initiative.' });
  }
});

app.get('/api/collaborations/projects', async (_req, res) => {
  await ensureSeedData();
  const rows = await db.select().from(collaborativeProjects).orderBy(desc(collaborativeProjects.id));
  res.json(rows);
});

app.get('/api/collaborations/projects/:id/workspace', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid project ID.' });

    const access = await userHasProjectAccess(req.authUser, id);
    if (!access.allowed) {
      return res.status(403).json({
        error: 'Access denied: only authorized participating organizations or Operations Center coordinators may enter this project workspace.',
      });
    }

    const [projRows, participants, tasks, reports, docs, linkedEvents] = await Promise.all([
      db.select().from(collaborativeProjects).where(eq(collaborativeProjects.id, id)).limit(1),
      db.select().from(projectParticipants).where(eq(projectParticipants.projectId, id)).orderBy(projectParticipants.id),
      db.select().from(projectTasks).where(eq(projectTasks.projectId, id)).orderBy(desc(projectTasks.id)),
      db.select().from(projectReports).where(eq(projectReports.projectId, id)).orderBy(desc(projectReports.id)),
      db.select().from(projectDocuments).where(eq(projectDocuments.projectId, id)).orderBy(desc(projectDocuments.id)),
      db.select().from(events).where(eq(events.projectId, id)).orderBy(events.startAt),
    ]);

    if (projRows.length === 0) return res.status(404).json({ error: 'Project workspace not found.' });
    res.json({
      project: projRows[0],
      participants,
      tasks,
      reports,
      documents: docs,
      events: linkedEvents,
      accessRole: access.accessRole,
      actorOrgNames: access.orgNames,
    });
  } catch (err) {
    console.error('Load workspace error:', err);
    res.status(500).json({ error: 'Unable to load shared project workspace.' });
  }
});

app.patch('/api/collaborations/projects/:id', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const access = await userHasProjectAccess(req.authUser, id);
    if (!access.allowed) {
      return res.status(403).json({ error: 'Access denied: organization is not authorized for this initiative.' });
    }

    const { status, title, summary, objectives, advocacyArea, geographicScope, endDate, addOrganizationId, role } =
      req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (status) updates.status = String(status);
    if (title) updates.title = String(title).trim();
    if (summary) updates.summary = String(summary).trim();
    if (objectives) updates.objectives = String(objectives).trim();
    if (advocacyArea) updates.advocacyArea = String(advocacyArea).trim();
    if (geographicScope) updates.geographicScope = String(geographicScope).trim();
    if (endDate !== undefined) updates.endDate = String(endDate).trim();

    const [updated] = await db
      .update(collaborativeProjects)
      .set(updates)
      .where(eq(collaborativeProjects.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Initiative not found.' });

    if (addOrganizationId) {
      const orgId = Number(addOrganizationId);
      const [orgRows, existingParts] = await Promise.all([
        db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1),
        db
          .select()
          .from(projectParticipants)
          .where(
            and(
              eq(projectParticipants.projectId, id),
              eq(projectParticipants.entityType, 'organization'),
              eq(projectParticipants.entityId, orgId)
            )
          )
          .limit(1),
      ]);
      if (orgRows.length > 0 && existingParts.length === 0) {
        await db.insert(projectParticipants).values({
          projectId: id,
          entityType: 'organization',
          entityId: orgRows[0].id,
          entityName: orgRows[0].name,
          role: String(role || 'Co-Organizer'),
        });
      }
    }

    await recordAudit(
      req.authUser!.uid,
      req.authUser!.email,
      req.authUser!.roleSlug,
      'UPDATE_SHARED_PROJECT',
      'collaborative_project',
      id,
      `status=${updated.status}`
    );

    res.json(updated);
  } catch (err) {
    console.error('Update shared project error:', err);
    res.status(500).json({ error: 'Unable to update joint initiative.' });
  }
});

app.get('/api/collaborations/projects/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [projRows, participants, tasks, reports, linkedEvents] = await Promise.all([
      db.select().from(collaborativeProjects).where(eq(collaborativeProjects.id, id)).limit(1),
      db.select().from(projectParticipants).where(eq(projectParticipants.projectId, id)),
      db.select().from(projectTasks).where(eq(projectTasks.projectId, id)).orderBy(desc(projectTasks.id)),
      db.select().from(projectReports).where(eq(projectReports.projectId, id)).orderBy(desc(projectReports.id)),
      db.select().from(events).where(eq(events.projectId, id)).orderBy(events.startAt),
    ]);
    if (projRows.length === 0) return res.status(404).json({ error: 'Project workspace not found.' });
    res.json({ project: projRows[0], participants, tasks, reports, events: linkedEvents });
  } catch (err) {
    res.status(500).json({ error: 'Unable to load shared project workspace.' });
  }
});

app.post('/api/collaborations/projects/:id/tasks', requireAnyAuth, async (req: AuthRequest, res) => {
  const projectId = Number(req.params.id);
  const access = await userHasProjectAccess(req.authUser, projectId);
  if (!access.allowed) return res.status(403).json({ error: 'Access denied: not an authorized project participant.' });

  const { title, assignedEntity, dueDate } = req.body;
  if (!title) return res.status(400).json({ error: 'Task title required.' });
  const [created] = await db
    .insert(projectTasks)
    .values({
      projectId,
      title: String(title).trim(),
      assignedEntity: String(assignedEntity || access.orgNames[0] || req.authUser!.displayName).trim(),
      dueDate: String(dueDate || '').trim(),
      status: 'Open',
    })
    .returning();
  res.status(201).json(created);
});

app.patch('/api/collaborations/projects/:id/tasks/:taskId', requireAnyAuth, async (req: AuthRequest, res) => {
  const projectId = Number(req.params.id);
  const access = await userHasProjectAccess(req.authUser, projectId);
  if (!access.allowed) return res.status(403).json({ error: 'Access denied: not an authorized project participant.' });

  const [updated] = await db
    .update(projectTasks)
    .set({ status: String(req.body.status) })
    .where(and(eq(projectTasks.id, Number(req.params.taskId)), eq(projectTasks.projectId, projectId)))
    .returning();
  if (!updated) return res.status(404).json({ error: 'Task not found.' });
  res.json(updated);
});

app.post('/api/collaborations/projects/:id/reports', requireAnyAuth, async (req: AuthRequest, res) => {
  const projectId = Number(req.params.id);
  const access = await userHasProjectAccess(req.authUser, projectId);
  if (!access.allowed) return res.status(403).json({ error: 'Access denied: not an authorized project participant.' });

  const { reportType, title, summary } = req.body;
  if (!title || !summary) return res.status(400).json({ error: 'Title and summary required.' });
  const [created] = await db
    .insert(projectReports)
    .values({
      projectId,
      authorName: access.orgNames[0]
        ? `${req.authUser!.displayName || req.authUser!.email} (${access.orgNames[0]})`
        : req.authUser!.displayName || req.authUser!.email,
      reportType: String(reportType || 'Progress Update'),
      title: String(title).trim(),
      summary: String(summary).trim(),
    })
    .returning();
  res.status(201).json(created);
});

app.post('/api/collaborations/projects/:id/documents', requireAnyAuth, publicUpload.single('file'), async (req: AuthRequest, res) => {
  try {
    const projectId = Number(req.params.id);
    const access = await userHasProjectAccess(req.authUser, projectId);
    if (!access.allowed) return res.status(403).json({ error: 'Access denied: not an authorized project participant.' });

    const { title, category, description, fileUrl, fileName, uploadedByOrg } = req.body;
    const uploadedFile = req.file;
    const resolvedUrl = uploadedFile
      ? `/uploads/public/${uploadedFile.filename}`
      : String(fileUrl || '').trim();
    const resolvedName = uploadedFile
      ? uploadedFile.originalname
      : String(fileName || '').trim() || (resolvedUrl.split('/').pop() || 'document');

    if (!title || !resolvedUrl) {
      return res.status(400).json({ error: 'Document title and either an uploaded file or document URL are required.' });
    }

    const [created] = await db
      .insert(projectDocuments)
      .values({
        projectId,
        title: String(title).trim(),
        category: String(category || 'Policy Brief').trim(),
        description: String(description || '').trim(),
        fileUrl: resolvedUrl,
        fileName: resolvedName,
        uploadedByOrg: String(uploadedByOrg || access.orgNames[0] || 'Joint Working Group').trim(),
        uploadedByName: req.authUser!.displayName || req.authUser!.email,
        uploadedByUid: req.authUser!.uid,
        status: 'Active',
      })
      .returning();

    await recordAudit(
      req.authUser!.uid,
      req.authUser!.email,
      req.authUser!.roleSlug,
      'UPLOAD_PROJECT_DOCUMENT',
      'project_document',
      created.id,
      `projectId=${projectId}; title=${created.title}`
    );

    res.status(201).json(created);
  } catch (err) {
    console.error('Upload project document error:', err);
    res.status(500).json({ error: 'Unable to register collaborative document.' });
  }
});

app.patch('/api/collaborations/projects/:id/documents/:docId', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    const projectId = Number(req.params.id);
    const docId = Number(req.params.docId);
    const access = await userHasProjectAccess(req.authUser, projectId);
    if (!access.allowed) return res.status(403).json({ error: 'Access denied: not an authorized project participant.' });

    const nextStatus = req.body.status === 'Archived' ? 'Archived' : 'Active';
    const [updated] = await db
      .update(projectDocuments)
      .set({
        status: nextStatus,
        archivedAt: nextStatus === 'Archived' ? new Date() : null,
      })
      .where(and(eq(projectDocuments.id, docId), eq(projectDocuments.projectId, projectId)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Document not found in this project workspace.' });

    await recordAudit(
      req.authUser!.uid,
      req.authUser!.email,
      req.authUser!.roleSlug,
      nextStatus === 'Archived' ? 'ARCHIVE_PROJECT_DOCUMENT' : 'RESTORE_PROJECT_DOCUMENT',
      'project_document',
      docId,
      `projectId=${projectId}; status=${nextStatus}`
    );

    res.json(updated);
  } catch (err) {
    console.error('Update project document error:', err);
    res.status(500).json({ error: 'Unable to update document archive status.' });
  }
});

app.post('/api/collaborations/projects/:id/events', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    const projectId = Number(req.params.id);
    const access = await userHasProjectAccess(req.authUser, projectId);
    if (!access.allowed) return res.status(403).json({ error: 'Access denied: not an authorized project participant.' });

    const { title, description, format, startAt, endAt, venueOrLink } = req.body;
    if (!title || !description || !startAt || !venueOrLink) {
      return res.status(400).json({ error: 'Title, description, date/time, and venue are required.' });
    }
    const [created] = await db
      .insert(events)
      .values({
        slug: `${slugify(title)}-${crypto.randomBytes(2).toString('hex')}`,
        title: String(title).trim(),
        description: String(description).trim(),
        objectives: 'Joint collaborative event organized via INDEPENDENTE Collaboration Workspace.',
        category: 'Forums and dialogues',
        format: String(format || 'Hybrid'),
        startAt: String(startAt).trim(),
        endAt: String(endAt || startAt).trim(),
        venueOrLink: String(venueOrLink).trim(),
        organizer: access.orgNames[0] || req.authUser!.displayName || 'Joint Collaboration Partners',
        registrationDeadline: String(startAt).slice(0, 10),
        capacity: 150,
        contactPerson: req.authUser!.email,
        posterUrl: '/src/assets/images/event_national_summit_1795044499688.jpg',
        status: 'Upcoming',
        projectId,
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Unable to schedule collaborative event.' });
  }
});

// ==================== PART VII: UNIFIED USER PROFILE (MY WORKSPACE) ====================
app.get('/api/workspace/me', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeedData();
    const u = req.authUser!;
    const emailLower = u.email.toLowerCase();

    const [
      outletMemberships,
      myArticles,
      orgMemberships,
      myMembershipApps,
      myOrgEstablishmentApps,
      mobMemberships,
      myProposedMobs,
      myEventRegs,
      myCollabRequests,
      myNotifs,
    ] = await Promise.all([
      db
        .select({
          membershipId: mediaOutletMembers.id,
          editorialRole: mediaOutletMembers.editorialRole,
          outlet: mediaOutlets,
        })
        .from(mediaOutletMembers)
        .innerJoin(mediaOutlets, eq(mediaOutletMembers.outletId, mediaOutlets.id))
        .where(or(eq(mediaOutletMembers.uid, u.uid), eq(mediaOutletMembers.email, emailLower))),
      db.select().from(publications).where(eq(publications.authorUid, u.uid)).orderBy(desc(publications.id)),
      db
        .select({
          membershipId: organizationMembers.id,
          orgRole: organizationMembers.orgRole,
          titleOrCommittee: organizationMembers.titleOrCommittee,
          organization: organizations,
        })
        .from(organizationMembers)
        .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
        .where(or(eq(organizationMembers.uid, u.uid), eq(organizationMembers.email, emailLower))),
      db
        .select({
          application: membershipApplications,
          organizationName: organizations.name,
        })
        .from(membershipApplications)
        .innerJoin(organizations, eq(membershipApplications.organizationId, organizations.id))
        .where(or(eq(membershipApplications.applicantUid, u.uid), eq(membershipApplications.applicantEmail, emailLower)))
        .orderBy(desc(membershipApplications.id)),
      db
        .select()
        .from(organizationApplications)
        .where(or(eq(organizationApplications.founderUid, u.uid), eq(organizationApplications.founderEmail, emailLower)))
        .orderBy(desc(organizationApplications.id)),
      db
        .select({
          member: mobilizationMembers,
          mobilization: mobilizations,
        })
        .from(mobilizationMembers)
        .innerJoin(mobilizations, eq(mobilizationMembers.mobilizationId, mobilizations.id))
        .where(or(eq(mobilizationMembers.uid, u.uid), eq(mobilizationMembers.email, emailLower))),
      db.select().from(mobilizations).where(or(eq(mobilizations.proposedByUid, u.uid), eq(mobilizations.proposedByEmail, emailLower))),
      db
        .select({
          registration: eventRegistrations,
          event: events,
        })
        .from(eventRegistrations)
        .innerJoin(events, eq(eventRegistrations.eventId, events.id))
        .where(eq(eventRegistrations.email, emailLower))
        .orderBy(desc(eventRegistrations.id)),
      db
        .select()
        .from(collaborationRequests)
        .where(
          or(
            eq(collaborationRequests.senderUid, u.uid),
            u.organizationId ? eq(collaborationRequests.senderEntityId, u.organizationId) : sql`false`,
            u.organizationId ? eq(collaborationRequests.recipientEntityId, u.organizationId) : sql`false`
          )
        )
        .orderBy(desc(collaborationRequests.id)),
      db
        .select()
        .from(notifications)
        .where(
          or(
            eq(notifications.recipientUid, u.uid),
            u.organizationId ? eq(notifications.organizationId, u.organizationId) : sql`false`
          )
        )
        .orderBy(desc(notifications.id))
        .limit(15),
    ]);

    // If partner user has organizationId not yet in organization_members, include it cleanly
    let directOrg = null;
    if (u.organizationId && !orgMemberships.some((m) => m.organization.id === u.organizationId)) {
      const rows = await db.select().from(organizations).where(eq(organizations.id, u.organizationId)).limit(1);
      if (rows[0]) directOrg = rows[0];
    }

    res.json({
      account: u,
      myPublications: { outlets: outletMemberships, articles: myArticles },
      myOrganizations: orgMemberships,
      directOrganization: directOrg,
      myMembershipApplications: myMembershipApps,
      myOrganizationEstablishmentApps: myOrgEstablishmentApps,
      myMobilizations: { joined: mobMemberships, proposed: myProposedMobs },
      myEvents: myEventRegs,
      myCollaborationRequests: myCollabRequests,
      myNotifications: myNotifs,
    });
  } catch (err) {
    console.error('My Workspace error:', err);
    res.status(500).json({ error: 'Unable to load My Workspace.' });
  }
});

app.patch('/api/workspace/me', requireAnyAuth, async (req: AuthRequest, res) => {
  try {
    const { displayName } = req.body;
    if (!displayName || String(displayName).trim().length < 2) {
      return res.status(400).json({ error: 'Display name must be at least 2 characters.' });
    }
    const [updated] = await db
      .update(users)
      .set({ displayName: String(displayName).trim(), updatedAt: new Date() })
      .where(eq(users.id, req.authUser!.id))
      .returning({
        id: users.id,
        uid: users.uid,
        email: users.email,
        displayName: users.displayName,
        roleSlug: users.roleSlug,
        organizationId: users.organizationId,
      });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Unable to update account display name.' });
  }
});

// ==================== REAL-TIME ORGANIZATION COMMS WEBSOCKET HUB ====================
interface OrgSocketClient {
  ws: WebSocket;
  orgId: number;
  uid: string;
  displayName: string;
  orgRole: string;
}

const orgRooms = new Map<number, Set<OrgSocketClient>>();

function getOnlineMembersForOrg(orgId: number) {
  const room = orgRooms.get(orgId);
  if (!room) return [];
  const unique = new Map<string, { uid: string; displayName: string; orgRole: string }>();
  for (const client of room) {
    if (client.ws.readyState === WebSocket.OPEN) {
      unique.set(client.uid, {
        uid: client.uid,
        displayName: client.displayName,
        orgRole: client.orgRole,
      });
    }
  }
  return Array.from(unique.values());
}

function broadcastToOrgRoom(orgId: number, payload: Record<string, unknown>) {
  const room = orgRooms.get(orgId);
  if (!room) return;
  const serialized = JSON.stringify(payload);
  for (const client of room) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(serialized);
    }
  }
}

// ==================== VITE / STATIC SERVING ====================
async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', async (request, socket, head) => {
    try {
      const parsedUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      if (parsedUrl.pathname !== '/ws/org-comms') {
        return;
      }

      const token = parsedUrl.searchParams.get('token') || '';
      const orgId = Number(parsedUrl.searchParams.get('orgId'));
      if (!token || !Number.isFinite(orgId) || orgId <= 0) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const authUser = await verifyBearerToken(token);
      if (!authUser) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const access = await userHasOrgWorkspaceAccess(authUser, orgId);
      if (!access.allowed) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, { authUser, orgId, orgRole: access.orgRole });
      });
    } catch {
      socket.destroy();
    }
  });

  wss.on(
    'connection',
    async (
      ws: WebSocket,
      ctx: {
        authUser: { uid: string; displayName: string; email: string };
        orgId: number;
        orgRole: string;
      }
    ) => {
      const client: OrgSocketClient = {
        ws,
        orgId: ctx.orgId,
        uid: ctx.authUser.uid,
        displayName: ctx.authUser.displayName || ctx.authUser.email,
        orgRole: ctx.orgRole || 'Member',
      };

      if (!orgRooms.has(ctx.orgId)) orgRooms.set(ctx.orgId, new Set());
      orgRooms.get(ctx.orgId)!.add(client);

      try {
        const [internalAnns, chatMsgs] = await Promise.all([
          db
            .select()
            .from(organizationAnnouncements)
            .where(eq(organizationAnnouncements.organizationId, ctx.orgId))
            .orderBy(desc(organizationAnnouncements.id)),
          db
            .select()
            .from(internalChatMessages)
            .where(eq(internalChatMessages.organizationId, ctx.orgId))
            .orderBy(internalChatMessages.id)
            .limit(200),
        ]);

        ws.send(
          JSON.stringify({
            type: 'init',
            announcements: internalAnns,
            messages: chatMsgs,
            onlineMembers: getOnlineMembersForOrg(ctx.orgId),
          })
        );
      } catch (err) {
        console.error('WS init error:', err);
      }

      broadcastToOrgRoom(ctx.orgId, {
        type: 'presence:update',
        onlineMembers: getOnlineMembersForOrg(ctx.orgId),
      });

      ws.on('message', async (raw) => {
        try {
          const data = JSON.parse(String(raw));
          if (data?.type === 'chat:send') {
            const channel = ['general', 'coordination', 'officers', 'announcements-discussion'].includes(
              String(data.channel || 'general')
            )
              ? String(data.channel || 'general')
              : 'general';
            const messageText = String(data.message || '').trim();
            if (!messageText || messageText.length > 2000) return;

            const [created] = await db
              .insert(internalChatMessages)
              .values({
                organizationId: ctx.orgId,
                channel,
                senderUid: client.uid,
                senderName: client.displayName,
                senderRole: client.orgRole,
                message: messageText,
              })
              .returning();

            broadcastToOrgRoom(ctx.orgId, { type: 'chat:message', message: created });
          }
        } catch {
          // Ignore malformed WS messages
        }
      });

      ws.on('close', () => {
        const room = orgRooms.get(ctx.orgId);
        if (room) {
          room.delete(client);
          if (room.size === 0) orgRooms.delete(ctx.orgId);
          else {
            broadcastToOrgRoom(ctx.orgId, {
              type: 'presence:update',
              onlineMembers: getOnlineMembersForOrg(ctx.orgId),
            });
          }
        }
      });
    }
  );

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`INDEPENDENTE server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
