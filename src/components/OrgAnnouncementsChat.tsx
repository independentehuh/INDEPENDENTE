import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Building2,
  Hash,
  Lock,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { InternalChatMessage, OrganizationAnnouncement, PageRoute } from '../types/index.ts';

interface OrgAnnouncementsChatProps {
  fixedOrgId?: number;
  onNavigate?: (page: PageRoute, slug?: string) => void;
}

interface OrgOption {
  id: number;
  name: string;
}

interface OnlineMember {
  uid: string;
  displayName: string;
  orgRole: string;
}

const CHAT_CHANNELS = [
  { id: 'general', label: 'general', desc: 'All active organization members' },
  { id: 'coordination', label: 'coordination', desc: 'Field mobilization & project logistics' },
  { id: 'officers', label: 'officers', desc: 'Committee leads & secretariat officers' },
  { id: 'announcements-discussion', label: 'announcements', desc: 'Follow-ups on circulars & notices' },
] as const;

const ANNOUNCEMENT_CATEGORIES = [
  'Official Broadcast',
  'Internal Announcement',
  'Internal Circular',
  'Calendar Item',
  'Accomplishment Report',
  'Document Notice',
];

const OFFICER_ROLES = new Set([
  'Secretariat Overseer',
  'Organization Administrator',
  'President / Chairperson',
  'Secretary',
]);

