import { count, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  advocacyAreas,
  announcements,
  campaigns,
  citizenCaseUpdates,
  citizenCategories,
  citizenSubmissions,
  collaborationRequests,
  collaborativeProjects,
  documents,
  editorialCollaborations,
  events,
  internalChatMessages,
  mediaOutletMembers,
  mediaOutlets,
  membershipApplications,
  mobilizationMembers,
  mobilizationTasks,
  mobilizationUpdates,
  mobilizations,
  organizationAnnouncements,
  organizationMembers,
  organizationRepresentatives,
  organizations,
  partnerActivities,
  partnershipAgreements,
  projectDocuments,
  projectParticipants,
  projectReports,
  projectTasks,
  publicationCategories,
  publications,
  roles,
  systemSettings,
  users,
} from './schema.ts';
import { hashAccessCode, hashPassword } from '../lib/auth-crypto.ts';

let seedPromise: Promise<void> | null = null;
let seeded = false;

export async function ensureSeedData(): Promise<void> {
  if (seeded) return;
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    try {
      const [{ value: roleCount }] = await db.select({ value: count() }).from(roles);
      if (roleCount > 0) {
        await ensureExpansionSeedData();
        seeded = true;
        return;
      }

      // 1. Roles
      await db
        .insert(roles)
        .values([
          {
            slug: 'super_admin',
            name: 'Super Administrator',
            description: 'Complete application control, system settings, and RBAC governance.',
            permissionsJson: JSON.stringify(['*']),
          },
          {
            slug: 'secretariat_admin',
            name: 'Secretariat Administrator',
            description: 'Network-wide organizational administration, documents, and announcements.',
            permissionsJson: JSON.stringify([
              'admin.overview',
              'publications.manage',
              'advocacy.manage',
              'partners.manage',
              'events.manage',
              'documents.manage',
              'analytics.view',
            ]),
          },
          {
            slug: 'executive_committee',
            name: 'Executive Committee',
            description: 'Authorized network oversight, strategic reports, and policy governance.',
            permissionsJson: JSON.stringify(['admin.overview', 'analytics.view', 'partners.review']),
          },
          {
            slug: 'editor_in_chief',
            name: 'Editor-in-Chief',
            description: 'Publication approval, editorial scheduling, and correction notices.',
            permissionsJson: JSON.stringify(['admin.overview', 'publications.manage', 'publications.publish']),
          },
          {
            slug: 'editorial_staff',
            name: 'Editorial Staff',
            description: 'Content creation, editing, and fact-check submission.',
            permissionsJson: JSON.stringify(['publications.create', 'publications.edit']),
          },
          {
            slug: 'advocacy_coordinator',
            name: 'Advocacy Coordinator',
            description: 'Advocacy areas and campaign management.',
            permissionsJson: JSON.stringify(['admin.overview', 'advocacy.manage']),
          },
          {
            slug: 'partnership_coordinator',
            name: 'Partnership Coordinator',
            description: 'Partner applications review and organizational coordination.',
            permissionsJson: JSON.stringify(['admin.overview', 'partners.manage']),
          },
          {
            slug: 'events_coordinator',
            name: 'Events Coordinator',
            description: 'Event creation, participant approval, and QR attendance.',
            permissionsJson: JSON.stringify(['admin.overview', 'events.manage']),
          },
          {
            slug: 'citizen_affairs_officer',
            name: 'Citizen Affairs Officer',
            description: 'Restricted access to assigned Citizen Isanguni cases, screening, and referrals.',
            permissionsJson: JSON.stringify(['admin.overview', 'isanguni.manage', 'isanguni.refer']),
          },
          {
            slug: 'partner_admin',
            name: 'Partner Organization Administrator',
            description: 'Manages own partner organization profile, representatives, and submissions.',
            permissionsJson: JSON.stringify(['partner.portal', 'partner.manage_reps']),
          },
          {
            slug: 'partner_rep',
            name: 'Partner Representative',
            description: 'Authorized partner organization access to circulars, events, and activities.',
            permissionsJson: JSON.stringify(['partner.portal']),
          },
          {
            slug: 'public_visitor',
            name: 'Public Visitor',
            description: 'Standard public website and Citizen Isanguni submission access.',
            permissionsJson: JSON.stringify(['public.read', 'isanguni.submit']),
          },
        ])
        .onConflictDoNothing();

      // 2. Publication Categories
      await db
        .insert(publicationCategories)
        .values([
          { slug: 'news', name: 'News', description: 'Current developments, public affairs, and community news.', sortOrder: 1 },
          { slug: 'investigative-reports', name: 'Investigative Reports', description: 'Document-based reporting and examinations of public-interest issues.', sortOrder: 2 },
          { slug: 'features', name: 'Features', description: 'Human-interest stories, community profiles, and significant developments.', sortOrder: 3 },
          { slug: 'opinion-editorial', name: 'Opinion & Editorial', description: 'Opinions, commentaries, and editorial perspectives.', sortOrder: 4 },
          { slug: 'press-releases', name: 'Press Releases', description: 'Official organizational statements and announcements.', sortOrder: 5 },
          { slug: 'research-policy', name: 'Research & Policy', description: 'Research papers, policy briefs, studies, and analytical reports.', sortOrder: 6 },
          { slug: 'advocacy-publications', name: 'Advocacy Publications', description: 'Campaign materials, explainers, and information resources.', sortOrder: 7 },
          { slug: 'community-reports', name: 'Community Reports', description: 'Local issues, grassroots initiatives, and citizen perspectives.', sortOrder: 8 },
        ])
        .onConflictDoNothing();

      // 3. Citizen Isanguni Categories
      await db
        .insert(citizenCategories)
        .values([
          { slug: 'public-service', name: 'Public Service Concerns', description: 'Delays, accessibility, or quality of frontline public services.' },
          { slug: 'governance-accountability', name: 'Governance and Accountability', description: 'Transparency, procurement, budget disclosure, and public ethics.' },
          { slug: 'community-problems', name: 'Community Problems', description: 'Local infrastructure, drainage, sanitation, and neighborhood safety.' },
          { slug: 'education-student', name: 'Education and Student Concerns', description: 'School facilities, academic freedom, and student welfare matters.' },
          { slug: 'human-rights', name: 'Human Rights and Civil Liberties', description: 'Due process, free expression, and protection of civic space.' },
          { slug: 'environmental-issues', name: 'Environmental Issues', description: 'Watershed degradation, waste management, and coastal protection.' },
          { slug: 'social-welfare', name: 'Social Welfare and Community Needs', description: 'Healthcare access, food security, and vulnerable sector support.' },
          { slug: 'youth-sectoral', name: 'Youth and Sectoral Concerns', description: 'Youth participation, labor welfare, and sectoral representation.' },
          { slug: 'institutional-complaints', name: 'Institutional Complaints', description: 'Procedural grievances involving public or private institutions.' },
          { slug: 'recommendations-policy', name: 'Recommendations and Policy Proposals', description: 'Constructive civic proposals and local ordinance ideas.' },
          { slug: 'assistance-referral', name: 'Requests for Assistance or Referral', description: 'Guidance on connecting with appropriate legal or civic partner groups.' },
          { slug: 'other-concerns', name: 'Other Concerns', description: 'Matters of public interest not listed above.' },
        ])
        .onConflictDoNothing();

      // 4. Organizations (Demonstration Partner Network)
      const insertedOrgs = await db
        .insert(organizations)
        .values([
          {
            slug: 'bantay-bayan-civic-coalition',
            name: 'Bantay Bayan Civic Transparency Coalition',
            orgType: 'Civic Coalition',
            description: 'A nonpartisan municipal budget monitoring and open-contracting citizens coalition operating across Luzon.',
            mission: 'To equip everyday citizens with plain-language public finance literacy tools and participatory audit frameworks.',
            vision: 'Local governments where every peso of public expenditure is transparent, traceable, and citizen-reviewed.',
            advocacyInterests: 'Good Governance and Accountability, Public Information and Media Literacy',
            geographicCoverage: 'National Capital Region & Central Luzon',
            address: '42 Malakas St., Diliman, Quezon City 1101',
            officialRepresentative: 'Atty. Clarissa M. Mendoza',
            officialEmail: 'secretariat@bantaybayan-demo.org',
            contactNumber: '+63 2 8412 9044',
            website: 'https://independente.org/partners/bantay-bayan',
            socialLinks: 'FB: @BantayBayanPH',
            partnershipDate: '2025-03-14',
            partnershipStatus: 'Active',
            isFeatured: true,
            isDemonstration: true,
          },
          {
            slug: 'kalikasan-watershed-guardians',
            name: 'Kalikasan Watershed Guardians Network',
            orgType: 'Community Organization',
            description: 'Community-led coastal mangrove and river basin stewardship alliance across Visayas island provinces.',
            mission: 'To protect community watersheds through citizen water-quality science and coastal zoning advocacy.',
            vision: 'Resilient Philippine coastal and riverine communities thriving alongside healthy ecosystems.',
            advocacyInterests: 'Environmental Protection and Sustainability, Community Development',
            geographicCoverage: 'Central & Western Visayas',
            address: '18 Osmena Blvd., Cebu City 6000',
            officialRepresentative: 'Engr. Mateo R. Villareal',
            officialEmail: 'desk@kalikasanwatershed-demo.org',
            contactNumber: '+63 32 418 7721',
            website: 'https://independente.org/partners/kalikasan-watershed',
            socialLinks: 'IG: @WatershedGuardians',
            partnershipDate: '2025-06-02',
            partnershipStatus: 'Active',
            isFeatured: true,
            isDemonstration: true,
          },
          {
            slug: 'kapisanan-edukasyon-sibika',
            name: 'Kapisanan ng mga Guro at Mag-aaral sa Sibika',
            orgType: 'Academic Institution',
            description: 'Educators and campus civic fellows advancing critical media literacy, academic freedom, and youth deliberative forums.',
            mission: 'To strengthen civic reasoning and nonpartisan source verification inside Philippine secondary and tertiary campuses.',
            vision: 'An educated youth constituency capable of independent judgment and constructive civic dialogue.',
            advocacyInterests: 'Education and Academic Freedom, Youth Development and Participation, Public Information and Media Literacy',
            geographicCoverage: 'Nationwide Campus Chapters',
            address: 'Taft Ave., Malate, Manila 1004',
            officialRepresentative: 'Prof. Danilo S. Pangilinan',
            officialEmail: 'council@kapisanansibika-demo.org',
            contactNumber: '+63 2 8524 3190',
            partnershipDate: '2025-08-19',
            partnershipStatus: 'Active',
            isFeatured: true,
            isDemonstration: true,
          },
          {
            slug: 'mindanao-grassroots-media-guild',
            name: 'Mindanao Grassroots Media & Community Guild',
            orgType: 'Independent Media Partner',
            description: 'Network of community radio correspondents and barangay chroniclers documenting rural public service realities.',
            mission: 'To amplify verifiable grassroots reporting from underserved municipalities across Mindanao.',
            vision: 'Equitable national discourse informed by accurate local voices.',
            advocacyInterests: 'Public Information and Media Literacy, Social Welfare and Inclusion',
            geographicCoverage: 'Davao, Bukidnon & Northern Mindanao',
            address: '89 Jacinto St., Davao City 8000',
            officialRepresentative: 'Lorna A. Macapagal',
            officialEmail: 'editors@mindanaoguild-demo.org',
            contactNumber: '+63 82 221 5580',
            website: 'https://independente.org/partners/mindanao-guild',
            socialLinks: 'X: @MindanaoGuild',
            partnershipDate: '2026-01-10',
            partnershipStatus: 'Active',
            isFeatured: true,
            isDemonstration: true,
          },
        ])
        .returning();

      const primaryOrgId = insertedOrgs[0].id;

      // Demo Partner Portal User Account (Clearly labeled as Demonstration Partner Account)
      const [demoPartnerUser] = await db
        .insert(users)
        .values({
          uid: 'partner-demo-bantay-bayan',
          email: 'partner.demo@independente.org',
          displayName: 'Clarissa M. Mendoza (Demo Partner)',
          roleSlug: 'partner_admin',
          organizationId: primaryOrgId,
          passwordHash: hashPassword('PartnerDemo2026!'),
          emailVerified: true,
          twoFactorEnabled: false,
          isActive: true,
        })
        .returning();

      await db.insert(organizationRepresentatives).values([
        {
          organizationId: primaryOrgId,
          userId: demoPartnerUser.id,
          fullName: 'Atty. Clarissa M. Mendoza',
          position: 'Executive Coordinator',
          email: 'partner.demo@independente.org',
          phone: '+63 2 8412 9044',
          partnerRole: 'Organization Administrator',
          isPrimary: true,
        },
        {
          organizationId: primaryOrgId,
          fullName: 'Marco V. Evangelista',
          position: 'Communications & Media Liaison',
          email: 'comms@bantaybayan-demo.org',
          phone: '+63 917 555 0192',
          partnerRole: 'Communications Officer',
          isPrimary: false,
        },
      ]);

      await db.insert(partnershipAgreements).values([
        {
          organizationId: primaryOrgId,
          title: 'Memorandum of Understanding on Municipal Budget Literacy & Civic Oversight',
          agreementType: 'MOU',
          effectiveDate: '2025-03-14',
          expiryDate: '2028-03-14',
          documentUrl: '/api/documents/download/charter-2026',
          status: 'Active',
        },
      ]);

      await db.insert(partnerActivities).values([
        {
          organizationId: primaryOrgId,
          title: 'Q3 Participatory Procurement Clinic in District II Barangays',
          activityType: 'Completed Activity Report',
          description: 'Conducted a 2-day workshop with 64 barangay council observers on reading Annual Investment Plans.',
          activityDate: '2026-09-22',
          accomplishmentSummary: '64 citizen observers trained; 12 public budget briefers distributed.',
          status: 'Completed',
        },
        {
          organizationId: primaryOrgId,
          title: 'Joint Civic Literacy Caravan — Central Luzon',
          activityType: 'Proposed Collaborative Activity',
          description: 'Co-hosted dialogue between local student councils and municipal budget officers.',
          activityDate: '2026-12-12',
          accomplishmentSummary: 'Scheduled for Secretariat coordination.',
          status: 'Approved',
        },
      ]);

      // 5. Advocacy Areas (10 Initial Suggested Categories)
      const insertedAdvocacies = await db
        .insert(advocacyAreas)
        .values([
          {
            slug: 'good-governance-accountability',
            title: 'Good Governance and Accountability',
            summary: 'Advancing transparent public budgeting, open contracting, and citizen-led oversight of local and national institutions.',
            backgroundRationale: 'Opaque procurement and inaccessible financial disclosures weaken public trust and limit meaningful citizen oversight.',
            identifiedConcern: 'Many barangay and municipal expenditure documents remain difficult for ordinary residents to locate, interpret, and verify.',
            objectives: 'Establish plain-language budget scorecards, support citizen audit circles, and promote open procurement data standards.',
            guidingPrinciples: 'Nonpartisan rigor, documentary verification, constructive engagement, and institutional accountability.',
            interventions: 'Open Budget Clinics, Freedom of Information request clinics, and quarterly local governance scorecards.',
            citizenParticipation: 'Join a local budget reading circle, submit public service observations via Citizen Isanguni, or request a community FOI workshop.',
            heroImageUrl: '/src/assets/images/pub_investigative_ledger_1795044497584.jpg',
            sortOrder: 1,
            isDemonstration: true,
          },
          {
            slug: 'human-rights-civil-liberties',
            title: 'Human Rights and Civil Liberties',
            summary: 'Defending due process, peaceful assembly, free expression, and dignified treatment for all citizens regardless of background.',
            backgroundRationale: 'Constitutional guarantees remain meaningful only when citizens understand their rights and have safe pathways to document concerns.',
            identifiedConcern: 'Limited awareness of due process protections and safe documentation channels at the community level.',
            objectives: 'Publish accessible legal-literacy explainers and coordinate nonpartisan referrals with accredited rights clinics.',
            guidingPrinciples: 'Universality, impartiality, privacy protection, and strict adherence to due process.',
            interventions: 'Know-Your-Rights community primers, legal aid referral pathways, and civil liberties monitoring briefs.',
            citizenParticipation: 'Attend regional civic rights forums or confidentially log civil liberty concerns through Citizen Isanguni.',
            heroImageUrl: '/src/assets/images/hero_civic_assembly_1795044498184.jpg',
            sortOrder: 2,
            isDemonstration: true,
          },
          {
            slug: 'education-academic-freedom',
            title: 'Education and Academic Freedom',
            summary: 'Supporting equitable access to quality education, campus critical inquiry, and institutional autonomy.',
            backgroundRationale: 'Independent inquiry in schools and universities forms the bedrock of an informed citizenry.',
            identifiedConcern: 'Resource gaps in public classrooms and pressures affecting independent campus journalism and faculty research.',
            objectives: 'Convene educator-student roundtables and publish empirical briefs on public education infrastructure.',
            guidingPrinciples: 'Academic independence, evidence-based policy, and student-educator co-governance.',
            interventions: 'Campus Press Independence Network, Classroom Needs Mapping, and Education Policy Dialogues.',
            citizenParticipation: 'Educators, parents, and students may submit school facility concerns or join partner campus chapters.',
            heroImageUrl: '/src/assets/images/pub_community_forum_1795044499634.jpg',
            sortOrder: 3,
            isDemonstration: true,
          },
          {
            slug: 'youth-development-participation',
            title: 'Youth Development and Participation',
            summary: 'Empowering young Filipinos to move beyond token consultation into substantive civic leadership and policy research.',
            backgroundRationale: 'Youth represent a decisive demographic yet often lack structured training in nonpartisan policy evaluation.',
            identifiedConcern: 'Fragmented civic mentoring and uneven support for Sangguniang Kabataan and community youth councils.',
            objectives: 'Mentor 500+ youth civic fellows annually in public policy drafting and community project monitoring.',
            guidingPrinciples: 'Intergenerational respect, leadership accountability, and inclusive regional representation.',
            interventions: 'Civic Fellows Incubator, Youth Budget Monitoring Fellowship, and Barangay Youth Assemblies.',
            citizenParticipation: 'Apply for regional civic workshops or volunteer as a community rapporteur.',
            heroImageUrl: '/src/assets/images/event_national_summit_1795044499688.jpg',
            sortOrder: 4,
            isDemonstration: true,
          },
          {
            slug: 'community-development',
            title: 'Community Development',
            summary: 'Strengthening barangay-level self-reliance, resilient neighborhood infrastructure, and participatory planning.',
            backgroundRationale: 'Sustainable national progress begins with well-coordinated, resilient neighborhood institutions.',
            identifiedConcern: 'Disconnect between municipal master plans and everyday neighborhood priorities such as drainage, transit, and lighting.',
            objectives: 'Facilitate structured community consultations that translate resident observations into actionable local proposals.',
            guidingPrinciples: 'Subsidiarity, asset-based community development, and transparent stakeholder collaboration.',
            interventions: 'Barangay Listening Assemblies, Community Needs Audits, and LGU-Citizen Dialogue Bridges.',
            citizenParticipation: 'Host a neighborhood consultation or document local infrastructure needs on Citizen Isanguni.',
            heroImageUrl: '/src/assets/images/pub_community_forum_1795044499634.jpg',
            sortOrder: 5,
            isDemonstration: true,
          },
          {
            slug: 'social-welfare-inclusion',
            title: 'Social Welfare and Inclusion',
            summary: 'Advocating accessible healthcare, dignified social protection, and equal civic voice for marginalized sectors.',
            backgroundRationale: 'Public policies must be evaluated by how reliably they reach senior citizens, persons with disabilities, and low-income households.',
            identifiedConcern: 'Complex documentation hurdles often exclude vulnerable families from timely social assistance.',
            objectives: 'Map frontline service bottlenecks and publish actionable inclusion audits for local service desks.',
            guidingPrinciples: 'Human dignity, accessibility, non-discrimination, and data-backed compassion.',
            interventions: 'Frontline Access Audits, PWD & Senior Civic Accessibility Reviews, and Partner Referral Desks.',
            citizenParticipation: 'Share service accessibility observations or volunteer with accredited social welfare partners.',
            heroImageUrl: '/src/assets/images/hero_civic_assembly_1795044498184.jpg',
            sortOrder: 6,
            isDemonstration: true,
          },
          {
            slug: 'environmental-protection-sustainability',
            title: 'Environmental Protection and Sustainability',
            summary: 'Promoting community watershed protection, climate resilience, and evidence-based ecological stewardship.',
            backgroundRationale: 'Coastal erosion, watershed encroachment, and waste crises directly threaten community livelihoods across the archipelago.',
            identifiedConcern: 'Weak enforcement of coastal easements and insufficient public access to environmental compliance filings.',
            objectives: 'Support citizen-science water monitoring and foster transparent environmental impact consultations.',
            guidingPrinciples: 'Intergenerational equity, scientific integrity, and community-anchored conservation.',
            interventions: 'Watershed Citizen Science Brigades, Mangrove Corridor Audits, and Climate Adaptation Briefs.',
            citizenParticipation: 'Report illegal dumping or watershed degradation with geotagged evidence via Citizen Isanguni.',
            heroImageUrl: '/src/assets/images/advocacy_green_watershed_1795044498495.jpg',
            sortOrder: 7,
            isDemonstration: true,
          },
          {
            slug: 'public-information-media-literacy',
            title: 'Public Information and Media Literacy',
            summary: 'Combating disinformation through independent verification standards, source transparency, and civic media education.',
            backgroundRationale: 'Informed civic decisions require reliable facts rather than algorithmic outrage or partisan propaganda.',
            identifiedConcern: 'Rapid circulation of unverified claims around public budgets, health advisories, and civic procedures.',
            objectives: 'Equip citizens with practical source-checking habits and publish rigorously cited public explainers.',
            guidingPrinciples: 'Editorial independence, transparent sourcing, prompt correction policy, and zero partisan alignment.',
            interventions: 'Community Fact-Checking Clinics, Newsroom Source Transparency Standards, and Media Literacy Toolkits.',
            citizenParticipation: 'Read and share verified explainers, or enroll your school or organization in a media literacy session.',
            heroImageUrl: '/src/assets/images/pub_investigative_ledger_1795044497584.jpg',
            sortOrder: 8,
            isDemonstration: true,
          },
          {
            slug: 'economic-social-justice',
            title: 'Economic and Social Justice',
            summary: 'Examining fair labor standards, micro-enterprise support, and equitable regional public investments.',
            backgroundRationale: 'Broad-based civic empowerment requires economic fairness and transparent public resource allocation across regions.',
            identifiedConcern: 'Disparities in regional infrastructure access and regulatory burdens on small cooperatives and informal workers.',
            objectives: 'Produce grounded socioeconomic research and convene multi-sector dialogues on livelihood resilience.',
            guidingPrinciples: 'Fair opportunity, empirical rigor, and constructive dialogue between workers, entrepreneurs, and policymakers.',
            interventions: 'Regional Livelihood Policy Briefs, Cooperative Governance Clinics, and Public Market Transparency Studies.',
            citizenParticipation: 'Submit sectoral policy recommendations or join regional economic roundtables.',
            heroImageUrl: '/src/assets/images/hero_civic_assembly_1795044498184.jpg',
            sortOrder: 9,
            isDemonstration: true,
          },
          {
            slug: 'democratic-participation-civic-education',
            title: 'Democratic Participation and Civic Education',
            summary: 'Cultivating year-round democratic engagement beyond election cycles through informed public deliberation.',
            backgroundRationale: 'Democracy is sustained not every three years at the ballot box, but daily through attentive, principled citizenship.',
            identifiedConcern: 'Voter and civic fatigue driven by personality-centered politics rather than issue-based accountability.',
            objectives: 'Host nonpartisan issue assemblies and publish clear voter and citizen-participation handbooks.',
            guidingPrinciples: 'Strict nonpartisanship, critical thinking, respectful disagreement, and constitutional literacy.',
            interventions: 'Town Hall Deliberation Series, Nonpartisan Issue Trackers, and Citizen Assembly Toolkits.',
            citizenParticipation: 'Attend upcoming civic dialogues, sign up for newsletters, or partner as a local host organization.',
            heroImageUrl: '/src/assets/images/event_national_summit_1795044499688.jpg',
            sortOrder: 10,
            isDemonstration: true,
          },
        ])
        .returning();

      // Campaigns
      await db.insert(campaigns).values([
        {
          slug: 'bukas-na-badyet-2026',
          advocacyAreaId: insertedAdvocacies[0].id,
          title: 'Bukas na Badyet: Barangay & Municipal Budget Literacy Drive',
          summary: 'A nationwide citizen campaign translating local Annual Investment Plans into readable one-page community briefs.',
          objectives: 'Publish plain-language budget summaries for 45 pilot municipalities and train 300 resident observers.',
          status: 'Active',
          startDate: '2026-02-01',
          endDate: '2026-12-31',
          partnerOrgNames: 'Bantay Bayan Civic Transparency Coalition, Kapisanan ng mga Guro at Mag-aaral sa Sibika',
          participationSteps: 'Download the Citizen Budget Reading Guide, attend a municipal budget briefing, and log procurement discrepancies with documents.',
          heroImageUrl: '/src/assets/images/pub_investigative_ledger_1795044497584.jpg',
          isDemonstration: true,
        },
        {
          slug: 'sagip-katubigan-coastal-watch',
          advocacyAreaId: insertedAdvocacies[6].id,
          title: 'Sagip Katubigan: Community Watershed & Mangrove Watch',
          summary: 'Citizen-science turbidity monitoring and coastal easement preservation led by Visayas partner organizations.',
          objectives: 'Establish 18 community water-testing stations and publish quarterly watershed health bulletins.',
          status: 'Active',
          startDate: '2026-04-15',
          endDate: '2027-04-15',
          partnerOrgNames: 'Kalikasan Watershed Guardians Network',
          participationSteps: 'Join monthly coastal cleanup and testing mornings or submit geotagged watershed alerts via Citizen Isanguni.',
          heroImageUrl: '/src/assets/images/advocacy_green_watershed_1795044498495.jpg',
          isDemonstration: true,
        },
        {
          slug: 'malayang-isip-media-literacy',
          advocacyAreaId: insertedAdvocacies[7].id,
          title: 'Malayang Isip: Campus & Barangay Media Verification Clinics',
          summary: 'Hands-on public workshops teaching everyday verification of official circulars, statistics, and viral claims.',
          objectives: 'Deliver 30 nonpartisan verification workshops across Luzon, Visayas, and Mindanao.',
          status: 'Planning',
          startDate: '2026-11-01',
          endDate: '2027-06-30',
          partnerOrgNames: 'Kapisanan ng mga Guro at Mag-aaral sa Sibika, Mindanao Grassroots Media & Community Guild',
          participationSteps: 'Request a workshop for your community center or school through our Partnership Portal.',
          heroImageUrl: '/src/assets/images/pub_community_forum_1795044499634.jpg',
          isDemonstration: true,
        },
      ]);

      // 6. Publications (6 Rich Demonstration Articles across Categories)
      await db.insert(publications).values([
        {
          slug: 'following-the-barangay-ledger-2026-audit',
          title: 'Following the Barangay Ledger: What 42 Municipal Procurement Notices Reveal About Local Infrastructure',
          subheadline: 'A six-month document examination highlights recurring gaps between posted project timelines and completed neighborhood works.',
          categorySlug: 'investigative-reports',
          authorName: 'INDEPENDENTE Investigative Desk',
          authorRole: 'Investigative Unit',
          featuredImageUrl: '/src/assets/images/pub_investigative_ledger_1795044497584.jpg',
          bodyMarkdown: `Across forty-two urban and peri-urban municipalities reviewed between March and September 2026, public notices posted on official procurement portals routinely complied with initial bidding publication rules—yet post-award completion records remained absent in nearly four out of ten local drainage and footbridge projects.\n\nIndependent citizen observers trained under the Bukas na Badyet initiative cross-checked publicly posted Notices of Award against physical site inspections conducted alongside neighborhood associations. In fourteen districts, projects listed as fully liquidated had either stalled at partial excavation or lacked mandatory public project signboards detailing contractor scope and completion dates.\n\n"Transparency cannot stop at uploading a PDF of a bidding invitation," notes the joint research note prepared with partner legal and accounting fellows. "Citizens need accessible tracking from budget appropriation through final engineering sign-off."\n\nFollowing formal inquiries submitted through municipal Freedom of Information desks, nine local engineering offices published updated milestone schedules and convened open inspection walkthroughs with affected residents.`,
          referencesText: '1. Municipal Procurement Transparency Disclosures (FY 2025–2026).\n2. Republic Act No. 9184 Implementing Rules and Regulations.\n3. Bantay Bayan Citizen Field Inspection Logs (Q2–Q3 2026).',
          tags: 'Good Governance, Procurement, Local Budgets, Accountability',
          status: 'published',
          publishedAt: '2026-11-12',
          viewCount: 1842,
          isFeatured: true,
          isDemonstration: true,
        },
        {
          slug: 'citizens-shaping-public-spaces-visayas-forums',
          title: 'Beyond Election Day: How Neighborhood Listening Circles Are Reshaping Local Service Priorities',
          subheadline: 'From shaded barangay courtyards to municipal budget hearings, ordinary residents are proving that sustained civic participation changes outcomes.',
          categorySlug: 'features',
          authorName: 'Elena R. Bautista',
          authorRole: 'Senior Features Writer',
          featuredImageUrl: '/src/assets/images/pub_community_forum_1795044499634.jpg',
          bodyMarkdown: `Every second Saturday morning in a shaded courtyard outside Cebu City, forty neighbors pull up plastic chairs not for a political rally, but for a structured ninety-minute review of clinic medicine stockouts, street lighting, and flood drainage grates.\n\nNo candidate banners hang on the fence. Instead, a hand-lettered Manila paper chart tracks which community concerns were raised last month, which office received the written referral, and what response arrived.\n\nParticipants say the nonpartisan format has lowered the barrier for seniors, market vendors, and college students who previously avoided partisan town halls. When citizens arrive with documented dates, photos, and shared proposals rather than personal attacks, frontline administrators are far more likely to engage constructively.`,
          referencesText: 'Field interviews conducted across three Visayas barangay listening circles, October 2026.',
          tags: 'Community Participation, Civic Forums, Visayas',
          status: 'published',
          publishedAt: '2026-11-08',
          viewCount: 1215,
          isFeatured: true,
          isDemonstration: true,
        },
        {
          slug: 'editorial-independent-minds-informed-choices',
          title: 'Editorial: Why Independent Citizenship Remains the Anchor of Democratic Resilience',
          subheadline: 'Institutions and personalities come and go; only an alert, critical-thinking public can sustain accountable governance.',
          categorySlug: 'opinion-editorial',
          authorName: 'Editorial Board',
          authorRole: 'Editor-in-Chief Desk',
          featuredImageUrl: '/src/assets/images/hero_civic_assembly_1795044498184.jpg',
          bodyMarkdown: `Ang isang bansa ay hindi lamang hinuhubog ng pamahalaan, mga personalidad sa politika, o mga institusyon. Hinuhubog din ito ng mga mamamayang mulat, mapanuri, responsable, at handang makilahok.\n\nThat founding conviction of INDEPENDENTE carries heightened urgency today. When public debate is reduced to competing loyalties around political personalities, factual scrutiny is the first casualty. Citizens are encouraged to cheer or condemn before reading a single primary document.\n\nIndependent citizenship demands a steadier discipline: verifying claims before amplifying them, distinguishing verified evidence from rumor, respecting fellow citizens across differing beliefs, and insisting on accountability regardless of who holds office.`,
          referencesText: 'INDEPENDENTE Founding Editorial Charter, Section II.',
          tags: 'Editorial, Civic Philosophy, Democracy',
          status: 'published',
          publishedAt: '2026-11-05',
          viewCount: 980,
          isFeatured: false,
          isDemonstration: true,
        },
        {
          slug: 'coastal-mangrove-easement-policy-brief-2026',
          title: 'Policy Brief: Strengthening Community Co-Management of Coastal Mangrove Buffers',
          subheadline: 'Empirical water-quality findings and legal recommendations from twelve Visayas shoreline barangays.',
          categorySlug: 'research-policy',
          authorName: 'Dr. Tomas P. Javier & Kalikasan Research Desk',
          authorRole: 'Policy Research Fellow',
          featuredImageUrl: '/src/assets/images/advocacy_green_watershed_1795044498495.jpg',
          bodyMarkdown: `Storm surge attenuation studies conducted across twelve coastal barangays confirm that intact mangrove corridors reduce wave energy by up to 62 percent during moderate monsoon swells. Yet overlapping municipal zoning clearances continue to permit encroachment along critical estuary mouths.\n\nThis policy brief outlines three immediate administrative reforms: mandatory public posting of foreshore lease applications in local barangay halls, formal recognition of citizen-science water quality logs in municipal disaster risk reviews, and dedicated annual maintenance allocations for community mangrove nurseries.`,
          referencesText: 'DENR Coastal Resource Guidelines; Kalikasan Watershed Guardians 2026 Field Dataset.',
          tags: 'Environment, Policy Brief, Mangrove Conservation',
          status: 'published',
          publishedAt: '2026-10-29',
          viewCount: 745,
          isFeatured: false,
          isDemonstration: true,
        },
        {
          slug: 'press-release-launch-of-citizen-isanguni-portal',
          title: 'Official Statement: Opening Citizen Isanguni Public Reporting & Safeguards Protocol',
          subheadline: 'INDEPENDENTE inaugurates a structured, privacy-protected public channel for community concerns, recommendations, and responsible referrals.',
          categorySlug: 'press-releases',
          authorName: 'INDEPENDENTE Secretariat',
          authorRole: 'Official Communications',
          featuredImageUrl: '/src/assets/images/event_national_summit_1795044499688.jpg',
          bodyMarkdown: `The Secretariat of INDEPENDENTE – An Independent Citizens Network formally announces the public launch of Citizen Isanguni, our structured concern, recommendation, and civic reporting portal.\n\nGuided by the Data Privacy Act of 2012 (Republic Act No. 10173), Citizen Isanguni enables any citizen—whether or not affiliated with a partner organization—to submit identified, confidential, or anonymous reports with encrypted tracking credentials.\n\nINDEPENDENTE reiterates clearly that Citizen Isanguni is an independent civic network mechanism and not a government investigative agency, law enforcement body, or emergency service. All submissions undergo structured screening, privacy verification, and consent-based referral protocols.`,
          referencesText: 'Republic Act No. 10173 (Data Privacy Act of 2012); Citizen Isanguni Operating Guidelines.',
          tags: 'Citizen Isanguni, Official Statement, Data Privacy',
          status: 'published',
          publishedAt: '2026-10-20',
          viewCount: 1410,
          isFeatured: false,
          isDemonstration: true,
        },
        {
          slug: 'community-report-rural-water-access-bukidnon',
          title: 'Community Report: Residents in Three Upland Sitios Co-Design Gravity-Fed Water Monitoring',
          subheadline: 'Local radio volunteers and farmer associations document dry-season supply interruptions and present data to the municipal council.',
          categorySlug: 'community-reports',
          authorName: 'Lorna A. Macapagal',
          authorRole: 'Community Correspondent',
          featuredImageUrl: '/src/assets/images/pub_community_forum_1795044499634.jpg',
          bodyMarkdown: `For three consecutive summers, households in three upland sitios relied on irregular water deliveries whenever hillside spring pressure dropped. Rather than issuing unverified complaints online, residents partnered with the Mindanao Grassroots Media & Community Guild to log daily flow hours across twenty-four households for sixty days.\n\nEquipped with a clear two-month table and photographs of cracked intake pipes, community representatives presented their findings at the open municipal council session, prompting an emergency repair allocation within three weeks.`,
          referencesText: 'Sitio Water Logbook Archive, September–October 2026.',
          tags: 'Community Report, Mindanao, Water Access',
          status: 'published',
          publishedAt: '2026-11-02',
          viewCount: 632,
          isFeatured: false,
          isDemonstration: true,
        },
      ]);

      // 7. Events & Activities
      await db.insert(events).values([
        {
          slug: 'national-civic-literacy-accountability-summit-2026',
          title: '2026 National Civic Literacy & Public Accountability Assembly',
          description: 'Annual multi-sector gathering of independent journalists, civic educators, partner organizations, and active citizens examining open governance and media verification.',
          objectives: 'Align 2027 regional civic literacy milestones, launch the Open Barangay Budget Toolkit, and host cross-regional partner consultations.',
          category: 'Conferences',
          format: 'Hybrid',
          startAt: '2026-12-05 09:00',
          endAt: '2026-12-05 17:00',
          venueOrLink: 'UP Bahay ng Alumni, Diliman, Quezon City & Zoom Livestream',
          organizer: 'INDEPENDENTE Secretariat & Executive Committee',
          participatingOrgs: 'Bantay Bayan Civic Transparency Coalition, Kapisanan ng mga Guro at Mag-aaral sa Sibika, Kalikasan Watershed Guardians Network',
          registrationRequirements: 'Open to individual citizens and accredited partner delegations (max 5 delegates per organization).',
          registrationDeadline: '2026-12-01',
          capacity: 250,
          contactPerson: 'Events Desk (events@independente.org)',
          posterUrl: '/src/assets/images/event_national_summit_1795044499688.jpg',
          resourcesText: 'Provisional Programme, Delegate Briefing Kit, and Nonpartisan Assembly Guidelines.',
          status: 'Upcoming',
          isDemonstration: true,
        },
        {
          slug: 'local-budget-reading-foi-workshop-luzon',
          title: 'Workshop: Reading Municipal Budgets & Filing Effective FOI Requests',
          description: 'Practical half-day clinic equipping community leaders and student researchers with step-by-step budget analysis and FOI drafting skills.',
          objectives: 'Enable every participant to locate, download, and interpret an LGU Annual Investment Plan.',
          category: 'Workshops and training',
          format: 'Online',
          startAt: '2026-11-28 14:00',
          endAt: '2026-11-28 17:30',
          venueOrLink: 'Secure Video Conference (Link sent upon confirmation)',
          organizer: 'Bantay Bayan & INDEPENDENTE Advocacy Center',
          participatingOrgs: 'Bantay Bayan Civic Transparency Coalition',
          registrationRequirements: 'Open to public participants; bring a laptop or tablet if available.',
          registrationDeadline: '2026-11-26',
          capacity: 120,
          contactPerson: 'Advocacy Training Team',
          posterUrl: '/src/assets/images/pub_investigative_ledger_1795044497584.jpg',
          resourcesText: 'FOI Request Templates & Budget Glossary PDF.',
          status: 'Upcoming',
          isDemonstration: true,
        },
        {
          slug: 'visayas-coastal-watershed-consultation',
          title: 'Visayas Citizen Consultation on Coastal Resilience & Mangrove Easements',
          description: 'Public consultation gathering fisherfolk leaders, coastal barangay representatives, and environmental researchers.',
          objectives: 'Document localized coastal erosion pressures and finalize community policy inputs for 2027.',
          category: 'Consultations',
          format: 'In-person',
          startAt: '2026-12-14 08:30',
          endAt: '2026-12-14 13:00',
          venueOrLink: 'Cebu Civic Center Hall B, Osmena Blvd., Cebu City',
          organizer: 'Kalikasan Watershed Guardians Network',
          participatingOrgs: 'Kalikasan Watershed Guardians Network',
          registrationRequirements: 'Open registration; sectoral groups encouraged to send two representatives.',
          registrationDeadline: '2026-12-10',
          capacity: 90,
          contactPerson: 'Engr. Mateo R. Villareal',
          posterUrl: '/src/assets/images/advocacy_green_watershed_1795044498495.jpg',
          resourcesText: 'Draft Mangrove Policy Brief & Consultation Discussion Guide.',
          status: 'Upcoming',
          isDemonstration: true,
        },
        {
          slug: 'mindanao-community-journalism-roundtable',
          title: 'Mindanao Community Reporting & Verification Roundtable',
          description: 'Completed regional dialogue on documentary verification standards for community correspondents.',
          objectives: 'Establish shared fact-checking checklists across 14 local community desks.',
          category: 'Forums and dialogues',
          format: 'In-person',
          startAt: '2026-10-12 09:00',
          endAt: '2026-10-12 16:00',
          venueOrLink: 'Ateneo Community Hall, Davao City',
          organizer: 'Mindanao Grassroots Media & Community Guild',
          participatingOrgs: 'Mindanao Grassroots Media & Community Guild',
          registrationRequirements: 'Completed event',
          registrationDeadline: '2026-10-08',
          capacity: 80,
          contactPerson: 'Lorna A. Macapagal',
          posterUrl: '/src/assets/images/pub_community_forum_1795044499634.jpg',
          resourcesText: 'Published Accomplishment Summary & Field Verification Checklist.',
          status: 'Past',
          postEventReport: '76 community correspondents and campus writers completed the verification practicum and adopted the 2026 Grassroots Citation Protocol.',
          isDemonstration: true,
        },
      ]);

      // 8. Announcements (Public + Partner Internal Circulars)
      await db.insert(announcements).values([
        {
          title: 'Call for Partner Organizations: 2027 Regional Civic Accreditation Cycle Now Open',
          body: 'INDEPENDENTE invites nonpartisan community groups, academic centers, civic coalitions, and independent local media desks across Luzon, Visayas, and Mindanao to apply for accredited network partnership for the 2027 cycle.',
          audience: 'public',
          category: 'Call for Partnership',
          isPinned: true,
          publishedAt: '2026-11-15',
          authorName: 'INDEPENDENTE Secretariat',
          isDemonstration: true,
        },
        {
          title: 'Public Advisory on Citizen Isanguni Privacy & Emergency Redirection',
          body: 'Citizen Isanguni processes community concerns with strict RA 10173 safeguards. For situations involving immediate physical danger or medical emergencies, please contact local emergency responders (911) directly.',
          audience: 'public',
          category: 'Official Notice',
          isPinned: false,
          publishedAt: '2026-11-10',
          authorName: 'Citizen Affairs Office',
          isDemonstration: true,
        },
        {
          title: 'Secretariat Circular No. 2026-11: Delegation Registration Guidelines for the December National Assembly',
          body: 'All accredited partner organizations are requested to submit official delegation rosters (up to 5 representatives per organization) via the Partnership Portal Events tab no later than December 1, 2026.',
          audience: 'partners',
          category: 'Secretariat Circular',
          isPinned: true,
          publishedAt: '2026-11-14',
          authorName: 'INDEPENDENTE Secretariat',
          isDemonstration: true,
        },
        {
          title: 'Memorandum 2026-08: Updated Q4 Accomplishment Report Template & Evidence Checklist',
          body: 'Partner Program Coordinators may now download the standardized Q4 collaborative activity reporting form from the Document Center.',
          audience: 'partners',
          category: 'Memorandum',
          isPinned: false,
          publishedAt: '2026-11-04',
          authorName: 'Partnership Coordination Desk',
          isDemonstration: true,
        },
      ]);

      // 9. Documents
      await db.insert(documents).values([
        {
          title: 'INDEPENDENTE Network Partnership Charter & Nonpartisanship Covenant (2026)',
          category: 'Organizational Guidelines',
          description: 'Foundational governing principles, nonpartisan standards, and rights/responsibilities of accredited partner organizations.',
          accessLevel: 'public',
          fileUrl: '/api/documents/download/charter-2026',
        },
        {
          title: 'Standard Memorandum of Understanding (MOU) Template for Partner Organizations',
          category: 'Memorandum of Understanding',
          description: 'Official bilateral partnership agreement template for institutional and community network onboarding.',
          accessLevel: 'partners',
          fileUrl: '/api/documents/download/mou-template',
        },
        {
          title: 'Quarterly Collaborative Activity & Accomplishment Report Template',
          category: 'Official Template',
          description: 'Structured reporting template for joint civic forums, workshops, and community research initiatives.',
          accessLevel: 'partners',
          fileUrl: '/api/documents/download/accomplishment-template',
        },
        {
          title: 'RA 10173 Data Privacy & Citizen Isanguni Referral Safeguards Protocol',
          category: 'Organizational Guidelines',
          description: 'Mandatory confidentiality, informed consent, and secure handling procedures for citizen reports.',
          accessLevel: 'public',
          fileUrl: '/api/documents/download/privacy-protocol',
        },
      ]);

      // 10. Demonstration Citizen Isanguni Submissions (Strictly Restricted to Citizen Affairs / Admin)
      const demoCases = await db
        .insert(citizenSubmissions)
        .values([
          {
            referenceNumber: 'ISG-2026-DEMO01',
            accessCodeHash: hashAccessCode('DEMO1-2026A'),
            subject: '[DEMO] Delayed Posting of Barangay Flood Drainage Rehabilitation Schedule',
            categorySlug: 'governance-accountability',
            location: 'Barangay San Isidro, Quezon City',
            incidentDate: '2026-10-28',
            description: 'Residents observed excavation materials left uncovered near the elementary school entrance for three weeks without a posted contractor signboard or revised completion notice.',
            involvedParties: 'Local Barangay Engineering Desk (Demonstration Record)',
            whyItMatters: 'Poses pedestrian safety hazards for school children and stalls monsoon drainage readiness.',
            requestedAction: 'Request public posting of project scope, timeline, and safety barriers.',
            privacyMode: 'confidential',
            reporterName: 'Demo Citizen Reporter',
            reporterEmail: 'citizen.demo@example.org',
            preferredContact: 'portal',
            consentForReferral: true,
            status: 'UNDER REVIEW',
            priority: 'High',
            assignedOfficerName: 'Citizen Affairs Desk',
            isDemonstration: true,
          },
          {
            referenceNumber: 'ISG-2026-DEMO02',
            accessCodeHash: hashAccessCode('DEMO2-2026B'),
            subject: '[DEMO] Policy Recommendation: Tactile & Large-Print Forms at Municipal Senior Desks',
            categorySlug: 'recommendations-policy',
            location: 'Cebu City Hall Annex',
            incidentDate: '2026-11-03',
            description: 'Senior citizens applying for quarterly medical vouchers struggle with 8-point font application forms and lack shaded seating queues.',
            involvedParties: 'Municipal Social Welfare Frontline Counter',
            whyItMatters: 'Improves dignity and independent access for elderly and low-vision residents.',
            requestedAction: 'Forward recommendation to Social Welfare Inclusion working group for dialogue.',
            privacyMode: 'anonymous',
            preferredContact: 'portal',
            consentForReferral: false,
            status: 'INITIAL SCREENING',
            priority: 'Standard',
            isDemonstration: true,
          },
        ])
        .returning();

      await db.insert(citizenCaseUpdates).values([
        {
          submissionId: demoCases[0].id,
          authorRole: 'system',
          authorName: 'Citizen Isanguni Intake',
          updateType: 'status_change',
          message: 'Submission received and assigned reference ISG-2026-DEMO01 under confidential safeguards.',
          newStatus: 'RECEIVED',
          isPublicToReporter: true,
        },
        {
          submissionId: demoCases[0].id,
          authorRole: 'officer',
          authorName: 'Citizen Affairs Officer',
          updateType: 'status_change',
          message: 'Screening completed. Reviewing attached municipal notice records before issuing referral consent check.',
          previousStatus: 'RECEIVED',
          newStatus: 'UNDER REVIEW',
          isPublicToReporter: true,
        },
      ]);

      // 11. System Settings
      await db
        .insert(systemSettings)
        .values([
          {
            key: 'organization_name',
            value: 'INDEPENDENTE — An Independent Citizens Network',
            description: 'Official organization display title',
          },
          {
            key: 'correction_policy',
            value: 'INDEPENDENTE corrects factual errors promptly, transparently, and prominently at the top or foot of any affected publication with a timestamped editorial note.',
            description: 'Editorial correction & clarification policy',
          },
          {
            key: 'data_privacy_officer_email',
            value: 'dpo@independente.org',
            description: 'RA 10173 Data Protection Officer contact',
          },
          {
            key: 'email_notifications_mode',
            value: 'Database Queue (Configure SMTP_HOST / RESEND_API_KEY for live outbound relay)',
            description: 'Email notification transport status',
          },
        ])
        .onConflictDoNothing();

      await ensureExpansionSeedData();
      seeded = true;
    } catch (err) {
      seedPromise = null;
      throw err;
    }
  })();

  return seedPromise;
}

