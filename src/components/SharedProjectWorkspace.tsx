import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Building2,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Download,
  FileText,
  FolderKanban,
  Lock,
  Plus,
  Search,
  Upload,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  CollaborativeProject,
  NetworkEvent,
  PageRoute,
  ProjectDocument,
  SharedProjectSummary,
} from '../types/index.ts';

interface SharedProjectWorkspaceProps {
  onNavigate: (page: PageRoute, slug?: string) => void;
}

interface ParticipantRow {
  id: number;
  projectId: number;
  entityType: string;
  entityId: number;
  entityName: string;
  role: string;
  joinedAt: string;
}

interface ProjectTaskRow {
  id: number;
  projectId: number;
  title: string;
  assignedEntity: string;
  dueDate: string;
  status: string;
  createdAt: string;
}

interface ProjectReportRow {
  id: number;
  projectId: number;
  authorName: string;
  reportType: string;
  title: string;
  summary: string;
  createdAt: string;
}

interface WorkspaceDetail {
  project: CollaborativeProject;
  participants: ParticipantRow[];
  tasks: ProjectTaskRow[];
  reports: ProjectReportRow[];
  documents: ProjectDocument[];
  events: NetworkEvent[];
  accessRole: string;
  actorOrgNames: string[];
}

interface OrgOption {
  id: number;
  name: string;
  orgType?: string;
  geographicCoverage?: string;
}

type WorkspaceSubTab = 'initiative' | 'tasks' | 'documents' | 'updates';

const ADVOCACY_AREAS = [
  'Good Governance and Accountability',
  'Human Rights and Civil Liberties',
  'Education and Academic Freedom',
  'Youth Development and Participation',
  'Community Development',
  'Social Welfare and Inclusion',
  'Environmental Protection and Sustainability',
  'Public Information and Media Literacy',
  'Economic and Social Justice',
  'Democratic Participation and Civic Education',
];

const DOCUMENT_CATEGORIES = [
  'Policy Brief',
  'Joint Charter / MOU',
  'Meeting Minutes',
  'Research Appendix',
  'Accomplishment Evidence',
  'Press Statement',
];

