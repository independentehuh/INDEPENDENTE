import React, { useEffect, useState } from 'react';
import {
  Bell,
  Building2,
  Calendar,
  Flag,
  Handshake,
  LogIn,
  MessageSquare,
  Newspaper,
  Settings,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { OrgAnnouncementsChat } from '../components/OrgAnnouncementsChat.tsx';
import {
  CollaborationRequest,
  MediaOutlet,
  Mobilization,
  NetworkEvent,
  Organization,
  PageRoute,
  Publication,
} from '../types/index.ts';

interface MyWorkspacePageProps {
  onNavigate: (page: PageRoute, slug?: string) => void;
}

interface WorkspacePayload {
  account: {
    id: number;
    uid: string;
    email: string;
    displayName: string;
    roleSlug: string;
    organizationId: number | null;
  };
  myPublications: {
    outlets: Array<{ membershipId: number; editorialRole: string; outlet: MediaOutlet }>;
    articles: Publication[];
  };
  myOrganizations: Array<{
    membershipId: number;
    orgRole: string;
    titleOrCommittee: string;
    organization: Organization;
  }>;
  directOrganization: Organization | null;
  myMembershipApplications: Array<{
    application: {
      id: number;
      status: string;
      motivation: string;
      reviewNotes: string;
      createdAt: string;
    };
    organizationName: string;
  }>;
  myOrganizationEstablishmentApps: Array<{
    id: number;
    referenceCode: string;
    organizationName: string;
    status: string;
    reviewNotes: string;
  }>;
  myMobilizations: {
    joined: Array<{
      member: { id: number; role: string; status: string };
      mobilization: Mobilization;
    }>;
    proposed: Mobilization[];
  };
  myEvents: Array<{
    registration: {
      id: number;
      qrToken: string;
      delegationSize: number;
      status: string;
      attended: boolean;
    };
    event: NetworkEvent;
  }>;
  myCollaborationRequests: CollaborationRequest[];
  myNotifications: Array<{
    id: number;
    title: string;
    message: string;
    createdAt: string;
  }>;
}

export const MyWorkspacePage: React.FC<MyWorkspacePageProps> = ({ onNavigate }) => {
  const { idToken, partnerToken, dbUser, partnerUser, signInWithGoogle, refreshProfile } = useAuth();
  const activeToken = idToken || partnerToken;
  const activeUser = dbUser || partnerUser;

  const [data, setData] = useState<WorkspacePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [displayNameEdit, setDisplayNameEdit] = useState('');
  const [notice, setNotice] = useState('');
  const [activeChatOrgId, setActiveChatOrgId] = useState<number | null>(null);

  const loadWorkspace = async () => {
    if (!activeToken) return;
    setLoading(true);
    try {
      const res = await fetch('/api/workspace/me', {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (res.ok) {
        const json: WorkspacePayload = await res.json();
        setData(json);
        setDisplayNameEdit(json.account.displayName || '');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, [activeToken]);

  if (!activeToken || !activeUser) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-5">
        <UserCheck className="w-10 h-10 text-navy-900 dark:text-white mx-auto" />
        <h1 className="font-serif text-3xl font-semibold text-navy-900 dark:text-white">
          My Workspace
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Sign in with Google or via your Partner Organization account to manage your media
          publications, organizations, membership applications, mobilizations, events, and
          collaboration requests in one unified civic workspace.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={signInWithGoogle}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-navy-900 text-white rounded-md hover:bg-navy-800 cursor-pointer"
          >
            <LogIn className="w-4 h-4" /> Sign In with Google
          </button>
          <button
            type="button"
            onClick={() => onNavigate('partner-portal')}
            className="px-5 py-2.5 text-sm font-semibold border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            Partner Portal Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-crimson-600 dark:text-red-400">
            Unified Participation Profile · My Workspace
          </div>
          <h1 className="font-serif text-3xl font-semibold text-navy-900 dark:text-white mt-1">
            {data?.account.displayName || activeUser.displayName || activeUser.email}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeUser.email} · Network Role: {activeUser.roleSlug}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigate('advocacy')}
            className="px-3.5 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            Start / Join Mobilization
          </button>
          <button
            type="button"
            onClick={() => onNavigate('network')}
            className="px-3.5 py-2 text-xs font-semibold bg-navy-900 text-white rounded-md hover:bg-navy-800 cursor-pointer"
          >
            Organization Hub
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 text-sm text-emerald-900 dark:text-emerald-200">
          {notice}
        </div>
      )}

      {loading || !data ? (
        <div className="py-16 text-center text-sm text-slate-500">Loading personal workspace...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            {/* 1. My Organizations & 2. My Publications */}
            <section className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4" /> My Organizations
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigate('network')}
                  className="text-xs font-semibold text-navy-900 dark:text-slate-200 hover:underline cursor-pointer"
                >
                  Browse or Establish Organization →
                </button>
              </div>
              {data.myOrganizations.length === 0 && !data.directOrganization ? (
                <p className="text-sm text-slate-500">
                  You are not currently affiliated with an organization workspace. Apply to join or
                  establish an organization from the Organization Hub.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.directOrganization && (
                    <div className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold text-sm">{data.directOrganization.name}</div>
                        <div className="text-xs text-slate-500">
                          {data.directOrganization.affiliationStatus} · Partner Portal Linked
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveChatOrgId((prev) =>
                              prev === data.directOrganization!.id ? null : data.directOrganization!.id
                            )
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          {activeChatOrgId === data.directOrganization.id ? 'Hide Chat' : 'Announcements & Chat'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate('network', `workspace-${data.directOrganization!.id}`)}
                          className="px-3 py-1.5 text-xs font-semibold bg-navy-900 text-white rounded cursor-pointer"
                        >
                          Open Workspace
                        </button>
                      </div>
                    </div>
                  )}
                  {data.myOrganizations.map((m) => (
                    <div key={m.membershipId} className="py-3 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold text-sm">{m.organization.name}</div>
                        <div className="text-xs text-slate-500">
                          Role: {m.orgRole} · {m.organization.affiliationStatus || 'Organization'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveChatOrgId((prev) =>
                              prev === m.organization.id ? null : m.organization.id
                            )
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          {activeChatOrgId === m.organization.id ? 'Hide Chat' : 'Announcements & Chat'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate('network', `workspace-${m.organization.id}`)}
                          className="px-3 py-1.5 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded cursor-pointer"
                        >
                          Open Workspace
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeChatOrgId && (
                <div className="pt-5 border-t border-slate-200 dark:border-slate-800">
                  <OrgAnnouncementsChat fixedOrgId={activeChatOrgId} onNavigate={onNavigate} />
                </div>
              )}
            </section>

            {/* My Membership & Establishment Applications */}
            <section className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4">
              <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
                My Membership &amp; Organization Applications
              </h2>
              {data.myMembershipApplications.length === 0 &&
              data.myOrganizationEstablishmentApps.length === 0 ? (
                <p className="text-sm text-slate-500">No pending or past applications on record.</p>
              ) : (
                <div className="space-y-3 text-xs">
                  {data.myOrganizationEstablishmentApps.map((app) => (
                    <div key={app.id} className="p-3 border border-slate-200 dark:border-slate-800 rounded">
                      <div className="font-mono text-slate-500">
                        Establishment App · {app.referenceCode} · <strong>{app.status}</strong>
                      </div>
                      <div className="font-semibold text-sm mt-0.5">{app.organizationName}</div>
                      {app.reviewNotes && <p className="text-slate-600 mt-1">{app.reviewNotes}</p>}
                    </div>
                  ))}
                  {data.myMembershipApplications.map((m) => (
                    <div key={m.application.id} className="p-3 border border-slate-200 dark:border-slate-800 rounded">
                      <div className="text-slate-500">
                        Membership Application · <strong>{m.application.status}</strong>
                      </div>
                      <div className="font-semibold text-sm mt-0.5">{m.organizationName}</div>
                      <p className="text-slate-600 dark:text-slate-300 mt-1">{m.application.motivation}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* My Mobilizations & Advocacy Participation */}
            <section className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white flex items-center gap-2">
                  <Flag className="w-4 h-4 text-crimson-600" /> My Mobilizations &amp; Advocacy Participation
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigate('advocacy')}
                  className="text-xs font-semibold text-navy-900 dark:text-slate-200 hover:underline cursor-pointer"
                >
                  Open Advocacy &amp; Mobilizations →
                </button>
              </div>
              {data.myMobilizations.proposed.length === 0 && data.myMobilizations.joined.length === 0 ? (
                <p className="text-sm text-slate-500">
                  You have not proposed or joined a mobilization yet.
                </p>
              ) : (
                <div className="space-y-3 text-xs">
                  {data.myMobilizations.proposed.map((mob) => (
                    <div key={mob.id} className="p-3 border border-slate-200 dark:border-slate-800 rounded flex items-center justify-between gap-4">
                      <div>
                        <div className="text-slate-500">
                          Proposed Initiative · {mob.supportType} · <strong>{mob.status}</strong>
                        </div>
                        <div className="font-semibold text-sm">{mob.title}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate('advocacy', `mob-workspace-${mob.id}`)}
                        className="px-3 py-1.5 font-semibold bg-navy-900 text-white rounded cursor-pointer"
                      >
                        Organizer Workspace
                      </button>
                    </div>
                  ))}
                  {data.myMobilizations.joined.map((j) => (
                    <div key={j.member.id} className="p-3 border border-slate-200 dark:border-slate-800 rounded flex items-center justify-between gap-4">
                      <div>
                        <div className="text-slate-500">
                          {j.member.role} · Application Status: <strong>{j.member.status}</strong>
                        </div>
                        <div className="font-semibold text-sm">{j.mobilization.title}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* My Publications */}
            <section className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white flex items-center gap-2">
                  <Newspaper className="w-4 h-4" /> My Publications &amp; Manuscripts
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigate('media')}
                  className="text-xs font-semibold text-navy-900 dark:text-slate-200 hover:underline cursor-pointer"
                >
                  Open Multi-Publication Center →
                </button>
              </div>
              {data.myPublications.outlets.length === 0 && data.myPublications.articles.length === 0 ? (
                <p className="text-sm text-slate-500">No assigned publication outlets or authored manuscripts yet.</p>
              ) : (
                <div className="space-y-3 text-xs">
                  {data.myPublications.outlets.map((o) => (
                    <div key={o.membershipId} className="p-3 border border-slate-200 dark:border-slate-800 rounded flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-sm">{o.outlet.name}</div>
                        <div className="text-slate-500">Editorial Role: {o.editorialRole}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate('media', `editorial-${o.outlet.id}`)}
                        className="px-3 py-1.5 font-semibold border border-slate-300 dark:border-slate-700 rounded cursor-pointer"
                      >
                        Editorial Desk
                      </button>
                    </div>
                  ))}
                  {data.myPublications.articles.map((a) => (
                    <div key={a.id} className="p-3 border border-slate-200 dark:border-slate-800 rounded">
                      <div className="text-slate-500">Manuscript · {a.status}</div>
                      <div className="font-semibold text-sm">{a.title}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* My Events & Collaboration Requests */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
                <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> My Registered Events
                </h2>
                {data.myEvents.length === 0 ? (
                  <p className="text-xs text-slate-500">No event registrations found for {activeUser.email}.</p>
                ) : (
                  <div className="space-y-2.5 text-xs">
                    {data.myEvents.map((ev) => (
                      <div key={ev.registration.id} className="p-3 border border-slate-200 dark:border-slate-800 rounded">
                        <div className="font-semibold">{ev.event.title}</div>
                        <div className="text-slate-500 font-mono mt-0.5">
                          {ev.event.startAt} · QR: {ev.registration.qrToken}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
                <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
                  <Handshake className="w-4 h-4" /> My Collaboration Requests
                </h2>
                {data.myCollaborationRequests.length === 0 ? (
                  <p className="text-xs text-slate-500">No collaboration requests sent or received.</p>
                ) : (
                  <div className="space-y-2.5 text-xs">
                    {data.myCollaborationRequests.map((c) => (
                      <div key={c.id} className="p-3 border border-slate-200 dark:border-slate-800 rounded">
                        <div className="font-mono text-slate-500">
                          {c.referenceCode} · <strong>{c.status}</strong>
                        </div>
                        <div className="font-semibold mt-0.5">{c.title}</div>
                        <div className="text-slate-500">
                          {c.senderName} → {c.recipientName}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>

          {/* Right Rail: Notifications & Account Settings */}
          <aside className="lg:col-span-4 space-y-6">
            <section className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
              <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4" /> My Notifications
              </h2>
              {data.myNotifications.length === 0 ? (
                <p className="text-xs text-slate-500">No personal or organizational notifications yet.</p>
              ) : (
                <div className="space-y-2.5 text-xs">
                  {data.myNotifications.map((n) => (
                    <div key={n.id} className="p-3 border border-slate-200 dark:border-slate-800 rounded">
                      <div className="font-semibold">{n.title}</div>
                      <p className="text-slate-600 dark:text-slate-300 mt-0.5">{n.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
              <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
                <Settings className="w-4 h-4" /> My Account Settings
              </h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const res = await fetch('/api/workspace/me', {
                    method: 'PATCH',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${activeToken}`,
                    },
                    body: JSON.stringify({ displayName: displayNameEdit }),
                  });
                  if (res.ok) {
                    setNotice('Account display name updated.');
                    await refreshProfile();
                    loadWorkspace();
                  }
                }}
                className="space-y-3 text-xs"
              >
                <div>
                  <label className="block font-semibold mb-1">Display Name</label>
                  <input
                    required
                    value={displayNameEdit}
                    onChange={(e) => setDisplayNameEdit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Account Email</label>
                  <input
                    disabled
                    value={data.account.email}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded bg-slate-50 dark:bg-slate-900 text-slate-500"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold bg-navy-900 text-white rounded cursor-pointer"
                >
                  Save Profile
                </button>
              </form>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
};