async function ensureExpansionSeedData(): Promise<void> {
  const [{ value: outletCount }] = await db.select({ value: count() }).from(mediaOutlets);
  if (outletCount === 0) {
    const insertedOutlets = await db
      .insert(mediaOutlets)
      .values([
        {
          slug: 'independente-news',
          name: 'INDEPENDENTE NEWS',
          abbreviation: 'IND-NEWS',
          logoUrl: '/assets/aistudio/Kampus_Independente_logo__1__80e86dcb.jpg',
          coverImageUrl: '/assets/aistudio/Kampus_Independente_logo_856d9f00.png',
          description: 'Flagship national civic newsroom delivering verified public-interest reporting, official network statements, and accountability coverage.',
          editorialMission: 'Deliver accurate, nonpartisan, document-verified reporting on public governance, citizen initiatives, and democratic institutions.',
          category: 'National Civic News',
          primaryAudience: 'General Public & Civic Institutions',
          editorialContact: 'newsdesk@independente.org',
          socialLinks: 'FB: @IndependenteNewsPH | X: @IndependentePH',
          adminEmail: 'newsdesk@independente.org',
          status: 'Active',
          isDemonstration: true,
        },
        {
          slug: 'the-independent-review',
          name: 'THE INDEPENDENT REVIEW',
          abbreviation: 'TIR',
          logoUrl: '/assets/aistudio/Kampus_Independente_logo__1__80e86dcb.jpg',
          coverImageUrl: '/src/assets/images/pub_investigative_ledger_1795044497584.jpg',
          description: 'Long-form investigative journalism, policy briefs, and documentary public-finance examinations.',
          editorialMission: 'Advance deep analytical journalism, primary-source audits, and independent public policy discourse.',
          category: 'Investigative & Policy',
          primaryAudience: 'Policy Researchers, Journalists & Advocates',
          editorialContact: 'review@independente.org',
          socialLinks: 'Web: review.independente.org',
          adminEmail: 'review@independente.org',
          status: 'Active',
          isDemonstration: true,
        },
        {
          slug: 'kampus-independente',
          name: 'KAMPUS INDEPENDENTE',
          abbreviation: 'KAMPUS',
          logoUrl: '/assets/aistudio/Kampus_Independente_logo__1__80e86dcb.jpg',
          coverImageUrl: '/assets/aistudio/Kampus_Independente_logo_856d9f00.png',
          description: 'Student and campus civic publication nurturing critical inquiry, academic freedom, and youth-led community journalism.',
          editorialMission: 'Think. Stand. Build. Empowering campus writers and youth fellows to practice principled, verifiable civic journalism.',
          category: 'Campus & Youth Press',
          primaryAudience: 'University Students, Campus Press & Youth Leaders',
          editorialContact: 'kampus@independente.org',
          socialLinks: 'IG: @KampusIndependente',
          adminEmail: 'kampus@independente.org',
          status: 'Active',
          isDemonstration: true,
        },
        {
          slug: 'community-desk',
          name: 'COMMUNITY DESK',
          abbreviation: 'COMMDESK',
          logoUrl: '/assets/aistudio/Kampus_Independente_logo__1__80e86dcb.jpg',
          coverImageUrl: '/src/assets/images/pub_community_forum_1795044499634.jpg',
          description: 'Grassroots correspondent network chronicling barangay initiatives, watershed watch groups, and rural service access.',
          editorialMission: 'Connect regional community chroniclers directly with national civic discourse using strict source verification.',
          category: 'Community & Grassroots',
          primaryAudience: 'Local Communities, Barangays & Regional Chapters',
          editorialContact: 'community@independente.org',
          socialLinks: 'Radio & Barangay Bulletin Network',
          adminEmail: 'community@independente.org',
          status: 'Active',
          isDemonstration: true,
        },
      ])
      .onConflictDoNothing()
      .returning();

    if (insertedOutlets.length >= 4) {
      const [indNews, indReview, kampus, commDesk] = insertedOutlets;
      await db.insert(mediaOutletMembers).values([
        { outletId: indNews.id, email: 'newsdesk@independente.org', displayName: 'Editorial Board', editorialRole: 'Editor-in-Chief' },
        { outletId: indReview.id, email: 'review@independente.org', displayName: 'Dr. Tomas P. Javier', editorialRole: 'Publication Administrator' },
        { outletId: kampus.id, email: 'kampus@independente.org', displayName: 'Kampus Student Editorial Collective', editorialRole: 'Managing Editor' },
        { outletId: commDesk.id, email: 'community@independente.org', displayName: 'Lorna A. Macapagal', editorialRole: 'Staff Writer' },
      ]);

      // Link existing seeded articles to the four outlets
      await db.update(publications).set({ outletId: indReview.id }).where(eq(publications.slug, 'following-the-barangay-ledger-2026-audit'));
      await db.update(publications).set({ outletId: commDesk.id, coOutletId: indNews.id }).where(eq(publications.slug, 'citizens-shaping-public-spaces-visayas-forums'));
      await db.update(publications).set({ outletId: indNews.id }).where(eq(publications.slug, 'editorial-independent-minds-informed-choices'));
      await db.update(publications).set({ outletId: indReview.id }).where(eq(publications.slug, 'coastal-mangrove-easement-policy-brief-2026'));
      await db.update(publications).set({ outletId: indNews.id }).where(eq(publications.slug, 'press-release-launch-of-citizen-isanguni-portal'));
      await db.update(publications).set({ outletId: commDesk.id }).where(eq(publications.slug, 'community-report-rural-water-access-bukidnon'));

      // Seed one Kampus Independente campus story & one editorial collaboration
      const [kampusArticle] = await db
        .insert(publications)
        .values({
          slug: 'kampus-independente-campus-press-fellowship-2026',
          title: 'Kampus Independente Opens 2026 Regional Campus Press & Fact-Checking Fellowship',
          subheadline: 'Forty student editors from Luzon, Visayas, and Mindanao convene to build shared source-verification standards.',
          categorySlug: 'features',
          authorName: 'Kampus Editorial Collective',
          authorRole: 'KAMPUS INDEPENDENTE Desk',
          featuredImageUrl: '/assets/aistudio/Kampus_Independente_logo_856d9f00.png',
          bodyMarkdown: `Student publications remain vital training grounds for public accountability and critical citizenship. Through the 2026 Regional Campus Press Fellowship, student writers across public and private universities are adopting transparent primary-source verification checklists.\n\nFellows collaborate across campuses on student welfare audits, academic freedom documentation, and municipal youth budget explainers—working alongside partner educators from Kapisanan ng mga Guro at Mag-aaral sa Sibika.`,
          referencesText: 'KAMPUS INDEPENDENTE 2026 Editorial Guild Charter.',
          tags: 'Campus Press, Youth Leadership, Fact-Checking',
          status: 'published',
          publishedAt: '2026-11-16',
          viewCount: 540,
          isFeatured: true,
          isDemonstration: true,
          outletId: kampus.id,
          coOutletId: indNews.id,
        })
        .onConflictDoNothing()
        .returning();

      if (kampusArticle) {
        await db.insert(editorialCollaborations).values({
          publicationId: kampusArticle.id,
          leadOutletId: kampus.id,
          partnerOutletId: indNews.id,
          proposedByUid: 'system-seed',
          collaborationNote: 'Cross-publication youth civic reporting feature co-published with INDEPENDENTE NEWS.',
          status: 'Published',
        });
      }
    }
  }

  // Seed Mobilizations
  const [{ value: mobCount }] = await db.select({ value: count() }).from(mobilizations);
  if (mobCount === 0) {
    const allAreas = await db.select().from(advocacyAreas).orderBy(advocacyAreas.sortOrder);
    const allOrgs = await db.select().from(organizations).orderBy(organizations.id);

    const insertedMobs = await db
      .insert(mobilizations)
      .values([
        {
          slug: 'open-barangay-budget-watch-2026',
          title: 'Open Barangay Budget Watch Brigades',
          advocacyAreaId: allAreas[0]?.id || null,
          description: 'Mobilizing trained resident volunteers to attend barangay budget postings, digitize public notice boards, and publish clear community spending summaries.',
          objectives: 'Cover 60 pilot barangays across Metro Manila and Central Luzon with transparent quarterly budget digests.',
          targetAudience: 'Resident associations, youth volunteers, accountants, and civic educators',
          geographicScope: 'Metro Manila & Central Luzon',
          startDate: '2026-11-01',
          endDate: '2027-05-30',
          participationType: 'Volunteers',
          supportType: 'INDEPENDENTE Supported',
          proposedByName: 'Atty. Clarissa M. Mendoza',
          proposedByEmail: 'partner.demo@independente.org',
          organizationId: allOrgs[0]?.id || null,
          status: 'Active',
          reviewNotes: 'Approved by Advocacy Operations (OP-02) with joint Secretariat toolkit backing.',
          heroImageUrl: '/src/assets/images/pub_investigative_ledger_1795044497584.jpg',
          isDemonstration: true,
        },
        {
          slug: 'visayas-mangrove-nursery-volunteer-drive',
          title: 'Visayas Community Mangrove Nursery & Coastal Cleanup Drive',
          advocacyAreaId: allAreas[6]?.id || allAreas[0]?.id || null,
          description: 'Independent grassroots coastal stewardship mobilization establishing citizen-tended mangrove nurseries and water turbidity checkpoints.',
          objectives: 'Plant 4,000 native mangrove propagules and log monthly shoreline baseline observations.',
          targetAudience: 'Coastal fisherfolk, students, environmental volunteers',
          geographicScope: 'Cebu, Bohol & Iloilo Shorelines',
          startDate: '2026-11-18',
          endDate: '2027-03-31',
          participationType: 'Community Brigades',
          supportType: 'Independent Initiative',
          proposedByName: 'Engr. Mateo R. Villareal',
          proposedByEmail: 'desk@kalikasanwatershed-demo.org',
          organizationId: allOrgs[1]?.id || null,
          status: 'Active',
          reviewNotes: 'Verified community initiative led by Kalikasan Watershed Guardians Network.',
          heroImageUrl: '/src/assets/images/advocacy_green_watershed_1795044498495.jpg',
          isDemonstration: true,
        },
        {
          slug: 'campus-fact-check-peer-network',
          title: 'Campus Fact-Check & Civic Deliberation Circles',
          advocacyAreaId: allAreas[7]?.id || allAreas[0]?.id || null,
          description: 'Student-led campus verification clinics preparing factual primers on local public services and constitutional rights.',
          objectives: 'Establish 20 active university deliberation chapters before mid-2027.',
          targetAudience: 'College students, campus journalists, student council fellows',
          geographicScope: 'Nationwide University Campuses',
          startDate: '2026-12-01',
          endDate: '2027-08-15',
          participationType: 'Campus Chapter',
          supportType: 'INDEPENDENTE Supported',
          proposedByName: 'Prof. Danilo S. Pangilinan',
          proposedByEmail: 'council@kapisanansibika-demo.org',
          organizationId: allOrgs[2]?.id || null,
          status: 'Active',
          reviewNotes: 'Co-endorsed with KAMPUS INDEPENDENTE.',
          heroImageUrl: '/src/assets/images/pub_community_forum_1795044499634.jpg',
          isDemonstration: true,
        },
      ])
      .onConflictDoNothing()
      .returning();

    if (insertedMobs.length > 0) {
      await db.insert(mobilizationMembers).values([
        {
          mobilizationId: insertedMobs[0].id,
          fullName: 'Atty. Clarissa M. Mendoza',
          email: 'partner.demo@independente.org',
          role: 'Organizer',
          skillsOrInterest: 'Municipal finance law & audit coordination',
          status: 'Approved',
        },
        {
          mobilizationId: insertedMobs[0].id,
          fullName: 'Marco V. Evangelista',
          email: 'comms@bantaybayan-demo.org',
          role: 'Coordinator',
          skillsOrInterest: 'Community outreach & data visualization',
          status: 'Approved',
        },
      ]);

      await db.insert(mobilizationTasks).values([
        {
          mobilizationId: insertedMobs[0].id,
          title: 'Publish District II Barangay Budget Digest Template',
          description: 'Finalize simplified 1-page printable breakdown for resident observers.',
          assignedTo: 'Marco V. Evangelista',
          dueDate: '2026-12-02',
          status: 'In Progress',
        },
        {
          mobilizationId: insertedMobs[0].id,
          title: 'Confirm Venue for Quezon City Volunteer Orientation',
          description: 'Coordinate seating and printed FOI primers.',
          assignedTo: 'Atty. Clarissa M. Mendoza',
          dueDate: '2026-11-29',
          status: 'Completed',
        },
      ]);

      await db.insert(mobilizationUpdates).values([
        {
          mobilizationId: insertedMobs[0].id,
          authorName: 'Atty. Clarissa M. Mendoza',
          updateType: 'Progress Report',
          title: 'First 18 Barangay Notice Boards Documented',
          content: 'Volunteer observers across 18 pilot barangays photographed and indexed Q4 public procurement notices.',
          isPublic: true,
        },
      ]);
    }
  }

  // Seed Organization Memberships, Membership Requirements & Internal Announcements
  const [{ value: orgMemberCount }] = await db.select({ value: count() }).from(organizationMembers);
  if (orgMemberCount === 0) {
    const allOrgs = await db.select().from(organizations).orderBy(organizations.id);
    if (allOrgs.length > 0) {
      await db
        .update(organizations)
        .set({
          affiliationStatus: 'Official Partner Organization',
          objectives: 'Advance participatory local governance, open procurement literacy, and community consultation.',
          proposedPrograms: 'Open Budget Clinics, Citizen Audit Circles, Regional Governance Scorecards.',
          orgStructure: 'General Assembly, Executive Board, Secretariat & Regional Chapters.',
          membershipRequirements: 'Open to citizen volunteers, researchers, and community organizers committed to nonpartisan transparency.',
          acceptingMembers: true,
        })
        .where(eq(organizations.id, allOrgs[0].id));

      if (allOrgs[1]) {
        await db
          .update(organizations)
          .set({
            affiliationStatus: 'Affiliated Organization',
            membershipRequirements: 'Open to Visayas coastal residents, marine educators, and student volunteers.',
            acceptingMembers: true,
          })
          .where(eq(organizations.id, allOrgs[1].id));
      }

      await db.insert(organizationMembers).values([
        {
          organizationId: allOrgs[0].id,
          email: 'partner.demo@independente.org',
          fullName: 'Atty. Clarissa M. Mendoza',
          orgRole: 'Organization Administrator',
          titleOrCommittee: 'Executive Coordinator',
          status: 'Active',
        },
        {
          organizationId: allOrgs[0].id,
          email: 'comms@bantaybayan-demo.org',
          fullName: 'Marco V. Evangelista',
          orgRole: 'Communications Officer',
          titleOrCommittee: 'Public Information Desk',
          status: 'Active',
        },
        {
          organizationId: allOrgs[0].id,
          email: 'treasury@bantaybayan-demo.org',
          fullName: 'Rosario D. Castillo',
          orgRole: 'Treasurer',
          titleOrCommittee: 'Finance & Audit',
          status: 'Active',
        },
      ]);

      await db.insert(organizationAnnouncements).values([
        {
          organizationId: allOrgs[0].id,
          title: 'Q4 Internal Chapter Planning Assembly',
          body: 'All committee coordinators are reminded to upload Q4 barangay scorecard drafts before December 5.',
          category: 'Internal Announcement',
          eventDate: '2026-12-03',
          authorName: 'Atty. Clarissa M. Mendoza',
        },
        {
          organizationId: allOrgs[0].id,
          title: 'Accomplishment Report: 64 Citizen Budget Observers Accredited',
          body: 'Completed two-day procurement reading practicum across District II barangays with 64 participating citizens.',
          category: 'Accomplishment Report',
          eventDate: '2026-10-28',
          authorName: 'Marco V. Evangelista',
        },
      ]);

      await db.insert(membershipApplications).values([
        {
          organizationId: allOrgs[0].id,
          applicantName: 'Rafael N. Dizon',
          applicantEmail: 'rafael.dizon.demo@example.org',
          applicantPhone: '+63 917 440 8821',
          motivation: 'CPA wanting to volunteer in barangay budget review clinics in Quezon City.',
          skillsOrInterests: 'Public Accounting, Excel Audits, Civic Literacy',
          status: 'Submitted',
        },
      ]);
    }
  }

  // Seed Collaborative Projects & Collaboration Requests
  const [{ value: projCount }] = await db.select({ value: count() }).from(collaborativeProjects);
  if (projCount === 0) {
    const allOrgs = await db.select().from(organizations).orderBy(organizations.id);
    const allOutlets = await db.select().from(mediaOutlets).orderBy(mediaOutlets.id);
    if (allOrgs.length >= 2 && allOutlets.length >= 1) {
      const [proj] = await db
        .insert(collaborativeProjects)
        .values({
          slug: 'joint-civic-literacy-open-data-caravan-2026',
          title: 'Joint Civic Literacy & Open Data Caravan 2026',
          summary: 'Cross-network collaboration uniting partner organizations, campus publications, and grassroots media desks for public-finance and verification workshops.',
          objectives: 'Conduct 8 regional town halls and publish co-authored plain-language civic primers.',
          advocacyArea: 'Good Governance and Accountability',
          geographicScope: 'National Capital Region, Cebu & Davao',
          startDate: '2026-11-10',
          endDate: '2027-04-30',
          status: 'Active Collaboration',
          leadEntityType: 'organization',
          leadEntityId: allOrgs[0].id,
          leadEntityName: allOrgs[0].name,
          isDemonstration: true,
        })
        .onConflictDoNothing()
        .returning();

      if (proj) {
        await db.insert(projectParticipants).values([
          { projectId: proj.id, entityType: 'organization', entityId: allOrgs[0].id, entityName: allOrgs[0].name, role: 'Lead' },
          { projectId: proj.id, entityType: 'organization', entityId: allOrgs[2]?.id || allOrgs[1].id, entityName: allOrgs[2]?.name || allOrgs[1].name, role: 'Co-Organizer' },
          { projectId: proj.id, entityType: 'publication', entityId: allOutlets[2]?.id || allOutlets[0].id, entityName: allOutlets[2]?.name || allOutlets[0].name, role: 'Media Partner' },
        ]);

        await db.insert(projectTasks).values([
          { projectId: proj.id, title: 'Publish Co-Authored Plain-Language Procurement Guide', assignedEntity: allOrgs[0].name, dueDate: '2026-12-10', status: 'In Progress' },
          { projectId: proj.id, title: 'Confirm Campus Forum Moderators for Cebu & Manila', assignedEntity: allOrgs[2]?.name || allOrgs[1].name, dueDate: '2026-12-18', status: 'Open' },
        ]);

        await db.insert(projectReports).values([
          {
            projectId: proj.id,
            authorName: allOrgs[0].name,
            reportType: 'Progress Update',
            title: 'Joint Working Group Kickoff Completed',
            summary: 'Editorial, academic, and civic partners aligned on regional forum schedules and shared nonpartisan verification standards.',
          },
        ]);

        await db.insert(collaborationRequests).values([
          {
            referenceCode: 'COL-2026-DEMO01',
            senderType: 'organization',
            senderEntityId: allOrgs[0].id,
            senderName: allOrgs[0].name,
            recipientType: 'publication',
            recipientEntityId: allOutlets[1]?.id || allOutlets[0].id,
            recipientName: allOutlets[1]?.name || allOutlets[0].name,
            title: 'Co-Publish Municipal Drainage Audit Series',
            purpose: 'Combine citizen field verification logs with investigative documentary editing.',
            proposedScope: 'Three-part regional accountability feature with source appendix.',
            timeline: 'December 2026 – January 2027',
            status: 'Active Collaboration',
            projectId: proj.id,
          },
        ]);
      }
    }
  }

  // Seed Collaborative Project Documents & Archive (idempotent even on existing DBs)
  const [{ value: docCount }] = await db.select({ value: count() }).from(projectDocuments);
  if (docCount === 0) {
    const existingProjs = await db.select().from(collaborativeProjects).orderBy(collaborativeProjects.id).limit(1);
    if (existingProjs.length > 0) {
      const targetProj = existingProjs[0];
      const existingTasks = await db.select().from(projectTasks).where(eq(projectTasks.projectId, targetProj.id));
      if (existingTasks.length > 0 && existingTasks.length < 3) {
        await db.insert(projectTasks).values({
          projectId: targetProj.id,
          title: 'Finalize Participating Organization Memorandum & Nonpartisan Guidelines',
          assignedEntity: targetProj.leadEntityName,
          dueDate: '2026-11-15',
          status: 'Completed',
        });
      }

      await db.insert(projectDocuments).values([
        {
          projectId: targetProj.id,
          title: 'Joint Caravan Facilitation Guide & Nonpartisan Protocol',
          category: 'Joint Charter / MOU',
          description: 'Shared operating protocol defining nonpartisan moderation standards, open-data citations, and regional partner roles.',
          fileUrl: '/api/documents/download/charter-2026',
          fileName: 'INDEPENDENTE-Joint-Caravan-Protocol-2026.txt',
          uploadedByOrg: targetProj.leadEntityName,
          uploadedByName: 'Atty. Clarissa M. Mendoza',
          uploadedByUid: 'partner-demo-bantay-bayan',
          status: 'Active',
        },
        {
          projectId: targetProj.id,
          title: 'Open Barangay Budget Primer — Working Draft',
          category: 'Policy Brief',
          description: 'Plain-language public expenditure explainer co-edited by partner researchers and campus civic fellows.',
          fileUrl: '/api/documents/download/accomplishment-template',
          fileName: 'Open-Barangay-Budget-Primer-Draft.txt',
          uploadedByOrg: 'Kapisanan ng mga Guro at Mag-aaral sa Sibika',
          uploadedByName: 'Prof. Danilo S. Pangilinan',
          uploadedByUid: 'system-seed',
          status: 'Active',
        },
        {
          projectId: targetProj.id,
          title: 'Initial Steering Committee Planning Notes (Oct 2026)',
          category: 'Meeting Minutes',
          description: 'Superseded scoping notes retained in the shared archive for audit traceability after regional schedule approval.',
          fileUrl: '/api/documents/download/mou-template',
          fileName: 'Steering-Committee-Minutes-Oct2026.txt',
          uploadedByOrg: targetProj.leadEntityName,
          uploadedByName: 'Marco V. Evangelista',
          uploadedByUid: 'system-seed',
          status: 'Archived',
          archivedAt: new Date('2026-11-11T09:30:00Z'),
        },
      ]);
    }
  }

  // Seed Internal Organization Group Chat Messages (idempotent)
  const [{ value: chatCount }] = await db.select({ value: count() }).from(internalChatMessages);
  if (chatCount === 0) {
    const firstOrg = await db.select().from(organizations).orderBy(organizations.id).limit(1);
    if (firstOrg.length > 0) {
      await db.insert(internalChatMessages).values([
        {
          organizationId: firstOrg[0].id,
          channel: 'general',
          senderUid: 'partner-demo-bantay-bayan',
          senderName: 'Atty. Clarissa M. Mendoza',
          senderRole: 'Organization Administrator',
          message: 'Good morning team — please review the Q4 Internal Chapter Planning Assembly notice and confirm your committee attendance.',
        },
        {
          organizationId: firstOrg[0].id,
          channel: 'general',
          senderUid: 'system-seed-comms',
          senderName: 'Marco V. Evangelista',
          senderRole: 'Communications Officer',
          message: 'Confirmed. I have uploaded the updated District II barangay procurement checklists to the shared folder.',
        },
        {
          organizationId: firstOrg[0].id,
          channel: 'coordination',
          senderUid: 'system-seed-treasury',
          senderName: 'Rosario D. Castillo',
          senderRole: 'Treasurer',
          message: 'Logistics and workshop handouts for the December 3 assembly are ready for final sign-off.',
        },
      ]);
    }
  }
}
