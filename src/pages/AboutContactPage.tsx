import React, { useState } from 'react';
import { CheckCircle2, Mail, MapPin, ShieldCheck } from 'lucide-react';
import { NetworkDocument } from '../types/index.ts';

interface AboutContactPageProps {
  mode: 'about' | 'contact';
  publicDocuments: NetworkDocument[];
  correctionPolicy?: string;
}

export const AboutContactPage: React.FC<AboutContactPageProps> = ({
  mode,
  publicDocuments,
  correctionPolicy,
}) => {
  const [form, setForm] = useState({ fullName: '', email: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setSent(true);
      setForm({ fullName: '', email: '', subject: '', message: '' });
    } else {
      const data = await res.json();
      setError(data.error || 'Unable to send message.');
    }
  };

  if (mode === 'contact') {
    return (
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-6 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-widest text-crimson-600 dark:text-red-400">
            Secretariat &amp; Editorial Desk
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-navy-900 dark:text-white">
            Contact INDEPENDENTE
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5 space-y-6 text-sm">
            <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-navy-900 dark:text-slate-300 mt-1" />
                <div>
                  <div className="font-semibold">General Secretariat</div>
                  <div className="text-slate-600 dark:text-slate-400">secretariat@independente.org</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-crimson-600 mt-1" />
                <div>
                  <div className="font-semibold">Data Protection Officer (RA 10173)</div>
                  <div className="text-slate-600 dark:text-slate-400">dpo@independente.org</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-navy-900 dark:text-slate-300 mt-1" />
                <div>
                  <div className="font-semibold">Central Coordinating Office</div>
                  <div className="text-slate-600 dark:text-slate-400">
                    National Capital Region · Regional Desks across Luzon, Visayas, and Mindanao
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            {sent ? (
              <div className="p-8 border border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-lg space-y-3">
                <CheckCircle2 className="w-7 h-7 text-emerald-700" />
                <h2 className="font-serif text-xl font-semibold">Message Received</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Thank you for reaching out to INDEPENDENTE. The Secretariat will review your
                  message.
                </p>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="text-xs font-semibold underline cursor-pointer"
                >
                  Send another inquiry
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4"
              >
                {error && <div className="text-xs text-red-600">{error}</div>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Full Name *</label>
                    <input
                      required
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Email *</label>
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Subject *</label>
                  <input
                    required
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Message *</label>
                  <textarea
                    required
                    rows={4}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-transparent"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-semibold bg-navy-900 text-white rounded-md cursor-pointer"
                >
                  Send Message
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <img
            src="/assets/aistudio/Kampus_Independente_logo__1__80e86dcb.jpg"
            alt="INDEPENDENTE Official Emblem"
            referrerPolicy="no-referrer"
            className="w-20 h-20 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
          />
          <div className="space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-widest text-crimson-600 dark:text-red-400">
              Charter, Philosophy &amp; Governance
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-navy-900 dark:text-white">
              About INDEPENDENTE
            </h1>
            <p className="text-base sm:text-lg font-serif italic text-slate-700 dark:text-slate-200">
              “An informed citizenry is an empowered citizenry.” — Think. Stand. Build. (Mag-isip.
              Manindigan. Magpanday.)
            </p>
          </div>
        </div>
        <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-navy-950">
          <img
            src="/assets/aistudio/Kampus_Independente_logo_856d9f00.png"
            alt="INDEPENDENTE — An Independent Citizens Network Banner"
            referrerPolicy="no-referrer"
            className="w-full h-auto object-cover"
          />
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-3">
          <h2 className="font-serif text-2xl font-semibold text-navy-900 dark:text-white">
            Core Philosophy &amp; Nonpartisanship
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            INDEPENDENTE is an independent, nonpartisan, citizen-centered civic network. We
            believe a nation is shaped not solely by government officials, political personalities,
            or formal institutions—it is equally shaped by citizens who are informed, discerning,
            responsible, and ready to participate constructively.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            The platform welcomes citizens across differing political beliefs and regional
            backgrounds, grounded in evidence, respectful civic discourse, and mutual
            accountability.
          </p>
        </div>

        <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
          <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
            Core Values
          </h2>
          <div className="grid grid-cols-2 gap-2 text-sm text-slate-700 dark:text-slate-300">
            <span>• Independence</span>
            <span>• Accountability</span>
            <span>• Inclusivity</span>
            <span>• Transparency</span>
            <span>• Civic Participation</span>
            <span>• Critical Thinking</span>
            <span>• Democratic Engagement</span>
            <span>• Responsible Citizenship</span>
          </div>
        </div>
      </section>

      <section className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
        <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
          Editorial Standards &amp; Correction Policy
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {correctionPolicy ||
            'All articles, investigative reports, and policy papers undergo independent fact-checking and editorial review prior to publication. Citizen Isanguni submissions are never automatically published as news stories.'}
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
          Public Charters &amp; Governance Documents
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {publicDocuments.map((doc) => (
            <div key={doc.id} className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg space-y-1.5">
              <div className="text-xs text-slate-500">{doc.category}</div>
              <div className="text-sm font-semibold">{doc.title}</div>
              <p className="text-xs text-slate-600 dark:text-slate-400">{doc.description}</p>
              <a href={doc.fileUrl} className="inline-block text-xs font-semibold text-navy-900 dark:text-slate-200 underline">
                Download Document
              </a>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
