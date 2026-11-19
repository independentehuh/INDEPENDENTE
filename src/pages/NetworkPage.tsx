import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Compass,
  FileText,
  Globe,
  Handshake,
  Layers,
  Lock,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { OrgAnnouncementsChat } from '../components/OrgAnnouncementsChat.tsx';
import {
  CollaborationRequest,
  CollaborativeProject,
  CollaboratorCandidate,
  Organization,
  PageRoute,
} from '../types/index.ts';

interface NetworkPageProps {
  initialSlug?: string;
  onNavigate: (page: PageRoute, slug?: string) => void;
}

interface OrgDetail extends Organization {
  activities: Array<{
    id: number;
    title: string;
    activityType: string;
    description: string;
    activityDate: string;
    accomplishmentSummary: string;
    status: string;
  }>;
  relatedPublications: Array<{ id: number; slug: string; title: string; publishedAt: string }>;
}

interface OrgWorkspacePayload {
  organization: Organization;
  yourOrgRole: string;
  members: Array<{
    id: number;
    email: string;
    fullName: string;
    orgRole: string;
    titleOrCommittee: string;
    status: string;
  }>;
  membershipApplications: Array<{
    id: number;
    applicantName: string;
    applicantEmail: string;
    applicantPhone: string;
    motivation: string;
    skillsOrInterests: string;
    status: string;
    reviewNotes: string;
    createdAt: string;
  }>;
  representatives: Array<{
    id: number;
    fullName: string;
    position: string;
    email: string;
    partnerRole: string;
  }>;
  announcements: Array<{
    id: number;
    title: string;
    body: string;
    category: string;
    eventDate: string;
    authorName: string;
    createdAt: string;
  }>;
  documents: Array<{ id: number; title: string; category: string; description: string; fileUrl: string }>;
  activities: Array<{
    id: number;
    title: string;
    activityType: string;
    activityDate: string;
    accomplishmentSummary: string;
    description: string;
    status: string;
  }>;
  events: Array<{
    id: number;
    slug: string;
    title: string;
    startAt: string;
    format: string;
    venueOrLink: string;
  }>;
}

interface ProjectDetailPayload {
  project: CollaborativeProject;
  participants: Array<{ id: number; entityName: string; entityType: string; role: string }>;
  tasks: Array<{ id: number; title: string; assignedEntity: string; dueDate: string; status: string }>;
  reports: Array<{ id: number; authorName: string; reportType: string; title: string; summary: string; createdAt: string }>;
  events: Array<{ id: number; slug: string; title: string; startAt: string; format: string; venueOrLink: string }>;
}

const ORG_ROLES = [
  'Organization Administrator',
  'President / Chairperson',
  'Secretary',
  'Treasurer',
  'Communications Officer',
  'Program Coordinator',
  'Ordinary Member',
];

