import React, { useEffect, useState } from 'react';
import {
  Bell,
  Building2,
  Calendar,
  FileText,
  KeyRound,
  Lock,
  LogOut,
  MessageSquare,
  ShieldCheck,
  Upload,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { OrgAnnouncementsChat } from '../components/OrgAnnouncementsChat.tsx';
import { Announcement, NetworkDocument, NetworkEvent, Organization, PageRoute } from '../types/index.ts';

interface PartnerPortalPageProps {
  onNavigate: (page: PageRoute, slug?: string) => void;
}

interface PartnerDashboardData {
  user: { id: number; email: string; displayName: string; roleSlug: string; organizationId: number };
  organization: Organization;
  representatives: Array<{
    id: number;
    fullName: string;
    position: string;
    email: string;
    phone: string;
    partnerRole: string;
    isPrimary: boolean;
  }>;
  agreements: Array<{
    id: number;
    title: string;
    agreementType: string;
    effectiveDate: string;
    expiryDate: string;
    documentUrl: string;
    status: string;
  }>;
  announcements: Announcement[];
  events: NetworkEvent[];
  registrations: Array<{ id: number; eventId: number; fullName: string; delegationSize: number; qrToken: string }>;
  activities: Array<{
    id: number;
    title: string;
    activityType: string;
    description: string;
    activityDate: string;
    accomplishmentSummary: string;
    photoUrl: string;
    status: string;
  }>;
  documents: NetworkDocument[];
  inquiries: Array<{
    id: number;
    subject: string;
    message: string;
    status: string;
    secretariatReply: string;
    createdAt: string;
  }>;
}

export const PartnerPortalPage: React.FC<PartnerPortalPageProps> = ({ onNavigate }) => {
  const { partnerToken, idToken, dbUser, setPartnerSession, signInWithGoogle } = useAuth();
  const activeToken = partnerToken || (dbUser?.organizationId ? idToken : null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [needs2FA, setNeeds2FA] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  const [dash, setDash] = useState<PartnerDashboardData | null>(null);
  const [activeTab, setActiveTab] = useState<
    'profile' | 'announcements' | 'team-comms' | 'events' | 'activities' | 'documents' | 'inquiries' | 'security'
  >('profile');

  // Forms inside dashboard
  const [profileForm, setProfileForm] = useState<Record<string, string>>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [repForm, setRepForm] = useState({
    fullName: '',
    position: '',
    email: '',
    phone: '',
    partnerRole: 'Authorized Representative',
  });
  const [activityForm, setActivityForm] = useState({
    title: '',
    activityType: 'Proposed Collaborative Activity',
    description: '',
    activityDate: new Date().toISOString().slice(0, 10),
    accomplishmentSummary: '',
  });
  const [activityPhoto, setActivityPhoto] = useState<File | null>(null);
  const [inquiryForm, setInquiryForm] = useState({ subject: '', message: '' });
  const [secForm, setSecForm] = useState({ currentPassword: '', newPassword: '', twoFactorEnabled: false });
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const loadDashboard = async (tokenToUse: string) => {
    const res = await fetch('/api/partner/dashboard', {
      headers: { Authorization: `Bearer ${tokenToUse}` },
    });
    if (res.ok) {
      const data: PartnerDashboardData = await res.json();
      setDash(data);
      setProfileForm({
        description: data.organization.description || '',
        mission: data.organization.mission || '',
        vision: data.organization.vision || '',
        advocacyInterests: data.organization.advocacyInterests || '',
        geographicCoverage: data.organization.geographicCoverage || '',
        officialEmail: data.organization.officialEmail || '',
        contactNumber: data.organization.contactNumber || '',
        website: data.organization.website || '',
        socialLinks: data.organization.socialLinks || '',
      });
    }
  };

  useEffect(() => {
    if (activeToken) {
      loadDashboard(activeToken);
    } else {
      setDash(null);
    }
  }, [activeToken]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const res = await fetch('/api/partner/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, twoFactorCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Authentication failed.');
      } else if (data.requiresTwoFactor) {
        setNeeds2FA(true);
        setLoginError(data.message);
      } else if (data.token) {
        setPartnerSession(data.token, data.user);
      }
    } catch {
      setLoginError('Network error connecting to Partner Portal.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/partner/request-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setResetMsg(data.message || 'Reset request recorded.');
  };

  if (!activeToken || !dash) {
    return (
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-6 space-y-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-crimson-600 dark:text-red-400">
              Restricted Organizational Access
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-navy-900 dark:text-white">
              Partnership Portal
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              Dedicated workspace exclusively for accredited INDEPENDENTE partner organizations.
              Manage your organizational profile, confirm event delegations, download Secretariat
              circulars and MOU templates, and submit accomplishment reports.
            </p>
            <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-900/60 space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="font-semibold text-slate-900 dark:text-white">
                Partner Data Isolation &amp; Confidentiality
              </div>
              <p>
                Each approved organization can view only its own private organizational records and
                authorized network circulars. Not yet a partner?{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('network', 'apply')}
                  className="font-semibold text-navy-900 dark:text-white underline cursor-pointer"
                >
                  Apply for Partnership
                </button>
                .
              </p>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                Demonstration Partner Preview Account: partner.demo@independente.org / PartnerDemo2026!
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 p-7 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/70 space-y-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-navy-900 dark:text-white">
              <Lock className="w-4 h-4 text-crimson-600" />
              {resetMode ? 'Request Password Reset' : 'Partner Organization Sign In'}
            </div>

            {resetMode ? (
              <form onSubmit={handleResetRequest} className="space-y-4">
                {resetMsg && (
                  <div className="p-3 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
                    {resetMsg}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold mb-1">Official Partner Email</label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-sm font-semibold bg-navy-900 text-white rounded-md cursor-pointer"
                  >
                    Submit Reset Notice
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetMode(false)}
                    className="text-xs text-slate-600 underline cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                  <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded">
                    {loginError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold mb-1">Official Email</label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="representative@organization.org"
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Password</label>
                  <input
                    required
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                  />
                </div>
                {needs2FA && (
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Two-Factor Verification Code
                    </label>
                    <input
                      required
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value)}
                      placeholder="6-digit code"
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                    />
                  </div>
                )}
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => setResetMode(true)}
                    className="text-slate-600 dark:text-slate-400 hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('partner.demo@independente.org');
                      setPassword('PartnerDemo2026!');
                    }}
                    className="text-navy-900 dark:text-slate-200 font-medium hover:underline cursor-pointer"
                  >
                    Fill Demo Credentials
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loggingIn}
                  className="w-full py-2.5 text-sm font-semibold text-white bg-navy-900 hover:bg-navy-800 rounded-md cursor-pointer"
                >
                  {loggingIn ? 'Verifying Credentials...' : 'Sign In to Partner Portal'}
                </button>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-center">
                  <button
                    type="button"
                    onClick={signInWithGoogle}
                    className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-navy-900 underline cursor-pointer"
                  >
                    Or sign in with Google if your partner email is linked
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(profileForm).forEach(([k, v]) => fd.append(k, v));
    if (logoFile) fd.append('logo', logoFile);
    const res = await fetch('/api/partner/profile', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${activeToken}` },
      body: fd,
    });
    if (res.ok) {
      showToast('Organization profile updated.');
      loadDashboard(activeToken);
    }
  };

  const handleAddRep = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/partner/representatives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${activeToken}` },
      body: JSON.stringify(repForm),
    });
    if (res.ok) {
      setRepForm({ fullName: '', position: '', email: '', phone: '', partnerRole: 'Authorized Representative' });
      showToast('Representative added.');
      loadDashboard(activeToken);
    }
  };

  const handleSubmitActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(activityForm).forEach(([k, v]) => fd.append(k, v));
    if (activityPhoto) fd.append('photo', activityPhoto);
    const res = await fetch('/api/partner/activities', {
      method: 'POST',
      headers: { Authorization: `Bearer ${activeToken}` },
      body: fd,
    });
    if (res.ok) {
      setActivityForm({
        title: '',
        activityType: 'Proposed Collaborative Activity',
        description: '',
        activityDate: new Date().toISOString().slice(0, 10),
        accomplishmentSummary: '',
      });
      setActivityPhoto(null);
      showToast('Activity submission recorded.');
      loadDashboard(activeToken);
    }
  };

  const handleSendInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/partner/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${activeToken}` },
      body: JSON.stringify(inquiryForm),
    });
    if (res.ok) {
      setInquiryForm({ subject: '', message: '' });
      showToast('Inquiry transmitted to the Secretariat.');
      loadDashboard(activeToken);
    }
  };

  const handleQuickDelegation = async (ev: NetworkEvent) => {
    const res = await fetch(`/api/events/${ev.id}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registrationType: 'Partner Organization',
        fullName: dash.user.displayName || dash.organization.officialRepresentative,
        email: dash.user.email,
        organizationName: dash.organization.name,
        delegationSize: 3,
      }),
    });
    if (res.ok) {
      showToast(`Delegation (3 seats) confirmed for ${ev.title}.`);
      loadDashboard(activeToken);
    }
  };

  const handleUpdateSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/partner/security', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${activeToken}` },
      body: JSON.stringify(secForm),
    });
    const data = await res.json();
    showToast(data.message || data.error || 'Updated.');
    setSecForm({ ...secForm, currentPassword: '', newPassword: '' });
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Partner Header */}
      <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/70 dark:bg-slate-900/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Accredited Partner Portal · {dash.organization.partnershipStatus} Partner · Role:{' '}
            {dash.user.roleSlug}
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-navy-900 dark:text-white">
            {dash.organization.name}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('team-comms')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-navy-900 text-white rounded-md hover:bg-navy-800 cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5" /> Organizational Announcements &amp; Chat
          </button>
          <button
            type="button"
            onClick={() => setPartnerSession(null, null)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-md hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out of Partner Portal
          </button>
        </div>
      </div>

      {toast && (
        <div className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-sm text-emerald-900 dark:text-emerald-200">
          {toast}
        </div>
      )}

      {/* 8-Module Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { id: 'profile', label: 'A. Profile & Reps', icon: Building2 },
          { id: 'team-comms', label: 'B. Team Broadcasts & Chat', icon: Bell },
          { id: 'announcements', label: 'C. Network Circulars', icon: ShieldCheck },
          { id: 'events', label: 'D. Events & Delegations', icon: Calendar },
          { id: 'activities', label: 'E. Partnership Activities', icon: Upload },
          { id: 'documents', label: 'F. Document Center', icon: FileText },
          { id: 'inquiries', label: 'G. Secretariat Coordination', icon: MessageSquare },
          { id: 'security', label: 'H. Account Security', icon: KeyRound },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id as typeof activeTab)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap ${
                activeTab === item.id
                  ? 'bg-navy-900 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'team-comms' && (
        <OrgAnnouncementsChat fixedOrgId={dash.organization.id} onNavigate={onNavigate} />
      )}

      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleSaveProfile}
            className="lg:col-span-7 p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4"
          >
            <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
              Organization Profile &amp; Branding
            </h2>
            <div>
              <label className="block text-xs font-semibold mb-1">Description</label>
              <textarea
                rows={3}
                value={profileForm.description || ''}
                onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Official Email</label>
                <input
                  value={profileForm.officialEmail || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, officialEmail: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Contact Number</label>
                <input
                  value={profileForm.contactNumber || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, contactNumber: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Website</label>
                <input
                  value={profileForm.website || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Update Organization Logo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  className="text-xs"
                />
              </div>
            </div>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold bg-navy-900 text-white rounded-md cursor-pointer"
            >
              Save Profile Updates
            </button>
          </form>

          <div className="lg:col-span-5 p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-5">
            <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5" /> Authorized Representatives
            </h2>
            <div className="space-y-2.5">
              {dash.representatives.map((rep) => (
                <div key={rep.id} className="p-3 border border-slate-200 dark:border-slate-800 rounded text-xs">
                  <div className="font-semibold text-slate-900 dark:text-white">{rep.fullName}</div>
                  <div className="text-slate-500">
                    {rep.position} · {rep.partnerRole}
                  </div>
                  <div className="text-slate-500">{rep.email}</div>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddRep} className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="text-xs font-semibold">Add Representative</div>
              <input
                required
                placeholder="Full Name"
                value={repForm.fullName}
                onChange={(e) => setRepForm({ ...repForm, fullName: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-transparent"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  placeholder="Position"
                  value={repForm.position}
                  onChange={(e) => setRepForm({ ...repForm, position: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                />
                <select
                  value={repForm.partnerRole}
                  onChange={(e) => setRepForm({ ...repForm, partnerRole: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                >
                  <option>Organization Administrator</option>
                  <option>Authorized Representative</option>
                  <option>Communications Officer</option>
                  <option>Program Coordinator</option>
                  <option>Member/Participant</option>
                </select>
              </div>
              <input
                required
                type="email"
                placeholder="Email"
                value={repForm.email}
                onChange={(e) => setRepForm({ ...repForm, email: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-transparent"
              />
              <button type="submit" className="px-4 py-2 text-xs font-semibold bg-navy-900 text-white rounded cursor-pointer">
                Add Representative
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'announcements' && (
        <div className="space-y-4">
          <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
            Secretariat Circulars, Memoranda &amp; Network Updates
          </h2>
          {dash.announcements.map((ann) => (
            <div key={ann.id} className="p-5 border border-slate-200 dark:border-slate-800 rounded-lg space-y-1.5">
              <div className="text-xs text-slate-500">
                <span className="font-semibold text-crimson-600">{ann.category}</span> ·{' '}
                <span className="tabular-nums">{ann.publishedAt}</span> · Audience: {ann.audience}
              </div>
              <h3 className="font-semibold text-base text-slate-900 dark:text-white">{ann.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">{ann.body}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'events' && (
        <div className="space-y-6">
          <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
            Network Activity Calendar &amp; Partner Delegation Registration
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {dash.events.map((ev) => (
              <div key={ev.id} className="p-5 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                <div className="text-xs text-slate-500">
                  {ev.category} · {ev.format} · <span className="font-mono">{ev.startAt}</span>
                </div>
                <div className="font-serif text-lg font-semibold text-slate-900 dark:text-white">{ev.title}</div>
                <p className="text-xs text-slate-600 dark:text-slate-300">{ev.venueOrLink}</p>
                {ev.status !== 'Past' && (
                  <button
                    type="button"
                    onClick={() => handleQuickDelegation(ev)}
                    className="px-3.5 py-2 text-xs font-semibold bg-navy-900 text-white rounded cursor-pointer"
                  >
                    Confirm 3-Member Delegation
                  </button>
                )}
              </div>
            ))}
          </div>
          {dash.registrations.length > 0 && (
            <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
              <h3 className="text-sm font-semibold">Confirmed Organization Delegations</h3>
              {dash.registrations.map((r) => (
                <div key={r.id} className="text-xs font-mono text-slate-600 dark:text-slate-300">
                  {r.qrToken} · {r.fullName} ({r.delegationSize} delegates)
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'activities' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleSubmitActivity}
            className="lg:col-span-5 p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4"
          >
            <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
              Submit Proposal or Accomplishment Report
            </h2>
            <input
              required
              placeholder="Activity Title"
              value={activityForm.title}
              onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={activityForm.activityType}
                onChange={(e) => setActivityForm({ ...activityForm, activityType: e.target.value })}
                className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
              >
                <option>Proposed Collaborative Activity</option>
                <option>Completed Activity Report</option>
                <option>Joint Project</option>
              </select>
              <input
                type="date"
                value={activityForm.activityDate}
                onChange={(e) => setActivityForm({ ...activityForm, activityDate: e.target.value })}
                className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-transparent"
              />
            </div>
            <textarea
              required
              rows={3}
              placeholder="Description & Objectives"
              value={activityForm.description}
              onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
            />
            <textarea
              rows={2}
              placeholder="Accomplishment Summary / Expected Outcomes"
              value={activityForm.accomplishmentSummary}
              onChange={(e) => setActivityForm({ ...activityForm, accomplishmentSummary: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
            />
            <div>
              <label className="block text-xs font-semibold mb-1">Documentation Photo / PDF</label>
              <input type="file" onChange={(e) => setActivityPhoto(e.target.files?.[0] || null)} className="text-xs" />
            </div>
            <button type="submit" className="px-5 py-2 text-xs font-semibold bg-navy-900 text-white rounded cursor-pointer">
              Submit to Secretariat
            </button>
          </form>

          <div className="lg:col-span-7 space-y-4">
            <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
              Recorded Partnership Activities
            </h2>
            {dash.activities.map((a) => (
              <div key={a.id} className="p-5 border border-slate-200 dark:border-slate-800 rounded-lg space-y-1.5">
                <div className="text-xs text-slate-500">
                  {a.activityType} · <span className="tabular-nums">{a.activityDate}</span> ·{' '}
                  <strong>{a.status}</strong>
                </div>
                <div className="font-semibold text-slate-900 dark:text-white">{a.title}</div>
                <p className="text-xs text-slate-600 dark:text-slate-300">{a.description}</p>
                {a.accomplishmentSummary && (
                  <p className="text-xs text-slate-500 pt-1">Outcomes: {a.accomplishmentSummary}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="space-y-6">
          <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
            Partnership Agreements, Templates &amp; Guidelines
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dash.agreements.map((ag) => (
              <div key={ag.id} className="p-5 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                <div className="text-xs text-slate-500">
                  {ag.agreementType} · Effective {ag.effectiveDate} · {ag.status}
                </div>
                <div className="font-semibold text-sm">{ag.title}</div>
                {ag.documentUrl && (
                  <a href={ag.documentUrl} className="text-xs font-semibold text-navy-900 dark:text-slate-200 underline">
                    Download Agreement Copy
                  </a>
                )}
              </div>
            ))}
            {dash.documents.map((doc) => (
              <div key={doc.id} className="p-5 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                <div className="text-xs text-slate-500">{doc.category}</div>
                <div className="font-semibold text-sm">{doc.title}</div>
                <p className="text-xs text-slate-600 dark:text-slate-300">{doc.description}</p>
                <a href={doc.fileUrl} className="inline-block text-xs font-semibold text-navy-900 dark:text-slate-200 underline">
                  Download Resource
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'inquiries' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleSendInquiry}
            className="lg:col-span-5 p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4"
          >
            <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
              Contact the Secretariat
            </h2>
            <input
              required
              placeholder="Subject / Request for Assistance"
              value={inquiryForm.subject}
              onChange={(e) => setInquiryForm({ ...inquiryForm, subject: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
            />
            <textarea
              required
              rows={4}
              placeholder="Message or coordination details..."
              value={inquiryForm.message}
              onChange={(e) => setInquiryForm({ ...inquiryForm, message: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
            />
            <button type="submit" className="px-5 py-2 text-xs font-semibold bg-navy-900 text-white rounded cursor-pointer">
              Send Inquiry
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
              Coordination Thread History
            </h2>
            {dash.inquiries.length === 0 ? (
              <p className="text-sm text-slate-500">No inquiries logged yet.</p>
            ) : (
              dash.inquiries.map((inq) => (
                <div key={inq.id} className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-900 dark:text-white">{inq.subject}</span>
                    <span>{inq.status}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{inq.message}</p>
                  {inq.secretariatReply && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded text-xs">
                      <strong>Secretariat Response:</strong> {inq.secretariatReply}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <form
          onSubmit={handleUpdateSecurity}
          className="max-w-lg p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4"
        >
          <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
            Account Security &amp; Two-Factor Authentication
          </h2>
          <div>
            <label className="block text-xs font-semibold mb-1">Current Password</label>
            <input
              type="password"
              value={secForm.currentPassword}
              onChange={(e) => setSecForm({ ...secForm, currentPassword: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">New Password (min 8 chars)</label>
            <input
              type="password"
              value={secForm.newPassword}
              onChange={(e) => setSecForm({ ...secForm, newPassword: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
            />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={secForm.twoFactorEnabled}
              onChange={(e) => setSecForm({ ...secForm, twoFactorEnabled: e.target.checked })}
            />
            Enable Optional Two-Factor Verification on Partner Sign In
          </label>
          <button type="submit" className="px-5 py-2 text-xs font-semibold bg-navy-900 text-white rounded cursor-pointer">
            Update Security Settings
          </button>
        </form>
      )}
    </div>
  );
};
