export type PageRoute =
  | 'home'
  | 'media'
  | 'advocacy'
  | 'network'
  | 'events'
  | 'partner-portal'
  | 'operations'
  | 'workspace'
  | 'isanguni'
  | 'about'
  | 'contact'
  | 'admin';

export interface PublicationCategory {
  id: number;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
}

export interface MediaOutlet {
  id: number;
  slug: string;
  name: string;
  abbreviation: string;
  logoUrl: string;
  coverImageUrl: string;
  description: string;
  editorialMission: string;
  category: string;
  primaryAudience: string;
  editorialContact: string;
  socialLinks: string;
  adminEmail?: string;
  status: string;
  isDemonstration: boolean;
  publishedCount?: number;
  totalReads?: number;
  teamCount?: number;
}

export interface Publication {
  id: number;
  slug: string;
  title: string;
  subheadline: string;
  categorySlug: string;
  authorName: string;
  authorRole: string;
  featuredImageUrl: string;
  bodyMarkdown: string;
  referencesText: string;
  tags: string;
  status: string;
  publishedAt: string | null;
  scheduledFor?: string | null;
  correctionNote?: string;
  viewCount: number;
  isFeatured: boolean;
  isDemonstration: boolean;
  outletId?: number | null;
  coOutletId?: number | null;
  outletName?: string;
  outletSlug?: string | null;
  outletAbbreviation?: string | null;
  coOutletName?: string | null;
  coOutletSlug?: string | null;
  related?: Publication[];
}

export interface AdvocacyArea {
  id: number;
  slug: string;
  title: string;
  summary: string;
  backgroundRationale: string;
  identifiedConcern: string;
  objectives: string;
  guidingPrinciples: string;
  interventions: string;
  citizenParticipation: string;
  campaignMaterialsUrl?: string;
  heroImageUrl?: string;
  isDemonstration: boolean;
}

export interface Campaign {
  id: number;
  slug: string;
  advocacyAreaId: number;
  title: string;
  summary: string;
  objectives: string;
  status: string;
  startDate: string;
  endDate?: string;
  partnerOrgNames?: string;
  participationSteps: string;
  heroImageUrl?: string;
  isDemonstration: boolean;
}

export interface Mobilization {
  id: number;
  slug: string;
  title: string;
  advocacyAreaId?: number | null;
  description: string;
  objectives: string;
  targetAudience: string;
  geographicScope: string;
  startDate: string;
  endDate?: string;
  participationType: string;
  supportType: string;
  proposedByName: string;
  organizationId?: number | null;
  status: string;
  reviewNotes?: string;
  heroImageUrl?: string;
  isDemonstration: boolean;
  participantCount?: number;
}

export interface Organization {
  id: number;
  slug: string;
  name: string;
  orgType: string;
  description: string;
  mission: string;
  vision: string;
  advocacyInterests: string;
  geographicCoverage: string;
  officialRepresentative: string;
  officialEmail?: string;
  contactNumber?: string;
  website?: string;
  socialLinks?: string;
  logoUrl?: string;
  partnershipDate: string;
  partnershipStatus: string;
  affiliationStatus?: string;
  objectives?: string;
  proposedPrograms?: string;
  orgStructure?: string;
  membershipRequirements?: string;
  acceptingMembers?: boolean;
  memberCount?: number;
  isFeatured?: boolean;
  isDemonstration: boolean;
}

export interface CollaboratorCandidate {
  entityType: 'organization' | 'publication' | 'mobilization';
  entityId: number;
  slug: string;
  name: string;
  badge: string;
  focus: string;
  location: string;
  summary: string;
  matchScore: number;
}

export interface CollaborationRequest {
  id: number;
  referenceCode: string;
  senderType: string;
  senderEntityId: number;
  senderName: string;
  recipientType: string;
  recipientEntityId: number;
  recipientName: string;
  title: string;
  purpose: string;
  proposedScope: string;
  timeline: string;
  status: string;
  responseNotes?: string;
  projectId?: number | null;
  createdAt: string;
}

export interface CollaborativeProject {
  id: number;
  slug: string;
  title: string;
  summary: string;
  objectives: string;
  advocacyArea: string;
  geographicScope: string;
  startDate: string;
  endDate?: string;
  status: string;
  leadEntityType: string;
  leadEntityId: number;
  leadEntityName: string;
  isDemonstration: boolean;
}

export interface ProjectDocument {
  id: number;
  projectId: number;
  title: string;
  category: string;
  description: string;
  fileUrl: string;
  fileName: string;
  uploadedByOrg: string;
  uploadedByName: string;
  status: 'Active' | 'Archived' | string;
  archivedAt?: string | null;
  createdAt: string;
}

export interface SharedProjectSummary extends CollaborativeProject {
  participantCount: number;
  totalTasks: number;
  completedTasks: number;
  openTasks: number;
  activeDocuments: number;
  archivedDocuments: number;
  accessRole: string;
}

export interface OrganizationAnnouncement {
  id: number;
  organizationId: number;
  title: string;
  body: string;
  category: string;
  eventDate?: string;
  documentUrl?: string;
  authorUid?: string;
  authorName: string;
  createdAt: string;
}

export interface InternalChatMessage {
  id: number;
  organizationId: number;
  channel: string;
  senderUid: string;
  senderName: string;
  senderRole: string;
  message: string;
  createdAt: string;
}

export interface NetworkEvent {
  id: number;
  slug: string;
  title: string;
  description: string;
  objectives: string;
  category: string;
  format: string;
  startAt: string;
  endAt: string;
  venueOrLink: string;
  organizer: string;
  participatingOrgs?: string;
  registrationRequirements?: string;
  registrationDeadline: string;
  capacity: number;
  contactPerson: string;
  posterUrl?: string;
  resourcesText?: string;
  status: string;
  postEventReport?: string;
  mobilizationId?: number | null;
  projectId?: number | null;
  organizationId?: number | null;
  registeredSeats?: number;
  availableSlots?: number;
  isDemonstration: boolean;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  audience: string;
  category: string;
  isPinned: boolean;
  publishedAt: string;
  authorName: string;
  isDemonstration: boolean;
}

export interface CitizenCategory {
  id: number;
  slug: string;
  name: string;
  description: string;
}

export interface NetworkDocument {
  id: number;
  title: string;
  category: string;
  description: string;
  accessLevel: string;
  fileUrl: string;
}

export interface BootstrapData {
  publicationCategories: PublicationCategory[];
  citizenCategories: CitizenCategory[];
  advocacyAreas: AdvocacyArea[];
  announcements: Announcement[];
  publicDocuments: NetworkDocument[];
  settings: Record<string, string>;
}
