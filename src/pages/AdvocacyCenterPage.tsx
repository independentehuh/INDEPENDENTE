import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Flag,
  PlusCircle,
  Search,
  Users,
} from 'lucide-react';
import {
  AdvocacyArea,
  Campaign,
  Mobilization,
  NetworkEvent,
  Organization,
  PageRoute,
  Publication,
} from '../types/index.ts';
import { MediaImage } from '../components/MediaImage.tsx';
import { useAuth } from '../context/AuthContext.tsx';

interface AdvocacyCenterPageProps {
  initialSlug?: string;
  onNavigate: (page: PageRoute, slug?: string) => void;
}

interface AdvocacyDetailPayload {
  area: AdvocacyArea;
  campaigns: Campaign[];
  partners: Array<Pick<Organization, 'id' | 'slug' | 'name' | 'orgType' | 'geographicCoverage' | 'logoUrl'>>;
  publications: Publication[];
  events: NetworkEvent[];
}

interface MobilizationDetailPayload {
  mobilization: Mobilization;
  participantCount: number;
  updates: Array<{
    id: number;
    title: string;
    content: string;
    updateType: string;
    authorName: string;
    createdAt: string;
  }>;
  events: NetworkEvent[];
}

interface MobilizationWorkspacePayload {
  mobilization: Mobilization;
  members: Array<{
    id: number;
    fullName: string;
    email: string;
    role: string;
    skillsOrInterest: string;
    status: string;
  }>;
  tasks: Array<{
    id: number;
    title: string;
    description: string;
    assignedTo: string;
    dueDate: string;
    status: string;
  }>;
  updates: Array<{
    id: number;
    title: string;
    content: string;
    updateType: string;
    authorName: string;
    isPublic: boolean;
    createdAt: string;
  }>;
}

const CAMPAIGN_STATUSES = [
  'All',
  'Active',
  'Planning',
  'Proposed',
  'Temporarily Paused',
  'Completed',
  'Archived',
];

