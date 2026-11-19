import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// 1. Roles & Permissions
export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  permissionsJson: text('permissions_json').notNull(), // JSON array of permission strings
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. Organizations (Affiliated Partner Organizations & Institutional Partners)
export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  orgType: text('org_type').notNull(), // NGO, Academic, Community Org, Civic Coalition, Media Partner, Youth Org
  description: text('description').notNull(),
  mission: text('mission').notNull(),
  vision: text('vision').notNull(),
  advocacyInterests: text('advocacy_interests').notNull(), // Comma-separated or JSON array string
  geographicCoverage: text('geographic_coverage').notNull(), // e.g., Metro Manila, Cebu, Mindanao, National
  address: text('address').notNull(),
  officialRepresentative: text('official_representative').notNull(),
  officialEmail: text('official_email').notNull(),
  contactNumber: text('contact_number').notNull(),
  website: text('website').default(''),
  socialLinks: text('social_links').default(''),
  logoUrl: text('logo_url').default(''),
  partnershipDate: text('partnership_date').notNull(),
  partnershipStatus: text('partnership_status').notNull().default('Active'), // Active, Probationary, Suspended, Alumni
  affiliationStatus: text('affiliation_status').notNull().default('Official Partner Organization'), // Independent Organization, Affiliated Organization, Official Partner Organization, Central Network Unit
  objectives: text('objectives').default(''),
  proposedPrograms: text('proposed_programs').default(''),
  orgStructure: text('org_structure').default(''),
  membershipRequirements: text('membership_requirements').default('Open to civic-minded citizens aligned with the organization charter.'),
  acceptingMembers: boolean('accepting_members').notNull().default(true),
  isFeatured: boolean('is_featured').notNull().default(false),
  isDemonstration: boolean('is_demonstration').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// 3. Users (Linked to Firebase Auth UID or Partner Organization Credentials)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull().default(''),
  roleSlug: text('role_slug').notNull().default('public_visitor'),
  organizationId: integer('organization_id').references(() => organizations.id, {
    onDelete: 'set null',
  }),
  passwordHash: text('password_hash'), // For Partner Portal email/password authentication
  emailVerified: boolean('email_verified').notNull().default(true),
  twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
  twoFactorCode: text('two_factor_code'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 4. Organization Representatives
export const organizationRepresentatives = pgTable('organization_representatives', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  fullName: text('full_name').notNull(),
  position: text('position').notNull(),
  email: text('email').notNull(),
  phone: text('phone').default(''),
  partnerRole: text('partner_role').notNull().default('Authorized Representative'), // Organization Administrator, Authorized Representative, Communications Officer, Program Coordinator, Member/Participant
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// 5. Partnership Applications
export const partnershipApplications = pgTable('partnership_applications', {
  id: serial('id').primaryKey(),
  referenceCode: text('reference_code').notNull().unique(),
  organizationName: text('organization_name').notNull(),
  orgType: text('org_type').notNull(),
  officialAddress: text('official_address').notNull(),
  websiteOrSocial: text('website_or_social').default(''),
  background: text('background').notNull(),
  mission: text('mission').notNull(),
  vision: text('vision').notNull(),
  advocacyInterests: text('advocacy_interests').notNull(),
  authorizedRep: text('authorized_rep').notNull(),
  position: text('position').notNull(),
  officialEmail: text('official_email').notNull(),
  contactNumber: text('contact_number').notNull(),
  proposedAreas: text('proposed_areas').notNull(),
  supportingDocUrl: text('supporting_doc_url').default(''),
  consentGiven: boolean('consent_given').notNull().default(true),
  status: text('status').notNull().default('Submitted'), // Submitted, Initial Review, Verification, Interview/Consultation, Approved, Rejected, Onboarding
  reviewNotes: text('review_notes').default(''),
  reviewedByUid: text('reviewed_by_uid'),
  approvedOrganizationId: integer('approved_organization_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 6. Partnership Agreements
export const partnershipAgreements = pgTable('partnership_agreements', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  agreementType: text('agreement_type').notNull(), // MOU, Partnership Charter, Data Sharing Addendum
  effectiveDate: text('effective_date').notNull(),
  expiryDate: text('expiry_date').default(''),
  documentUrl: text('document_url').default(''),
  status: text('status').notNull().default('Active'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 7. Publication Categories
export const publicationCategories = pgTable('publication_categories', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

// 8. Publications (News, Investigative Reports, Features, Opinion, Press Releases, Research, Advocacy, Community Reports)
export const publications = pgTable('publications', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  subheadline: text('subheadline').notNull(),
  categorySlug: text('category_slug').notNull(),
  authorName: text('author_name').notNull(),
  authorRole: text('author_role').notNull().default('Editorial Desk'),
  authorUid: text('author_uid'),
  featuredImageUrl: text('featured_image_url').default(''),
  bodyMarkdown: text('body_markdown').notNull(),
  referencesText: text('references_text').default(''),
  tags: text('tags').default(''), // Comma-separated keywords
  status: text('status').notNull().default('draft'), // draft, review, scheduled, published, archived
  publishedAt: text('published_at'),
  scheduledFor: text('scheduled_for'),
  correctionNote: text('correction_note').default(''),
  viewCount: integer('view_count').notNull().default(0),
  isFeatured: boolean('is_featured').notNull().default(false),
  isDemonstration: boolean('is_demonstration').notNull().default(false),
  outletId: integer('outlet_id'),
  coOutletId: integer('co_outlet_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 9. Advocacy Areas
export const advocacyAreas = pgTable('advocacy_areas', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  backgroundRationale: text('background_rationale').notNull(),
  identifiedConcern: text('identified_concern').notNull(),
  objectives: text('objectives').notNull(),
  guidingPrinciples: text('guiding_principles').notNull(),
  interventions: text('interventions').notNull(),
  citizenParticipation: text('citizen_participation').notNull(),
  campaignMaterialsUrl: text('campaign_materials_url').default(''),
  heroImageUrl: text('hero_image_url').default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  isDemonstration: boolean('is_demonstration').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// 10. Campaigns
export const campaigns = pgTable('campaigns', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  advocacyAreaId: integer('advocacy_area_id')
    .references(() => advocacyAreas.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  objectives: text('objectives').notNull(),
  status: text('status').notNull().default('Active'), // Proposed, Planning, Active, Temporarily Paused, Completed, Archived
  startDate: text('start_date').notNull(),
  endDate: text('end_date').default(''),
  partnerOrgNames: text('partner_org_names').default(''),
  participationSteps: text('participation_steps').notNull(),
  heroImageUrl: text('hero_image_url').default(''),
  isDemonstration: boolean('is_demonstration').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// 11. Events & Activities
export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  objectives: text('objectives').notNull(),
  category: text('category').notNull(), // Conferences, Forums and dialogues, Consultations, Workshops and training, etc.
  format: text('format').notNull(), // Online, In-person, Hybrid
  startAt: text('start_at').notNull(),
  endAt: text('end_at').notNull(),
  venueOrLink: text('venue_or_link').notNull(),
  organizer: text('organizer').notNull(),
  participatingOrgs: text('participating_orgs').default(''),
  registrationRequirements: text('registration_requirements').default('Open to registered participants'),
  registrationDeadline: text('registration_deadline').notNull(),
  capacity: integer('capacity').notNull().default(150),
  contactPerson: text('contact_person').notNull(),
  posterUrl: text('poster_url').default(''),
  resourcesText: text('resources_text').default(''),
  status: text('status').notNull().default('Upcoming'), // Upcoming, Ongoing, Past, Cancelled
  postEventReport: text('post_event_report').default(''),
  mobilizationId: integer('mobilization_id'),
  projectId: integer('project_id'),
  organizationId: integer('organization_id'),
  isDemonstration: boolean('is_demonstration').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// 12. Event Registrations
export const eventRegistrations = pgTable('event_registrations', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id')
    .references(() => events.id, { onDelete: 'cascade' })
    .notNull(),
  registrationType: text('registration_type').notNull().default('Individual'), // Individual, Organizational Delegation, Partner Organization
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').default(''),
  organizationName: text('organization_name').default(''),
  delegationSize: integer('delegation_size').notNull().default(1),
  qrToken: text('qr_token').notNull().unique(),
  status: text('status').notNull().default('Confirmed'), // Pending, Confirmed, Cancelled
  attended: boolean('attended').notNull().default(false),
  attendedAt: text('attended_at'),
  registeredAt: timestamp('registered_at').defaultNow(),
});

// 13. Citizen Isanguni Categories
export const citizenCategories = pgTable('citizen_categories', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  isActive: boolean('is_active').notNull().default(true),
});

// 14. Citizen Isanguni Submissions (Strictly Restricted)
export const citizenSubmissions = pgTable('citizen_submissions', {
  id: serial('id').primaryKey(),
  referenceNumber: text('reference_number').notNull().unique(),
  accessCodeHash: text('access_code_hash').notNull(),
  subject: text('subject').notNull(),
  categorySlug: text('category_slug').notNull(),
  location: text('location').notNull(),
  incidentDate: text('incident_date').notNull(),
  description: text('description').notNull(),
  involvedParties: text('involved_parties').default(''),
  whyItMatters: text('why_it_matters').notNull(),
  requestedAction: text('requested_action').notNull(),
  privacyMode: text('privacy_mode').notNull().default('confidential'), // identified, confidential, anonymous
  reporterName: text('reporter_name').default(''),
  reporterEmail: text('reporter_email').default(''),
  reporterPhone: text('reporter_phone').default(''),
  preferredContact: text('preferred_contact').default('portal'),
  consentForReferral: boolean('consent_for_referral').notNull().default(false),
  status: text('status').notNull().default('RECEIVED'), // RECEIVED, INITIAL SCREENING, UNDER REVIEW, FOR CLARIFICATION, FOR REFERRAL, ACTION INITIATED, RESOLVED / ADDRESSED, CLOSED, OUT OF SCOPE
  priority: text('priority').notNull().default('Standard'), // Urgent Safety Notice, High, Standard
  assignedOfficerUid: text('assigned_officer_uid'),
  assignedOfficerName: text('assigned_officer_name').default(''),
  reporterFeedback: text('reporter_feedback').default(''),
  reporterRating: integer('reporter_rating'),
  isDemonstration: boolean('is_demonstration').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 15. Citizen Isanguni Attachments (Stored outside public webroot)
export const citizenAttachments = pgTable('citizen_attachments', {
  id: serial('id').primaryKey(),
  submissionId: integer('submission_id')
    .references(() => citizenSubmissions.id, { onDelete: 'cascade' })
    .notNull(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSize: integer('file_size').notNull(),
  storagePath: text('storage_path').notNull(),
  uploadedByRole: text('uploaded_by_role').notNull().default('reporter'), // reporter, officer
  createdAt: timestamp('created_at').defaultNow(),
});

// 16. Citizen Case Updates & Internal Notes (Chronological Log)
export const citizenCaseUpdates = pgTable('citizen_case_updates', {
  id: serial('id').primaryKey(),
  submissionId: integer('submission_id')
    .references(() => citizenSubmissions.id, { onDelete: 'cascade' })
    .notNull(),
  authorRole: text('author_role').notNull(), // system, officer, reporter
  authorName: text('author_name').notNull(),
  updateType: text('update_type').notNull(), // status_change, internal_note, clarification_request, reporter_reply, action_taken, referral_notice
  message: text('message').notNull(),
  previousStatus: text('previous_status'),
  newStatus: text('new_status'),
  isPublicToReporter: boolean('is_public_to_reporter').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// 17. Referrals
export const referrals = pgTable('referrals', {
  id: serial('id').primaryKey(),
  submissionId: integer('submission_id')
    .references(() => citizenSubmissions.id, { onDelete: 'cascade' })
    .notNull(),
  targetOrganizationId: integer('target_organization_id').references(() => organizations.id, {
    onDelete: 'set null',
  }),
  targetInstitutionName: text('target_institution_name').notNull(),
  referralReason: text('referral_reason').notNull(),
  consentConfirmed: boolean('consent_confirmed').notNull().default(false),
  status: text('status').notNull().default('Recommended'), // Recommended, Transmitted, Acknowledged, Completed
  acknowledgmentNotes: text('acknowledgment_notes').default(''),
  createdByUid: text('created_by_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 18. Announcements (Public & Partner Internal Circulars/Memoranda)
export const announcements = pgTable('announcements', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  audience: text('audience').notNull().default('public'), // public, partners
  category: text('category').notNull().default('Official Notice'), // Official Notice, Secretariat Circular, Memorandum, Call for Partnership
  isPinned: boolean('is_pinned').notNull().default(false),
  publishedAt: text('published_at').notNull(),
  authorName: text('author_name').notNull().default('INDEPENDENTE Secretariat'),
  isDemonstration: boolean('is_demonstration').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// 19. Documents (Shared Network & Partner Document Center)
export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  category: text('category').notNull(), // Partnership Agreement, Memorandum of Understanding, Organizational Guidelines, Official Template, Shared Publication
  description: text('description').notNull(),
  accessLevel: text('access_level').notNull().default('partners'), // public, partners, organization_only, admin_only
  organizationId: integer('organization_id').references(() => organizations.id, {
    onDelete: 'cascade',
  }),
  fileUrl: text('file_url').notNull(),
  uploadedByUid: text('uploaded_by_uid').default('system'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 20. Partner Collaborative Activities & Accomplishment Reports
export const partnerActivities = pgTable('partner_activities', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  activityType: text('activity_type').notNull(), // Proposed Collaborative Activity, Completed Activity Report, Joint Project
  description: text('description').notNull(),
  activityDate: text('activity_date').notNull(),
  accomplishmentSummary: text('accomplishment_summary').default(''),
  photoUrl: text('photo_url').default(''),
  status: text('status').notNull().default('Submitted'), // Submitted, Approved, Ongoing, Completed
  createdAt: timestamp('created_at').defaultNow(),
});

// 21. Partner Inquiries & Secretariat Coordination
export const partnerInquiries = pgTable('partner_inquiries', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  senderEmail: text('sender_email').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('Open'), // Open, In Progress, Responded, Closed
  secretariatReply: text('secretariat_reply').default(''),
  repliedByUid: text('replied_by_uid'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 22. Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  recipientType: text('recipient_type').notNull(), // admin, partner, public_user
  recipientUid: text('recipient_uid'),
  organizationId: integer('organization_id'),
  title: text('title').notNull(),
  message: text('message').notNull(),
  linkPath: text('link_path').default('/'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// 23. Contact Messages
export const contactMessages = pgTable('contact_messages', {
  id: serial('id').primaryKey(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('New'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 24. Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorUid: text('actor_uid').notNull(),
  actorEmail: text('actor_email').notNull(),
  actorRole: text('actor_role').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  details: text('details').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

// 25. System Settings
export const systemSettings = pgTable('system_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  description: text('description').default(''),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  representatives: many(organizationRepresentatives),
  agreements: many(partnershipAgreements),
  activities: many(partnerActivities),
  inquiries: many(partnerInquiries),
}));

export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
}));

export const advocacyAreasRelations = relations(advocacyAreas, ({ many }) => ({
  campaigns: many(campaigns),
}));

export const campaignsRelations = relations(campaigns, ({ one }) => ({
  advocacyArea: one(advocacyAreas, {
    fields: [campaigns.advocacyAreaId],
    references: [advocacyAreas.id],
  }),
}));

export const eventsRelations = relations(events, ({ many }) => ({
  registrations: many(eventRegistrations),
}));

export const eventRegistrationsRelations = relations(eventRegistrations, ({ one }) => ({
  event: one(events, {
    fields: [eventRegistrations.eventId],
    references: [events.id],
  }),
}));

export const citizenSubmissionsRelations = relations(citizenSubmissions, ({ many }) => ({
  attachments: many(citizenAttachments),
  updates: many(citizenCaseUpdates),
  referrals: many(referrals),
}));

export const citizenAttachmentsRelations = relations(citizenAttachments, ({ one }) => ({
  submission: one(citizenSubmissions, {
    fields: [citizenAttachments.submissionId],
    references: [citizenSubmissions.id],
  }),
}));

export const citizenCaseUpdatesRelations = relations(citizenCaseUpdates, ({ one }) => ({
  submission: one(citizenSubmissions, {
    fields: [citizenCaseUpdates.submissionId],
    references: [citizenSubmissions.id],
  }),
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  submission: one(citizenSubmissions, {
    fields: [referrals.submissionId],
    references: [citizenSubmissions.id],
  }),
}));

// ==================== EXPANSION TABLES: PART II-VIII ====================

// 26. Registered Independent Media Publications (Outlets / Newsrooms)
export const mediaOutlets = pgTable('media_outlets', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  abbreviation: text('abbreviation').notNull(),
  logoUrl: text('logo_url').default(''),
  coverImageUrl: text('cover_image_url').default(''),
  description: text('description').notNull(),
  editorialMission: text('editorial_mission').notNull(),
  category: text('category').notNull(), // National Civic News, Investigative & Policy, Campus & Youth Press, Community & Grassroots
  primaryAudience: text('primary_audience').notNull(),
  editorialContact: text('editorial_contact').notNull(),
  socialLinks: text('social_links').default(''),
  adminUid: text('admin_uid').default(''),
  adminEmail: text('admin_email').default(''),
  status: text('status').notNull().default('Active'), // Active, Editorial Review, Suspended, Archived
  isDemonstration: boolean('is_demonstration').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 27. Publication Editorial Team Memberships (Strict Outlet Isolation)
export const mediaOutletMembers = pgTable('media_outlet_members', {
  id: serial('id').primaryKey(),
  outletId: integer('outlet_id')
    .references(() => mediaOutlets.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  uid: text('uid').default(''),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  editorialRole: text('editorial_role').notNull().default('Staff Writer'), // Publication Administrator, Editor-in-Chief, Managing Editor, Staff Writer, Fact-checker, Contributor
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// 28. Cross-Publication Editorial Collaborations & Co-Publishing
export const editorialCollaborations = pgTable('editorial_collaborations', {
  id: serial('id').primaryKey(),
  publicationId: integer('publication_id')
    .references(() => publications.id, { onDelete: 'cascade' })
    .notNull(),
  leadOutletId: integer('lead_outlet_id')
    .references(() => mediaOutlets.id, { onDelete: 'cascade' })
    .notNull(),
  partnerOutletId: integer('partner_outlet_id')
    .references(() => mediaOutlets.id, { onDelete: 'cascade' })
    .notNull(),
  proposedByUid: text('proposed_by_uid').notNull(),
  collaborationNote: text('collaboration_note').default(''),
  status: text('status').notNull().default('Proposed'), // Proposed, Accepted, Declined, Published
  createdAt: timestamp('created_at').defaultNow(),
});

// 29. Mobilizations (Advocacy & Civic Mobilization Initiatives)
export const mobilizations = pgTable('mobilizations', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  advocacyAreaId: integer('advocacy_area_id').references(() => advocacyAreas.id, {
    onDelete: 'set null',
  }),
  description: text('description').notNull(),
  objectives: text('objectives').notNull(),
  targetAudience: text('target_audience').notNull(),
  geographicScope: text('geographic_scope').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').default(''),
  participationType: text('participation_type').notNull(), // Volunteers, Consultation, Civic Action, Community Brigades, Campus Chapter
  supportType: text('support_type').notNull().default('Independent Initiative'), // INDEPENDENTE Supported, Independent Initiative
  proposedByUid: text('proposed_by_uid').default(''),
  proposedByName: text('proposed_by_name').notNull(),
  proposedByEmail: text('proposed_by_email').notNull(),
  organizationId: integer('organization_id').references(() => organizations.id, {
    onDelete: 'set null',
  }),
  status: text('status').notNull().default('Submitted'), // Draft, Submitted, Initial Review, Verification, Approved, Returned for Revision, Declined, Active, Completed, Archived
  reviewNotes: text('review_notes').default(''),
  heroImageUrl: text('hero_image_url').default('/src/assets/images/hero_civic_assembly_1795044498184.jpg'),
  isDemonstration: boolean('is_demonstration').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 30. Mobilization Organizers, Volunteers & Participants
export const mobilizationMembers = pgTable('mobilization_members', {
  id: serial('id').primaryKey(),
  mobilizationId: integer('mobilization_id')
    .references(() => mobilizations.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  uid: text('uid').default(''),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').default(''),
  role: text('role').notNull().default('Volunteer'), // Organizer, Coordinator, Volunteer, Participant
  skillsOrInterest: text('skills_or_interest').default(''),
  status: text('status').notNull().default('Pending'), // Pending, Approved, Declined
  createdAt: timestamp('created_at').defaultNow(),
});

// 31. Mobilization Private Workspace Tasks
export const mobilizationTasks = pgTable('mobilization_tasks', {
  id: serial('id').primaryKey(),
  mobilizationId: integer('mobilization_id')
    .references(() => mobilizations.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  description: text('description').default(''),
  assignedTo: text('assigned_to').default('Unassigned'),
  dueDate: text('due_date').default(''),
  status: text('status').notNull().default('Pending'), // Pending, In Progress, Completed
  createdByUid: text('created_by_uid').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

// 32. Mobilization Announcements, Milestones & Accomplishment Reports
export const mobilizationUpdates = pgTable('mobilization_updates', {
  id: serial('id').primaryKey(),
  mobilizationId: integer('mobilization_id')
    .references(() => mobilizations.id, { onDelete: 'cascade' })
    .notNull(),
  authorUid: text('author_uid').default(''),
  authorName: text('author_name').notNull(),
  updateType: text('update_type').notNull().default('Progress Report'), // Announcement, Progress Report, Accomplishment Report, Calendar Milestone, Document
  title: text('title').notNull(),
  content: text('content').notNull(),
  documentUrl: text('document_url').default(''),
  eventDate: text('event_date').default(''),
  isPublic: boolean('is_public').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// 33. Establish an Organization Applications (OP-03 Organizing Operations)
export const organizationApplications = pgTable('organization_applications', {
  id: serial('id').primaryKey(),
  referenceCode: text('reference_code').notNull().unique(),
  organizationName: text('organization_name').notNull(),
  orgType: text('org_type').notNull(),
  location: text('location').notNull(),
  description: text('description').notNull(),
  mission: text('mission').notNull(),
  vision: text('vision').notNull(),
  objectives: text('objectives').notNull(),
  proposedPrograms: text('proposed_programs').notNull(),
  advocacyInterests: text('advocacy_interests').notNull(),
  orgStructure: text('org_structure').notNull(),
  membershipRequirements: text('membership_requirements').notNull(),
  founderUid: text('founder_uid').default(''),
  founderName: text('founder_name').notNull(),
  founderEmail: text('founder_email').notNull(),
  founderContact: text('founder_contact').notNull(),
  supportingDocUrl: text('supporting_doc_url').default(''),
  status: text('status').notNull().default('Submitted'), // Draft, Submitted, Initial Screening, Verification, Approved, Returned, Declined, Organization Onboarding
  reviewNotes: text('review_notes').default(''),
  approvedOrganizationId: integer('approved_organization_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 34. Organization Memberships & Internal Roles (Isolated per Organization)
export const organizationMembers = pgTable('organization_members', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  uid: text('uid').default(''),
  email: text('email').notNull(),
  fullName: text('full_name').notNull(),
  orgRole: text('org_role').notNull().default('Ordinary Member'), // Organization Administrator, President / Chairperson, Secretary, Treasurer, Communications Officer, Program Coordinator, Ordinary Member
  titleOrCommittee: text('title_or_committee').default('General Member'),
  status: text('status').notNull().default('Active'), // Active, Suspended
  joinedAt: timestamp('joined_at').defaultNow(),
});

// 35. Applications to Join an Existing Organization
export const membershipApplications = pgTable('membership_applications', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  applicantUid: text('applicant_uid').default(''),
  applicantName: text('applicant_name').notNull(),
  applicantEmail: text('applicant_email').notNull(),
  applicantPhone: text('applicant_phone').default(''),
  motivation: text('motivation').notNull(),
  skillsOrInterests: text('skills_or_interests').default(''),
  status: text('status').notNull().default('Submitted'), // Submitted, Under Review, Approved, Declined
  reviewNotes: text('review_notes').default(''),
  reviewedByUid: text('reviewed_by_uid').default(''),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 36. Internal Organization Announcements, Calendar, Projects & Accomplishment Reports
export const organizationAnnouncements = pgTable('organization_announcements', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  category: text('category').notNull().default('Internal Announcement'), // Internal Announcement, Calendar Item, Activity / Project, Document Notice, Accomplishment Report
  eventDate: text('event_date').default(''),
  documentUrl: text('document_url').default(''),
  authorUid: text('author_uid').default(''),
  authorName: text('author_name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 37. Inter-Entity Collaboration Requests
export const collaborationRequests = pgTable('collaboration_requests', {
  id: serial('id').primaryKey(),
  referenceCode: text('reference_code').notNull().unique(),
  senderType: text('sender_type').notNull(), // organization, publication, mobilization, user
  senderEntityId: integer('sender_entity_id').notNull(),
  senderName: text('sender_name').notNull(),
  senderUid: text('sender_uid').default(''),
  recipientType: text('recipient_type').notNull(), // organization, publication, mobilization
  recipientEntityId: integer('recipient_entity_id').notNull(),
  recipientName: text('recipient_name').notNull(),
  title: text('title').notNull(),
  purpose: text('purpose').notNull(),
  proposedScope: text('proposed_scope').notNull(),
  timeline: text('timeline').notNull(),
  status: text('status').notNull().default('Request Submitted'), // Request Submitted, Recipient Review, Accepted, Declined, Coordination, Active Collaboration, Completed
  responseNotes: text('response_notes').default(''),
  projectId: integer('project_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 38. Shared Collaborative Project Workspaces
export const collaborativeProjects = pgTable('collaborative_projects', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  objectives: text('objectives').notNull(),
  advocacyArea: text('advocacy_area').notNull(),
  geographicScope: text('geographic_scope').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').default(''),
  status: text('status').notNull().default('Active Collaboration'), // Planning, Active Collaboration, Completed, Archived
  leadEntityType: text('lead_entity_type').notNull(),
  leadEntityId: integer('lead_entity_id').notNull(),
  leadEntityName: text('lead_entity_name').notNull(),
  createdByUid: text('created_by_uid').default(''),
  isDemonstration: boolean('is_demonstration').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 39. Shared Project Participants
export const projectParticipants = pgTable('project_participants', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .references(() => collaborativeProjects.id, { onDelete: 'cascade' })
    .notNull(),
  entityType: text('entity_type').notNull(), // organization, publication, mobilization, user
  entityId: integer('entity_id').notNull(),
  entityName: text('entity_name').notNull(),
  role: text('role').notNull().default('Co-Organizer'), // Lead, Co-Organizer, Media Partner, Contributor
  joinedAt: timestamp('joined_at').defaultNow(),
});

// 40. Shared Project Tasks
export const projectTasks = pgTable('project_tasks', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .references(() => collaborativeProjects.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  assignedEntity: text('assigned_entity').default('Joint Team'),
  dueDate: text('due_date').default(''),
  status: text('status').notNull().default('Open'), // Open, In Progress, Completed
  createdAt: timestamp('created_at').defaultNow(),
});

// 41. Shared Project Reports & Announcements
export const projectReports = pgTable('project_reports', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .references(() => collaborativeProjects.id, { onDelete: 'cascade' })
    .notNull(),
  authorName: text('author_name').notNull(),
  reportType: text('report_type').notNull().default('Progress Update'), // Progress Update, Accomplishment Report, Shared Announcement
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 42. Shared Project Collaborative Documents & Archive
export const projectDocuments = pgTable('project_documents', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .references(() => collaborativeProjects.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  category: text('category').notNull().default('Policy Brief'), // Policy Brief, Joint Charter / MOU, Meeting Minutes, Research Appendix, Accomplishment Evidence, Press Statement
  description: text('description').default(''),
  fileUrl: text('file_url').notNull(),
  fileName: text('file_name').default(''),
  uploadedByOrg: text('uploaded_by_org').default('Joint Working Group'),
  uploadedByName: text('uploaded_by_name').notNull(),
  uploadedByUid: text('uploaded_by_uid').default(''),
  status: text('status').notNull().default('Active'), // Active, Archived
  archivedAt: timestamp('archived_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 43. Organization Internal Group Chat Messages
export const internalChatMessages = pgTable('internal_chat_messages', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  channel: text('channel').notNull().default('general'), // general, coordination, officers, announcements-discussion
  senderUid: text('sender_uid').default(''),
  senderName: text('sender_name').notNull(),
  senderRole: text('sender_role').default('Member'),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
