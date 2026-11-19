import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  FileText,
  Flag,
  Handshake,
  Lock,
  Megaphone,
  QrCode,
  Settings,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  AdvocacyArea,
  Campaign,
  NetworkEvent,
  Publication,
  PublicationCategory,
} from '../types/index.ts';

interface AdminDashboardPageProps {
  publicationCategories: PublicationCategory[];
  onRefreshPublic: () => void;
}

interface OverviewPayload {
  kpis: {
    totalPublications: number;
    pendingEditorial: number;
    publishedArticles: number;
    totalReads: number;
    activeCampaigns: number;
    registeredPartners: number;
    pendingApplications: number;
    upcomingEvents: number;
    eventRegistrations: number;
    totalCitizenSubmissions: number;
    reportsAwaitingReview: number;
    reportsUnderProcessing: number;
    reportsResolved: number;
    registeredOutlets?: number;
    activeMobilizations?: number;
    pendingMobilizations?: number;
    pendingOrgApplications?: number;
    activeCollaborations?: number;
  };
  analytics: {
    isanguniByStatus: Array<{ status: string; count: number }>;
    isanguniByCategory: Array<{ category: string; count: number }>;
    topPublications: Array<{ id: number; title: string; categorySlug: string; viewCount: number }>;
  };
  recentAuditLogs: Array<{
    id: number;
    actorEmail: string;
    actorRole: string;
    action: string;
    entityType: string;
    entityId: string;
    details: string;
    createdAt: string;
  }>;
  notifications: Array<{ id: number; title: string; message: string; createdAt: string }>;
}

interface OrgEstablishmentAppRow {
  id: number;
  referenceCode: string;
  organizationName: string;
  orgType: string;
  location: string;
  founderName: string;
  founderEmail: string;
  advocacyInterests: string;
  status: string;
  reviewNotes: string;
}

interface MobilizationAdminRow {
  id: number;
  title: string;
  supportType: string;
  participationType: string;
  geographicScope: string;
  proposedByName: string;
  status: string;
  reviewNotes: string;
}

interface OrgAffiliationRow {
  id: number;
  name: string;
  orgType: string;
  affiliationStatus: string;
  geographicCoverage: string;
}

interface MediaOutletRow {
  id: number;
  name: string;
  abbreviation: string;
  category: string;
  status: string;
  publishedCount?: number;
}

interface PartnershipApplicationRow {
  id: number;
  referenceCode: string;
  organizationName: string;
  orgType: string;
  officialAddress: string;
  authorizedRep: string;
  officialEmail: string;
  proposedAreas: string;
  status: string;
  reviewNotes: string;
  createdAt: string;
}

interface IsanguniCaseRow {
  id: number;
  referenceNumber: string;
  subject: string;
  categorySlug: string;
  location: string;
  incidentDate: string;
  privacyMode: string;
  status: string;
  priority: string;
  assignedOfficerName: string;
  consentForReferral: boolean;
  isDemonstration: boolean;
}

interface IsanguniCaseDetail {
  submission: IsanguniCaseRow & {
    description: string;
    involvedParties: string;
    whyItMatters: string;
    requestedAction: string;
    reporterName: string;
    reporterEmail: string;
    reporterPhone: string;
  };
  updates: Array<{
    id: number;
    authorName: string;
    updateType: string;
    message: string;
    isPublicToReporter: boolean;
    createdAt: string;
  }>;
  attachments: Array<{ id: number; fileName: string; mimeType: string }>;
  referrals: Array<{
    id: number;
    targetInstitutionName: string;
    referralReason: string;
    status: string;
    consentConfirmed: boolean;
  }>;
}