export const SharedProjectWorkspace: React.FC<SharedProjectWorkspaceProps> = ({ onNavigate }) => {
  const { idToken, partnerToken, dbUser, partnerUser, signInWithGoogle } = useAuth();
  const activeToken = idToken || partnerToken;
  const activeUser = dbUser || partnerUser;

  const [projects, setProjects] = useState<SharedProjectSummary[]>([]);
  const [userOrgs, setUserOrgs] = useState<OrgOption[]>([]);
  const [availablePartnerOrgs, setAvailablePartnerOrgs] = useState<OrgOption[]>([]);
  const [isOversight, setIsOversight] = useState(false);

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [subTab, setSubTab] = useState<WorkspaceSubTab>('initiative');
  const [projectSearch, setProjectSearch] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState('All');
  const [taskFilter, setTaskFilter] = useState('All');
  const [docFilter, setDocFilter] = useState<'Active' | 'Archived' | 'All'>('Active');

  // New Initiative Form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProject, setNewProject] = useState({
    title: '',
    summary: '',
    objectives: '',
    advocacyArea: ADVOCACY_AREAS[0],
    geographicScope: 'National & Regional Chapters',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    leadOrganizationId: '',
    partnerOrgIds: [] as number[],
  });

  // Add Partner Org Form
  const [addOrgId, setAddOrgId] = useState('');
  const [addOrgRole, setAddOrgRole] = useState('Co-Organizer');

  // New Task Form
  const [newTask, setNewTask] = useState({
    title: '',
    assignedEntity: '',
    dueDate: '',
  });

  // New Document Form
  const [newDoc, setNewDoc] = useState({
    title: '',
    category: 'Policy Brief',
    description: '',
    fileUrl: '',
    uploadedByOrg: '',
  });
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // New Update & Event Forms
  const [newReport, setNewReport] = useState({
    reportType: 'Progress Update',
    title: '',
    summary: '',
  });
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    format: 'Hybrid',
    startAt: '',
    venueOrLink: '',
  });

  const authHeaders = useMemo<Record<string, string>>(() => {
    const h: Record<string, string> = {};
    if (activeToken) h.Authorization = `Bearer ${activeToken}`;
    return h;
  }, [activeToken]);

  const loadAuthorizedProjects = useCallback(async () => {
    if (!activeToken) return;
    setLoadingList(true);
    try {
      const res = await fetch('/api/operations/shared-projects', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        const list: SharedProjectSummary[] = data.projects || [];
        setProjects(list);
        setUserOrgs(data.userOrganizations || []);
        setAvailablePartnerOrgs(data.availablePartnerOrgs || []);
        setIsOversight(Boolean(data.isOversight));
        if (list.length > 0 && (!selectedProjectId || !list.some((p) => p.id === selectedProjectId))) {
          setSelectedProjectId(list[0].id);
        }
        if (data.userOrganizations?.length > 0 && !newProject.leadOrganizationId) {
          setNewProject((prev) => ({ ...prev, leadOrganizationId: String(data.userOrganizations[0].id) }));
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedback({ type: 'err', text: err.error || 'Unable to verify project workspace access.' });
      }
    } finally {
      setLoadingList(false);
    }
  }, [activeToken, authHeaders, selectedProjectId, newProject.leadOrganizationId]);

  const loadWorkspaceDetail = useCallback(
    async (projectId: number) => {
      if (!activeToken) return;
      setLoadingWorkspace(true);
      try {
        const res = await fetch(`/api/collaborations/projects/${projectId}/workspace`, {
          headers: authHeaders,
        });
        if (res.ok) {
          const data: WorkspaceDetail = await res.json();
          setWorkspace(data);
        } else {
          const err = await res.json().catch(() => ({}));
          setWorkspace(null);
          setFeedback({ type: 'err', text: err.error || 'Access denied for selected workspace.' });
        }
      } finally {
        setLoadingWorkspace(false);
      }
    },
    [activeToken, authHeaders]
  );

  useEffect(() => {
    if (activeToken) {
      loadAuthorizedProjects();
    } else {
      setProjects([]);
      setWorkspace(null);
    }
  }, [activeToken, loadAuthorizedProjects]);

  useEffect(() => {
    if (activeToken && selectedProjectId) {
      loadWorkspaceDetail(selectedProjectId);
    }
  }, [activeToken, selectedProjectId, loadWorkspaceDetail]);

  const refreshAll = async (targetId?: number) => {
    const id = targetId || selectedProjectId;
    await loadAuthorizedProjects();
    if (id) await loadWorkspaceDetail(id);
  };

  const togglePartnerOrgSelection = (orgId: number) => {
    setNewProject((prev) => ({
      ...prev,
      partnerOrgIds: prev.partnerOrgIds.includes(orgId)
        ? prev.partnerOrgIds.filter((id) => id !== orgId)
        : [...prev.partnerOrgIds, orgId],
    }));
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeToken) return;
    setCreatingProject(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/operations/shared-projects', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProject,
          leadOrganizationId: newProject.leadOrganizationId ? Number(newProject.leadOrganizationId) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', text: data.error || 'Could not launch joint initiative.' });
        return;
      }
      setShowCreateForm(false);
      setNewProject({
        title: '',
        summary: '',
        objectives: '',
        advocacyArea: ADVOCACY_AREAS[0],
        geographicScope: 'National & Regional Chapters',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: '',
        leadOrganizationId: userOrgs[0]?.id ? String(userOrgs[0].id) : '',
        partnerOrgIds: [],
      });
      setSelectedProjectId(data.id);
      await refreshAll(data.id);
      setFeedback({ type: 'ok', text: `Launched joint advocacy initiative "${data.title}".` });
    } finally {
      setCreatingProject(false);
    }
  };

  const handleUpdateProjectStatus = async (status: string) => {
    if (!selectedProjectId || !activeToken) return;
    setFeedback(null);
    const res = await fetch(`/api/collaborations/projects/${selectedProjectId}`, {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      await refreshAll(selectedProjectId);
      setFeedback({ type: 'ok', text: `Initiative status updated to ${status}.` });
    }
  };

  const handleAddPartnerOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !addOrgId || !activeToken) return;
    setFeedback(null);
    const res = await fetch(`/api/collaborations/projects/${selectedProjectId}`, {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        addOrganizationId: Number(addOrgId),
        role: addOrgRole,
      }),
    });
    if (res.ok) {
      setAddOrgId('');
      await refreshAll(selectedProjectId);
      setFeedback({ type: 'ok', text: 'Participating partner organization added to workspace.' });
    } else {
      const err = await res.json().catch(() => ({}));
      setFeedback({ type: 'err', text: err.error || 'Unable to add participating organization.' });
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !newTask.title.trim() || !activeToken) return;
    setFeedback(null);
    const res = await fetch(`/api/collaborations/projects/${selectedProjectId}/tasks`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(newTask),
    });
    if (res.ok) {
      setNewTask({ title: '', assignedEntity: '', dueDate: '' });
      await refreshAll(selectedProjectId);
      setFeedback({ type: 'ok', text: 'Shared task added to initiative tracker.' });
    }
  };

  const handleUpdateTaskStatus = async (taskId: number, status: string) => {
    if (!selectedProjectId || !activeToken) return;
    const res = await fetch(`/api/collaborations/projects/${selectedProjectId}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      await refreshAll(selectedProjectId);
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !activeToken) return;
    setUploadingDoc(true);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append('title', newDoc.title.trim());
      formData.append('category', newDoc.category);
      formData.append('description', newDoc.description.trim());
      formData.append(
        'uploadedByOrg',
        newDoc.uploadedByOrg || workspace?.actorOrgNames[0] || userOrgs[0]?.name || 'Joint Working Group'
      );
      if (docFile) {
        formData.append('file', docFile);
      } else {
        formData.append('fileUrl', newDoc.fileUrl.trim());
      }

      const res = await fetch(`/api/collaborations/projects/${selectedProjectId}/documents`, {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', text: data.error || 'Unable to register collaborative document.' });
        return;
      }
      setNewDoc({ title: '', category: 'Policy Brief', description: '', fileUrl: '', uploadedByOrg: '' });
      setDocFile(null);
      await refreshAll(selectedProjectId);
      setFeedback({ type: 'ok', text: `Document "${data.title}" added to shared repository.` });
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleToggleDocumentArchive = async (doc: ProjectDocument) => {
    if (!selectedProjectId || !activeToken) return;
    const nextStatus = doc.status === 'Archived' ? 'Active' : 'Archived';
    const res = await fetch(`/api/collaborations/projects/${selectedProjectId}/documents/${doc.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      await refreshAll(selectedProjectId);
      setFeedback({
        type: 'ok',
        text:
          nextStatus === 'Archived'
            ? `"${doc.title}" moved to collaborative document archive.`
            : `"${doc.title}" restored to active workspace documents.`,
      });
    }
  };

  const handlePostReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !activeToken) return;
    const res = await fetch(`/api/collaborations/projects/${selectedProjectId}/reports`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(newReport),
    });
    if (res.ok) {
      setNewReport({ reportType: 'Progress Update', title: '', summary: '' });
      await loadWorkspaceDetail(selectedProjectId);
      setFeedback({ type: 'ok', text: 'Progress update posted to shared initiative log.' });
    }
  };

  const handleScheduleEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !activeToken) return;
    const res = await fetch(`/api/collaborations/projects/${selectedProjectId}/events`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(newEvent),
    });
    if (res.ok) {
      setNewEvent({ title: '', description: '', format: 'Hybrid', startAt: '', venueOrLink: '' });
      await loadWorkspaceDetail(selectedProjectId);
      setFeedback({ type: 'ok', text: 'Joint public event scheduled and linked to initiative.' });
    }
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (projectStatusFilter !== 'All' && p.status !== projectStatusFilter) return false;
      if (projectSearch.trim()) {
        const q = projectSearch.toLowerCase();
        return (
          p.title.toLowerCase().includes(q) ||
          p.advocacyArea.toLowerCase().includes(q) ||
          p.leadEntityName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [projects, projectStatusFilter, projectSearch]);

  const taskStats = useMemo(() => {
    const list = workspace?.tasks || [];
    const total = list.length;
    const completed = list.filter((t) => t.status === 'Completed').length;
    const inProgress = list.filter((t) => t.status === 'In Progress').length;
    const open = list.filter((t) => t.status === 'Open').length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, open, percent };
  }, [workspace?.tasks]);

  const filteredTasks = useMemo(() => {
    const list = workspace?.tasks || [];
    if (taskFilter === 'All') return list;
    return list.filter((t) => t.status === taskFilter);
  }, [workspace?.tasks, taskFilter]);

  const docCounts = useMemo(() => {
    const list = workspace?.documents || [];
    return {
      active: list.filter((d) => d.status !== 'Archived').length,
      archived: list.filter((d) => d.status === 'Archived').length,
      all: list.length,
    };
  }, [workspace?.documents]);

  const filteredDocs = useMemo(() => {
    const list = workspace?.documents || [];
    if (docFilter === 'All') return list;
    return list.filter((d) => (docFilter === 'Archived' ? d.status === 'Archived' : d.status !== 'Archived'));
  }, [workspace?.documents, docFilter]);

  const unjoinedPartnerOrgs = useMemo(() => {
    const existingIds = new Set(
      (workspace?.participants || [])
        .filter((p) => p.entityType === 'organization')
        .map((p) => p.entityId)
    );
    return availablePartnerOrgs.filter((org) => !existingIds.has(org.id));
  }, [availablePartnerOrgs, workspace?.participants]);

  // Unauthenticated gate
  if (!activeToken) {
    return (
      <section className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/60 p-8 sm:p-12 text-center space-y-5">
        <div className="mx-auto w-11 h-11 rounded-md border border-slate-200 dark:border-slate-700 flex items-center justify-center text-navy-900 dark:text-white">
          <Lock className="w-5 h-5" />
        </div>
        <div className="max-w-xl mx-auto space-y-2">
          <div className="text-xs font-semibold uppercase tracking-widest text-crimson-600 dark:text-red-400">
            Authorized Participating Organizations Only
          </div>
          <h2 className="font-serif text-2xl font-semibold text-navy-900 dark:text-white">
            Sign in to Enter the Shared Project Workspace
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Joint advocacy initiatives, shared task trackers, and collaborative document archives are
            strictly isolated to verified members of participating partner organizations and designated
            Operations Center coordinators.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => signInWithGoogle()}
            className="px-4 py-2.5 text-xs font-semibold bg-navy-900 text-white rounded-md hover:bg-navy-800 cursor-pointer whitespace-nowrap"
          >
            Sign in with Google Account
          </button>
          <button
            type="button"
            onClick={() => onNavigate('partner-portal')}
            className="px-4 py-2.5 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 cursor-pointer whitespace-nowrap"
          >
            Partner Organization Portal Login
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-widest text-crimson-600 dark:text-red-400">
            Cross-Organization Collaboration · OP-02 / OP-03 / OP-04
          </div>
          <h2 className="font-serif text-2xl font-semibold text-navy-900 dark:text-white">
            Shared Project Workspace
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Signed in as <span className="font-semibold text-navy-900 dark:text-white">{activeUser?.displayName || activeUser?.email}</span>
            {userOrgs.length > 0 && !isOversight ? ` · ${userOrgs.map((o) => o.name).join(', ')}` : ''}
            {isOversight ? ' · Operations Center Oversight Access' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-navy-900 text-white rounded-md hover:bg-navy-800 cursor-pointer shrink-0 whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          {showCreateForm ? 'Close Initiative Form' : 'Launch Joint Initiative'}
        </button>
      </div>

      {feedback && (
        <div
          className={`px-4 py-3 rounded-md border text-xs font-medium ${
            feedback.type === 'ok'
              ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
              : 'border-red-300 dark:border-red-800 bg-red-50/70 dark:bg-red-950/40 text-red-900 dark:text-red-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Launch New Joint Initiative Drawer */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateProject}
          className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/70 dark:bg-slate-900/70 space-y-5"
        >
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="font-serif text-lg font-semibold text-navy-900 dark:text-white">
              Launch New Joint Advocacy Initiative
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Establish a shared workspace with partner organizations, shared tasks, and a collaborative document repository.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Initiative Title *
              </label>
              <input
                type="text"
                required
                value={newProject.title}
                onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                placeholder="e.g., Regional Open Procurement & Citizen Audit Drive"
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Advocacy Area
              </label>
              <select
                value={newProject.advocacyArea}
                onChange={(e) => setNewProject({ ...newProject, advocacyArea: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                {ADVOCACY_AREAS.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Lead Organization
              </label>
              <select
                value={newProject.leadOrganizationId}
                onChange={(e) => setNewProject({ ...newProject, leadOrganizationId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                {userOrgs.length === 0 ? (
                  <option value="">Coordinator Lead ({activeUser?.displayName || 'Operations'})</option>
                ) : (
                  userOrgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Start Date
                </label>
                <input
                  type="date"
                  value={newProject.startDate}
                  onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Target End Date
                </label>
                <input
                  type="date"
                  value={newProject.endDate}
                  onChange={(e) => setNewProject({ ...newProject, endDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Geographic Scope
            </label>
            <input
              type="text"
              value={newProject.geographicScope}
              onChange={(e) => setNewProject({ ...newProject, geographicScope: e.target.value })}
              placeholder="e.g., Central Luzon, Cebu & Davao"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Initiative Summary *
              </label>
              <textarea
                required
                rows={3}
                value={newProject.summary}
                onChange={(e) => setNewProject({ ...newProject, summary: e.target.value })}
                placeholder="Describe the civic issue, public scope, and nonpartisan collaboration purpose."
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Shared Deliverables &amp; Objectives *
              </label>
              <textarea
                required
                rows={3}
                value={newProject.objectives}
                onChange={(e) => setNewProject({ ...newProject, objectives: e.target.value })}
                placeholder="List concrete joint milestones, workshops, or shared research briefs."
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {availablePartnerOrgs.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Collaborating Partner Organizations (Co-Organizers)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availablePartnerOrgs
                  .filter((o) => String(o.id) !== newProject.leadOrganizationId)
                  .map((org) => {
                    const checked = newProject.partnerOrgIds.includes(org.id);
                    return (
                      <label
                        key={org.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-md border text-xs cursor-pointer ${
                          checked
                            ? 'border-navy-900 dark:border-slate-400 bg-white dark:bg-slate-950'
                            : 'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePartnerOrgSelection(org.id)}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="font-semibold text-navy-900 dark:text-white">{org.name}</div>
                          <div className="text-slate-500">
                            {org.orgType} · {org.geographicCoverage}
                          </div>
                        </div>
                      </label>
                    );
                  })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-md cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingProject}
              className="px-4 py-2 text-xs font-semibold bg-navy-900 text-white rounded-md hover:bg-navy-800 disabled:opacity-60 cursor-pointer"
            >
              {creatingProject ? 'Launching Initiative...' : 'Create Joint Initiative Workspace'}
            </button>
          </div>
        </form>
      )}

      {/* Main Master-Detail Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Project Rail */}
        <aside className="lg:col-span-4 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/60 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Authorized Joint Initiatives
              </h3>
              <span className="font-mono text-xs font-semibold text-navy-900 dark:text-white tabular-nums">
                {projects.length}
              </span>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Filter initiatives..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['All', 'Active Collaboration', 'Planning', 'Completed'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setProjectStatusFilter(st)}
                  className={`px-2 py-1 text-[11px] font-medium rounded border cursor-pointer ${
                    projectStatusFilter === st
                      ? 'border-navy-900 dark:border-slate-400 bg-navy-900 text-white'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {st === 'Active Collaboration' ? 'Active' : st}
                </button>
              ))}
            </div>
          </div>

          {loadingList ? (
            <div className="p-6 text-xs text-slate-500 text-center">Loading authorized initiatives...</div>
          ) : filteredProjects.length === 0 ? (
            <div className="p-6 text-xs text-slate-500 space-y-2">
              <p>No authorized shared initiatives match your current filter.</p>
              {(userOrgs.length > 0 || isOversight) && (
                <button
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                  className="text-crimson-600 dark:text-red-400 font-semibold hover:underline cursor-pointer"
                >
                  + Launch a Joint Initiative
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredProjects.map((proj) => {
                const isSelected = proj.id === selectedProjectId;
                const pct = proj.totalTasks > 0 ? Math.round((proj.completedTasks / proj.totalTasks) * 100) : 0;
                return (
                  <li key={proj.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedProjectId(proj.id)}
                      className={`w-full text-left p-4 transition-colors cursor-pointer space-y-2 ${
                        isSelected
                          ? 'bg-slate-50 dark:bg-slate-800/80'
                          : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-mono font-semibold text-crimson-600 dark:text-red-400">
                          {proj.status}
                        </span>
                        <span className="text-slate-500">{proj.accessRole}</span>
                      </div>
                      <div className="font-serif text-base font-semibold text-navy-900 dark:text-white leading-snug">
                        {proj.title}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{proj.leadEntityName}</div>

                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                          <span>
                            Tasks {proj.completedTasks}/{proj.totalTasks}
                          </span>
                          <span>
                            {proj.activeDocuments} docs · {proj.archivedDocuments} archived
                          </span>
                        </div>
                        <div className="h-1 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-navy-900 dark:bg-slate-200 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Main Workspace Detail */}
        <div className="lg:col-span-8 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/60">
          {!selectedProjectId ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Select a joint advocacy initiative on the left or launch a new collaboration workspace.
            </div>
          ) : loadingWorkspace && !workspace ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Loading isolated shared project workspace...
            </div>
          ) : workspace ? (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {/* Initiative Header */}
              <div className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="text-xs font-mono text-crimson-600 dark:text-red-400">
                      INITIATIVE #{workspace.project.id} · ACCESS: {workspace.accessRole.toUpperCase()}
                    </div>
                    <h3 className="font-serif text-2xl font-semibold text-navy-900 dark:text-white leading-tight">
                      {workspace.project.title}
                    </h3>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {workspace.project.advocacyArea} · {workspace.project.geographicScope} · Start{' '}
                      {workspace.project.startDate}
                      {workspace.project.endDate ? ` to ${workspace.project.endDate}` : ''}
                    </div>
                  </div>
                  <div className="shrink-0 space-y-1">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Initiative Status
                    </label>
                    <select
                      value={workspace.project.status}
                      onChange={(e) => handleUpdateProjectStatus(e.target.value)}
                      className="px-3 py-1.5 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-navy-900 dark:text-white cursor-pointer"
                    >
                      <option value="Planning">Planning</option>
                      <option value="Active Collaboration">Active Collaboration</option>
                      <option value="Completed">Completed</option>
                      <option value="Archived">Archived</option>
                    </select>
                  </div>
                </div>

                {/* Compact KPI Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div>
                    <div className="text-slate-500">Participating Entities</div>
                    <div className="font-mono text-lg font-semibold text-navy-900 dark:text-white tabular-nums">
                      {workspace.participants.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Task Progress</div>
                    <div className="font-mono text-lg font-semibold text-navy-900 dark:text-white tabular-nums">
                      {taskStats.completed}/{taskStats.total} ({taskStats.percent}%)
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Active Documents</div>
                    <div className="font-mono text-lg font-semibold text-navy-900 dark:text-white tabular-nums">
                      {docCounts.active}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Archived Documents</div>
                    <div className="font-mono text-lg font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                      {docCounts.archived}
                    </div>
                  </div>
                </div>

                {/* Workspace Segmented Sub-Navigation */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {(
                    [
                      { id: 'initiative', label: 'Joint Initiative & Partners', icon: FolderKanban },
                      { id: 'tasks', label: `Shared Task List (${taskStats.total})`, icon: CheckCircle2 },
                      { id: 'documents', label: `Documents & Archive (${docCounts.all})`, icon: FileText },
                      { id: 'updates', label: `Updates & Events (${workspace.reports.length + workspace.events.length})`, icon: Calendar },
                    ] as const
                  ).map((tab) => {
                    const Icon = tab.icon;
                    const active = subTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSubTab(tab.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-navy-900 text-white border-navy-900 dark:border-slate-400'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* TAB 1: JOINT INITIATIVE & PARTICIPATING ORGANIZATIONS */}
              {subTab === 'initiative' && (
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Initiative Summary
                      </h4>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        {workspace.project.summary}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Shared Objectives &amp; Milestones
                      </h4>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        {workspace.project.objectives}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-navy-900 dark:text-slate-200" />
                        <h4 className="font-serif text-lg font-semibold text-navy-900 dark:text-white">
                          Authorized Participating Organizations &amp; Partners
                        </h4>
                      </div>
                      <span className="font-mono text-xs text-slate-500 tabular-nums">
                        {workspace.participants.length} joined
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-2 pr-3">Organization / Partner Entity</th>
                            <th className="py-2 pr-3">Type</th>
                            <th className="py-2 pr-3">Workspace Role</th>
                            <th className="py-2">Joined</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {workspace.participants.map((p) => (
                            <tr key={p.id}>
                              <td className="py-2.5 pr-3 font-medium text-navy-900 dark:text-white">
                                <span className="inline-flex items-center gap-1.5">
                                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                  {p.entityName}
                                </span>
                              </td>
                              <td className="py-2.5 pr-3 capitalize text-slate-600 dark:text-slate-300">
                                {p.entityType}
                              </td>
                              <td className="py-2.5 pr-3 font-mono text-crimson-600 dark:text-red-400">
                                {p.role}
                              </td>
                              <td className="py-2.5 font-mono text-slate-500 tabular-nums">
                                {p.joinedAt ? new Date(p.joinedAt).toLocaleDateString() : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {unjoinedPartnerOrgs.length > 0 && (
                      <form
                        onSubmit={handleAddPartnerOrg}
                        className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-end"
                      >
                        <div className="flex-1 space-y-1">
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                            Invite / Add Partner Organization to Workspace
                          </label>
                          <select
                            value={addOrgId}
                            onChange={(e) => setAddOrgId(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                          >
                            <option value="">Select affiliated partner organization...</option>
                            {unjoinedPartnerOrgs.map((org) => (
                              <option key={org.id} value={org.id}>
                                {org.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:w-44 space-y-1">
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                            Assigned Role
                          </label>
                          <select
                            value={addOrgRole}
                            onChange={(e) => setAddOrgRole(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                          >
                            <option value="Co-Organizer">Co-Organizer</option>
                            <option value="Media Partner">Media Partner</option>
                            <option value="Contributor">Contributor</option>
                          </select>
                        </div>
                        <button
                          type="submit"
                          disabled={!addOrgId}
                          className="px-4 py-2 text-xs font-semibold bg-navy-900 text-white rounded-md hover:bg-navy-800 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                        >
                          Add Partner
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: SHARED TASK LIST */}
              {subTab === 'tasks' && (
                <div className="p-6 space-y-6">
                  {/* Overall Progress Tracker */}
                  <div className="space-y-2 pb-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-navy-900 dark:text-white">
                        Joint Initiative Completion Progress
                      </span>
                      <span className="font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                        {taskStats.completed} Completed · {taskStats.inProgress} In Progress ·{' '}
                        {taskStats.open} Open ({taskStats.percent}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-navy-900 dark:bg-slate-200 transition-all"
                        style={{ width: `${taskStats.percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Add Shared Task Form */}
                  <form
                    onSubmit={handleAddTask}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pb-5 border-b border-slate-200 dark:border-slate-800"
                  >
                    <div className="sm:col-span-5 space-y-1">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                        New Shared Task *
                      </label>
                      <input
                        type="text"
                        required
                        value={newTask.title}
                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                        placeholder="e.g., Compile municipal audit summary table"
                        className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="sm:col-span-4 space-y-1">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Assigned Organization / Lead
                      </label>
                      <input
                        type="text"
                        list="workspace-participant-orgs"
                        value={newTask.assignedEntity}
                        onChange={(e) => setNewTask({ ...newTask, assignedEntity: e.target.value })}
                        placeholder={workspace.participants[0]?.entityName || 'Joint Team'}
                        className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                      <datalist id="workspace-participant-orgs">
                        {workspace.participants.map((p) => (
                          <option key={p.id} value={p.entityName} />
                        ))}
                      </datalist>
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={newTask.dueDate}
                        onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                        className="w-full px-2.5 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <button
                        type="submit"
                        className="w-full py-2 px-3 text-xs font-semibold bg-navy-900 text-white rounded-md hover:bg-navy-800 cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </form>

                  {/* Task Filter & List */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Action Items
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {['All', 'Open', 'In Progress', 'Completed'].map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setTaskFilter(st)}
                            className={`px-2.5 py-1 text-[11px] font-medium rounded border cursor-pointer ${
                              taskFilter === st
                                ? 'border-navy-900 bg-navy-900 text-white dark:border-slate-400'
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>

                    {filteredTasks.length === 0 ? (
                      <p className="text-xs text-slate-500 py-4">No tasks matching this status.</p>
                    ) : (
                      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                        {filteredTasks.map((t) => {
                          const isDone = t.status === 'Completed';
                          return (
                            <li
                              key={t.id}
                              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="flex items-start gap-3">
                                <button
                                  type="button"
                                  title={isDone ? 'Reopen task' : 'Mark completed'}
                                  onClick={() =>
                                    handleUpdateTaskStatus(t.id, isDone ? 'Open' : 'Completed')
                                  }
                                  className="mt-0.5 text-navy-900 dark:text-slate-200 cursor-pointer shrink-0"
                                >
                                  {isDone ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                  ) : t.status === 'In Progress' ? (
                                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                  ) : (
                                    <Circle className="w-4 h-4 text-slate-400" />
                                  )}
                                </button>
                                <div>
                                  <div
                                    className={`text-sm font-medium ${
                                      isDone
                                        ? 'line-through text-slate-400 dark:text-slate-500'
                                        : 'text-navy-900 dark:text-white'
                                    }`}
                                  >
                                    {t.title}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    Assigned to {t.assignedEntity}
                                    {t.dueDate ? ` · Due ${t.dueDate}` : ''}
                                  </div>
                                </div>
                              </div>
                              <select
                                value={t.status}
                                onChange={(e) => handleUpdateTaskStatus(t.id, e.target.value)}
                                className="px-2.5 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 cursor-pointer shrink-0"
                              >
                                <option value="Open">Open</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Completed">Completed</option>
                              </select>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: COLLABORATIVE DOCUMENTS & ARCHIVE */}
              {subTab === 'documents' && (
                <div className="p-6 space-y-6">
                  {/* Upload / Register Document Form */}
                  <form
                    onSubmit={handleUploadDocument}
                    className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-3"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-navy-900 dark:text-white">
                      <Upload className="w-3.5 h-3.5 text-crimson-600 dark:text-red-400" />
                      Register or Upload Collaborative Document
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        required
                        value={newDoc.title}
                        onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                        placeholder="Document title *"
                        className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                      <select
                        value={newDoc.category}
                        onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value })}
                        className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      >
                        {DOCUMENT_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-medium text-slate-500">
                          Upload File (PDF, DOCX, TXT, Image — max 8MB)
                        </label>
                        <input
                          type="file"
                          onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                          className="w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-slate-300 dark:file:border-slate-700 file:text-xs file:font-semibold file:bg-white dark:file:bg-slate-900 file:text-slate-800 dark:file:text-slate-200 cursor-pointer"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[11px] font-medium text-slate-500">
                          Or External / Shared Document URL
                        </label>
                        <input
                          type="text"
                          value={newDoc.fileUrl}
                          onChange={(e) => setNewDoc({ ...newDoc, fileUrl: e.target.value })}
                          placeholder="https://... or /api/documents/download/..."
                          disabled={Boolean(docFile)}
                          className="w-full px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white disabled:opacity-50"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={newDoc.description}
                        onChange={(e) => setNewDoc({ ...newDoc, description: e.target.value })}
                        placeholder="Brief scope note or version description"
                        className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newDoc.uploadedByOrg}
                          onChange={(e) => setNewDoc({ ...newDoc, uploadedByOrg: e.target.value })}
                          placeholder={
                            workspace.actorOrgNames[0] || userOrgs[0]?.name || 'Contributing organization'
                          }
                          className="flex-1 px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                        />
                        <button
                          type="submit"
                          disabled={uploadingDoc || (!docFile && !newDoc.fileUrl.trim())}
                          className="px-4 py-2 text-xs font-semibold bg-navy-900 text-white rounded-md hover:bg-navy-800 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                        >
                          {uploadingDoc ? 'Saving...' : 'Save Document'}
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Document Repository Filter & List */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Shared Document Repository &amp; Archive
                      </h4>
                      <div className="flex gap-1.5">
                        {(
                          [
                            { id: 'Active', label: `Active (${docCounts.active})` },
                            { id: 'Archived', label: `Archived (${docCounts.archived})` },
                            { id: 'All', label: `All (${docCounts.all})` },
                          ] as const
                        ).map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setDocFilter(f.id)}
                            className={`px-2.5 py-1 text-[11px] font-medium rounded border cursor-pointer ${
                              docFilter === f.id
                                ? 'border-navy-900 bg-navy-900 text-white dark:border-slate-400'
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {filteredDocs.length === 0 ? (
                      <p className="text-xs text-slate-500 py-4">
                        No {docFilter.toLowerCase()} collaborative documents recorded yet.
                      </p>
                    ) : (
                      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                        {filteredDocs.map((doc) => {
                          const isArchived = doc.status === 'Archived';
                          return (
                            <li
                              key={doc.id}
                              className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="space-y-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                  <span className="font-mono font-semibold text-crimson-600 dark:text-red-400">
                                    {doc.category}
                                  </span>
                                  <span className="text-slate-400">·</span>
                                  <span
                                    className={`font-mono font-semibold ${
                                      isArchived
                                        ? 'text-slate-500'
                                        : 'text-emerald-700 dark:text-emerald-400'
                                    }`}
                                  >
                                    {doc.status}
                                  </span>
                                  {doc.archivedAt && (
                                    <>
                                      <span className="text-slate-400">·</span>
                                      <span className="font-mono text-slate-500">
                                        Archived {new Date(doc.archivedAt).toLocaleDateString()}
                                      </span>
                                    </>
                                  )}
                                </div>
                                <div className="text-sm font-semibold text-navy-900 dark:text-white">
                                  {doc.title}
                                </div>
                                {doc.description && (
                                  <p className="text-xs text-slate-600 dark:text-slate-300">
                                    {doc.description}
                                  </p>
                                )}
                                <div className="text-[11px] text-slate-500">
                                  {doc.uploadedByOrg} · Uploaded by {doc.uploadedByName} ·{' '}
                                  <span className="font-mono">{doc.fileName || 'Attachment'}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <a
                                  href={doc.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 text-navy-900 dark:text-slate-100 whitespace-nowrap"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  Open
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleToggleDocumentArchive(doc)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
                                >
                                  {isArchived ? (
                                    <>
                                      <ArchiveRestore className="w-3.5 h-3.5" />
                                      Restore
                                    </>
                                  ) : (
                                    <>
                                      <Archive className="w-3.5 h-3.5" />
                                      Archive
                                    </>
                                  )}
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: SHARED UPDATES & JOINT EVENTS */}
              {subTab === 'updates' && (
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Progress Update Form */}
                    <form onSubmit={handlePostReport} className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Log Progress or Accomplishment Report
                      </h4>
                      <select
                        value={newReport.reportType}
                        onChange={(e) => setNewReport({ ...newReport, reportType: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      >
                        <option value="Progress Update">Progress Update</option>
                        <option value="Accomplishment Report">Accomplishment Report</option>
                        <option value="Shared Announcement">Shared Announcement</option>
                      </select>
                      <input
                        type="text"
                        required
                        value={newReport.title}
                        onChange={(e) => setNewReport({ ...newReport, title: e.target.value })}
                        placeholder="Update headline *"
                        className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                      <textarea
                        required
                        rows={3}
                        value={newReport.summary}
                        onChange={(e) => setNewReport({ ...newReport, summary: e.target.value })}
                        placeholder="Summary of field outcomes, attendance, or milestones..."
                        className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 text-xs font-semibold bg-navy-900 text-white rounded-md hover:bg-navy-800 cursor-pointer"
                      >
                        Post Shared Update
                      </button>
                    </form>

                    {/* Joint Event Form */}
                    <form onSubmit={handleScheduleEvent} className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Schedule Linked Joint Event
                      </h4>
                      <input
                        type="text"
                        required
                        value={newEvent.title}
                        onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                        placeholder="Joint forum / workshop title *"
                        className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={newEvent.format}
                          onChange={(e) => setNewEvent({ ...newEvent, format: e.target.value })}
                          className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                        >
                          <option value="Hybrid">Hybrid</option>
                          <option value="Online">Online</option>
                          <option value="In-person">In-person</option>
                        </select>
                        <input
                          type="text"
                          required
                          value={newEvent.startAt}
                          onChange={(e) => setNewEvent({ ...newEvent, startAt: e.target.value })}
                          placeholder="YYYY-MM-DD HH:MM *"
                          className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                        />
                      </div>
                      <input
                        type="text"
                        required
                        value={newEvent.venueOrLink}
                        onChange={(e) => setNewEvent({ ...newEvent, venueOrLink: e.target.value })}
                        placeholder="Venue address or video link *"
                        className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                      <textarea
                        required
                        rows={2}
                        value={newEvent.description}
                        onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                        placeholder="Brief public event agenda *"
                        className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 text-xs font-semibold border border-navy-900 dark:border-slate-400 text-navy-900 dark:text-white rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Publish Joint Event
                      </button>
                    </form>
                  </div>

                  {/* Combined Updates & Events Ledger */}
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Recent Reports &amp; Announcements ({workspace.reports.length})
                      </h4>
                      {workspace.reports.length === 0 ? (
                        <p className="text-xs text-slate-500">No updates logged yet.</p>
                      ) : (
                        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                          {workspace.reports.map((rep) => (
                            <li key={rep.id} className="py-3 space-y-1">
                              <div className="text-[11px] font-mono text-crimson-600 dark:text-red-400">
                                {rep.reportType} · {new Date(rep.createdAt).toLocaleDateString()}
                              </div>
                              <div className="text-sm font-semibold text-navy-900 dark:text-white">
                                {rep.title}
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-300">{rep.summary}</p>
                              <div className="text-[11px] text-slate-500">By {rep.authorName}</div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Linked Joint Events ({workspace.events.length})
                      </h4>
                      {workspace.events.length === 0 ? (
                        <p className="text-xs text-slate-500">No linked joint events scheduled yet.</p>
                      ) : (
                        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                          {workspace.events.map((ev) => (
                            <li key={ev.id} className="py-3 space-y-1">
                              <div className="text-[11px] font-mono text-navy-900 dark:text-slate-300">
                                {ev.format} · {ev.startAt}
                              </div>
                              <div className="text-sm font-semibold text-navy-900 dark:text-white">
                                {ev.title}
                              </div>
                              <div className="text-xs text-slate-500">{ev.venueOrLink}</div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};