export const NetworkPage: React.FC<NetworkPageProps> = ({ initialSlug, onNavigate }) => {
  const { idToken, partnerToken, dbUser, partnerUser, signInWithGoogle } = useAuth();
  const activeToken = idToken || partnerToken;
  const activeUser = dbUser || partnerUser;

  const [tab, setTab] = useState<'directory' | 'establish' | 'apply' | 'status' | 'workspace' | 'collaborations'>(
    initialSlug === 'apply'
      ? 'apply'
      : initialSlug?.startsWith('workspace-')
        ? 'workspace'
        : initialSlug === 'collaborations'
          ? 'collaborations'
          : 'directory'
  );

  // Directory & Profile state
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<OrgDetail | null>(null);
  const [affiliationFilter, setAffiliationFilter] = useState('all');
  const [orgTypeFilter, setOrgTypeFilter] = useState('all');
  const [searchText, setSearchText] = useState('');

  // Join Existing Organization Form (on org profile detail)
  const [joinForm, setJoinForm] = useState({
    applicantName: '',
    applicantEmail: '',
    applicantPhone: '',
    motivation: '',
    skillsOrInterests: '',
  });
  const [joinResult, setJoinResult] = useState('');
  const [joinError, setJoinError] = useState('');

  // Establish an Organization (OP-03)
  const [estForm, setEstForm] = useState({
    organizationName: '',
    orgType: 'Civic Coalition',
    location: '',
    description: '',
    mission: '',
    vision: '',
    objectives: '',
    proposedPrograms: '',
    advocacyInterests: '',
    orgStructure: 'General Assembly, Executive Board, and Secretariat',
    membershipRequirements: 'Open to committed civic advocates aligned with nonpartisan democratic charter.',
    founderName: '',
    founderEmail: '',
    founderContact: '',
  });
  const [estResult, setEstResult] = useState<{
    referenceCode: string;
    status: string;
    organizationName: string;
    notice: string;
  } | null>(null);
  const [estError, setEstError] = useState('');

  // Partner Accreditation Application (preserved from existing)
  const [formState, setFormState] = useState({
    organizationName: '',
    orgType: 'Civic Coalition',
    officialAddress: '',
    websiteOrSocial: '',
    background: '',
    mission: '',
    vision: '',
    advocacyInterests: '',
    authorizedRep: '',
    position: '',
    officialEmail: '',
    contactNumber: '',
    proposedAreas: '',
    consentGiven: false,
  });
  const [supportingDoc, setSupportingDoc] = useState<File | null>(null);
  const [submittingApp, setSubmittingApp] = useState(false);
  const [appResult, setAppResult] = useState<{ referenceCode: string; status: string } | null>(null);
  const [appError, setAppError] = useState('');

  // Status check
  const [checkRef, setCheckRef] = useState('');
  const [checkedStatus, setCheckedStatus] = useState<{
    referenceCode: string;
    organizationName: string;
    status: string;
    reviewNotes: string;
  } | null>(null);
  const [checkError, setCheckError] = useState('');

  // Organization Workspace state
  const [workspaceOrgId, setWorkspaceOrgId] = useState<number>(
    initialSlug?.startsWith('workspace-') ? Number(initialSlug.replace('workspace-', '')) : 1
  );
  const [workspaceData, setWorkspaceData] = useState<OrgWorkspacePayload | null>(null);
  const [workspaceSection, setWorkspaceSection] = useState<
    'overview' | 'members' | 'applications' | 'announcements' | 'activities' | 'documents'
  >('overview');
  const [workspaceError, setWorkspaceError] = useState('');
  const [workspaceNotice, setWorkspaceNotice] = useState('');

  // Collaborations & Find Collaborators state
  const [collabInterest, setCollabInterest] = useState('');
  const [collabLocation, setCollabLocation] = useState('');
  const [collabTypeFilter, setCollabTypeFilter] = useState('all');
  const [candidates, setCandidates] = useState<CollaboratorCandidate[]>([]);
  const [requestsList, setRequestsList] = useState<CollaborationRequest[]>([]);
  const [projectsList, setProjectsList] = useState<CollaborativeProject[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<CollaboratorCandidate | null>(null);
  const [collabReqForm, setCollabReqForm] = useState({
    title: '',
    purpose: '',
    proposedScope: '',
    timeline: 'Q1–Q2 2027',
  });
  const [collabNotice, setCollabNotice] = useState('');
  const [selectedProject, setSelectedProject] = useState<ProjectDetailPayload | null>(null);
  const [newProjTask, setNewProjTask] = useState({ title: '', assignedEntity: '', dueDate: '' });
  const [newProjReport, setNewProjReport] = useState({
    reportType: 'Progress Update',
    title: '',
    summary: '',
  });
  const [newProjEvent, setNewProjEvent] = useState({
    title: '',
    description: '',
    format: 'Hybrid',
    startAt: '2027-02-15 14:00',
    endAt: '2027-02-15 17:00',
    venueOrLink: '',
  });

  const authHeaders: Record<string, string> = activeToken ? { Authorization: `Bearer ${activeToken}` } : {};

  const loadOrganizations = async () => {
    const params = new URLSearchParams();
    if (affiliationFilter !== 'all') params.set('affiliation', affiliationFilter);
    if (orgTypeFilter !== 'all') params.set('orgType', orgTypeFilter);
    if (searchText.trim()) params.set('q', searchText.trim());
    const res = await fetch(`/api/org-hub/organizations?${params.toString()}`);
    if (res.ok) setOrgs(await res.json());
  };

  const openOrganization = async (slug: string) => {
    const res = await fetch(`/api/organizations/${encodeURIComponent(slug)}`);
    if (res.ok) {
      setSelectedOrg(await res.json());
      setJoinResult('');
      setJoinError('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const loadWorkspace = async (orgId: number) => {
    if (!activeToken) return;
    setWorkspaceError('');
    const res = await fetch(`/api/org-hub/organizations/${orgId}/workspace`, {
      headers: authHeaders,
    });
    const d = await res.json();
    if (!res.ok) {
      setWorkspaceData(null);
      setWorkspaceError(d.error || 'Unable to access this organization workspace.');
    } else {
      setWorkspaceData(d);
    }
  };

  const loadCollaborations = async () => {
    const params = new URLSearchParams();
    if (collabInterest.trim()) params.set('interest', collabInterest.trim());
    if (collabLocation.trim()) params.set('location', collabLocation.trim());
    if (collabTypeFilter !== 'all') params.set('entityType', collabTypeFilter);

    const [discRes, projRes] = await Promise.all([
      fetch(`/api/collaborations/discover?${params.toString()}`),
      fetch('/api/collaborations/projects'),
    ]);
    if (discRes.ok) setCandidates(await discRes.json());
    if (projRes.ok) setProjectsList(await projRes.json());

    if (activeToken) {
      const reqRes = await fetch('/api/collaborations/requests', { headers: authHeaders });
      if (reqRes.ok) setRequestsList(await reqRes.json());
    }
  };

  const openProjectWorkspace = async (projectId: number) => {
    const res = await fetch(`/api/collaborations/projects/${projectId}`);
    if (res.ok) {
      setSelectedProject(await res.json());
    }
  };

  useEffect(() => {
    loadOrganizations();
  }, [affiliationFilter, orgTypeFilter]);

  useEffect(() => {
    if (activeUser) {
      setJoinForm((prev) => ({
        ...prev,
        applicantName: prev.applicantName || activeUser.displayName || '',
        applicantEmail: prev.applicantEmail || activeUser.email || '',
      }));
      setEstForm((prev) => ({
        ...prev,
        founderName: prev.founderName || activeUser.displayName || '',
        founderEmail: prev.founderEmail || activeUser.email || '',
      }));
    }
  }, [activeUser]);

  useEffect(() => {
    if (initialSlug === 'apply') {
      setTab('apply');
      setSelectedOrg(null);
    } else if (initialSlug === 'collaborations') {
      setTab('collaborations');
      setSelectedOrg(null);
    } else if (initialSlug?.startsWith('workspace-')) {
      const id = Number(initialSlug.replace('workspace-', ''));
      if (id > 0) {
        setWorkspaceOrgId(id);
        setTab('workspace');
        setSelectedOrg(null);
      }
    } else if (initialSlug) {
      openOrganization(initialSlug);
    }
  }, [initialSlug]);

  useEffect(() => {
    if (tab === 'workspace' && activeToken && workspaceOrgId > 0) {
      loadWorkspace(workspaceOrgId);
    }
    if (tab === 'collaborations') {
      loadCollaborations();
    }
  }, [tab, activeToken, workspaceOrgId]);

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAppError('');
    setSubmittingApp(true);
    try {
      const fd = new FormData();
      Object.entries(formState).forEach(([k, v]) => fd.append(k, String(v)));
      if (supportingDoc) fd.append('supportingDoc', supportingDoc);

      const res = await fetch('/api/partnerships/apply', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) setAppError(data.error || 'Unable to submit application.');
      else setAppResult(data);
    } catch {
      setAppError('Network error submitting application.');
    } finally {
      setSubmittingApp(false);
    }
  };

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckError('');
    setCheckedStatus(null);
    const res = await fetch(
      `/api/partnerships/application-status?ref=${encodeURIComponent(checkRef.trim())}`
    );
    const data = await res.json();
    if (!res.ok) setCheckError(data.error || 'Not found.');
    else setCheckedStatus(data);
  };

  if (selectedOrg) {
    return (
      <div className="max-w-[1150px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <button
          type="button"
          onClick={() => setSelectedOrg(null)}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-navy-900 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Organization Hub Directory
        </button>

        <div className="p-8 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/60 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
            <div className="space-y-2">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {selectedOrg.affiliationStatus || 'Official Partner Organization'} · {selectedOrg.orgType} · Since{' '}
                <span className="tabular-nums">{selectedOrg.partnershipDate}</span>
                {selectedOrg.isDemonstration ? ' · Demonstration Record' : ''}
              </div>
              <h1 className="font-serif text-3xl font-semibold text-navy-900 dark:text-white">
                {selectedOrg.name}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
                {selectedOrg.description}
              </p>
            </div>
            <div className="flex flex-col sm:items-end gap-3 shrink-0">
              {selectedOrg.logoUrl ? (
                <img
                  src={selectedOrg.logoUrl}
                  alt={`${selectedOrg.name} logo`}
                  className="w-20 h-20 object-contain rounded border border-slate-200 dark:border-slate-700 bg-white p-1"
                />
              ) : (
                <div className="w-16 h-16 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-center bg-slate-50 dark:bg-slate-800">
                  <Building2 className="w-7 h-7 text-navy-900 dark:text-slate-300" />
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setWorkspaceOrgId(selectedOrg.id);
                  setSelectedOrg(null);
                  setTab('workspace');
                }}
                className="px-3.5 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Open Organization Workspace →
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white mb-1">Mission</h2>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {selectedOrg.mission}
              </p>
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white mb-1">Vision</h2>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {selectedOrg.vision}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Advocacy Interests</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                {selectedOrg.advocacyInterests}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Geographic Coverage</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                {selectedOrg.geographicCoverage}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Official Representative</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                {selectedOrg.officialRepresentative}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Links</dt>
              <dd className="font-medium text-navy-900 dark:text-slate-200 mt-0.5 flex items-center gap-2">
                <Globe className="w-3.5 h-3.5" />
                <span>{selectedOrg.website || selectedOrg.socialLinks || 'Available upon request'}</span>
              </dd>
            </div>
          </dl>

          {/* Join Existing Organization Section */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
                Join This Organization (Membership Application)
              </h2>
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                {selectedOrg.acceptingMembers !== false ? 'Accepting Member Applications' : 'Membership Closed'}
              </span>
            </div>
            {selectedOrg.membershipRequirements && (
              <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 p-3.5 rounded border border-slate-200 dark:border-slate-800">
                <strong>Membership Requirements:</strong> {selectedOrg.membershipRequirements}
              </p>
            )}
            {joinResult ? (
              <div className="p-4 border border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-md text-sm text-emerald-900 dark:text-emerald-200">
                {joinResult} Track approval inside My Workspace.
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setJoinError('');
                  const res = await fetch(`/api/org-hub/organizations/${selectedOrg.id}/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeaders },
                    body: JSON.stringify(joinForm),
                  });
                  const d = await res.json();
                  if (!res.ok) setJoinError(d.error || 'Unable to submit membership request.');
                  else setJoinResult(d.message);
                }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs"
              >
                {joinError && (
                  <div className="sm:col-span-2 p-2.5 text-red-700 bg-red-50 border border-red-200 rounded">
                    {joinError}
                  </div>
                )}
                <input
                  required
                  placeholder="Full Name *"
                  value={joinForm.applicantName}
                  onChange={(e) => setJoinForm({ ...joinForm, applicantName: e.target.value })}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                />
                <input
                  required
                  type="email"
                  placeholder="Email Address *"
                  value={joinForm.applicantEmail}
                  onChange={(e) => setJoinForm({ ...joinForm, applicantEmail: e.target.value })}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                />
                <input
                  placeholder="Contact Number"
                  value={joinForm.applicantPhone}
                  onChange={(e) => setJoinForm({ ...joinForm, applicantPhone: e.target.value })}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                />
                <input
                  placeholder="Skills, Chapter, or Committee Interest"
                  value={joinForm.skillsOrInterests}
                  onChange={(e) => setJoinForm({ ...joinForm, skillsOrInterests: e.target.value })}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                />
                <textarea
                  required
                  rows={2}
                  placeholder="Statement of motivation & civic commitment *"
                  value={joinForm.motivation}
                  onChange={(e) => setJoinForm({ ...joinForm, motivation: e.target.value })}
                  className="sm:col-span-2 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                />
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-semibold bg-navy-900 text-white rounded hover:bg-navy-800 cursor-pointer"
                  >
                    Submit Membership Application
                  </button>
                </div>
              </form>
            )}
          </div>

          {selectedOrg.activities.length > 0 && (
            <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
                Activities &amp; Contributions
              </h2>
              <div className="space-y-3">
                {selectedOrg.activities.map((act) => (
                  <div key={act.id} className="p-4 border border-slate-200 dark:border-slate-800 rounded-md">
                    <div className="text-xs text-slate-500">
                      {act.activityType} · <span className="tabular-nums">{act.activityDate}</span> · {act.status}
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-white mt-0.5">{act.title}</div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{act.accomplishmentSummary || act.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedOrg.relatedPublications.length > 0 && (
            <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
                Related Publications
              </h2>
              {selectedOrg.relatedPublications.map((pub) => (
                <button
                  key={pub.id}
                  type="button"
                  onClick={() => onNavigate('media', pub.slug)}
                  className="block text-left text-sm font-medium text-navy-900 dark:text-slate-200 hover:underline cursor-pointer"
                >
                  {pub.title} ({pub.publishedAt})
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-widest text-crimson-600 dark:text-red-400">
            OP-03 &amp; OP-04 · Organization Hub &amp; Collaboration Ecosystem
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-navy-900 dark:text-white">
            Organizations &amp; Network Collaborations
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
            Discover and join independent or affiliated civic organizations, establish a new
            organization workspace, accredit official partners, and build joint collaborations.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'directory', label: 'Organization Hub & Join' },
            { id: 'establish', label: 'Establish Organization' },
            { id: 'workspace', label: 'Organization Workspace' },
            { id: 'collaborations', label: 'Find Collaborators & Projects' },
            { id: 'apply', label: 'Partner Accreditation' },
            { id: 'status', label: 'Application Status' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as typeof tab)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap ${
                tab === item.id
                  ? item.id === 'establish' || item.id === 'apply'
                    ? 'bg-crimson-600 text-white'
                    : 'bg-navy-900 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Membership & Affiliation Structure Distinction */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg space-y-1">
          <div className="text-xs font-semibold text-navy-900 dark:text-white">
            Independent Organizations
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Self-governing civic groups with isolated workspaces, autonomous membership rosters, and
            independent governance.
          </p>
        </div>
        <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg space-y-1">
          <div className="text-xs font-semibold text-navy-900 dark:text-white">
            Affiliated Organizations
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Recognized chapters and aligned civic collectives participating regularly in joint
            mobilizations.
          </p>
        </div>
        <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg space-y-1">
          <div className="text-xs font-semibold text-navy-900 dark:text-white">
            Official Partner Organizations
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Accredited institutions, NGOs, and academic centers with MOU status and Partner Portal
            access.
          </p>
        </div>
        <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg space-y-1">
          <div className="text-xs font-semibold text-navy-900 dark:text-white">
            Central Network Units
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Core INDEPENDENTE operational wings and Secretariat bodies coordinating across divisions.
          </p>
        </div>
      </section>

      {/* TAB: DIRECTORY & JOIN */}
      {tab === 'directory' && (
        <section className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/70 dark:bg-slate-900/50">
            <select
              aria-label="Filter by affiliation classification"
              value={affiliationFilter}
              onChange={(e) => setAffiliationFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900"
            >
              <option value="all">All Classifications</option>
              <option value="Independent Organization">Independent Organization</option>
              <option value="Affiliated Organization">Affiliated Organization</option>
              <option value="Official Partner Organization">Official Partner Organization</option>
              <option value="Central Network Unit">Central Network Unit</option>
            </select>
            <select
              aria-label="Filter by organization type"
              value={orgTypeFilter}
              onChange={(e) => setOrgTypeFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900"
            >
              <option value="all">All Organization Types</option>
              <option value="Civic Coalition">Civic Coalition</option>
              <option value="Community Organization">Community Organization</option>
              <option value="Academic Institution">Academic Institution</option>
              <option value="Independent Media Partner">Independent Media Partner</option>
              <option value="Youth Organization">Youth Organization</option>
            </select>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search name, advocacy, or region..."
              className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900"
            />
            <button
              type="button"
              onClick={loadOrganizations}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold bg-navy-900 text-white rounded-md hover:bg-navy-800 cursor-pointer"
            >
              <Search className="w-4 h-4" /> Apply Filters
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {orgs.map((org) => (
              <div
                key={org.id}
                className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/60 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-navy-900 dark:text-slate-200">
                      {org.affiliationStatus || 'Official Partner Organization'}
                    </span>{' '}
                    · {org.orgType} · {org.geographicCoverage}
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
                    {org.name}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {org.description}
                  </p>
                  <div className="text-xs text-slate-500 pt-1">
                    <strong>Focus:</strong> {org.advocacyInterests} ·{' '}
                    <span className="tabular-nums">{org.memberCount || 0} active members</span>
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-500">Rep: {org.officialRepresentative}</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setWorkspaceOrgId(org.id);
                        setTab('workspace');
                      }}
                      className="font-medium text-slate-600 dark:text-slate-300 hover:underline cursor-pointer"
                    >
                      Workspace
                    </button>
                    <button
                      type="button"
                      onClick={() => openOrganization(org.slug)}
                      className="font-semibold text-navy-900 dark:text-slate-200 hover:underline cursor-pointer"
                    >
                      Profile &amp; Join →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TAB: ESTABLISH AN ORGANIZATION */}
      {tab === 'establish' && (
        <section className="max-w-3xl space-y-6">
          <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-900/50 space-y-2">
            <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
              Establish an Organization (OP-03 Organizing Operations)
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Workflow: Submitted → Initial Screening → Verification → Approved / Returned →
              Organization Workspace Onboarding. <strong>Governance Clarification:</strong> Platform
              approval grants an independent digital organizational workspace within INDEPENDENTE
              and does not constitute statutory incorporation with SEC, CDA, or DILG.
            </p>
          </div>

          {estResult ? (
            <div className="p-8 border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-lg space-y-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-700 dark:text-emerald-400" />
              <h3 className="font-serif text-2xl font-semibold">
                Establishment Application Recorded
              </h3>
              <div className="font-mono text-lg font-semibold tabular-nums">
                {estResult.referenceCode} ({estResult.status})
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300">{estResult.notice}</p>
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setEstError('');
                const res = await fetch('/api/org-hub/apply', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHeaders },
                  body: JSON.stringify(estForm),
                });
                const d = await res.json();
                if (!res.ok) setEstError(d.error || 'Unable to submit establishment request.');
                else setEstResult(d);
              }}
              className="p-6 sm:p-8 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4 bg-white dark:bg-slate-900/60"
            >
              {estError && (
                <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded">
                  {estError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Organization Name *</label>
                  <input
                    required
                    value={estForm.organizationName}
                    onChange={(e) => setEstForm({ ...estForm, organizationName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Organization Type *</label>
                  <select
                    value={estForm.orgType}
                    onChange={(e) => setEstForm({ ...estForm, orgType: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                  >
                    <option>Civic Coalition</option>
                    <option>Community Organization</option>
                    <option>Youth Organization</option>
                    <option>Academic / Campus Group</option>
                    <option>Advocacy Collective</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Primary Location / Coverage *</label>
                <input
                  required
                  placeholder="e.g., Cebu City & Central Visayas"
                  value={estForm.location}
                  onChange={(e) => setEstForm({ ...estForm, location: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Description *</label>
                <textarea
                  required
                  rows={2}
                  value={estForm.description}
                  onChange={(e) => setEstForm({ ...estForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Mission *</label>
                  <textarea
                    required
                    rows={2}
                    value={estForm.mission}
                    onChange={(e) => setEstForm({ ...estForm, mission: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Vision *</label>
                  <textarea
                    required
                    rows={2}
                    value={estForm.vision}
                    onChange={(e) => setEstForm({ ...estForm, vision: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Objectives &amp; Proposed Programs *</label>
                <textarea
                  required
                  rows={2}
                  value={estForm.objectives}
                  onChange={(e) => setEstForm({ ...estForm, objectives: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Advocacy Interests *</label>
                  <input
                    required
                    placeholder="e.g., Local Budget Transparency, Youth Organizing"
                    value={estForm.advocacyInterests}
                    onChange={(e) => setEstForm({ ...estForm, advocacyInterests: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Membership Requirements</label>
                  <input
                    value={estForm.membershipRequirements}
                    onChange={(e) => setEstForm({ ...estForm, membershipRequirements: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-semibold mb-1">Founder / Lead Name *</label>
                  <input
                    required
                    value={estForm.founderName}
                    onChange={(e) => setEstForm({ ...estForm, founderName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Founder Email *</label>
                  <input
                    required
                    type="email"
                    value={estForm.founderEmail}
                    onChange={(e) => setEstForm({ ...estForm, founderEmail: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Contact Number</label>
                  <input
                    value={estForm.founderContact}
                    onChange={(e) => setEstForm({ ...estForm, founderContact: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="px-6 py-2.5 text-sm font-semibold text-white bg-navy-900 hover:bg-navy-800 rounded-md cursor-pointer"
              >
                Submit Establishment Proposal
              </button>
            </form>
          )}
        </section>
      )}

      {/* TAB: ISOLATED ORGANIZATION WORKSPACE */}
      {tab === 'workspace' && (
        <section className="space-y-6">
          <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-crimson-600 dark:text-red-400">
                Tenant-Isolated Organization Workspace
              </div>
              <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
                {workspaceData?.organization.name || 'Select Your Organization Workspace'}
              </h2>
            </div>
            <select
              aria-label="Select organization workspace"
              value={workspaceOrgId}
              onChange={(e) => setWorkspaceOrgId(Number(e.target.value))}
              className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.affiliationStatus})
                </option>
              ))}
            </select>
          </div>

          {!activeToken ? (
            <div className="p-10 border border-slate-200 dark:border-slate-800 rounded-lg text-center space-y-4">
              <Lock className="w-8 h-8 text-navy-900 dark:text-white mx-auto" />
              <h3 className="font-serif text-xl font-semibold">Authentication Required</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-lg mx-auto">
                Organization Workspaces are strictly isolated to verified organization members,
                officers, and Partner Portal administrators.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="px-5 py-2 text-xs font-semibold bg-navy-900 text-white rounded-md cursor-pointer"
                >
                  Sign In with Google
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('partner-portal')}
                  className="px-5 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-md cursor-pointer"
                >
                  Partner Portal Login
                </button>
              </div>
            </div>
          ) : workspaceError ? (
            <div className="p-8 border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 rounded-lg text-sm space-y-2">
              <div className="font-semibold">Access Boundary Enforced</div>
              <p>{workspaceError}</p>
            </div>
          ) : (
            workspaceData && (
              <div className="space-y-6">
                {workspaceNotice && (
                  <div className="p-3 border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 text-sm text-emerald-900 dark:text-emerald-200 rounded">
                    {workspaceNotice}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'overview', label: 'Profile & Calendar' },
                    { id: 'members', label: `Members & Roles (${workspaceData.members.length})` },
                    { id: 'applications', label: `Membership Apps (${workspaceData.membershipApplications.length})` },
                    { id: 'announcements', label: `Announcements & Group Chat (${workspaceData.announcements.length})` },
                    { id: 'activities', label: `Accomplishments & Events` },
                    { id: 'documents', label: `Documents (${workspaceData.documents.length})` },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setWorkspaceSection(s.id as typeof workspaceSection)}
                      className={`px-3.5 py-2 text-xs font-semibold rounded-md cursor-pointer ${
                        workspaceSection === s.id
                          ? 'bg-navy-900 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {workspaceSection === 'overview' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2 text-sm">
                      <div className="text-xs text-slate-500">
                        Your Organizational Role: <strong>{workspaceData.yourOrgRole}</strong>
                      </div>
                      <h3 className="font-serif text-lg font-semibold">Organization Charter &amp; Profile</h3>
                      <p className="text-slate-600 dark:text-slate-300">{workspaceData.organization.description}</p>
                      <div className="text-xs text-slate-500 pt-2">
                        <strong>Classification:</strong> {workspaceData.organization.affiliationStatus} ·{' '}
                        <strong>Location:</strong> {workspaceData.organization.geographicCoverage}
                      </div>
                    </div>
                    <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
                      <h3 className="font-serif text-lg font-semibold flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> Organization Schedule &amp; Linked Events
                      </h3>
                      {workspaceData.events.length === 0 ? (
                        <p className="text-xs text-slate-500">No organization-specific events scheduled yet.</p>
                      ) : (
                        <div className="space-y-2 text-xs">
                          {workspaceData.events.map((ev) => (
                            <div key={ev.id} className="p-2.5 border border-slate-200 dark:border-slate-800 rounded">
                              <div className="font-semibold">{ev.title}</div>
                              <div className="text-slate-500 font-mono">
                                {ev.startAt} · {ev.format}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {workspaceSection === 'members' && (
                  <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4">
                    <h3 className="font-serif text-lg font-semibold flex items-center gap-2">
                      <Users className="w-4 h-4" /> Members &amp; Internal Leadership Roles
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-2 pr-3">Name</th>
                            <th className="py-2 pr-3">Email</th>
                            <th className="py-2 pr-3">Role Assignment</th>
                            <th className="py-2">Committee / Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {workspaceData.members.map((m) => (
                            <tr key={m.id}>
                              <td className="py-2.5 pr-3 font-medium">{m.fullName}</td>
                              <td className="py-2.5 pr-3 font-mono text-slate-500">{m.email}</td>
                              <td className="py-2.5 pr-3">
                                <select
                                  value={m.orgRole}
                                  onChange={async (e) => {
                                    const res = await fetch(
                                      `/api/org-hub/organizations/${workspaceData.organization.id}/members/${m.id}`,
                                      {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json', ...authHeaders },
                                        body: JSON.stringify({ orgRole: e.target.value }),
                                      }
                                    );
                                    if (res.ok) {
                                      setWorkspaceNotice(`Updated role for ${m.fullName}.`);
                                      loadWorkspace(workspaceData.organization.id);
                                    }
                                  }}
                                  className="px-2 py-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                                >
                                  {ORG_ROLES.map((r) => (
                                    <option key={r}>{r}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2.5 text-slate-500">
                                {m.titleOrCommittee} · {m.status}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {workspaceSection === 'applications' && (
                  <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4">
                    <h3 className="font-serif text-lg font-semibold">Incoming Membership Applications</h3>
                    {workspaceData.membershipApplications.length === 0 ? (
                      <p className="text-sm text-slate-500">No membership applications on record.</p>
                    ) : (
                      <div className="space-y-3 text-xs">
                        {workspaceData.membershipApplications.map((a) => (
                          <div key={a.id} className="p-4 border border-slate-200 dark:border-slate-800 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="font-semibold text-sm">{a.applicantName} ({a.applicantEmail})</div>
                              <div className="text-slate-500">Status: <strong>{a.status}</strong> · Skills: {a.skillsOrInterests}</div>
                              <p className="text-slate-600 dark:text-slate-300 mt-1">{a.motivation}</p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              {['Approved', 'Returned for Clarification', 'Declined'].map((st) => (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={async () => {
                                    const res = await fetch(
                                      `/api/org-hub/organizations/${workspaceData.organization.id}/membership-applications/${a.id}`,
                                      {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json', ...authHeaders },
                                        body: JSON.stringify({ status: st }),
                                      }
                                    );
                                    if (res.ok) {
                                      setWorkspaceNotice(`Application moved to ${st}.`);
                                      loadWorkspace(workspaceData.organization.id);
                                    }
                                  }}
                                  className={`px-2.5 py-1.5 rounded border cursor-pointer ${
                                    st === 'Approved'
                                      ? 'bg-emerald-700 text-white border-emerald-700'
                                      : 'border-slate-300 dark:border-slate-700'
                                  }`}
                                >
                                  {st}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {workspaceSection === 'announcements' && (
                  <OrgAnnouncementsChat
                    fixedOrgId={workspaceData.organization.id}
                    onNavigate={onNavigate}
                  />
                )}

                {workspaceSection === 'activities' && (
                  <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
                    <h3 className="font-serif text-lg font-semibold">Activities &amp; Accomplishment Reports</h3>
                    {workspaceData.activities.length === 0 ? (
                      <p className="text-sm text-slate-500">No organizational accomplishment reports recorded yet.</p>
                    ) : (
                      workspaceData.activities.map((act) => (
                        <div key={act.id} className="p-4 border border-slate-200 dark:border-slate-800 rounded text-xs space-y-1">
                          <div className="text-slate-500">
                            {act.activityType} · {act.activityDate} · {act.status}
                          </div>
                          <div className="font-semibold text-sm">{act.title}</div>
                          <p>{act.accomplishmentSummary || act.description}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {workspaceSection === 'documents' && (
                  <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
                    <h3 className="font-serif text-lg font-semibold flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Organization Documents &amp; Charters
                    </h3>
                    {workspaceData.documents.map((d) => (
                      <div key={d.id} className="p-3 border border-slate-200 dark:border-slate-800 rounded flex justify-between items-center text-xs">
                        <div>
                          <div className="font-semibold">{d.title}</div>
                          <div className="text-slate-500">{d.category} — {d.description}</div>
                        </div>
                        <a href={d.fileUrl} className="px-3 py-1.5 font-semibold border border-slate-300 dark:border-slate-700 rounded">
                          Download
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
        </section>
      )}

      {/* TAB: FIND COLLABORATORS & JOINT PROJECTS */}
      {tab === 'collaborations' && (
        <section className="space-y-8">
          {collabNotice && (
            <div className="p-3 border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 text-sm text-emerald-900 dark:text-emerald-200 rounded">
              {collabNotice}
            </div>
          )}

          {/* Find Collaborators Discovery Bar */}
          <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/70 dark:bg-slate-900/50 space-y-4">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-crimson-600" />
              <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
                Find Collaborators Across the Network
              </h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Match with organizations, independent media publications, and active mobilizations by
              shared civic focus and region without exposing private personal data.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                value={collabInterest}
                onChange={(e) => setCollabInterest(e.target.value)}
                placeholder="Shared interest (e.g., governance, youth, media)"
                className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
              />
              <input
                value={collabLocation}
                onChange={(e) => setCollabLocation(e.target.value)}
                placeholder="Region or City"
                className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
              />
              <select
                value={collabTypeFilter}
                onChange={(e) => setCollabTypeFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
              >
                <option value="all">All Collaborator Types</option>
                <option value="organization">Organizations</option>
                <option value="publication">Media Publications</option>
                <option value="mobilization">Mobilizations</option>
              </select>
              <button
                type="button"
                onClick={loadCollaborations}
                className="px-4 py-2 text-sm font-semibold bg-navy-900 text-white rounded cursor-pointer"
              >
                Match Collaborators
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {candidates.map((cand) => (
                <div key={`${cand.entityType}-${cand.entityId}`} className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 flex flex-col justify-between space-y-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-slate-500">
                      <span className="font-semibold">{cand.badge}</span>
                      <span className="font-mono font-semibold text-navy-900 dark:text-slate-200 tabular-nums">
                        {cand.matchScore}% match
                      </span>
                    </div>
                    <div className="font-serif text-base font-semibold text-navy-900 dark:text-white">
                      {cand.name}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 line-clamp-2">{cand.summary}</p>
                    <div className="text-slate-500">
                      Focus: {cand.focus} · {cand.location}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCandidate(cand);
                      setCollabReqForm({
                        title: `Joint Civic Initiative with ${cand.name}`,
                        purpose: '',
                        proposedScope: '',
                        timeline: 'Q1–Q2 2027',
                      });
                    }}
                    className="px-3 py-1.5 font-semibold border border-navy-900 text-navy-900 dark:text-slate-200 dark:border-slate-600 rounded hover:bg-navy-900 hover:text-white cursor-pointer"
                  >
                    Propose Collaboration →
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Send Collaboration Request Form when candidate chosen */}
          {selectedCandidate && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!activeToken) {
                  setCollabNotice('Please sign in with Google or Partner Portal first to send collaboration requests.');
                  return;
                }
                const res = await fetch('/api/collaborations/requests', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHeaders },
                  body: JSON.stringify({
                    recipientType: selectedCandidate.entityType,
                    recipientEntityId: selectedCandidate.entityId,
                    recipientName: selectedCandidate.name,
                    ...collabReqForm,
                  }),
                });
                if (res.ok) {
                  setSelectedCandidate(null);
                  setCollabNotice('Structured collaboration request submitted.');
                  loadCollaborations();
                }
              }}
              className="p-6 border border-navy-900 dark:border-slate-500 rounded-lg bg-white dark:bg-slate-900 space-y-3 text-xs"
            >
              <div className="flex justify-between items-center">
                <h3 className="font-serif text-lg font-semibold">
                  Send Collaboration Request to {selectedCandidate.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedCandidate(null)}
                  className="text-slate-500 hover:underline cursor-pointer"
                >
                  Cancel
                </button>
              </div>
              <input
                required
                placeholder="Collaboration Title"
                value={collabReqForm.title}
                onChange={(e) => setCollabReqForm({ ...collabReqForm, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
              />
              <textarea
                required
                rows={2}
                placeholder="Purpose & mutual civic alignment"
                value={collabReqForm.purpose}
                onChange={(e) => setCollabReqForm({ ...collabReqForm, purpose: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  required
                  placeholder="Proposed Scope (e.g., co-hosted forum, policy brief)"
                  value={collabReqForm.proposedScope}
                  onChange={(e) => setCollabReqForm({ ...collabReqForm, proposedScope: e.target.value })}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                />
                <input
                  required
                  placeholder="Target Timeline"
                  value={collabReqForm.timeline}
                  onChange={(e) => setCollabReqForm({ ...collabReqForm, timeline: e.target.value })}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                />
              </div>
              <button type="submit" className="px-5 py-2 font-semibold bg-crimson-600 text-white rounded cursor-pointer">
                Submit Collaboration Request
              </button>
            </form>
          )}

          {/* Active Collaborative Projects & Requests */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 space-y-4">
              <h3 className="font-serif text-xl font-semibold flex items-center gap-2">
                <Layers className="w-4 h-4" /> Shared Collaborative Projects
              </h3>
              {projectsList.map((proj) => (
                <div key={proj.id} className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2 text-xs">
                  <div className="text-slate-500">
                    {proj.status} · Lead: {proj.leadEntityName}
                  </div>
                  <div className="font-semibold text-base text-navy-900 dark:text-white">{proj.title}</div>
                  <p className="text-slate-600 dark:text-slate-300">{proj.summary}</p>
                  <button
                    type="button"
                    onClick={() => openProjectWorkspace(proj.id)}
                    className="px-3 py-1.5 font-semibold bg-navy-900 text-white rounded cursor-pointer"
                  >
                    Open Project Workspace
                  </button>
                </div>
              ))}

              {requestsList.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <h4 className="font-serif text-lg font-semibold">Collaboration Requests</h4>
                  {requestsList.map((r) => (
                    <div key={r.id} className="p-3 border border-slate-200 dark:border-slate-800 rounded text-xs space-y-1.5">
                      <div className="font-mono text-slate-500">
                        {r.referenceCode} · <strong>{r.status}</strong>
                      </div>
                      <div className="font-semibold">{r.title}</div>
                      <div className="text-slate-500">
                        {r.senderName} → {r.recipientName}
                      </div>
                      {activeToken && r.status !== 'Accepted' && r.status !== 'Declined' && (
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={async () => {
                              await fetch(`/api/collaborations/requests/${r.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json', ...authHeaders },
                                body: JSON.stringify({ status: 'Accepted' }),
                              });
                              setCollabNotice('Collaboration request accepted — shared project workspace activated.');
                              loadCollaborations();
                            }}
                            className="px-2.5 py-1 bg-emerald-700 text-white rounded cursor-pointer"
                          >
                            Accept &amp; Launch Project
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await fetch(`/api/collaborations/requests/${r.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json', ...authHeaders },
                                body: JSON.stringify({ status: 'Declined' }),
                              });
                              loadCollaborations();
                            }}
                            className="px-2.5 py-1 border border-slate-300 rounded cursor-pointer"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-7">
              {!selectedProject ? (
                <div className="p-10 border border-slate-200 dark:border-slate-800 rounded-lg text-center text-sm text-slate-500">
                  Select a Collaborative Project on the left to coordinate joint tasks, publish
                  linked events, and file progress reports.
                </div>
              ) : (
                <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-6">
                  <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                    <div className="text-xs text-slate-500">
                      {selectedProject.project.status} · {selectedProject.project.geographicScope}
                    </div>
                    <h3 className="font-serif text-2xl font-semibold text-navy-900 dark:text-white">
                      {selectedProject.project.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      {selectedProject.project.objectives}
                    </p>
                    <div className="text-xs text-slate-500 mt-2">
                      <strong>Co-Organizers:</strong>{' '}
                      {selectedProject.participants.map((p) => `${p.entityName} (${p.role})`).join(' · ')}
                    </div>
                  </div>

                  {/* Tasks */}
                  <div className="space-y-3 text-xs">
                    <h4 className="font-semibold text-sm">Joint Tasks</h4>
                    {selectedProject.tasks.map((t) => (
                      <div key={t.id} className="p-2.5 border border-slate-200 dark:border-slate-800 rounded flex justify-between items-center">
                        <div>
                          <div className="font-semibold">{t.title}</div>
                          <div className="text-slate-500">{t.assignedEntity} · Due {t.dueDate || 'TBD'}</div>
                        </div>
                        <span className="font-mono">{t.status}</span>
                      </div>
                    ))}
                    {activeToken && (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const res = await fetch(`/api/collaborations/projects/${selectedProject.project.id}/tasks`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...authHeaders },
                            body: JSON.stringify(newProjTask),
                          });
                          if (res.ok) {
                            setNewProjTask({ title: '', assignedEntity: '', dueDate: '' });
                            openProjectWorkspace(selectedProject.project.id);
                          }
                        }}
                        className="flex flex-wrap gap-2"
                      >
                        <input
                          required
                          placeholder="Add joint task..."
                          value={newProjTask.title}
                          onChange={(e) => setNewProjTask({ ...newProjTask, title: e.target.value })}
                          className="flex-1 min-w-[180px] px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                        />
                        <input
                          placeholder="Assigned Entity"
                          value={newProjTask.assignedEntity}
                          onChange={(e) => setNewProjTask({ ...newProjTask, assignedEntity: e.target.value })}
                          className="w-36 px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                        />
                        <button type="submit" className="px-3 py-1.5 font-semibold bg-navy-900 text-white rounded cursor-pointer">
                          <Plus className="w-3.5 h-3.5 inline" /> Task
                        </button>
                      </form>
                    )}
                  </div>

                  {/* Reports & Linked Public Event */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Progress &amp; Accomplishment Reports</h4>
                      {selectedProject.reports.map((r) => (
                        <div key={r.id} className="p-2.5 border border-slate-200 dark:border-slate-800 rounded">
                          <div className="font-semibold">{r.title}</div>
                          <div className="text-slate-500">{r.reportType} by {r.authorName}</div>
                          <p className="mt-1">{r.summary}</p>
                        </div>
                      ))}
                      {activeToken && (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            await fetch(`/api/collaborations/projects/${selectedProject.project.id}/reports`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', ...authHeaders },
                              body: JSON.stringify(newProjReport),
                            });
                            setNewProjReport({ reportType: 'Progress Update', title: '', summary: '' });
                            openProjectWorkspace(selectedProject.project.id);
                          }}
                          className="space-y-2 pt-1"
                        >
                          <input
                            required
                            placeholder="Report title"
                            value={newProjReport.title}
                            onChange={(e) => setNewProjReport({ ...newProjReport, title: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                          />
                          <textarea
                            required
                            rows={2}
                            placeholder="Accomplishment summary..."
                            value={newProjReport.summary}
                            onChange={(e) => setNewProjReport({ ...newProjReport, summary: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                          />
                          <button type="submit" className="px-3 py-1.5 font-semibold border border-slate-300 rounded cursor-pointer">
                            Log Progress Report
                          </button>
                        </form>
                      )}
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Linked Public Events</h4>
                      {selectedProject.events.map((ev) => (
                        <div key={ev.id} className="p-2.5 border border-slate-200 dark:border-slate-800 rounded">
                          <div className="font-semibold">{ev.title}</div>
                          <div className="text-slate-500 font-mono">{ev.startAt} · {ev.format}</div>
                        </div>
                      ))}
                      {activeToken && (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            await fetch(`/api/collaborations/projects/${selectedProject.project.id}/events`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', ...authHeaders },
                              body: JSON.stringify(newProjEvent),
                            });
                            setNewProjEvent({
                              title: '',
                              description: '',
                              format: 'Hybrid',
                              startAt: '2027-02-15 14:00',
                              endAt: '2027-02-15 17:00',
                              venueOrLink: '',
                            });
                            openProjectWorkspace(selectedProject.project.id);
                          }}
                          className="space-y-2 pt-1"
                        >
                          <input
                            required
                            placeholder="Schedule Joint Event Title"
                            value={newProjEvent.title}
                            onChange={(e) => setNewProjEvent({ ...newProjEvent, title: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                          />
                          <input
                            required
                            placeholder="Venue or Online Stream Info"
                            value={newProjEvent.venueOrLink}
                            onChange={(e) => setNewProjEvent({ ...newProjEvent, venueOrLink: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                          />
                          <input
                            required
                            placeholder="Brief event description"
                            value={newProjEvent.description}
                            onChange={(e) => setNewProjEvent({ ...newProjEvent, description: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                          />
                          <button type="submit" className="px-3 py-1.5 font-semibold bg-crimson-600 text-white rounded cursor-pointer">
                            Publish Joint Public Event
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* TAB: PARTNER ACCREDITATION APPLICATION (PRESERVED) */}
      {tab === 'apply' && (
        <section className="max-w-3xl space-y-6">
          <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-900/50 space-y-2">
            <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white flex items-center gap-2">
              <Handshake className="w-4 h-4 text-crimson-600" /> Official Partnership Application Workflow (OP-04)
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Submitted → Initial Review → Verification → Interview/Consultation → Secretariat
              Approval → Onboarding &amp; Partner Portal Provisioning.
            </p>
          </div>

          {appResult ? (
            <div className="p-8 border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-lg space-y-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-700 dark:text-emerald-400" />
              <h3 className="font-serif text-2xl font-semibold text-slate-900 dark:text-white">
                Partnership Application Submitted
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Your application has been recorded for initial Secretariat review. Save your
                tracking reference code:
              </p>
              <div className="font-mono text-lg font-semibold text-navy-900 dark:text-white tabular-nums">
                {appResult.referenceCode} ({appResult.status})
              </div>
              <button
                type="button"
                onClick={() => {
                  setAppResult(null);
                  setTab('status');
                  setCheckRef(appResult.referenceCode);
                }}
                className="px-4 py-2 text-xs font-semibold bg-navy-900 text-white rounded-md cursor-pointer"
              >
                Track Application Status
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleApplySubmit}
              className="p-6 sm:p-8 border border-slate-200 dark:border-slate-800 rounded-lg space-y-5 bg-white dark:bg-slate-900/60"
            >
              {appError && (
                <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
                  {appError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Organization Name *</label>
                  <input
                    required
                    value={formState.organizationName}
                    onChange={(e) => setFormState({ ...formState, organizationName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Organization Type *</label>
                  <select
                    value={formState.orgType}
                    onChange={(e) => setFormState({ ...formState, orgType: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900"
                  >
                    <option>Civic Coalition</option>
                    <option>Community Organization</option>
                    <option>Academic Institution</option>
                    <option>Independent Media Partner</option>
                    <option>NGO / Civil Society</option>
                    <option>Youth Organization</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Official Address *</label>
                  <input
                    required
                    value={formState.officialAddress}
                    onChange={(e) => setFormState({ ...formState, officialAddress: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Website or Social Page</label>
                  <input
                    value={formState.websiteOrSocial}
                    onChange={(e) => setFormState({ ...formState, websiteOrSocial: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Organization Background *</label>
                <textarea
                  required
                  rows={3}
                  value={formState.background}
                  onChange={(e) => setFormState({ ...formState, background: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Mission *</label>
                  <textarea
                    required
                    rows={2}
                    value={formState.mission}
                    onChange={(e) => setFormState({ ...formState, mission: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Vision *</label>
                  <textarea
                    required
                    rows={2}
                    value={formState.vision}
                    onChange={(e) => setFormState({ ...formState, vision: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Advocacy Interests *</label>
                  <input
                    required
                    value={formState.advocacyInterests}
                    onChange={(e) => setFormState({ ...formState, advocacyInterests: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Proposed Partnership Areas *</label>
                  <input
                    required
                    value={formState.proposedAreas}
                    onChange={(e) => setFormState({ ...formState, proposedAreas: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-semibold mb-1">Authorized Representative *</label>
                  <input
                    required
                    value={formState.authorizedRep}
                    onChange={(e) => setFormState({ ...formState, authorizedRep: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Position / Title *</label>
                  <input
                    required
                    value={formState.position}
                    onChange={(e) => setFormState({ ...formState, position: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Official Email *</label>
                  <input
                    required
                    type="email"
                    value={formState.officialEmail}
                    onChange={(e) => setFormState({ ...formState, officialEmail: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Contact Number *</label>
                  <input
                    required
                    value={formState.contactNumber}
                    onChange={(e) => setFormState({ ...formState, contactNumber: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Supporting Documents (SEC/CDA Registration, Profile PDF, or Endorsement)
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => setSupportingDoc(e.target.files?.[0] || null)}
                  className="text-xs"
                />
              </div>
              <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={formState.consentGiven}
                  onChange={(e) => setFormState({ ...formState, consentGiven: e.target.checked })}
                  className="mt-0.5"
                />
                <span>
                  I confirm that I am authorized to submit this application on behalf of our
                  organization, and consent to verification and data processing under Republic Act
                  No. 10173.
                </span>
              </label>
              <button
                type="submit"
                disabled={submittingApp}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-navy-900 hover:bg-navy-800 rounded-md disabled:opacity-50 cursor-pointer"
              >
                {submittingApp ? 'Submitting Application...' : 'Submit Partnership Application'}
              </button>
            </form>
          )}
        </section>
      )}

      {/* TAB: CHECK STATUS */}
      {tab === 'status' && (
        <section className="max-w-xl space-y-5">
          <form onSubmit={handleCheckStatus} className="flex gap-2">
            <input
              required
              value={checkRef}
              onChange={(e) => setCheckRef(e.target.value)}
              placeholder="Enter Reference Code (e.g., PRT-2026-XXXXXX)"
              className="flex-1 px-3 py-2 text-sm font-mono border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900"
            />
            <button
              type="submit"
              className="px-4 py-2 text-sm font-semibold bg-navy-900 text-white rounded-md cursor-pointer"
            >
              Check Status
            </button>
          </form>
          {checkError && <p className="text-sm text-red-600">{checkError}</p>}
          {checkedStatus && (
            <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
              <div className="font-mono text-xs text-slate-500">{checkedStatus.referenceCode}</div>
              <div className="text-lg font-semibold text-navy-900 dark:text-white">
                {checkedStatus.organizationName}
              </div>
              <div className="text-sm">
                Workflow Stage: <strong>{checkedStatus.status}</strong>
              </div>
              {checkedStatus.reviewNotes && (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Secretariat Note: {checkedStatus.reviewNotes}
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
