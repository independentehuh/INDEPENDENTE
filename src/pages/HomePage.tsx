import React from 'react';
import { ArrowRight, Calendar, FileText, Handshake, Megaphone, ShieldAlert, Users } from 'lucide-react';
import {
  AdvocacyArea,
  Announcement,
  Campaign,
  NetworkEvent,
  Organization,
  PageRoute,
  Publication,
} from '../types/index.ts';
import { MediaImage } from '../components/MediaImage.tsx';

interface HomePageProps {
  publications: Publication[];
  advocacyAreas: AdvocacyArea[];
  campaigns: Campaign[];
  organizations: Organization[];
  events: NetworkEvent[];
  announcements: Announcement[];
  onNavigate: (page: PageRoute, detailSlug?: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  publications,
  advocacyAreas,
  campaigns,
  organizations,
  events,
  announcements,
  onNavigate,
}) => {
  const leadPub = publications[0];
  const secondaryPubs = publications.slice(1, 3);
  const dispatchPubs = publications.slice(3, 6);
  const upcomingEvents = events.filter((e) => e.status === 'Upcoming').slice(0, 3);
  const featuredOrgs = organizations.slice(0, 4);

  return (
    <div className="pb-12">
      {/* Hero Section */}
      <section className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-between space-y-8">
              <div className="space-y-5">
                <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-navy-950 shadow-xs">
                  <img
                    src="/assets/aistudio/Kampus_Independente_logo_856d9f00.png"
                    alt="INDEPENDENTE — An Independent Citizens Network: Think. Stand. Build. Mag-isip. Manindigan. Magpanday. For the People. For Peace. For the Nation."
                    referrerPolicy="no-referrer"
                    className="w-full h-auto object-cover"
                  />
                </div>

                <h1 className="font-serif text-3xl sm:text-4xl lg:text-[40px] font-semibold text-navy-900 dark:text-white leading-[1.18] headline-balance">
                  Independent Minds. Informed Choices. Empowered Citizens.
                </h1>

                <blockquote className="text-base sm:text-lg text-slate-700 dark:text-slate-200 leading-relaxed max-w-2xl font-serif italic pt-2 border-t border-slate-200 dark:border-slate-800">
                  “Ang isang bansa ay hindi lamang hinuhubog ng pamahalaan, mga personalidad sa
                  politika, o mga institusyon. Hinuhubog din ito ng mga mamamayang mulat, mapanuri,
                  responsable, at handang makilahok.”
                </blockquote>

                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                  An independent, nonpartisan civic newsroom, advocacy hub, partner coalition, and
                  citizen action portal serving communities across the Philippines.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('isanguni')}
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-crimson-600 hover:bg-crimson-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ShieldAlert className="w-4 h-4" />
                  Citizen Isanguni
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('media')}
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-navy-900 hover:bg-navy-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Read Our Publications
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('network')}
                  className="inline-flex items-center gap-2 px-4 py-3 text-sm font-medium text-navy-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Explore Our Network
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('network', 'apply')}
                  className="inline-flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white underline-offset-4 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Become a Partner <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col">
              <div className="relative flex-1 min-h-[280px] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
                <MediaImage
                  src="/src/assets/images/hero_civic_assembly_1795044498184.jpg"
                  alt="Citizens gathered in an independent civic assembly discussion"
                  className="w-full h-full lg:h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/45 to-transparent p-5">
                  <p className="text-xs text-slate-200 leading-snug">
                    “An informed citizenry is an empowered citizenry.” Nonpartisan civic dialogues
                    and verified public-interest reporting.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* A. Latest Publications (3-Tier Broadsheet Hierarchy) */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-14 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-medium tracking-wider uppercase text-slate-500 dark:text-slate-400">
              Independent Newsroom
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-navy-900 dark:text-white mt-1">
              Latest Publications
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('media')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-900 dark:text-slate-200 hover:text-crimson-600 cursor-pointer"
          >
            Open Media &amp; Publications Center <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Tier 1: Lead Story */}
          {leadPub && (
            <article className="lg:col-span-6 flex flex-col justify-between border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900/60">
              <div className="aspect-[16/10] bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <MediaImage
                  src={leadPub.featuredImageUrl}
                  alt={leadPub.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-crimson-600 dark:text-red-400 uppercase tracking-wide">
                      {leadPub.categorySlug.replace(/-/g, ' ')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{leadPub.publishedAt}</span>
                    {leadPub.isDemonstration && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Demonstration Record</span>
                      </>
                    )}
                  </div>
                  <h3 className="font-serif text-2xl font-semibold text-slate-900 dark:text-white leading-snug headline-balance">
                    <button
                      type="button"
                      onClick={() => onNavigate('media', leadPub.slug)}
                      className="text-left hover:text-navy-700 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {leadPub.title}
                    </button>
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {leadPub.subheadline}
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <span>{leadPub.authorName}</span>
                  <button
                    type="button"
                    onClick={() => onNavigate('media', leadPub.slug)}
                    className="font-semibold text-navy-900 dark:text-slate-200 hover:underline cursor-pointer"
                  >
                    Read Full Report
                  </button>
                </div>
              </div>
            </article>
          )}

          {/* Tier 2 & 3: Secondary Features + Dispatch Headlines */}
          <div className="lg:col-span-6 flex flex-col justify-between gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {secondaryPubs.map((pub) => (
                <article
                  key={pub.id}
                  className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900/60 flex flex-col"
                >
                  <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <MediaImage
                      src={pub.featuredImageUrl}
                      alt={pub.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                        <span className="font-semibold text-navy-900 dark:text-slate-200 uppercase">
                          {pub.categorySlug.replace(/-/g, ' ')}
                        </span>{' '}
                        · <span className="tabular-nums">{pub.publishedAt}</span>
                      </div>
                      <h3 className="font-serif text-base font-semibold text-slate-900 dark:text-white leading-snug">
                        <button
                          type="button"
                          onClick={() => onNavigate('media', pub.slug)}
                          className="text-left hover:underline cursor-pointer"
                        >
                          {pub.title}
                        </button>
                      </h3>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 pt-2">
                      {pub.authorName}
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Research, Statements &amp; Community Reports
              </div>
              {dispatchPubs.map((pub) => (
                <div
                  key={pub.id}
                  className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-800/80 last:border-0"
                >
                  <div className="space-y-0.5">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {pub.categorySlug.replace(/-/g, ' ')} ·{' '}
                      <span className="tabular-nums">{pub.publishedAt}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate('media', pub.slug)}
                      className="text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-navy-800 dark:hover:text-white text-left cursor-pointer"
                    >
                      {pub.title}
                    </button>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* B. Current Advocacy Priorities & C. Our Network */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-14 border-b border-slate-200 dark:border-slate-800">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* B. Current Advocacy Priorities */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium tracking-wider uppercase text-slate-500 dark:text-slate-400">
                  Civic Campaigns &amp; Policy Areas
                </p>
                <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-navy-900 dark:text-white mt-1">
                  Current Advocacy Priorities
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('advocacy')}
                className="text-sm font-semibold text-navy-900 dark:text-slate-200 hover:text-crimson-600 cursor-pointer shrink-0"
              >
                All {advocacyAreas.length} Areas →
              </button>
            </div>

            <div className="space-y-4">
              {campaigns.slice(0, 3).map((camp) => (
                <div
                  key={camp.id}
                  className="p-5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/60 space-y-2"
                >
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <span
                      className={`font-semibold ${
                        camp.status === 'Active'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {camp.status} Campaign
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">Started {camp.startDate}</span>
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-slate-900 dark:text-white">
                    <button
                      type="button"
                      onClick={() => onNavigate('advocacy')}
                      className="text-left hover:underline cursor-pointer"
                    >
                      {camp.title}
                    </button>
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {camp.summary}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* C. Our Network */}
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium tracking-wider uppercase text-slate-500 dark:text-slate-400">
                  Affiliated Coalitions
                </p>
                <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-navy-900 dark:text-white mt-1">
                  Our Network
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('network')}
                className="text-sm font-semibold text-navy-900 dark:text-slate-200 hover:text-crimson-600 cursor-pointer shrink-0"
              >
                Directory →
              </button>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/60">
              {featuredOrgs.map((org) => (
                <div key={org.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {org.orgType} · {org.geographicCoverage}
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate('network', org.slug)}
                      className="text-sm font-semibold text-navy-900 dark:text-white hover:underline text-left cursor-pointer"
                    >
                      {org.name}
                    </button>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                      {org.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* D. Upcoming Events & E. Citizen Participation */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-14 border-b border-slate-200 dark:border-slate-800">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium tracking-wider uppercase text-slate-500 dark:text-slate-400">
                  Public Forums &amp; Assemblies
                </p>
                <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-navy-900 dark:text-white mt-1">
                  Upcoming Events
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('events')}
                className="text-sm font-semibold text-navy-900 dark:text-slate-200 hover:text-crimson-600 cursor-pointer"
              >
                Events Calendar →
              </button>
            </div>

            <div className="space-y-4">
              {upcomingEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="p-5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {ev.category} · {ev.format} ·{' '}
                      <span className="font-mono tabular-nums">{ev.startAt}</span>
                    </div>
                    <h3 className="font-serif text-lg font-semibold text-slate-900 dark:text-white">
                      {ev.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{ev.venueOrLink}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('events', ev.slug)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-navy-900 hover:bg-navy-800 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    View &amp; Register
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* E. Citizen Participation */}
          <div className="lg:col-span-5">
            <div className="h-full p-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-crimson-600 dark:text-red-400">
                  Citizen Isanguni
                </div>
                <h2 className="font-serif text-2xl font-semibold text-navy-900 dark:text-white">
                  Your Voice. Your Concern. Our Collective Responsibility.
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Open to every citizen—even if you are not affiliated with any organization. Use
                  Citizen Isanguni to:
                </p>
                <ul className="space-y-2.5 text-sm text-slate-700 dark:text-slate-200">
                  <li className="flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-crimson-600 shrink-0 mt-0.5" />
                    <span>Raise public service or governance accountability concerns</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <FileText className="w-4 h-4 text-navy-900 dark:text-slate-300 shrink-0 mt-0.5" />
                    <span>Submit documented community complaints with evidence</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Megaphone className="w-4 h-4 text-navy-900 dark:text-slate-300 shrink-0 mt-0.5" />
                    <span>Recommend constructive policies and local solutions</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Users className="w-4 h-4 text-navy-900 dark:text-slate-300 shrink-0 mt-0.5" />
                    <span>Track case screening and updates anonymously or confidentially</span>
                  </li>
                </ul>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('isanguni')}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-crimson-600 hover:bg-crimson-700 rounded-md cursor-pointer"
                >
                  Open Citizen Isanguni
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('isanguni', 'track')}
                  className="px-4 py-2.5 text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-md hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
                >
                  Track Existing Report
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* F. Partnership Invitation & G. Latest Announcements */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* F. Partnership Invitation */}
          <div className="lg:col-span-6 p-8 rounded-lg bg-navy-900 text-white space-y-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
              <Handshake className="w-4 h-4" />
              Network Partnership
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold leading-snug headline-balance">
              Partner With INDEPENDENTE Across Cities, Provinces, and Regions
            </h2>
            <p className="text-sm text-slate-200 leading-relaxed">
              Civic coalitions, academic institutions, community associations, and independent
              local media desks are invited to apply for accredited partner status. Approved
              partners gain dedicated access to the secure Partnership Portal, joint advocacy
              campaigns, and Secretariat circulars.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('network', 'apply')}
                className="px-5 py-2.5 text-sm font-semibold bg-white text-navy-900 hover:bg-slate-100 rounded-md cursor-pointer"
              >
                Apply for Partnership
              </button>
              <button
                type="button"
                onClick={() => onNavigate('partner-portal')}
                className="px-5 py-2.5 text-sm font-medium border border-white/30 text-white hover:bg-white/10 rounded-md cursor-pointer"
              >
                Partner Portal Sign In
              </button>
            </div>
          </div>

          {/* G. Latest Announcements */}
          <div className="lg:col-span-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl font-semibold text-navy-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-crimson-600" />
                Latest Announcements
              </h2>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800">
              {announcements.slice(0, 4).map((ann) => (
                <div key={ann.id} className="py-4 space-y-1.5">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-navy-900 dark:text-slate-200">
                      {ann.category}
                    </span>{' '}
                    · <span className="tabular-nums">{ann.publishedAt}</span> · {ann.authorName}
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    {ann.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {ann.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
