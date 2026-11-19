import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Lock,
  MessageSquarePlus,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { CitizenCategory } from '../types/index.ts';

interface CitizenIsanguniPageProps {
  categories: CitizenCategory[];
  initialTab?: string;
}

interface TrackedCase {
  referenceNumber: string;
  subject: string;
  categorySlug: string;
  location: string;
  incidentDate: string;
  privacyMode: string;
  status: string;
  consentForReferral: boolean;
  reporterFeedback: string;
  reporterRating: number | null;
  createdAt: string;
  updates: Array<{
    id: number;
    authorRole: string;
    authorName: string;
    updateType: string;
    message: string;
    previousStatus: string | null;
    newStatus: string | null;
    createdAt: string;
  }>;
  attachments: Array<{
    id: number;
    fileName: string;
    mimeType: string;
    fileSize: number;
  }>;
}

export const CitizenIsanguniPage: React.FC<CitizenIsanguniPageProps> = ({
  categories,
  initialTab,
}) => {
  const [tab, setTab] = useState<'submit' | 'track'>(initialTab === 'track' ? 'track' : 'submit');

  // Submission state
  const [form, setForm] = useState({
    subject: '',
    categorySlug: categories[0]?.slug || 'public-service',
    location: '',
    incidentDate: new Date().toISOString().slice(0, 10),
    description: '',
    involvedParties: '',
    whyItMatters: '',
    requestedAction: '',
    privacyMode: 'confidential',
    reporterName: '',
    reporterEmail: '',
    reporterPhone: '',
    preferredContact: 'email',
    consentForReferral: false,
    truthfulnessConfirmed: false,
  });
  const [evidenceFiles, setEvidenceFiles] = useState<FileList | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [receipt, setReceipt] = useState<{
    referenceNumber: string;
    accessCode: string;
    status: string;
    privacyMode: string;
  } | null>(null);

  // Tracker state
  const [trackRef, setTrackRef] = useState('');
  const [trackCode, setTrackCode] = useState('');
  const [tracked, setTracked] = useState<TrackedCase | null>(null);
  const [trackError, setTrackError] = useState('');
  const [followupMsg, setFollowupMsg] = useState('');
  const [followupFiles, setFollowupFiles] = useState<FileList | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [followupNotice, setFollowupNotice] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
      if (evidenceFiles) {
        Array.from(evidenceFiles).slice(0, 5).forEach((f) => fd.append('evidence', f));
      }
      const res = await fetch('/api/isanguni/submit', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || 'Submission could not be completed.');
      } else {
        setReceipt(data);
        setTrackRef(data.referenceNumber);
        setTrackCode(data.accessCode);
      }
    } catch {
      setSubmitError('Network error submitting concern.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrack = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setTrackError('');
    const res = await fetch('/api/isanguni/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referenceNumber: trackRef, accessCode: trackCode }),
    });
    const data = await res.json();
    if (!res.ok) {
      setTracked(null);
      setTrackError(data.error || 'Unable to verify tracking credentials.');
    } else {
      setTracked(data);
    }
  };

  const handleFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    setFollowupNotice('');
    const fd = new FormData();
    fd.append('referenceNumber', trackRef);
    fd.append('accessCode', trackCode);
    if (followupMsg.trim()) fd.append('message', followupMsg.trim());
    if (feedbackText.trim()) {
      fd.append('feedback', feedbackText.trim());
      fd.append('rating', String(feedbackRating));
    }
    if (followupFiles) {
      Array.from(followupFiles).slice(0, 3).forEach((f) => fd.append('evidence', f));
    }
    const res = await fetch('/api/isanguni/followup', { method: 'POST', body: fd });
    if (res.ok) {
      setFollowupMsg('');
      setFollowupFiles(null);
      setFeedbackText('');
      setFollowupNotice('Follow-up and evidence uploaded securely.');
      handleTrack();
    }
  };

  const downloadAttachment = async (attId: number, fileName: string) => {
    const res = await fetch(`/api/isanguni/attachments/${attId}`, {
      headers: {
        'x-isanguni-ref': trackRef,
        'x-isanguni-code': trackCode,
      },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[1250px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2 max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-widest text-crimson-600 dark:text-red-400">
            Citizen Concern, Complaint &amp; Reporting Portal
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-navy-900 dark:text-white">
            CITIZEN ISANGUNI
          </h1>
          <p className="text-base font-medium text-slate-700 dark:text-slate-200">
            “Your Voice. Your Concern. Our Collective Responsibility.”
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Accessible to any citizen—including individuals not affiliated with INDEPENDENTE or any
            partner organization. Raise public service concerns, submit complaints, or recommend
            policy solutions under strict privacy safeguards.
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setTab('submit')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-md cursor-pointer ${
              tab === 'submit'
                ? 'bg-crimson-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            Submit a Concern
          </button>
          <button
            type="button"
            onClick={() => setTab('track')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-md cursor-pointer ${
              tab === 'track'
                ? 'bg-navy-900 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            Track Existing Report
          </button>
        </div>
      </div>

      {/* Mandatory Emergency & Non-Government Disclaimer */}
      <div className="p-5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 flex flex-col sm:flex-row items-start gap-4 text-xs sm:text-sm text-amber-950 dark:text-amber-100">
        <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold">
            Important Safeguards, Scope Limitation &amp; Emergency Notice
          </div>
          <p className="leading-relaxed">
            INDEPENDENTE is an independent civic network—<strong>not</strong> a government
            investigative agency, law enforcement authority, court, or emergency response service.
            Submitting a report does not guarantee formal investigation, legal representation,
            immediate intervention, or a specific outcome. <strong>For emergencies involving
            immediate physical danger, call 911 or contact local emergency responders immediately.</strong>
          </p>
        </div>
      </div>

      {tab === 'submit' && (
        <>
          {receipt ? (
            <div className="max-w-2xl mx-auto p-8 border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-lg space-y-5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-700 dark:text-emerald-400" />
                <div>
                  <h2 className="font-serif text-2xl font-semibold text-slate-900 dark:text-white">
                    Submission Received Securely
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Privacy Mode: {receipt.privacyMode.toUpperCase()} · Current Status:{' '}
                    {receipt.status}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-3">
                <div>
                  <div className="text-xs text-slate-500">Unique Reference Number</div>
                  <div className="font-mono text-xl font-bold text-navy-900 dark:text-white tabular-nums">
                    {receipt.referenceNumber}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">
                    One-Time Secure Access Code (Save this securely—it cannot be recovered if lost)
                  </div>
                  <div className="font-mono text-xl font-bold text-crimson-600 dark:text-red-400 tabular-nums">
                    {receipt.accessCode}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTab('track');
                    handleTrack();
                  }}
                  className="px-5 py-2.5 text-sm font-semibold bg-navy-900 text-white rounded-md cursor-pointer"
                >
                  Open Case Status Tracker
                </button>
                <button
                  type="button"
                  onClick={() => setReceipt(null)}
                  className="px-4 py-2.5 text-sm font-medium border border-slate-300 dark:border-slate-700 rounded-md cursor-pointer"
                >
                  Submit Another Report
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 p-6 sm:p-8 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/60 space-y-6">
                {submitError && (
                  <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded">
                    {submitError}
                  </div>
                )}

                <div className="space-y-4">
                  <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
                    1. Concern Information
                  </h2>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Subject or Title *</label>
                    <input
                      required
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      placeholder="Clear summary of the issue or recommendation"
                      className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Category *</label>
                      <select
                        value={form.categorySlug}
                        onChange={(e) => setForm({ ...form, categorySlug: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900"
                      >
                        {categories.map((c) => (
                          <option key={c.slug} value={c.slug}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Location of Concern *</label>
                      <input
                        required
                        value={form.location}
                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                        placeholder="Barangay, City/Municipality, Province"
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Date Observed *</label>
                      <input
                        required
                        type="date"
                        value={form.incidentDate}
                        onChange={(e) => setForm({ ...form, incidentDate: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      What happened? (Detailed description) *
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Individuals or Institutions Involved (Optional)
                    </label>
                    <input
                      value={form.involvedParties}
                      onChange={(e) => setForm({ ...form, involvedParties: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Why does this matter? *</label>
                      <textarea
                        required
                        rows={3}
                        value={form.whyItMatters}
                        onChange={(e) => setForm({ ...form, whyItMatters: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        What action or attention is requested? *
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={form.requestedAction}
                        onChange={(e) => setForm({ ...form, requestedAction: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Supporting Evidence */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <h2 className="font-serif text-lg font-semibold text-navy-900 dark:text-white">
                    2. Supporting Evidence (Optional, max 5 files, 8MB each)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Photographs, PDFs, screenshots, or documents. Stored securely outside public
                    web directories and never published automatically.
                  </p>
                  <input
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.doc,.docx"
                    onChange={(e) => setEvidenceFiles(e.target.files)}
                    className="text-xs"
                  />
                </div>

                {/* Privacy Mode & Reporter Info */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                  <h2 className="font-serif text-lg font-semibold text-navy-900 dark:text-white">
                    3. Privacy Mode &amp; Reporter Details
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        id: 'identified',
                        title: 'Identified',
                        desc: 'Name & contact visible to assigned Citizen Affairs Officers.',
                      },
                      {
                        id: 'confidential',
                        title: 'Confidential',
                        desc: 'Identity shielded; shared externally only with explicit consent.',
                      },
                      {
                        id: 'anonymous',
                        title: 'Anonymous',
                        desc: 'Zero personal identity recorded; track strictly via reference + code.',
                      },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setForm({ ...form, privacyMode: opt.id })}
                        className={`p-3.5 text-left rounded-md border cursor-pointer ${
                          form.privacyMode === opt.id
                            ? 'border-navy-900 bg-navy-900/5 dark:border-white dark:bg-white/10'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-semibold text-slate-900 dark:text-white">
                          {opt.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          {opt.desc}
                        </div>
                      </button>
                    ))}
                  </div>

                  {form.privacyMode !== 'anonymous' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          Full Name {form.privacyMode === 'identified' ? '*' : '(Optional)'}
                        </label>
                        <input
                          required={form.privacyMode === 'identified'}
                          value={form.reporterName}
                          onChange={(e) => setForm({ ...form, reporterName: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Email Address *</label>
                        <input
                          required
                          type="email"
                          value={form.reporterEmail}
                          onChange={(e) => setForm({ ...form, reporterEmail: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Contact Number</label>
                        <input
                          value={form.reporterPhone}
                          onChange={(e) => setForm({ ...form, reporterPhone: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          Preferred Communication
                        </label>
                        <select
                          value={form.preferredContact}
                          onChange={(e) => setForm({ ...form, preferredContact: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900"
                        >
                          <option value="email">Encrypted Portal + Email Notice</option>
                          <option value="portal">Portal Tracker Only</option>
                          <option value="phone">Phone Call</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Consent & Safeguards */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3 text-xs text-slate-600 dark:text-slate-300">
                  <label className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={form.consentForReferral}
                      onChange={(e) => setForm({ ...form, consentForReferral: e.target.checked })}
                      className="mt-0.5"
                    />
                    <span>
                      I authorize INDEPENDENTE to coordinate or refer this concern (excluding my
                      identity if Anonymous, or with prior verification if Confidential) to relevant
                      public institutions or partner organizations.
                    </span>
                  </label>
                  <label className="flex items-start gap-2.5">
                    <input
                      required
                      type="checkbox"
                      checked={form.truthfulnessConfirmed}
                      onChange={(e) => setForm({ ...form, truthfulnessConfirmed: e.target.checked })}
                      className="mt-0.5"
                    />
                    <span>
                      <strong>Good-Faith &amp; Anti-Fabrication Declaration *:</strong> I affirm
                      this report is submitted in good faith without knowingly fabricated evidence,
                      and I acknowledge the Data Privacy Notice under Republic Act No. 10173.
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 text-sm font-semibold text-white bg-crimson-600 hover:bg-crimson-700 rounded-md disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Encrypting & Recording...' : 'Submit Report to Citizen Isanguni'}
                </button>
              </div>

              {/* Safeguards Sidebar */}
              <aside className="lg:col-span-4 space-y-5">
                <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/70 dark:bg-slate-900/50 space-y-3 text-xs leading-relaxed">
                  <div className="flex items-center gap-2 font-semibold text-sm text-navy-900 dark:text-white">
                    <ShieldCheck className="w-4 h-4 text-crimson-600" />
                    Citizen Protection Standards
                  </div>
                  <ul className="space-y-2 text-slate-600 dark:text-slate-300">
                    <li>• Compliant with Republic Act No. 10173 (Data Privacy Act of 2012).</li>
                    <li>• Complaints are NEVER automatically published as media articles.</li>
                    <li>• Anonymous submissions cannot be traced to unmask reporters.</li>
                    <li>• Referrals never auto-mark a report as resolved until addressed.</li>
                    <li>• Case records are strictly separated from general web administration.</li>
                  </ul>
                </div>

                <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-sm text-navy-900 dark:text-white">
                    <Lock className="w-4 h-4" /> 9-Stage Case Workflow
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">
                    RECEIVED → INITIAL SCREENING → UNDER REVIEW → FOR CLARIFICATION → FOR REFERRAL →
                    ACTION INITIATED → RESOLVED / ADDRESSED → CLOSED (or OUT OF SCOPE).
                  </p>
                </div>
              </aside>
            </form>
          )}
        </>
      )}

      {tab === 'track' && (
        <div className="max-w-3xl space-y-6">
          <form
            onSubmit={handleTrack}
            className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/60 space-y-4"
          >
            <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
              Secure Submission Status &amp; Follow-Up
            </h2>
            <p className="text-xs text-slate-500">
              Enter your unique Reference Number and Access Code. (Demonstration preview case:{' '}
              <span className="font-mono">ISG-2026-DEMO01</span> /{' '}
              <span className="font-mono">DEMO1-2026A</span>)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                required
                value={trackRef}
                onChange={(e) => setTrackRef(e.target.value)}
                placeholder="Reference (e.g. ISG-2026-XXXXXX)"
                className="px-3 py-2 text-sm font-mono border border-slate-300 dark:border-slate-700 rounded bg-transparent"
              />
              <input
                required
                value={trackCode}
                onChange={(e) => setTrackCode(e.target.value)}
                placeholder="Access Code (e.g. XXXXX-XXXXX)"
                className="px-3 py-2 text-sm font-mono border border-slate-300 dark:border-slate-700 rounded bg-transparent"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-navy-900 text-white rounded-md cursor-pointer"
            >
              <Search className="w-4 h-4" /> Verify &amp; View Status
            </button>
            {trackError && <p className="text-sm text-red-600">{trackError}</p>}
          </form>

          {tracked && (
            <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-6 bg-white dark:bg-slate-900/60">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <div className="font-mono text-xs text-slate-500">
                    {tracked.referenceNumber} · {tracked.privacyMode.toUpperCase()}
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-navy-900 dark:text-white mt-1">
                    {tracked.subject}
                  </h3>
                  <div className="text-xs text-slate-500 mt-1">
                    {tracked.location} · Observed: <span className="tabular-nums">{tracked.incidentDate}</span>
                  </div>
                </div>
                <div className="px-3 py-1.5 rounded border border-navy-900/30 bg-navy-900/5 dark:bg-white/10 text-xs font-mono font-semibold text-navy-900 dark:text-white">
                  {tracked.status}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Chronological Case Activity
                </h4>
                {tracked.updates.map((u) => (
                  <div key={u.id} className="p-3.5 border border-slate-200 dark:border-slate-800 rounded text-xs space-y-1">
                    <div className="flex justify-between text-slate-500">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {u.authorName}
                      </span>
                      <span className="font-mono tabular-nums">
                        {new Date(u.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300">{u.message}</p>
                  </div>
                ))}
              </div>

              {tracked.attachments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Secured Evidence Files
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {tracked.attachments.map((att) => (
                      <button
                        key={att.id}
                        type="button"
                        onClick={() => downloadAttachment(att.id, att.fileName)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> {att.fileName}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Reporter Follow-up & Feedback */}
              <form
                onSubmit={handleFollowup}
                className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-navy-900 dark:text-white">
                  <MessageSquarePlus className="w-4 h-4" />
                  Submit Clarification, Additional Evidence, or Handling Feedback
                </div>
                {followupNotice && (
                  <div className="p-2.5 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
                    {followupNotice}
                  </div>
                )}
                <textarea
                  rows={3}
                  value={followupMsg}
                  onChange={(e) => setFollowupMsg(e.target.value)}
                  placeholder="Respond to officer questions or provide additional factual context..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Attach Additional Evidence
                    </label>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => setFollowupFiles(e.target.files)}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Service Handling Feedback (Optional)
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={feedbackRating}
                        onChange={(e) => setFeedbackRating(Number(e.target.value))}
                        className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                      >
                        <option value={5}>5/5</option>
                        <option value={4}>4/5</option>
                        <option value={3}>3/5</option>
                        <option value={2}>2/5</option>
                        <option value={1}>1/5</option>
                      </select>
                      <input
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="Optional feedback..."
                        className="flex-1 px-2 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-navy-900 text-white rounded cursor-pointer"
                >
                  Send Secure Follow-Up
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
