import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, MapPin, QrCode, Users, X } from 'lucide-react';
import { NetworkEvent } from '../types/index.ts';
import { MediaImage } from '../components/MediaImage.tsx';

interface EventsPageProps {
  initialSlug?: string;
}

export const EventsPage: React.FC<EventsPageProps> = ({ initialSlug }) => {
  const [events, setEvents] = useState<NetworkEvent[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [formatFilter, setFormatFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState<NetworkEvent | null>(null);

  // Registration modal
  const [registerEvent, setRegisterEvent] = useState<NetworkEvent | null>(null);
  const [regForm, setRegForm] = useState({
    registrationType: 'Individual',
    fullName: '',
    email: '',
    phone: '',
    organizationName: '',
    delegationSize: 1,
  });
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [regReceipt, setRegReceipt] = useState<{
    registration: { qrToken: string; fullName: string; delegationSize: number };
    eventTitle: string;
    startAt: string;
    venueOrLink: string;
    qrDataUrl: string;
  } | null>(null);

  const loadEvents = async () => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (formatFilter !== 'all') params.set('format', formatFilter);
    const res = await fetch(`/api/events?${params.toString()}`);
    if (res.ok) {
      const list: NetworkEvent[] = await res.json();
      setEvents(list);
      if (initialSlug) {
        const match = list.find((e) => e.slug === initialSlug);
        if (match) setSelectedEvent(match);
      }
    }
  };

  useEffect(() => {
    loadEvents();
  }, [statusFilter, formatFilter]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerEvent) return;
    setRegError('');
    setRegLoading(true);
    try {
      const res = await fetch(`/api/events/${registerEvent.id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegError(data.error || 'Registration failed.');
      } else {
        setRegReceipt(data);
        loadEvents();
      }
    } catch {
      setRegError('Network error during registration.');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-widest text-crimson-600 dark:text-red-400">
            Civic Calendar &amp; Assemblies
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-navy-900 dark:text-white">
            Events &amp; Activities Portal
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
            Conferences, public dialogues, consultations, and capacity-building workshops. Register
            individually or as an organizational delegation with instant QR attendance passes.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {['all', 'Upcoming', 'Ongoing', 'Past'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md cursor-pointer ${
                statusFilter === st
                  ? 'bg-navy-900 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {st === 'all' ? 'All Events' : st}
            </button>
          ))}
          <select
            aria-label="Filter by event format"
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900"
          >
            <option value="all">All Formats</option>
            <option value="In-person">In-person</option>
            <option value="Online">Online</option>
            <option value="Hybrid">Hybrid</option>
          </select>
        </div>
      </div>

      {/* Selected Event Detail Banner */}
      {selectedEvent && (
        <div className="p-6 sm:p-8 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/70 dark:bg-slate-900/60 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs text-slate-500">
                {selectedEvent.category} · {selectedEvent.format} · {selectedEvent.status}
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-navy-900 dark:text-white">
                {selectedEvent.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setSelectedEvent(null)}
              aria-label="Close event detail"
              className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 aspect-[16/10] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
              <MediaImage src={selectedEvent.posterUrl} alt={selectedEvent.title} />
            </div>
            <div className="lg:col-span-7 space-y-4 text-sm">
              <p className="text-slate-700 dark:text-slate-200 leading-relaxed">
                {selectedEvent.description}
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                <strong>Objectives:</strong> {selectedEvent.objectives}
              </p>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <dt className="text-slate-500">Schedule</dt>
                  <dd className="font-mono font-medium tabular-nums">
                    {selectedEvent.startAt} – {selectedEvent.endAt}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Venue / Link</dt>
                  <dd className="font-medium">{selectedEvent.venueOrLink}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Organizer</dt>
                  <dd className="font-medium">{selectedEvent.organizer}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Available Slots</dt>
                  <dd className="font-mono font-medium tabular-nums">
                    {selectedEvent.availableSlots ?? selectedEvent.capacity} / {selectedEvent.capacity}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Registration Deadline</dt>
                  <dd className="font-mono tabular-nums">{selectedEvent.registrationDeadline}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Contact Person</dt>
                  <dd>{selectedEvent.contactPerson}</dd>
                </div>
              </dl>

              {selectedEvent.postEventReport && (
                <div className="p-3 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs">
                  <strong>Post-Event Accomplishment Report:</strong> {selectedEvent.postEventReport}
                </div>
              )}

              {selectedEvent.status !== 'Past' && (
                <button
                  type="button"
                  onClick={() => {
                    setRegisterEvent(selectedEvent);
                    setRegReceipt(null);
                  }}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-crimson-600 hover:bg-crimson-700 rounded-md cursor-pointer"
                >
                  Register for This Activity
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Events List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {events.map((ev) => (
          <div
            key={ev.id}
            className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900/60 flex flex-col justify-between"
          >
            <div>
              <div className="aspect-[16/9] bg-slate-100 dark:bg-slate-800">
                <MediaImage src={ev.posterUrl} alt={ev.title} />
              </div>
              <div className="p-5 space-y-2.5">
                <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-navy-900 dark:text-white">{ev.status}</span>
                  <span>·</span>
                  <span>{ev.category}</span>
                  <span>·</span>
                  <span>{ev.format}</span>
                </div>
                <h3 className="font-serif text-xl font-semibold text-slate-900 dark:text-white">
                  {ev.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                  {ev.description}
                </p>
                <div className="pt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="font-mono tabular-nums">{ev.startAt}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="truncate">{ev.venueOrLink}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span className="tabular-nums">
                      {ev.availableSlots ?? ev.capacity} seats remaining (Deadline:{' '}
                      {ev.registrationDeadline})
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedEvent(ev)}
                className="text-xs font-semibold text-navy-900 dark:text-slate-200 hover:underline cursor-pointer"
              >
                Full Event Brief
              </button>
              {ev.status !== 'Past' && (
                <button
                  type="button"
                  onClick={() => {
                    setRegisterEvent(ev);
                    setRegReceipt(null);
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-navy-900 hover:bg-navy-800 rounded-md cursor-pointer"
                >
                  Register
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Registration Modal */}
      {registerEvent && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-slate-500">Event Registration</div>
                <h3 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
                  {registerEvent.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRegisterEvent(null)}
                className="p-1 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {regReceipt ? (
              <div className="space-y-4 text-center py-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <div className="text-base font-semibold">Registration Confirmed</div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Present this QR Attendance Pass at check-in ({regReceipt.registration.delegationSize}{' '}
                  seat/s for {regReceipt.registration.fullName}).
                </p>
                <img
                  src={regReceipt.qrDataUrl}
                  alt="QR Attendance Pass"
                  className="mx-auto border border-slate-200 rounded p-2 bg-white"
                />
                <div className="font-mono text-xs font-semibold bg-slate-100 dark:bg-slate-800 py-2 px-3 rounded inline-flex items-center gap-2">
                  <QrCode className="w-4 h-4" />
                  {regReceipt.registration.qrToken}
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                {regError && (
                  <div className="p-2.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded">
                    {regError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold mb-1">Registration Type</label>
                  <select
                    value={regForm.registrationType}
                    onChange={(e) => setRegForm({ ...regForm, registrationType: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900"
                  >
                    <option>Individual</option>
                    <option>Organizational Delegation</option>
                    <option>Partner Organization</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Full Name / Lead Delegate *</label>
                  <input
                    required
                    value={regForm.fullName}
                    onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Email *</label>
                    <input
                      required
                      type="email"
                      value={regForm.email}
                      onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Phone</label>
                    <input
                      value={regForm.phone}
                      onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                    />
                  </div>
                </div>
                {regForm.registrationType !== 'Individual' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Organization Name</label>
                      <input
                        value={regForm.organizationName}
                        onChange={(e) => setRegForm({ ...regForm, organizationName: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Delegation Size</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={regForm.delegationSize}
                        onChange={(e) =>
                          setRegForm({ ...regForm, delegationSize: Number(e.target.value) || 1 })
                        }
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-transparent"
                      />
                    </div>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full py-2.5 text-sm font-semibold text-white bg-navy-900 hover:bg-navy-800 rounded-md cursor-pointer"
                >
                  {regLoading ? 'Generating Pass...' : 'Confirm Registration & Generate QR Pass'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