const ISANGUNI_STATUSES = [
  'RECEIVED',
  'INITIAL SCREENING',
  'UNDER REVIEW',
  'FOR CLARIFICATION',
  'FOR REFERRAL',
  'ACTION INITIATED',
  'RESOLVED / ADDRESSED',
  'CLOSED',
  'OUT OF SCOPE',
];

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  publicationCategories,
  onRefreshPublic,
}) => {
  const { idToken, dbUser, signInWithGoogle } = useAuth();
  const [module, setModule] = useState<
    | 'overview'
    | 'editorial'
    | 'advocacy'
    | 'organizing'
    | 'partnerships'
    | 'events'
    | 'isanguni'
    | 'announcements'
    | 'users'
    | 'settings'
  >('overview');

  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [adminPubs, setAdminPubs] = useState<Publication[]>([]);
  const [mediaOutletsList, setMediaOutletsList] = useState<MediaOutletRow[]>([]);
  const [advocacyAreas, setAdvocacyAreas] = useState<AdvocacyArea[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [orgEstablishmentApps, setOrgEstablishmentApps] = useState<OrgEstablishmentAppRow[]>([]);
  const [orgAffiliations, setOrgAffiliations] = useState<OrgAffiliationRow[]>([]);
  const [mobilizationQueue, setMobilizationQueue] = useState<MobilizationAdminRow[]>([]);
  const [applications, setApplications] = useState<PartnershipApplicationRow[]>([]);
  const [eventsList, setEventsList] = useState<NetworkEvent[]>([]);
  const [isanguniList, setIsanguniList] = useState<IsanguniCaseRow[]>([]);
  const [selectedCase, setSelectedCase] = useState<IsanguniCaseDetail | null>(null);
  const [usersData, setUsersData] = useState<{
    users: Array<{ id: number; email: string; displayName: string; roleSlug: string; organizationId: number | null; isActive: boolean }>;
    roles: Array<{ slug: string; name: string }>;
    organizations: Array<{ id: number; name: string }>;
  } | null>(null);
  const [inquiries, setInquiries] = useState<Array<{ id: number; subject: string; senderEmail: string; message: string; status: string; secretariatReply: string }>>([]);
  const [settingsList, setSettingsList] = useState<Array<{ key: string; value: string; description: string }>>([]);
  const [notice, setNotice] = useState('');
  const [correctionTargetId, setCorrectionTargetId] = useState<number | null>(null);
  const [correctionInput, setCorrectionInput] = useState('');
  const [replyTargetId, setReplyTargetId] = useState<number | null>(null);
  const [replyInput, setReplyInput] = useState('');

  // Form states
  const [newPub, setNewPub] = useState({
    title: '',
    subheadline: '',
    categorySlug: 'news',
    authorName: '',
    bodyMarkdown: '',
    referencesText: '',
    tags: '',
    status: 'review',
  });
  const [newArea, setNewArea] = useState({
    title: '',
    summary: '',
    backgroundRationale: '',
    objectives: '',
    interventions: '',
    citizenParticipation: '',
  });
  const [newCamp, setNewCamp] = useState({
    advocacyAreaId: 0,
    title: '',
    summary: '',
    objectives: '',
    status: 'Active',
    startDate: new Date().toISOString().slice(0, 10),
    participationSteps: '',
  });
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    category: 'Forums and dialogues',
    format: 'Hybrid',
    startAt: '2026-12-20 10:00',
    endAt: '2026-12-20 15:00',
    venueOrLink: '',
    capacity: 150,
  });
  const [qrCheckinCode, setQrCheckinCode] = useState('');
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    body: '',
    audience: 'public',
    category: 'Official Notice',
  });

  // Case management forms
  const [caseStatusUpdate, setCaseStatusUpdate] = useState('UNDER REVIEW');
  const [caseStatusNote, setCaseStatusNote] = useState('');
  const [caseNoteMsg, setCaseNoteMsg] = useState('');
  const [caseNotePublic, setCaseNotePublic] = useState(false);
  const [referralForm, setReferralForm] = useState({
    targetInstitutionName: '',
    referralReason: '',
    consentConfirmed: false,
  });
  const [provisionedCreds, setProvisionedCreds] = useState<{
    email: string;
    temporaryPassword: string;
  } | null>(null);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 5000);
  };

  const authHeaders: Record<string, string> = idToken ? { Authorization: `Bearer ${idToken}` } : {};

  const canAccessIsanguni =
    dbUser && ['super_admin', 'citizen_affairs_officer'].includes(dbUser.roleSlug);
  const canAccessEditorial =
    dbUser && ['super_admin', 'secretariat_admin', 'editor_in_chief', 'editorial_staff'].includes(dbUser.roleSlug);
  const canPublish =
    dbUser && ['super_admin', 'secretariat_admin', 'editor_in_chief'].includes(dbUser.roleSlug);
  const canAccessPartners =
    dbUser && ['super_admin', 'secretariat_admin', 'partnership_coordinator', 'executive_committee'].includes(dbUser.roleSlug);
  const canAccessEvents =
    dbUser && ['super_admin', 'secretariat_admin', 'events_coordinator'].includes(dbUser.roleSlug);
  const canAccessAdvocacy =
    dbUser && ['super_admin', 'secretariat_admin', 'advocacy_coordinator'].includes(dbUser.roleSlug);
  const canManageUsers =
    dbUser && ['super_admin', 'secretariat_admin'].includes(dbUser.roleSlug);

  const loadModuleData = async () => {
    if (!idToken || !dbUser) return;
    const resOverview = await fetch('/api/admin/overview', { headers: authHeaders });
    if (resOverview.ok) setOverview(await resOverview.json());

    if (module === 'editorial' && canAccessEditorial) {
      const [r1, r2] = await Promise.all([
        fetch('/api/admin/publications', { headers: authHeaders }),
        fetch('/api/media/outlets'),
      ]);
      if (r1.ok) setAdminPubs(await r1.json());
      if (r2.ok) setMediaOutletsList(await r2.json());
    }
    if (module === 'advocacy' && canAccessAdvocacy) {
      const r = await fetch('/api/advocacy');
      if (r.ok) {
        const d = await r.json();
        setAdvocacyAreas(d.areas || []);
        setCampaigns(d.campaigns || []);
        if (d.areas?.length && !newCamp.advocacyAreaId) {
          setNewCamp((c) => ({ ...c, advocacyAreaId: d.areas[0].id }));
        }
      }
    }
    if (module === 'organizing' && (canAccessPartners || canAccessAdvocacy || canManageUsers)) {
      const [rApps, rOrgs, rMobs] = await Promise.all([
        canAccessPartners ? fetch('/api/org-hub/applications', { headers: authHeaders }) : Promise.resolve(null),
        fetch('/api/org-hub/organizations'),
        canAccessAdvocacy ? fetch('/api/admin/mobilizations', { headers: authHeaders }) : Promise.resolve(null),
      ]);
      if (rApps && rApps.ok) setOrgEstablishmentApps(await rApps.json());
      if (rOrgs.ok) setOrgAffiliations(await rOrgs.json());
      if (rMobs && rMobs.ok) setMobilizationQueue(await rMobs.json());
    }
    if (module === 'partnerships' && canAccessPartners) {
      const [r1, r2] = await Promise.all([
        fetch('/api/admin/applications', { headers: authHeaders }),
        fetch('/api/admin/inquiries', { headers: authHeaders }),
      ]);
      if (r1.ok) setApplications(await r1.json());
      if (r2.ok) setInquiries(await r2.json());
    }
    if (module === 'events' && canAccessEvents) {
      const r = await fetch('/api/events');
      if (r.ok) setEventsList(await r.json());
    }
    if (module === 'isanguni' && canAccessIsanguni) {
      const r = await fetch('/api/admin/isanguni', { headers: authHeaders });
      if (r.ok) setIsanguniList(await r.json());
    }
    if (module === 'users' && canManageUsers) {
      const r = await fetch('/api/admin/users', { headers: authHeaders });
      if (r.ok) setUsersData(await r.json());
    }
    if (module === 'settings' && canManageUsers) {
      const r = await fetch('/api/admin/settings', { headers: authHeaders });
      if (r.ok) setSettingsList(await r.json());
    }
  };

  useEffect(() => {
    loadModuleData();
  }, [idToken, dbUser, module]);

  if (!idToken || !dbUser) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-5">
        <Lock className="w-10 h-10 text-navy-900 dark:text-white mx-auto" />
        <h1 className="font-serif text-3xl font-semibold text-navy-900 dark:text-white">
          Secretariat &amp; Administration Dashboard
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Authorized INDEPENDENTE Secretariat officers, editors, coordinators, and Citizen Affairs
          Officers must sign in with their verified Google account.
        </p>
        <button
          type="button"
          onClick={signInWithGoogle}
          className="px-6 py-3 text-sm font-semibold bg-navy-900 text-white rounded-md cursor-pointer"
        >
          Sign In with Google
        </button>
      </div>
    );
  }

  const downloadProtectedCsv = async (url: string, filename: string) => {
    const res = await fetch(url, { headers: authHeaders });
    if (!res.ok) return;
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(objUrl);
  };

  const openIsanguniCase = async (id: number) => {
    const res = await fetch(`/api/admin/isanguni/${id}`, { headers: authHeaders });
    if (res.ok) {
      const data: IsanguniCaseDetail = await res.json();
      setSelectedCase(data);
      setCaseStatusUpdate(data.submission.status);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="text-xs text-slate-500">
            Central Management Console · Signed in as {dbUser.email} ({dbUser.roleSlug})
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-navy-900 dark:text-white">
            Secretariat Operations Dashboard
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadProtectedCsv('/api/admin/reports/impact?period=quarterly', 'independente-quarterly-impact.csv')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export Quarterly Impact CSV
          </button>
          <button
            type="button"
            onClick={() => downloadProtectedCsv('/api/admin/reports/impact?period=annual', 'independente-annual-impact.csv')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-navy-900 text-white rounded-md cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export Annual Report
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-sm text-emerald-900 dark:text-emerald-200">
          {notice}
        </div>
      )}

      {/* Navigation Strip */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'overview', label: 'Overview & Analytics', icon: BarChart3, show: true },
          { id: 'editorial', label: 'Editorial Desk', icon: FileText, show: canAccessEditorial },
          { id: 'advocacy', label: 'Advocacy & Campaigns', icon: Flag, show: canAccessAdvocacy },
          {
            id: 'organizing',
            label: 'Organizing & Mobilizations',
            icon: Users,
            show: canAccessPartners || canAccessAdvocacy || canManageUsers,
          },
          { id: 'partnerships', label: 'Partnerships & Inquiries', icon: Handshake, show: canAccessPartners },
          { id: 'events', label: 'Events & QR Attendance', icon: Calendar, show: canAccessEvents },
          { id: 'isanguni', label: 'Citizen Isanguni (Restricted)', icon: ShieldAlert, show: canAccessIsanguni },
          { id: 'announcements', label: 'Announcements', icon: Megaphone, show: canManageUsers },
          { id: 'users', label: 'Users & RBAC', icon: Users, show: canManageUsers },
          { id: 'settings', label: 'System Settings', icon: Settings, show: canManageUsers },
        ]
          .filter((t) => t.show)
          .map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setModule(t.id as typeof module)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md cursor-pointer ${
                  module === t.id
                    ? t.id === 'isanguni'
                      ? 'bg-crimson-600 text-white'
                      : 'bg-navy-900 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
      </div>

      {/* MODULE: OVERVIEW */}
      {module === 'overview' && overview && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: 'Registered Publications', val: overview.kpis.registeredOutlets ?? 0 },
              { label: 'Published Articles', val: overview.kpis.publishedArticles },
              { label: 'Pending Editorial Review', val: overview.kpis.pendingEditorial },
              { label: 'Active Mobilizations', val: overview.kpis.activeMobilizations ?? 0 },
              { label: 'Pending Mobilizations', val: overview.kpis.pendingMobilizations ?? 0 },
              { label: 'Registered Organizations', val: overview.kpis.registeredPartners },
              { label: 'Pending Org Establishment', val: overview.kpis.pendingOrgApplications ?? 0 },
              { label: 'Pending Partner Apps', val: overview.kpis.pendingApplications },
              { label: 'Active Collaborations', val: overview.kpis.activeCollaborations ?? 0 },
              { label: 'Citizen Submissions', val: overview.kpis.totalCitizenSubmissions },
            ].map((k) => (
              <div key={k.label} className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/60">
                <div className="text-xs text-slate-500">{k.label}</div>
                <div className="text-2xl font-mono font-semibold text-navy-900 dark:text-white tabular-nums mt-1">
                  {k.val}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-6 p-5 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
              <h2 className="font-serif text-lg font-semibold">Most-Read Publications</h2>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {overview.analytics.topPublications.map((p) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                    <span className="font-medium truncate">{p.title}</span>
                    <span className="font-mono tabular-nums text-slate-500 shrink-0">{p.viewCount} reads</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6 p-5 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
              <h2 className="font-serif text-lg font-semibold">Anonymized Citizen Isanguni Breakdown</h2>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="font-semibold text-slate-500 mb-2">By Status</div>
                  {overview.analytics.isanguniByStatus.map((s) => (
                    <div key={s.status} className="flex justify-between py-1">
                      <span>{s.status}</span>
                      <span className="font-mono tabular-nums">{s.count}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="font-semibold text-slate-500 mb-2">By Category</div>
                  {overview.analytics.isanguniByCategory.map((c) => (
                    <div key={c.category} className="flex justify-between py-1">
                      <span className="truncate pr-2">{c.category}</span>
                      <span className="font-mono tabular-nums">{c.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 p-5 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
              <h2 className="font-serif text-lg font-semibold">Audit Log (Administrative Actions)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2 pr-3">Actor</th>
                      <th className="py-2 pr-3">Action</th>
                      <th className="py-2 pr-3">Entity</th>
                      <th className="py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {overview.recentAuditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="py-2 pr-3">{log.actorEmail}</td>
                        <td className="py-2 pr-3 font-mono">{log.action}</td>
                        <td className="py-2 pr-3">
                          {log.entityType} #{log.entityId}
                        </td>
                        <td className="py-2 font-mono tabular-nums text-slate-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-5 p-5 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
              <h2 className="font-serif text-lg font-semibold">Secretariat Notifications</h2>
              <div className="space-y-2.5 text-xs">
                {overview.notifications.map((n) => (
                  <div key={n.id} className="p-3 border border-slate-200 dark:border-slate-800 rounded">
                    <div className="font-semibold">{n.title}</div>
                    <div className="text-slate-600 dark:text-slate-300 mt-0.5">{n.message}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODULE: EDITORIAL DESK */}
      {module === 'editorial' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await fetch('/api/admin/publications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify(newPub),
              });
              if (res.ok) {
                setNewPub({
                  title: '',
                  subheadline: '',
                  categorySlug: 'news',
                  authorName: '',
                  bodyMarkdown: '',
                  referencesText: '',
                  tags: '',
                  status: 'review',
                });
                showNotice('Publication saved to editorial workflow.');
                loadModuleData();
                onRefreshPublic();
              }
            }}
            className="lg:col-span-5 p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3"
          >
            <h2 className="font-serif text-xl font-semibold">Compose Publication</h2>
            <input
              required
              placeholder="Headline"
              value={newPub.title}
              onChange={(e) => setNewPub({ ...newPub, title: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
            />
            <input
              required
              placeholder="Subheadline / Deck"
              value={newPub.subheadline}
              onChange={(e) => setNewPub({ ...newPub, subheadline: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newPub.categorySlug}
                onChange={(e) => setNewPub({ ...newPub, categorySlug: e.target.value })}
                className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
              >
                {publicationCategories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={newPub.status}
                onChange={(e) => setNewPub({ ...newPub, status: e.target.value })}
                className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
              >
                <option value="draft">Draft</option>
                <option value="review">Submit for Fact-Check &amp; Review</option>
                <option value="scheduled">Scheduled</option>
                {canPublish && <option value="published">Publish Now</option>}
              </select>
            </div>
            <input
              placeholder="Author / Editorial Team"
              value={newPub.authorName}
              onChange={(e) => setNewPub({ ...newPub, authorName: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
            />
            <textarea
              required
              rows={5}
              placeholder="Article body (separate paragraphs with blank lines)"
              value={newPub.bodyMarkdown}
              onChange={(e) => setNewPub({ ...newPub, bodyMarkdown: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
            />
            <textarea
              rows={2}
              placeholder="References & primary sources"
              value={newPub.referencesText}
              onChange={(e) => setNewPub({ ...newPub, referencesText: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-transparent"
            />
            <button type="submit" className="px-5 py-2 text-xs font-semibold bg-navy-900 text-white rounded cursor-pointer">
              Save Manuscript
            </button>
          </form>

          <div className="lg:col-span-7 space-y-5">
            {mediaOutletsList.length > 0 && (
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Registered Network Publications ({mediaOutletsList.length})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {mediaOutletsList.map((o) => (
                    <div key={o.id} className="p-2.5 border border-slate-200 dark:border-slate-800 rounded flex justify-between">
                      <span className="font-semibold">{o.name}</span>
                      <span className="font-mono text-slate-500">{o.abbreviation} · {o.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <h2 className="font-serif text-xl font-semibold">Editorial Queue &amp; Published Archive</h2>
            {adminPubs.map((p) => (
              <div key={p.id} className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500">
                      {p.categorySlug} · Status: <strong>{p.status}</strong> · {p.authorName}
                    </div>
                    <div className="font-semibold text-sm">{p.title}</div>
                  </div>
                  {canPublish && (
                    <div className="flex gap-2 shrink-0">
                      {p.status !== 'published' && (
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/admin/publications/${p.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json', ...authHeaders },
                              body: JSON.stringify({ status: 'published' }),
                            });
                            showNotice(`Published: ${p.title}`);
                            loadModuleData();
                            onRefreshPublic();
                          }}
                          className="px-3 py-1.5 text-xs font-semibold bg-emerald-700 text-white rounded cursor-pointer"
                        >
                          Approve &amp; Publish
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setCorrectionTargetId(correctionTargetId === p.id ? null : p.id);
                          setCorrectionInput(p.correctionNote || '');
                        }}
                        className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded cursor-pointer"
                      >
                        Add Correction Note
                      </button>
                    </div>
                  )}
                </div>
                {correctionTargetId === p.id && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!correctionInput.trim()) return;
                      await fetch(`/api/admin/publications/${p.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', ...authHeaders },
                        body: JSON.stringify({ correctionNote: correctionInput.trim() }),
                      });
                      setCorrectionTargetId(null);
                      setCorrectionInput('');
                      showNotice('Correction note appended.');
                      loadModuleData();
                    }}
                    className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800"
                  >
                    <input
                      required
                      placeholder="Enter transparent editorial correction note..."
                      value={correctionInput}
                      onChange={(e) => setCorrectionInput(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                    />
                    <button type="submit" className="px-3 py-1.5 text-xs font-semibold bg-navy-900 text-white rounded cursor-pointer">
                      Save Note
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODULE: ADVOCACY & CAMPAIGNS */}
      {module === 'advocacy' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-6">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await fetch('/api/admin/advocacy', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHeaders },
                  body: JSON.stringify(newArea),
                });
                if (res.ok) {
                  setNewArea({ title: '', summary: '', backgroundRationale: '', objectives: '', interventions: '', citizenParticipation: '' });
                  showNotice('Advocacy area added dynamically.');
                  loadModuleData();
                  onRefreshPublic();
                }
              }}
              className="p-5 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3"
            >
              <h2 className="font-serif text-lg font-semibold">Create New Advocacy Area</h2>
              <input required placeholder="Advocacy Title" value={newArea.title} onChange={(e) => setNewArea({ ...newArea, title: e.target.value })} className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-transparent" />
              <textarea required rows={2} placeholder="Summary" value={newArea.summary} onChange={(e) => setNewArea({ ...newArea, summary: e.target.value })} className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-transparent" />
              <textarea required rows={2} placeholder="Background & Rationale" value={newArea.backgroundRationale} onChange={(e) => setNewArea({ ...newArea, backgroundRationale: e.target.value })} className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-transparent" />
              <textarea required rows={2} placeholder="Objectives" value={newArea.objectives} onChange={(e) => setNewArea({ ...newArea, objectives: e.target.value })} className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-transparent" />
              <button type="submit" className="px-4 py-2 text-xs font-semibold bg-navy-900 text-white rounded cursor-pointer">
                Publish Advocacy Area
              </button>
            </form>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await fetch('/api/admin/campaigns', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHeaders },
                  body: JSON.stringify(newCamp),
                });
                if (res.ok) {
                  setNewCamp({ ...newCamp, title: '', summary: '', objectives: '', participationSteps: '' });
                  showNotice('Campaign created.');
                  loadModuleData();
                }
              }}
              className="p-5 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3"
            >
              <h2 className="font-serif text-lg font-semibold">Launch Campaign</h2>
              <select
                value={newCamp.advocacyAreaId}
                onChange={(e) => setNewCamp({ ...newCamp, advocacyAreaId: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
              >
                {advocacyAreas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
              <input required placeholder="Campaign Title" value={newCamp.title} onChange={(e) => setNewCamp({ ...newCamp, title: e.target.value })} className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-transparent" />
              <textarea required rows={2} placeholder="Campaign Summary" value={newCamp.summary} onChange={(e) => setNewCamp({ ...newCamp, summary: e.target.value })} className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-transparent" />
              <textarea required rows={2} placeholder="Objectives" value={newCamp.objectives} onChange={(e) => setNewCamp({ ...newCamp, objectives: e.target.value })} className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-transparent" />
              <button type="submit" className="px-4 py-2 text-xs font-semibold bg-crimson-600 text-white rounded cursor-pointer">
                Save Campaign
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 space-y-3">
            <h2 className="font-serif text-xl font-semibold">Active &amp; Planned Campaigns</h2>
            {campaigns.map((c) => (
              <div key={c.id} className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-sm">{c.title}</div>
                  <div className="text-xs text-slate-500">{c.summary}</div>
                </div>
                <select
                  value={c.status}
                  onChange={async (e) => {
                    await fetch(`/api/admin/campaigns/${c.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json', ...authHeaders },
                      body: JSON.stringify({ status: e.target.value }),
                    });
                    showNotice('Campaign status updated.');
                    loadModuleData();
                  }}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                >
                  {['Proposed', 'Planning', 'Active', 'Temporarily Paused', 'Completed', 'Archived'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODULE: ORGANIZING & MOBILIZATION OVERSIGHT */}
      {module === 'organizing' && (
        <div className="space-y-8">
          <div className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              Organization Establishment Applications (OP-03)
            </h2>
            {orgEstablishmentApps.length === 0 ? (
              <p className="text-sm text-slate-500">No organization establishment applications on record.</p>
            ) : (
              orgEstablishmentApps.map((appRow) => (
                <div key={appRow.id} className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1 text-xs">
                    <div className="font-mono text-slate-500">
                      {appRow.referenceCode} · {appRow.orgType} · <strong>{appRow.status}</strong>
                    </div>
                    <div className="text-base font-semibold">{appRow.organizationName}</div>
                    <div className="text-slate-500">
                      Founder: {appRow.founderName} ({appRow.founderEmail}) · {appRow.location}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['Initial Screening', 'Verification', 'Returned for Clarification', 'Approved', 'Declined'].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={async () => {
                          await fetch(`/api/org-hub/applications/${appRow.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json', ...authHeaders },
                            body: JSON.stringify({ status: st }),
                          });
                          showNotice(`${appRow.organizationName} marked ${st}.`);
                          loadModuleData();
                          onRefreshPublic();
                        }}
                        className={`px-3 py-1.5 text-xs rounded border cursor-pointer ${
                          st === 'Approved'
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : st === 'Declined'
                              ? 'border-red-300 text-red-700'
                              : 'border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <h2 className="font-serif text-xl font-semibold">
              Organization Affiliation Classification
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {orgAffiliations.map((org) => (
                <div key={org.id} className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-semibold text-sm">{org.name}</div>
                    <div className="text-slate-500">{org.orgType} · {org.geographicCoverage}</div>
                  </div>
                  <select
                    value={org.affiliationStatus || 'Official Partner Organization'}
                    onChange={async (e) => {
                      await fetch(`/api/admin/organizations/${org.id}/affiliation`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', ...authHeaders },
                        body: JSON.stringify({ affiliationStatus: e.target.value }),
                      });
                      showNotice(`Updated ${org.name} classification.`);
                      loadModuleData();
                      onRefreshPublic();
                    }}
                    className="px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                  >
                    <option>Independent Organization</option>
                    <option>Affiliated Organization</option>
                    <option>Official Partner Organization</option>
                    <option>Central Network Unit</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <h2 className="font-serif text-xl font-semibold">
              Mobilization Proposals &amp; Support Designation (OP-02)
            </h2>
            {mobilizationQueue.map((mob) => (
              <div key={mob.id} className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="text-slate-500">
                    {mob.participationType} · {mob.geographicScope} · Status: <strong>{mob.status}</strong>
                  </div>
                  <div className="font-semibold text-sm">{mob.title}</div>
                  <div className="text-slate-500">Proposed by: {mob.proposedByName}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={mob.supportType}
                    onChange={async (e) => {
                      await fetch(`/api/admin/mobilizations/${mob.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', ...authHeaders },
                        body: JSON.stringify({ supportType: e.target.value }),
                      });
                      showNotice(`Updated support designation for ${mob.title}.`);
                      loadModuleData();
                    }}
                    className="px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                  >
                    <option>INDEPENDENTE Supported</option>
                    <option>Independent Initiative</option>
                  </select>
                  <select
                    value={mob.status}
                    onChange={async (e) => {
                      await fetch(`/api/admin/mobilizations/${mob.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', ...authHeaders },
                        body: JSON.stringify({ status: e.target.value }),
                      });
                      showNotice(`Mobilization "${mob.title}" moved to ${e.target.value}.`);
                      loadModuleData();
                    }}
                    className="px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                  >
                    {['Submitted', 'Initial Review', 'Verification', 'Returned for Revision', 'Approved', 'Active', 'Completed', 'Declined', 'Archived'].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODULE: PARTNERSHIPS */}
      {module === 'partnerships' && (
        <div className="space-y-8">
          {provisionedCreds && (
            <div className="p-5 border border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-sm space-y-1">
              <div className="font-semibold">Partner Organization Approved &amp; Portal Account Provisioned</div>
              <div className="font-mono text-xs">
                Email: {provisionedCreds.email} · Temporary Password: {provisionedCreds.temporaryPassword}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">Partnership Applications</h2>
            {applications.length === 0 ? (
              <p className="text-sm text-slate-500">No partnership applications pending review.</p>
            ) : (
              applications.map((appRow) => (
                <div key={appRow.id} className="p-5 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1 text-xs">
                    <div className="font-mono text-slate-500">
                      {appRow.referenceCode} · {appRow.orgType} · <strong>{appRow.status}</strong>
                    </div>
                    <div className="text-base font-semibold text-slate-900 dark:text-white">
                      {appRow.organizationName}
                    </div>
                    <div>
                      Rep: {appRow.authorizedRep} ({appRow.officialEmail}) · Areas: {appRow.proposedAreas}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['Initial Review', 'Verification', 'Interview/Consultation', 'Approved', 'Rejected'].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={async () => {
                          const res = await fetch(`/api/admin/applications/${appRow.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json', ...authHeaders },
                            body: JSON.stringify({ status: st }),
                          });
                          const d = await res.json();
                          if (d.provisionedPartnerCreds) {
                            setProvisionedCreds(d.provisionedPartnerCreds);
                          }
                          showNotice(`Application ${appRow.referenceCode} moved to ${st}.`);
                          loadModuleData();
                        }}
                        className={`px-3 py-1.5 text-xs rounded border cursor-pointer ${
                          st === 'Approved'
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : st === 'Rejected'
                              ? 'border-red-300 text-red-700'
                              : 'border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <h2 className="font-serif text-xl font-semibold">Partner Secretariat Inquiries</h2>
            {inquiries.map((inq) => (
              <div key={inq.id} className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="font-semibold text-sm">{inq.subject}</span>
                  <span>{inq.status}</span>
                </div>
                <p>{inq.message}</p>
                <button
                  type="button"
                  onClick={() => {
                    setReplyTargetId(replyTargetId === inq.id ? null : inq.id);
                    setReplyInput(inq.secretariatReply || '');
                  }}
                  className="px-3 py-1.5 font-semibold bg-navy-900 text-white rounded cursor-pointer"
                >
                  Reply to Partner
                </button>
                {replyTargetId === inq.id && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!replyInput.trim()) return;
                      await fetch(`/api/admin/inquiries/${inq.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', ...authHeaders },
                        body: JSON.stringify({ secretariatReply: replyInput.trim(), status: 'Responded' }),
                      });
                      setReplyTargetId(null);
                      setReplyInput('');
                      showNotice('Secretariat reply dispatched.');
                      loadModuleData();
                    }}
                    className="flex gap-2 pt-2"
                  >
                    <input
                      required
                      placeholder="Enter official Secretariat reply..."
                      value={replyInput}
                      onChange={(e) => setReplyInput(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                    />
                    <button type="submit" className="px-3 py-1.5 font-semibold bg-emerald-700 text-white rounded cursor-pointer">
                      Send Reply
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODULE: EVENTS & QR ATTENDANCE */}
      {module === 'events' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-6">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await fetch('/api/admin/events', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHeaders },
                  body: JSON.stringify(newEvent),
                });
                if (res.ok) {
                  showNotice('Event published to public calendar.');
                  loadModuleData();
                }
              }}
              className="p-5 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3"
            >
              <h2 className="font-serif text-lg font-semibold">Create Event</h2>
              <input required placeholder="Event Title" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-transparent" />
              <textarea required rows={3} placeholder="Description" value={newEvent.description} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-transparent" />
              <div className="grid grid-cols-2 gap-2">
                <select value={newEvent.category} onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })} className="px-2 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900">
                  <option>Conferences</option>
                  <option>Forums and dialogues</option>
                  <option>Consultations</option>
                  <option>Workshops and training</option>
                  <option>Community outreach</option>
                </select>
                <select value={newEvent.format} onChange={(e) => setNewEvent({ ...newEvent, format: e.target.value })} className="px-2 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900">
                  <option>Hybrid</option>
                  <option>In-person</option>
                  <option>Online</option>
                </select>
              </div>
              <input required placeholder="Venue or Online Meeting Info" value={newEvent.venueOrLink} onChange={(e) => setNewEvent({ ...newEvent, venueOrLink: e.target.value })} className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-transparent" />
              <button type="submit" className="px-4 py-2 text-xs font-semibold bg-navy-900 text-white rounded cursor-pointer">
                Publish Event
              </button>
            </form>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await fetch('/api/admin/events/checkin', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHeaders },
                  body: JSON.stringify({ qrToken: qrCheckinCode }),
                });
                const d = await res.json();
                if (res.ok) {
                  showNotice(`Checked in: ${d.fullName} (${d.delegationSize} seats)`);
                  setQrCheckinCode('');
                } else {
                  showNotice(d.error || 'Invalid QR token');
                }
              }}
              className="p-5 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3"
            >
              <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
                <QrCode className="w-4 h-4" /> QR Attendance Verification
              </h2>
              <input
                required
                placeholder="Enter QR Token (e.g. IND-EVT-1-...)"
                value={qrCheckinCode}
                onChange={(e) => setQrCheckinCode(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded bg-transparent"
              />
              <button type="submit" className="px-4 py-2 text-xs font-semibold bg-emerald-700 text-white rounded cursor-pointer">
                Mark Participant Attended
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 space-y-3">
            <h2 className="font-serif text-xl font-semibold">Event Attendance &amp; Exports</h2>
            {eventsList.map((ev) => (
              <div key={ev.id} className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500">
                    {ev.status} · <span className="font-mono">{ev.startAt}</span>
                  </div>
                  <div className="font-semibold text-sm">{ev.title}</div>
                  <div className="text-xs text-slate-500 tabular-nums">
                    Registered Seats: {ev.registeredSeats || 0} / {ev.capacity}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => downloadProtectedCsv(`/api/admin/events/${ev.id}/export`, `event-${ev.id}-attendance.csv`)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded cursor-pointer shrink-0"
                >
                  <Download className="w-3.5 h-3.5" /> Export Attendance CSV
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODULE: RESTRICTED CITIZEN ISANGUNI CASE MANAGEMENT */}
      {module === 'isanguni' && canAccessIsanguni && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-3">
            <h2 className="font-serif text-xl font-semibold text-crimson-600 dark:text-red-400">
              Restricted Citizen Isanguni Cases
            </h2>
            <p className="text-xs text-slate-500">
              Accessible exclusively to Citizen Affairs Officers and Super Administrators under RA
              10173 safeguards.
            </p>
            <div className="space-y-2.5">
              {isanguniList.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openIsanguniCase(c.id)}
                  className={`w-full text-left p-4 border rounded-lg space-y-1 cursor-pointer ${
                    selectedCase?.submission.id === c.id
                      ? 'border-crimson-600 bg-crimson-50/40 dark:bg-red-950/20'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex justify-between text-xs font-mono text-slate-500">
                    <span>{c.referenceNumber}</span>
                    <span className="font-semibold text-navy-900 dark:text-white">{c.status}</span>
                  </div>
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">{c.subject}</div>
                  <div className="text-xs text-slate-500">
                    {c.privacyMode.toUpperCase()} · {c.location}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7">
            {!selectedCase ? (
              <div className="p-10 border border-slate-200 dark:border-slate-800 rounded-lg text-center text-sm text-slate-500">
                Select a Citizen Isanguni report on the left to screen, update, or coordinate referral.
              </div>
            ) : (
              <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-6">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4 space-y-1">
                  <div className="font-mono text-xs text-slate-500">
                    {selectedCase.submission.referenceNumber} · {selectedCase.submission.privacyMode.toUpperCase()} · Referral Consent:{' '}
                    {selectedCase.submission.consentForReferral ? 'Confirmed' : 'Not Confirmed'}
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
                    {selectedCase.submission.subject}
                  </h3>
                  <div className="text-xs text-slate-500">
                    Location: {selectedCase.submission.location} · Observed: {selectedCase.submission.incidentDate}
                  </div>
                </div>

                <div className="space-y-2 text-xs leading-relaxed">
                  <p>
                    <strong>Description:</strong> {selectedCase.submission.description}
                  </p>
                  <p>
                    <strong>Why It Matters:</strong> {selectedCase.submission.whyItMatters}
                  </p>
                  <p>
                    <strong>Requested Action:</strong> {selectedCase.submission.requestedAction}
                  </p>
                  {selectedCase.submission.privacyMode !== 'anonymous' && (
                    <p className="pt-2 border-t border-slate-100 dark:border-slate-800 text-slate-500">
                      Reporter: {selectedCase.submission.reporterName || 'Shielded'} ·{' '}
                      {selectedCase.submission.reporterEmail} · {selectedCase.submission.reporterPhone}
                    </p>
                  )}
                </div>

                {/* Attachments */}
                {selectedCase.attachments.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold">Protected Attachments</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedCase.attachments.map((att) => (
                        <button
                          key={att.id}
                          type="button"
                          onClick={async () => {
                            const res = await fetch(`/api/isanguni/attachments/${att.id}`, {
                              headers: authHeaders,
                            });
                            if (!res.ok) return;
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = att.fileName;
                            a.click();
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded cursor-pointer"
                        >
                          <Download className="w-3 h-3" /> {att.fileName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status Transition */}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await fetch(`/api/admin/isanguni/${selectedCase.submission.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json', ...authHeaders },
                      body: JSON.stringify({
                        status: caseStatusUpdate,
                        statusNote: caseStatusNote,
                      }),
                    });
                    setCaseStatusNote('');
                    showNotice('Case status updated.');
                    openIsanguniCase(selectedCase.submission.id);
                    loadModuleData();
                  }}
                  className="p-4 bg-slate-50 dark:bg-slate-900 rounded-md space-y-3"
                >
                  <div className="text-xs font-semibold">Update Case Workflow Status</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={caseStatusUpdate}
                      onChange={(e) => setCaseStatusUpdate(e.target.value)}
                      className="px-2.5 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                    >
                      {ISANGUNI_STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <input
                      placeholder="Public status note for reporter..."
                      value={caseStatusNote}
                      onChange={(e) => setCaseStatusNote(e.target.value)}
                      className="px-2.5 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                    />
                  </div>
                  <button type="submit" className="px-4 py-1.5 text-xs font-semibold bg-navy-900 text-white rounded cursor-pointer">
                    Apply Status Change
                  </button>
                </form>

                {/* Notes / Clarification */}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await fetch(`/api/admin/isanguni/${selectedCase.submission.id}/updates`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', ...authHeaders },
                      body: JSON.stringify({
                        updateType: caseNotePublic ? 'clarification_request' : 'internal_note',
                        message: caseNoteMsg,
                        isPublicToReporter: caseNotePublic,
                      }),
                    });
                    setCaseNoteMsg('');
                    openIsanguniCase(selectedCase.submission.id);
                  }}
                  className="space-y-2"
                >
                  <textarea
                    required
                    rows={2}
                    placeholder="Add internal review note or clarification question..."
                    value={caseNoteMsg}
                    onChange={(e) => setCaseNoteMsg(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={caseNotePublic}
                        onChange={(e) => setCaseNotePublic(e.target.checked)}
                      />
                      Visible to reporter on Citizen Tracker
                    </label>
                    <button type="submit" className="px-3.5 py-1.5 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded cursor-pointer">
                      Record Note
                    </button>
                  </div>
                </form>

                {/* Consent-verified Referral */}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await fetch(`/api/admin/isanguni/${selectedCase.submission.id}/referrals`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', ...authHeaders },
                      body: JSON.stringify(referralForm),
                    });
                    const d = await res.json();
                    if (!res.ok) {
                      showNotice(d.error || 'Referral blocked.');
                    } else {
                      setReferralForm({ targetInstitutionName: '', referralReason: '', consentConfirmed: false });
                      showNotice('Referral prepared (status set to FOR REFERRAL; remains open until addressed).');
                      openIsanguniCase(selectedCase.submission.id);
                      loadModuleData();
                    }
                  }}
                  className="p-4 border border-slate-200 dark:border-slate-800 rounded space-y-2.5 text-xs"
                >
                  <div className="font-semibold">Prepare Institutional or Partner Referral</div>
                  <input
                    required
                    placeholder="Target Institution or Partner Organization"
                    value={referralForm.targetInstitutionName}
                    onChange={(e) => setReferralForm({ ...referralForm, targetInstitutionName: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                  />
                  <input
                    required
                    placeholder="Referral rationale & safeguards scope"
                    value={referralForm.referralReason}
                    onChange={(e) => setReferralForm({ ...referralForm, referralReason: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                  />
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={referralForm.consentConfirmed}
                      onChange={(e) => setReferralForm({ ...referralForm, consentConfirmed: e.target.checked })}
                    />
                    Confirm informed reporter consent (or anonymized extraction) before referral
                  </label>
                  <button type="submit" className="px-3.5 py-1.5 font-semibold bg-crimson-600 text-white rounded cursor-pointer">
                    Record Referral
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODULE: ANNOUNCEMENTS */}
      {module === 'announcements' && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await fetch('/api/admin/announcements', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeaders },
              body: JSON.stringify(newAnnouncement),
            });
            if (res.ok) {
              setNewAnnouncement({ title: '', body: '', audience: 'public', category: 'Official Notice' });
              showNotice('Announcement published.');
              onRefreshPublic();
            }
          }}
          className="max-w-xl p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4"
        >
          <h2 className="font-serif text-xl font-semibold">Publish Announcement or Partner Circular</h2>
          <input required placeholder="Title" value={newAnnouncement.title} onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent" />
          <div className="grid grid-cols-2 gap-3">
            <select value={newAnnouncement.audience} onChange={(e) => setNewAnnouncement({ ...newAnnouncement, audience: e.target.value })} className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900">
              <option value="public">Public Homepage</option>
              <option value="partners">Partner Portal Circular</option>
            </select>
            <select value={newAnnouncement.category} onChange={(e) => setNewAnnouncement({ ...newAnnouncement, category: e.target.value })} className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900">
              <option>Official Notice</option>
              <option>Secretariat Circular</option>
              <option>Memorandum</option>
              <option>Call for Partnership</option>
            </select>
          </div>
          <textarea required rows={4} placeholder="Body" value={newAnnouncement.body} onChange={(e) => setNewAnnouncement({ ...newAnnouncement, body: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent" />
          <button type="submit" className="px-5 py-2 text-xs font-semibold bg-navy-900 text-white rounded cursor-pointer">
            Publish Notice
          </button>
        </form>
      )}

      {/* MODULE: USERS & RBAC */}
      {module === 'users' && usersData && (
        <div className="space-y-4">
          <h2 className="font-serif text-xl font-semibold">User Accounts &amp; Role-Based Access Control</h2>
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 text-left text-slate-500">
                <tr>
                  <th className="p-3">Email</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Assigned Role</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {usersData.users.map((u) => (
                  <tr key={u.id}>
                    <td className="p-3 font-mono">{u.email}</td>
                    <td className="p-3">{u.displayName}</td>
                    <td className="p-3">
                      <select
                        disabled={dbUser.roleSlug !== 'super_admin'}
                        value={u.roleSlug}
                        onChange={async (e) => {
                          await fetch(`/api/admin/users/${u.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json', ...authHeaders },
                            body: JSON.stringify({ roleSlug: e.target.value }),
                          });
                          showNotice(`Updated role for ${u.email}`);
                          loadModuleData();
                        }}
                        className="px-2 py-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                      >
                        {usersData.roles.map((r) => (
                          <option key={r.slug} value={r.slug}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">{u.isActive ? 'Active' : 'Disabled'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODULE: SYSTEM SETTINGS */}
      {module === 'settings' && (
        <div className="max-w-2xl space-y-4">
          <h2 className="font-serif text-xl font-semibold">System Settings &amp; Policies</h2>
          {settingsList.map((s) => (
            <div key={s.key} className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2 text-xs">
              <div className="font-mono font-semibold">{s.key}</div>
              <div className="text-slate-500">{s.description}</div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded">{s.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