export const OrgAnnouncementsChat: React.FC<OrgAnnouncementsChatProps> = ({
  fixedOrgId,
  onNavigate,
}) => {
  const { idToken, partnerToken, dbUser, partnerUser, signInWithGoogle } = useAuth();
  const activeToken = idToken || partnerToken;
  const activeUser = dbUser || partnerUser;

  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(fixedOrgId || null);
  const [orgName, setOrgName] = useState('');
  const [yourOrgRole, setYourOrgRole] = useState('');
  const [isOversight, setIsOversight] = useState(false);

  const [announcements, setAnnouncements] = useState<OrganizationAnnouncement[]>([]);
  const [messages, setMessages] = useState<InternalChatMessage[]>([]);
  const [onlineMembers, setOnlineMembers] = useState<OnlineMember[]>([]);

  const [wsConnected, setWsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [activeChannel, setActiveChannel] = useState<string>('general');
  const [annFilter, setAnnFilter] = useState<string>('All');
  const [showNewAnnForm, setShowNewAnnForm] = useState(false);
  const [newAnn, setNewAnn] = useState({
    title: '',
    category: 'Internal Announcement',
    eventDate: '',
    body: '',
  });
  const [postingAnn, setPostingAnn] = useState(false);

  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const authHeaders = useMemo<Record<string, string>>(() => {
    const h: Record<string, string> = {};
    if (activeToken) h.Authorization = `Bearer ${activeToken}`;
    return h;
  }, [activeToken]);

  useEffect(() => {
    if (fixedOrgId) {
      setSelectedOrgId(fixedOrgId);
    }
  }, [fixedOrgId]);

  // Load authorized organizations when used standalone in Operations Center
  useEffect(() => {
    if (!activeToken || fixedOrgId) return;
    (async () => {
      try {
        const res = await fetch('/api/operations/my-organizations', { headers: authHeaders });
        if (res.ok) {
          const data = await res.json();
          const orgs: OrgOption[] = data.organizations || [];
          setOrgOptions(orgs);
          setIsOversight(Boolean(data.isOversight));
          if (orgs.length > 0 && (!selectedOrgId || !orgs.some((o) => o.id === selectedOrgId))) {
            setSelectedOrgId(orgs[0].id);
          }
        }
      } catch {
        // Ignore network transient
      }
    })();
  }, [activeToken, fixedOrgId, authHeaders, selectedOrgId]);

  const loadCommsSnapshot = useCallback(
    async (orgId: number) => {
      if (!activeToken) return;
      setLoading(true);
      setFeedback(null);
      try {
        const res = await fetch(`/api/org-hub/organizations/${orgId}/comms`, {
          headers: authHeaders,
        });
        if (res.ok) {
          const data = await res.json();
          setOrgName(data.organization?.name || '');
          setYourOrgRole(data.yourOrgRole || '');
          setAnnouncements(data.announcements || []);
          setMessages(data.messages || []);
          setOnlineMembers(data.onlineMembers || []);
        } else {
          const err = await res.json().catch(() => ({}));
          setFeedback({ type: 'err', text: err.error || 'Access denied for organization communications.' });
        }
      } finally {
        setLoading(false);
      }
    },
    [activeToken, authHeaders]
  );

  // Establish live WebSocket room connection per selected organization
  useEffect(() => {
    if (!activeToken || !selectedOrgId) {
      setWsConnected(false);
      return;
    }

    let cancelled = false;
    let attempt = 0;

    loadCommsSnapshot(selectedOrgId);

    const connectWs = () => {
      if (cancelled) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/ws/org-comms?token=${encodeURIComponent(
        activeToken
      )}&orgId=${selectedOrgId}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        attempt = 0;
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          const payload = JSON.parse(String(event.data));
          if (payload.type === 'init') {
            setAnnouncements(payload.announcements || []);
            setMessages(payload.messages || []);
            setOnlineMembers(payload.onlineMembers || []);
          } else if (payload.type === 'presence:update') {
            setOnlineMembers(payload.onlineMembers || []);
          } else if (payload.type === 'announcement:created' && payload.announcement) {
            const incoming: OrganizationAnnouncement = payload.announcement;
            setAnnouncements((prev) =>
              prev.some((a) => a.id === incoming.id) ? prev : [incoming, ...prev]
            );
          } else if (payload.type === 'announcement:deleted' && payload.announcementId) {
            const deletedId = Number(payload.announcementId);
            setAnnouncements((prev) => prev.filter((a) => a.id !== deletedId));
          } else if (payload.type === 'chat:message' && payload.message) {
            const incoming: InternalChatMessage = payload.message;
            setMessages((prev) =>
              prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]
            );
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        setWsConnected(false);
        wsRef.current = null;
        const delay = Math.min(8000, 1000 * Math.pow(2, attempt));
        attempt += 1;
        reconnectTimerRef.current = window.setTimeout(connectWs, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWs();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsConnected(false);
    };
  }, [activeToken, selectedOrgId, loadCommsSnapshot]);

  const channelMessages = useMemo(
    () => messages.filter((m) => m.channel === activeChannel),
    [messages, activeChannel]
  );

  // Auto-scroll chat log when channel or messages change
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [channelMessages.length, activeChannel]);

  const filteredAnnouncements = useMemo(() => {
    if (annFilter === 'All') return announcements;
    return announcements.filter((a) => a.category === annFilter);
  }, [announcements, annFilter]);

  const channelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of CHAT_CHANNELS) counts[c.id] = 0;
    for (const m of messages) {
      counts[m.channel] = (counts[m.channel] || 0) + 1;
    }
    return counts;
  }, [messages]);

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !activeToken) return;
    setPostingAnn(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/org-hub/organizations/${selectedOrgId}/announcements`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(newAnn),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', text: data.error || 'Could not publish announcement.' });
        return;
      }
      setAnnouncements((prev) => (prev.some((a) => a.id === data.id) ? prev : [data, ...prev]));
      setNewAnn({ title: '', category: 'Internal Announcement', eventDate: '', body: '' });
      setShowNewAnnForm(false);
      setFeedback({ type: 'ok', text: `Announcement "${data.title}" broadcast to organization members.` });
    } finally {
      setPostingAnn(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || !selectedOrgId || !activeToken) return;

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'chat:send', channel: activeChannel, message: text }));
      setChatInput('');
      return;
    }

    // Fallback over HTTP when WebSocket is reconnecting (also broadcasts to connected room)
    setSendingChat(true);
    try {
      const res = await fetch(`/api/org-hub/organizations/${selectedOrgId}/chat`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: activeChannel, message: text }),
      });
      if (res.ok) {
        const created: InternalChatMessage = await res.json();
        setMessages((prev) => (prev.some((m) => m.id === created.id) ? prev : [...prev, created]));
        setChatInput('');
      }
    } finally {
      setSendingChat(false);
    }
  };

  const handleDiscussAnnouncement = (ann: OrganizationAnnouncement) => {
    setActiveChannel('announcements-discussion');
    setChatInput(`Re: "${ann.title}" — `);
  };

  const handleDeleteAnnouncement = async (annId: number) => {
    if (!selectedOrgId || !activeToken) return;
    const res = await fetch(`/api/org-hub/organizations/${selectedOrgId}/announcements/${annId}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (res.ok) {
      setAnnouncements((prev) => prev.filter((a) => a.id !== annId));
      setFeedback({ type: 'ok', text: 'Announcement removed from board.' });
    } else {
      const err = await res.json().catch(() => ({}));
      setFeedback({ type: 'err', text: err.error || 'Unable to remove announcement.' });
    }
  };

  if (!activeToken) {
    return (
      <section className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/60 p-8 sm:p-12 text-center space-y-5">
        <div className="mx-auto w-11 h-11 rounded-md border border-slate-200 dark:border-slate-700 flex items-center justify-center text-navy-900 dark:text-white">
          <Lock className="w-5 h-5" />
        </div>
        <div className="max-w-xl mx-auto space-y-2">
          <div className="text-xs font-semibold uppercase tracking-widest text-crimson-600 dark:text-red-400">
            Organization-Isolated Communications
          </div>
          <h2 className="font-serif text-2xl font-semibold text-navy-900 dark:text-white">
            Sign in to Access Organization Announcements &amp; Internal Group Chat
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Internal circulars, meeting notices, and real-time member group channels are strictly
            isolated to verified members of each organization and authorized Operations Center
            coordinators.
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
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('partner-portal')}
              className="px-4 py-2.5 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 cursor-pointer whitespace-nowrap"
            >
              Partner Organization Portal Login
            </button>
          )}
        </div>
      </section>
    );
  }

  if (!fixedOrgId && orgOptions.length === 0 && !loading) {
    return (
      <section className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/60 p-8 text-center space-y-4">
        <Building2 className="w-7 h-7 mx-auto text-slate-400" />
        <h3 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
          No Active Organization Membership Linked
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-lg mx-auto">
          To view internal announcements and join a group chat room, sign in with a Partner
          Organization account or apply to join an organization in the Partner &amp; Organization
          Hub.
        </p>
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('network')}
            className="px-4 py-2 text-xs font-semibold bg-navy-900 text-white rounded-md hover:bg-navy-800 cursor-pointer"
          >
            Browse Organizations Directory
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-5">
      {/* Header & Organization Selector + Presence Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-widest text-crimson-600 dark:text-red-400">
            Internal Communications · OP-03 / OP-04
          </div>
          <h2 className="font-serif text-2xl font-semibold text-navy-900 dark:text-white">
            {orgName || 'Organization Announcements & Group Chat'}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Role: <strong className="text-navy-900 dark:text-white">{yourOrgRole || 'Member'}</strong>
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1 font-mono">
              {wsConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-400">Live WebSocket Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                  <span>Syncing room...</span>
                </>
              )}
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
              <Users className="w-3.5 h-3.5" />
              {onlineMembers.length} online
              {onlineMembers.length > 0
                ? ` (${onlineMembers.map((m) => m.displayName.split(' ')[0]).join(', ')})`
                : ''}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {!fixedOrgId && orgOptions.length > 1 && (
            <select
              aria-label="Select organization room"
              value={selectedOrgId || ''}
              onChange={(e) => setSelectedOrgId(Number(e.target.value))}
              className="px-3 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-navy-900 dark:text-white cursor-pointer"
            >
              {orgOptions.map((org) => (
                <option key={org.id} value={org.id}>
                  {isOversight ? `Oversight: ${org.name}` : org.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setShowNewAnnForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-navy-900 text-white rounded-md hover:bg-navy-800 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            {showNewAnnForm ? 'Close Notice Form' : 'Post Announcement'}
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`px-4 py-2.5 rounded-md border text-xs font-medium ${
            feedback.type === 'ok'
              ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
              : 'border-red-300 dark:border-red-800 bg-red-50/70 dark:bg-red-950/40 text-red-900 dark:text-red-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Dual-Pane Workspace: Organization Announcements (Left) + Real-Time Internal Group Chat (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANE: ORGANIZATIONAL ANNOUNCEMENTS BOARD */}
        <div className="lg:col-span-5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/60 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-crimson-600 dark:text-red-400" />
                <h3 className="font-serif text-lg font-semibold text-navy-900 dark:text-white">
                  Organizational Announcements
                </h3>
              </div>
              <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
                {announcements.length}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                'All',
                'Official Broadcast',
                'Internal Announcement',
                'Internal Circular',
                'Calendar Item',
                'Accomplishment Report',
              ].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setAnnFilter(cat)}
                  className={`px-2 py-1 text-[11px] font-medium rounded border cursor-pointer ${
                    annFilter === cat
                      ? 'border-navy-900 bg-navy-900 text-white dark:border-slate-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {cat === 'Official Broadcast'
                    ? 'Broadcasts'
                    : cat === 'Internal Announcement'
                      ? 'Notices'
                      : cat === 'Internal Circular'
                        ? 'Circulars'
                        : cat === 'Calendar Item'
                          ? 'Calendar'
                          : cat === 'Accomplishment Report'
                            ? 'Reports'
                            : 'All'}
                </button>
              ))}
            </div>
          </div>

          {showNewAnnForm && (
            <form
              onSubmit={handlePostAnnouncement}
              className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-3 text-xs"
            >
              <div className="font-semibold text-navy-900 dark:text-white">
                Publish Internal Announcement
              </div>
              <input
                type="text"
                required
                value={newAnn.title}
                onChange={(e) => setNewAnn({ ...newAnn, title: e.target.value })}
                placeholder="Announcement headline *"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newAnn.category}
                  onChange={(e) => setNewAnn({ ...newAnn, category: e.target.value })}
                  className="px-2.5 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                >
                  {ANNOUNCEMENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={newAnn.eventDate}
                  onChange={(e) => setNewAnn({ ...newAnn, eventDate: e.target.value })}
                  title="Target event or deadline date (optional)"
                  className="px-2.5 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
              <textarea
                required
                rows={3}
                value={newAnn.body}
                onChange={(e) => setNewAnn({ ...newAnn, body: e.target.value })}
                placeholder="Write official notice, assembly agenda, or action item..."
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewAnnForm(false)}
                  className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={postingAnn}
                  className="px-3.5 py-1.5 font-semibold bg-navy-900 text-white rounded-md hover:bg-navy-800 disabled:opacity-50 cursor-pointer"
                >
                  {postingAnn ? 'Publishing...' : 'Publish & Broadcast'}
                </button>
              </div>
            </form>
          )}

          <div className="max-h-[540px] overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
            {loading && announcements.length === 0 ? (
              <div className="p-6 text-xs text-slate-500 text-center">Loading announcements...</div>
            ) : filteredAnnouncements.length === 0 ? (
              <div className="p-6 text-xs text-slate-500">
                No internal announcements in this category yet.
              </div>
            ) : (
              filteredAnnouncements.map((ann) => (
                <article key={ann.id} className="p-4 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="font-mono font-semibold text-crimson-600 dark:text-red-400">
                      {ann.category}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500">
                      {new Date(ann.createdAt).toLocaleDateString()}
                    </span>
                    {ann.eventDate && (
                      <>
                        <span className="text-slate-400">·</span>
                        <span className="font-mono text-navy-900 dark:text-slate-300">
                          Date: {ann.eventDate}
                        </span>
                      </>
                    )}
                  </div>
                  <h4 className="font-serif text-base font-semibold text-navy-900 dark:text-white leading-snug">
                    {ann.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                    {ann.body}
                  </p>
                  <div className="pt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span>Posted by {ann.authorName}</span>
                    <div className="flex items-center gap-3">
                      {(OFFICER_ROLES.has(yourOrgRole) ||
                        (activeUser?.uid && ann.authorUid === activeUser.uid)) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteAnnouncement(ann.id)}
                          title="Remove announcement"
                          className="inline-flex items-center gap-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDiscussAnnouncement(ann)}
                        className="font-semibold text-navy-900 dark:text-slate-200 hover:underline cursor-pointer"
                      >
                        Discuss in Chat →
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        {/* RIGHT PANE: INTERNAL GROUP CHAT */}
        <div className="lg:col-span-7 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/60 flex flex-col">
          {/* Chat Header + Channels */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-navy-900 dark:text-slate-200" />
                <h3 className="font-serif text-lg font-semibold text-navy-900 dark:text-white">
                  Internal Group Chat
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">
                {CHAT_CHANNELS.find((c) => c.id === activeChannel)?.desc}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {CHAT_CHANNELS.map((ch) => {
                const active = activeChannel === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setActiveChannel(ch.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-navy-900 text-white border-navy-900 dark:border-slate-400'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Hash className="w-3 h-3" />
                    <span>{ch.label}</span>
                    <span
                      className={`font-mono text-[10px] tabular-nums ${
                        active ? 'text-slate-200' : 'text-slate-400'
                      }`}
                    >
                      {channelCounts[ch.id] || 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chat Message Stream */}
          <div
            ref={chatScrollRef}
            className="h-[430px] overflow-y-auto p-4 space-y-3 bg-slate-50/40 dark:bg-slate-950/30"
          >
            {channelMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-xs text-slate-500 space-y-1">
                <Hash className="w-5 h-5 text-slate-400" />
                <p>No messages in #{activeChannel} yet.</p>
                <p>Start an internal coordination thread with your organization members below.</p>
              </div>
            ) : (
              channelMessages.map((msg) => {
                const isSelf = activeUser?.uid && msg.senderUid === activeUser.uid;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1 px-1">
                      <span className="font-semibold text-navy-900 dark:text-slate-200">
                        {msg.senderName}
                      </span>
                      <span>·</span>
                      <span>{msg.senderRole}</span>
                      <span>·</span>
                      <span className="font-mono tabular-nums">
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div
                      className={`max-w-[85%] px-3.5 py-2.5 rounded-lg text-xs leading-relaxed whitespace-pre-wrap ${
                        isSelf
                          ? 'bg-navy-900 text-white'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                      }`}
                    >
                      {msg.message}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={handleSendChat}
            className="p-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2.5 bg-white dark:bg-slate-900"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={`Message #${activeChannel} (${orgName || 'Organization'})...`}
              maxLength={2000}
              className="flex-1 px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || sendingChat}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-navy-900 text-white rounded-md hover:bg-navy-800 disabled:opacity-50 cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" />
              Send
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};