export const AdvocacyCenterPage: React.FC<AdvocacyCenterPageProps> = ({
  initialSlug,
  onNavigate,
}) => {
  const { idToken, partnerToken, dbUser, partnerUser, signInWithGoogle } = useAuth();
  const activeToken = idToken || partnerToken;
  const activeUser = dbUser || partnerUser;

  const [tab, setTab] = useState<'areas' | 'mobilizations' | 'start' | 'workspace'>('areas');
  const [areas, setAreas] = useState<AdvocacyArea[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [mobilizations, setMobilizations] = useState<Mobilization[]>([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [detail, setDetail] = useState<AdvocacyDetailPayload | null>(null);
  const [activeMob, setActiveMob] = useState<MobilizationDetailPayload | null>(null);
  const [mobWorkspace, setMobWorkspace] = useState<MobilizationWorkspacePayload | null>(null);
  const [workspaceError, setWorkspaceError] = useState('');
  const [loading, setLoading] = useState(true);

  // Mobilization discovery filters
  const [mobSearch, setMobSearch] = useState('');
  const [mobTypeFilter, setMobTypeFilter] = useState('all');
  const [mobSupportFilter, setMobSupportFilter] = useState('all');

  // Join mobilization form
  const [joinForm, setJoinForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'Volunteer',
    skillsOrInterest: '',
  });
  const [joinResult, setJoinResult] = useState('');

  // Start a mobilization proposal form
  const [startForm, setStartForm] = useState({
    title: '',
    advocacyAreaId: '',
    description: '',
    objectives: '',
    targetAudience: '',
    geographicScope: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    participationType: 'Volunteers',
    supportType: 'Independent Initiative',
    status: 'Submitted',
  });
  const [startResult, setStartResult] = useState<Mobilization | null>(null);
  const [startError, setStartError] = useState('');

  // Workspace task & update forms
  const [taskForm, setTaskForm] = useState({ title: '', assignedTo: '', dueDate: '' });
  const [updateForm, setUpdateForm] = useState({
    updateType: 'Progress Report',
    title: '',
    content: '',
    isPublic: true,
  });

  const loadAdvocacyAndMobs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (mobSearch.trim()) params.set('q', mobSearch.trim());
      if (mobTypeFilter !== 'all') params.set('type', mobTypeFilter);
      if (mobSupportFilter !== 'all') params.set('supportType', mobSupportFilter);

      const [aRes, mRes] = await Promise.all([
        fetch('/api/advocacy'),
        fetch(`/api/mobilizations?${params.toString()}`),
      ]);
      if (aRes.ok) {
        const data = await aRes.json();
        setAreas(data.areas || []);
        setCampaigns(data.campaigns || []);
      }
      if (mRes.ok) {
        setMobilizations(await mRes.json());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdvocacyAndMobs();
  }, [mobTypeFilter, mobSupportFilter]);

  const openArea = async (slug: string) => {
    const res = await fetch(`/api/advocacy/${encodeURIComponent(slug)}`);
    if (res.ok) {
      setDetail(await res.json());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const openMobilization = async (slug: string) => {
    setJoinResult('');
    const res = await fetch(`/api/mobilizations/${encodeURIComponent(slug)}`);
    if (res.ok) {
      setActiveMob(await res.json());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const openMobWorkspace = async (mobId: number) => {
    setWorkspaceError('');
    if (!activeToken) {
      setWorkspaceError('Sign in to access private Mobilization Organizer Workspaces.');
      return;
    }
    const res = await fetch(`/api/mobilizations/${mobId}/workspace`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    const d = await res.json();
    if (!res.ok) {
      setWorkspaceError(d.error || 'Access denied to this mobilization workspace.');
    } else {
      setMobWorkspace(d);
      setTab('workspace');
    }
  };

  useEffect(() => {
    if (initialSlug) {
      if (initialSlug.startsWith('mob-workspace-')) {
        const id = Number(initialSlug.replace('mob-workspace-', ''));
        if (id && activeToken) openMobWorkspace(id);
      } else if (initialSlug === 'mobilizations') {
        setTab('mobilizations');
      } else if (initialSlug === 'start') {
        setTab('start');
      } else {
        openArea(initialSlug);
      }
    }
  }, [initialSlug, activeToken]);

  const filteredCampaigns =
    statusFilter === 'All' ? campaigns : campaigns.filter((c) => c.status === statusFilter);

  // Detail View: Mobilization Profile & Join
  if (activeMob) {
    const { mobilization: m, participantCount, updates } = activeMob;
    return (
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <button
          type="button"
          onClick={() => setActiveMob(null)}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-navy-900 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Advocacy &amp; Mobilizations
        </button>

        <div className="p-8 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/60 space-y-6">
          <div className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-6">
            <div className="text-xs font-mono text-crimson-600 dark:text-red-400">
              {m.supportType} · {m.participationType} · Status: {m.status}
            </div>
            <h1 className="font-serif text-3xl font-semibold text-navy-900 dark:text-white">
              {m.title}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {m.description}
            </p>
            <div className="text-xs text-slate-500 pt-2">
              Geographic Scope: <strong>{m.geographicScope}</strong> · Timeline:{' '}
              <span className="tabular-nums">
                {m.startDate}
                {m.endDate ? ` to ${m.endDate}` : ''}
              </span>{' '}
              · Approved Organizers &amp; Volunteers:{' '}
              <span className="font-mono tabular-nums">{participantCount}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h2 className="font-semibold text-navy-900 dark:text-white mb-1">Objectives</h2>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{m.objectives}</p>
            </div>
            <div>
              <h2 className="font-semibold text-navy-900 dark:text-white mb-1">Target Participants</h2>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{m.targetAudience}</p>
            </div>
          </div>

          {updates.length > 0 && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <h2 className="font-serif text-lg font-semibold">Public Progress Updates</h2>
              {updates.map((u) => (
                <div key={u.id} className="p-4 border border-slate-200 dark:border-slate-800 rounded text-xs">
                  <div className="text-slate-500">
                    {u.updateType} · {u.authorName}
                  </div>
                  <div className="font-semibold text-sm mt-0.5">{u.title}</div>
                  <p className="text-slate-600 dark:text-slate-300 mt-1">{u.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* Join / Volunteer Form */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
            <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
              Join or Volunteer for This Mobilization
            </h2>
            {joinResult ? (
              <div className="p-4 border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 rounded text-sm text-emerald-900 dark:text-emerald-200">
                {joinResult}
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const res = await fetch(`/api/mobilizations/${m.id}/join`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
                    },
                    body: JSON.stringify({
                      fullName: joinForm.fullName || activeUser?.displayName,
                      email: joinForm.email || activeUser?.email,
                      phone: joinForm.phone,
                      role: joinForm.role,
                      skillsOrInterest: joinForm.skillsOrInterest,
                    }),
                  });
                  const d = await res.json();
                  if (res.ok) setJoinResult(d.message);
                }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs"
              >
                <input
                  required={!activeUser}
                  placeholder={activeUser?.displayName || 'Full Name *'}
                  value={joinForm.fullName}
                  onChange={(e) => setJoinForm({ ...joinForm, fullName: e.target.value })}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                />
                <input
                  required={!activeUser}
                  type="email"
                  placeholder={activeUser?.email || 'Email *'}
                  value={joinForm.email}
                  onChange={(e) => setJoinForm({ ...joinForm, email: e.target.value })}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                />
                <input
                  placeholder="Contact Number (Optional)"
                  value={joinForm.phone}
                  onChange={(e) => setJoinForm({ ...joinForm, phone: e.target.value })}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                />
                <select
                  value={joinForm.role}
                  onChange={(e) => setJoinForm({ ...joinForm, role: e.target.value })}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                >
                  <option value="Volunteer">Volunteer</option>
                  <option value="Participant">Participant / Observer</option>
                </select>
                <input
                  placeholder="Relevant skills or community area (Optional)"
                  value={joinForm.skillsOrInterest}
                  onChange={(e) => setJoinForm({ ...joinForm, skillsOrInterest: e.target.value })}
                  className="sm:col-span-2 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                />
                <div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 font-semibold bg-crimson-600 text-white rounded cursor-pointer"
                  >
                    Submit Participation Interest
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Detail View: Advocacy Area Program Brief
  if (detail) {
    const { area } = detail;
    return (
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <button
          type="button"
          onClick={() => setDetail(null)}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Advocacy Center
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch border-b border-slate-200 dark:border-slate-800 pb-10">
          <div className="lg:col-span-7 space-y-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-crimson-600 dark:text-red-400">
              Advocacy Program &amp; Policy Area
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-navy-900 dark:text-white headline-balance">
              {area.title}
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              {area.summary}
            </p>
            <div className="pt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setDetail(null);
                  setTab('start');
                }}
                className="px-4 py-2.5 text-xs font-semibold text-white bg-navy-900 hover:bg-navy-800 rounded-md cursor-pointer"
              >
                Start a Related Mobilization
              </button>
              <button
                type="button"
                onClick={() => onNavigate('isanguni')}
                className="px-4 py-2.5 text-xs font-semibold text-white bg-crimson-600 hover:bg-crimson-700 rounded-md cursor-pointer"
              >
                Report Related Community Issue
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 aspect-[16/10] lg:aspect-auto rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
            <MediaImage
              src={area.heroImageUrl}
              alt={area.title}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
            <h2 className="font-serif text-lg font-semibold text-navy-900 dark:text-white">
              Background &amp; Rationale
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {area.backgroundRationale}
            </p>
          </div>
          <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
            <h2 className="font-serif text-lg font-semibold text-navy-900 dark:text-white">
              Identified Community Concern
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {area.identifiedConcern}
            </p>
          </div>
          <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
            <h2 className="font-serif text-lg font-semibold text-navy-900 dark:text-white">
              Objectives &amp; Position
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {area.objectives}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
              Guiding Principles: {area.guidingPrinciples}
            </p>
          </div>
          <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
            <h2 className="font-serif text-lg font-semibold text-navy-900 dark:text-white">
              Programs &amp; Proposed Interventions
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {area.interventions}
            </p>
            <p className="text-xs text-navy-900 dark:text-slate-200 font-medium pt-2 border-t border-slate-100 dark:border-slate-800">
              How Citizens Can Participate: {area.citizenParticipation}
            </p>
          </div>
        </div>

        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold text-navy-900 dark:text-white">
            Campaigns &amp; Initiatives
          </h2>
          {detail.campaigns.length === 0 ? (
            <p className="text-sm text-slate-500">
              Working groups are preparing upcoming campaign briefs under this advocacy area.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {detail.campaigns.map((c) => (
                <div
                  key={c.id}
                  className="p-5 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2"
                >
                  <div className="text-xs text-slate-500">
                    <span className="font-semibold text-navy-900 dark:text-white">{c.status}</span> ·{' '}
                    <span className="tabular-nums">{c.startDate}</span>
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-slate-900 dark:text-white">
                    {c.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{c.summary}</p>
                  <p className="text-xs text-slate-500 pt-1">
                    <strong>Participation:</strong> {c.participationSteps}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="space-y-3">
            <h3 className="font-serif text-lg font-semibold text-navy-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4" /> Partner Organizations Involved
            </h3>
            <div className="space-y-2">
              {detail.partners.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onNavigate('network', p.slug)}
                  className="w-full text-left p-3 border border-slate-200 dark:border-slate-800 rounded-md hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {p.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {p.orgType} · {p.geographicCoverage}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-serif text-lg font-semibold text-navy-900 dark:text-white">
              Upcoming Related Activities
            </h3>
            <div className="space-y-2">
              {detail.events.slice(0, 3).map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onNavigate('events', ev.slug)}
                  className="w-full text-left p-3 border border-slate-200 dark:border-slate-800 rounded-md hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {ev.title}
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums">
                    {ev.startAt} · {ev.format}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-widest text-crimson-600 dark:text-red-400">
            OP-02: Advocacy &amp; Mobilization Operations
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-navy-900 dark:text-white">
            Advocacy &amp; Mobilization Center
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            Explore core advocacy priorities and campaigns, join active citizen mobilizations, or
            propose a new civic mobilization for structured vetting.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab('areas')}
            className={`px-4 py-2 text-xs font-semibold rounded-md cursor-pointer ${
              tab === 'areas'
                ? 'bg-navy-900 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            Advocacy Areas &amp; Campaigns
          </button>
          <button
            type="button"
            onClick={() => setTab('mobilizations')}
            className={`px-4 py-2 text-xs font-semibold rounded-md cursor-pointer ${
              tab === 'mobilizations'
                ? 'bg-navy-900 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            Join a Mobilization ({mobilizations.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('start')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md cursor-pointer ${
              tab === 'start'
                ? 'bg-crimson-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" /> Start a Mobilization
          </button>
          {mobWorkspace && (
            <button
              type="button"
              onClick={() => setTab('workspace')}
              className={`px-4 py-2 text-xs font-semibold rounded-md cursor-pointer ${
                tab === 'workspace'
                  ? 'bg-navy-900 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              Organizer Workspace
            </button>
          )}
        </div>
      </div>

      {workspaceError && (
        <div className="p-3 rounded border border-red-300 bg-red-50 text-sm text-red-700">
          {workspaceError}
        </div>
      )}

      {/* TAB 1: ADVOCACY AREAS & CAMPAIGNS */}
      {tab === 'areas' && (
        <div className="space-y-12">
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="font-serif text-2xl font-semibold text-navy-900 dark:text-white flex items-center gap-2">
                <Flag className="w-5 h-5 text-crimson-600" />
                Active &amp; Planned Campaigns
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {CAMPAIGN_STATUSES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                      statusFilter === st
                        ? 'bg-navy-900 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {filteredCampaigns.length === 0 ? (
              <div className="p-8 border border-slate-200 dark:border-slate-800 rounded-lg text-center text-sm text-slate-500">
                No campaigns currently in "{statusFilter}" status.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {filteredCampaigns.map((camp) => (
                  <div
                    key={camp.id}
                    className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900/60 flex flex-col justify-between"
                  >
                    <div>
                      <div className="aspect-[16/9] bg-slate-100 dark:bg-slate-800">
                        <MediaImage src={camp.heroImageUrl} alt={camp.title} />
                      </div>
                      <div className="p-5 space-y-2">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-semibold text-navy-900 dark:text-white">
                            {camp.status}
                          </span>{' '}
                          · <span className="tabular-nums">{camp.startDate}</span>
                        </div>
                        <h3 className="font-serif text-lg font-semibold text-slate-900 dark:text-white">
                          {camp.title}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                          {camp.summary}
                        </p>
                      </div>
                    </div>
                    <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                      <strong>Action:</strong> {camp.participationSteps}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-6 pt-4 border-t border-slate-200 dark:border-slate-800">
            <h2 className="font-serif text-2xl font-semibold text-navy-900 dark:text-white">
              Advocacy Focus Areas ({areas.length})
            </h2>
            {loading ? (
              <p className="text-sm text-slate-500">Loading advocacy areas...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {areas.map((area, index) => (
                  <div
                    key={area.id}
                    className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/60 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="text-xs font-mono text-slate-500 tabular-nums">
                        {String(index + 1).padStart(2, '0')}. Advocacy Area
                      </div>
                      <h3 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
                        {area.title}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {area.summary}
                      </p>
                    </div>
                    <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                      <span className="text-xs text-slate-500 truncate max-w-[65%]">
                        {area.guidingPrinciples}
                      </span>
                      <button
                        type="button"
                        onClick={() => openArea(area.slug)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-navy-900 dark:text-slate-200 hover:text-crimson-600 cursor-pointer shrink-0"
                      >
                        Open Program Brief <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: JOIN AN EXISTING MOBILIZATION */}
      {tab === 'mobilizations' && (
        <section className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/70 dark:bg-slate-900/50">
            <input
              value={mobSearch}
              onChange={(e) => setMobSearch(e.target.value)}
              placeholder="Search title or location..."
              className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900"
            />
            <select
              value={mobTypeFilter}
              onChange={(e) => setMobTypeFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900"
            >
              <option value="all">All Participation Types</option>
              <option value="Volunteers">Volunteers</option>
              <option value="Community Brigades">Community Brigades</option>
              <option value="Campus Chapter">Campus Chapter</option>
              <option value="Consultation">Consultation</option>
              <option value="Civic Action">Civic Action</option>
            </select>
            <select
              value={mobSupportFilter}
              onChange={(e) => setMobSupportFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900"
            >
              <option value="all">All Initiative Tiers</option>
              <option value="INDEPENDENTE Supported">INDEPENDENTE Supported</option>
              <option value="Independent Initiative">Independent Initiative</option>
            </select>
            <button
              type="button"
              onClick={loadAdvocacyAndMobs}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold bg-navy-900 text-white rounded-md cursor-pointer"
            >
              <Search className="w-4 h-4" /> Filter Mobilizations
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mobilizations.map((m) => (
              <div
                key={m.id}
                className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900/60 flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-[16/9] bg-slate-100 dark:bg-slate-800">
                    <MediaImage src={m.heroImageUrl} alt={m.title} />
                  </div>
                  <div className="p-5 space-y-2">
                    <div className="text-xs font-mono text-crimson-600 dark:text-red-400">
                      {m.supportType} · {m.participationType}
                    </div>
                    <h3 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
                      {m.title}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {m.geographicScope} · Starts <span className="tabular-nums">{m.startDate}</span>
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3">
                      {m.description}
                    </p>
                  </div>
                </div>
                <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-500 tabular-nums">
                    {m.participantCount || 0} active participants
                  </span>
                  <div className="flex items-center gap-3">
                    {activeToken && (
                      <button
                        type="button"
                        onClick={() => openMobWorkspace(m.id)}
                        className="text-slate-500 hover:underline cursor-pointer"
                      >
                        Organizer Desk
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openMobilization(m.slug)}
                      className="font-semibold text-navy-900 dark:text-slate-200 hover:underline cursor-pointer"
                    >
                      Join / Details →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TAB 3: START A MOBILIZATION */}
      {tab === 'start' && (
        <section className="max-w-3xl space-y-6">
          <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-900/50 space-y-1.5">
            <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
              Start a Mobilization — Proposal &amp; Verification Workflow
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Draft → Submitted → Initial Review → Verification → Approved / Returned for Revision /
              Declined → Active → Completed / Archived. Proposals must follow nonpartisan civic
              guidelines.
            </p>
          </div>

          {!activeToken ? (
            <div className="p-8 border border-slate-200 dark:border-slate-800 rounded-lg text-center space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Sign in with Google or your Partner Organization account to submit a mobilization
                proposal and manage its private organizer workspace.
              </p>
              <button
                type="button"
                onClick={signInWithGoogle}
                className="px-5 py-2.5 text-xs font-semibold bg-navy-900 text-white rounded-md cursor-pointer"
              >
                Sign In with Google
              </button>
            </div>
          ) : startResult ? (
            <div className="p-8 border border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-lg space-y-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-700" />
              <h3 className="font-serif text-2xl font-semibold">{startResult.title}</h3>
              <p className="text-sm">
                Status: <strong>{startResult.status}</strong> ({startResult.supportType}). Your
                proposal has been queued for Advocacy Operations (OP-02) review.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => openMobWorkspace(startResult.id)}
                  className="px-4 py-2 text-xs font-semibold bg-navy-900 text-white rounded cursor-pointer"
                >
                  Open Private Organizer Workspace
                </button>
                <button
                  type="button"
                  onClick={() => setStartResult(null)}
                  className="px-4 py-2 text-xs border border-slate-300 rounded cursor-pointer"
                >
                  Submit Another Proposal
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setStartError('');
                const res = await fetch('/api/mobilizations', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${activeToken}`,
                  },
                  body: JSON.stringify(startForm),
                });
                const d = await res.json();
                if (!res.ok) setStartError(d.error || 'Unable to submit proposal.');
                else setStartResult(d);
              }}
              className="p-6 sm:p-8 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4 bg-white dark:bg-slate-900/60 text-sm"
            >
              {startError && (
                <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded">
                  {startError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold mb-1">Mobilization Title *</label>
                <input
                  required
                  value={startForm.title}
                  onChange={(e) => setStartForm({ ...startForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Advocacy Category</label>
                  <select
                    value={startForm.advocacyAreaId}
                    onChange={(e) => setStartForm({ ...startForm, advocacyAreaId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                  >
                    <option value="">General Civic Initiative</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Initiative Support Tier</label>
                  <select
                    value={startForm.supportType}
                    onChange={(e) => setStartForm({ ...startForm, supportType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                  >
                    <option value="Independent Initiative">Independent Initiative</option>
                    <option value="INDEPENDENTE Supported">Request INDEPENDENTE Supported Status</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Description *</label>
                <textarea
                  required
                  rows={3}
                  value={startForm.description}
                  onChange={(e) => setStartForm({ ...startForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Objectives *</label>
                <textarea
                  required
                  rows={2}
                  value={startForm.objectives}
                  onChange={(e) => setStartForm({ ...startForm, objectives: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Target Audience *</label>
                  <input
                    required
                    value={startForm.targetAudience}
                    onChange={(e) => setStartForm({ ...startForm, targetAudience: e.target.value })}
                    placeholder="e.g., Local residents, campus chapters"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Geographic Scope *</label>
                  <input
                    required
                    value={startForm.geographicScope}
                    onChange={(e) => setStartForm({ ...startForm, geographicScope: e.target.value })}
                    placeholder="e.g., Quezon City, Visayas"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Start Date *</label>
                  <input
                    required
                    type="date"
                    value={startForm.startDate}
                    onChange={(e) => setStartForm({ ...startForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Participation Type *</label>
                  <select
                    value={startForm.participationType}
                    onChange={(e) => setStartForm({ ...startForm, participationType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                  >
                    <option>Volunteers</option>
                    <option>Community Brigades</option>
                    <option>Campus Chapter</option>
                    <option>Consultation</option>
                    <option>Civic Action</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  onClick={() => setStartForm((s) => ({ ...s, status: 'Submitted' }))}
                  className="px-5 py-2.5 text-xs font-semibold bg-crimson-600 text-white rounded cursor-pointer"
                >
                  Submit Mobilization Proposal
                </button>
                <button
                  type="submit"
                  onClick={() => setStartForm((s) => ({ ...s, status: 'Draft' }))}
                  className="px-5 py-2.5 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded cursor-pointer"
                >
                  Save as Draft
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* TAB 4: PRIVATE MOBILIZATION ORGANIZER WORKSPACE */}
      {tab === 'workspace' && mobWorkspace && (
        <section className="space-y-8">
          <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/70 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="font-mono text-xs text-crimson-600 dark:text-red-400">
                Private Mobilization Organizer Workspace · {mobWorkspace.mobilization.status}
              </div>
              <h2 className="font-serif text-2xl font-semibold text-navy-900 dark:text-white mt-1">
                {mobWorkspace.mobilization.title}
              </h2>
            </div>
            <div className="text-xs text-slate-500">
              {mobWorkspace.mobilization.supportType} · {mobWorkspace.mobilization.geographicScope}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-6 space-y-6">
              <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
                <h3 className="font-serif text-lg font-semibold">
                  Volunteer Applications &amp; Participant Directory ({mobWorkspace.members.length})
                </h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {mobWorkspace.members.map((mem) => (
                    <div key={mem.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold">{mem.fullName}</div>
                        <div className="text-slate-500">
                          {mem.email} · {mem.role} · <strong>{mem.status}</strong>
                        </div>
                        {mem.skillsOrInterest && (
                          <div className="text-slate-500">{mem.skillsOrInterest}</div>
                        )}
                      </div>
                      {mem.status === 'Pending' && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await fetch(
                                `/api/mobilizations/${mobWorkspace.mobilization.id}/members/${mem.id}`,
                                {
                                  method: 'PATCH',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${activeToken}`,
                                  },
                                  body: JSON.stringify({ status: 'Approved' }),
                                }
                              );
                              openMobWorkspace(mobWorkspace.mobilization.id);
                            }}
                            className="px-2.5 py-1 bg-emerald-700 text-white rounded cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await fetch(
                                `/api/mobilizations/${mobWorkspace.mobilization.id}/members/${mem.id}`,
                                {
                                  method: 'PATCH',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${activeToken}`,
                                  },
                                  body: JSON.stringify({ status: 'Declined' }),
                                }
                              );
                              openMobWorkspace(mobWorkspace.mobilization.id);
                            }}
                            className="px-2.5 py-1 border border-red-300 text-red-700 rounded cursor-pointer"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4">
                <h3 className="font-serif text-lg font-semibold">Mobilization Tasks</h3>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await fetch(`/api/mobilizations/${mobWorkspace.mobilization.id}/tasks`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${activeToken}`,
                      },
                      body: JSON.stringify(taskForm),
                    });
                    setTaskForm({ title: '', assignedTo: '', dueDate: '' });
                    openMobWorkspace(mobWorkspace.mobilization.id);
                  }}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs"
                >
                  <input
                    required
                    placeholder="Task title"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    className="px-2.5 py-2 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                  />
                  <input
                    placeholder="Assignee"
                    value={taskForm.assignedTo}
                    onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                    className="px-2.5 py-2 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 font-semibold bg-navy-900 text-white rounded cursor-pointer"
                  >
                    Add Task
                  </button>
                </form>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {mobWorkspace.tasks.map((t) => (
                    <div key={t.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold">{t.title}</div>
                        <div className="text-slate-500">Assigned: {t.assignedTo}</div>
                      </div>
                      <select
                        value={t.status}
                        onChange={async (e) => {
                          await fetch(
                            `/api/mobilizations/${mobWorkspace.mobilization.id}/tasks/${t.id}`,
                            {
                              method: 'PATCH',
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${activeToken}`,
                              },
                              body: JSON.stringify({ status: e.target.value }),
                            }
                          );
                          openMobWorkspace(mobWorkspace.mobilization.id);
                        }}
                        className="px-2 py-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                      >
                        <option>Pending</option>
                        <option>In Progress</option>
                        <option>Completed</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-6">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await fetch(`/api/mobilizations/${mobWorkspace.mobilization.id}/updates`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${activeToken}`,
                    },
                    body: JSON.stringify(updateForm),
                  });
                  setUpdateForm({
                    updateType: 'Progress Report',
                    title: '',
                    content: '',
                    isPublic: true,
                  });
                  openMobWorkspace(mobWorkspace.mobilization.id);
                }}
                className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3 text-xs"
              >
                <h3 className="font-serif text-lg font-semibold">
                  Post Progress, Announcement or Accomplishment Report
                </h3>
                <select
                  value={updateForm.updateType}
                  onChange={(e) => setUpdateForm({ ...updateForm, updateType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                >
                  <option>Progress Report</option>
                  <option>Accomplishment Report</option>
                  <option>Announcement</option>
                  <option>Calendar Milestone</option>
                </select>
                <input
                  required
                  placeholder="Update Title"
                  value={updateForm.title}
                  onChange={(e) => setUpdateForm({ ...updateForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                />
                <textarea
                  required
                  rows={3}
                  placeholder="Details, milestones, or outcomes"
                  value={updateForm.content}
                  onChange={(e) => setUpdateForm({ ...updateForm, content: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={updateForm.isPublic}
                    onChange={(e) => setUpdateForm({ ...updateForm, isPublic: e.target.checked })}
                  />
                  Publish to public mobilization profile
                </label>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold bg-navy-900 text-white rounded cursor-pointer"
                >
                  Record Update
                </button>
              </form>

              <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
                <h3 className="font-serif text-lg font-semibold">Workspace Updates &amp; Reports</h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {mobWorkspace.updates.map((u) => (
                    <div key={u.id} className="py-3 space-y-1">
                      <div className="text-slate-500">
                        {u.updateType} · {u.authorName} · {u.isPublic ? 'Public' : 'Internal Only'}
                      </div>
                      <div className="font-semibold text-sm">{u.title}</div>
                      <p className="text-slate-600 dark:text-slate-300">{u.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
