import React, { useEffect, useState } from 'react';
import {
  Menu,
  Moon,
  Search,
  ShieldAlert,
  Sun,
  X,
  ArrowRight,
  Lock,
  LogIn,
  LogOut,
} from 'lucide-react';
import { PageRoute } from '../types/index.ts';
import { useTheme } from '../context/ThemeContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { PWAInstallButton } from './PWAInstallButton.tsx';
import { OfflineIndicator } from './OfflineIndicator.tsx';

interface LayoutProps {
  currentPage: PageRoute;
  onNavigate: (page: PageRoute, detailSlug?: string) => void;
  children: React.ReactNode;
}

interface SearchResults {
  publications: Array<{ id: number; slug: string; title: string; categorySlug: string }>;
  advocacy: Array<{ id: number; slug: string; title: string }>;
  campaigns: Array<{ id: number; slug: string; title: string; status: string }>;
  organizations: Array<{ id: number; slug: string; name: string; geographicCoverage: string }>;
  events: Array<{ id: number; slug: string; title: string; startAt: string }>;
  announcements: Array<{ id: number; title: string; publishedAt: string }>;
}

const NAV_ITEMS: Array<{ id: PageRoute; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'media', label: 'Media' },
  { id: 'advocacy', label: 'Advocacy' },
  { id: 'network', label: 'Organizations' },
  { id: 'events', label: 'Events' },
  { id: 'operations', label: 'Operations' },
  { id: 'partner-portal', label: 'Partners' },
  { id: 'isanguni', label: 'Isanguni' },
  { id: 'about', label: 'About' },
];

export const Layout: React.FC<LayoutProps> = ({ currentPage, onNavigate, children }) => {
  const { isDark, toggleTheme } = useTheme();
  const { dbUser, partnerUser, signInWithGoogle, logoutFirebase } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!searchOpen) return;
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          setSearchResults(await res.json());
        }
      } catch {
        // Ignore network errors on search typing
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, searchOpen]);

  const isStaff =
    dbUser &&
    [
      'super_admin',
      'secretariat_admin',
      'executive_committee',
      'editor_in_chief',
      'editorial_staff',
      'advocacy_coordinator',
      'partnership_coordinator',
      'events_coordinator',
      'citizen_affairs_officer',
    ].includes(dbUser.roleSlug);

  const handleNav = (page: PageRoute, slug?: string) => {
    setMobileMenuOpen(false);
    setSearchOpen(false);
    onNavigate(page, slug);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 dark:bg-[#0B1120] dark:text-slate-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-navy-900 focus:text-white focus:px-4 focus:py-2 focus:rounded"
      >
        Skip to main content
      </a>

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => handleNav('home')}
            className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-navy-900"
          >
            <img
              src="/assets/aistudio/Kampus_Independente_logo__1__80e86dcb.jpg"
              alt="INDEPENDENTE Emblem"
              referrerPolicy="no-referrer"
              className="w-[36px] h-8 rounded object-cover border border-slate-200 dark:border-slate-700 shrink-0"
            />
            <span className="font-serif text-lg sm:text-xl font-bold tracking-tight text-navy-900 dark:text-white">
              INDEPENDENTE
            </span>
          </button>

          {/* Zone 2: Single-Line Navigation Links */}
          <nav
            aria-label="Primary navigation"
            className="hidden xl:flex items-center gap-4 text-[13px] font-medium text-slate-600 dark:text-slate-300"
          >
            {NAV_ITEMS.map((item) => {
              const active = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNav(item.id)}
                  className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                    active
                      ? 'border-crimson-600 text-navy-900 dark:text-white font-semibold'
                      : 'border-transparent hover:text-navy-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Primary Action & Utility Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search network publications, advocacy, partners, and events"
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => handleNav('workspace')}
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer bg-[#976c6c] ${
                currentPage === 'workspace'
                  ? 'text-white border-navy-900'
                  : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:opacity-90'
              }`}
            >
              My Workspace
            </button>

            {isStaff ? (
              <button
                type="button"
                onClick={() => handleNav('admin')}
                className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  currentPage === 'admin'
                    ? 'bg-navy-900 text-white border-navy-900'
                    : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                Admin Desk
              </button>
            ) : dbUser ? (
              <button
                type="button"
                onClick={logoutFirebase}
                title={`Signed in as ${dbUser.email}`}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            ) : !partnerUser ? (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => handleNav('isanguni')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1b3c0a] hover:opacity-90 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Submit Concern
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="xl:hidden p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <PWAInstallButton variant="header" />
          </div>
        </div>

        {/* Mobile / Tablet Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="xl:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120] px-4 py-4 space-y-1">
            {[...NAV_ITEMS, { id: 'workspace' as PageRoute, label: 'My Workspace' }, { id: 'contact' as PageRoute, label: 'Contact' }].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`w-full text-left px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  currentPage === item.id
                    ? 'bg-slate-100 dark:bg-slate-800 text-navy-900 dark:text-white font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                {item.label}
              </button>
            ))}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              {isStaff ? (
                <button
                  type="button"
                  onClick={() => handleNav('admin')}
                  className="px-3 py-2 text-sm font-semibold text-navy-900 dark:text-white"
                >
                  Open Admin Desk
                </button>
              ) : dbUser ? (
                <button
                  type="button"
                  onClick={logoutFirebase}
                  className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300"
                >
                  Sign Out ({dbUser.email})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="px-3 py-2 text-sm font-medium text-navy-900 dark:text-white"
                >
                  Google Sign In
                </button>
              )}
            </div>
            <div className="pt-2">
              <PWAInstallButton variant="drawer" />
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main id="main-content" className="flex-1">
        {children}
      </main>

      {/* Institutional Footer */}
      <footer className="bg-slate-50 dark:bg-slate-900/70 border-t border-slate-200 dark:border-slate-800 mt-20">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src="/assets/aistudio/Kampus_Independente_logo__1__80e86dcb.jpg"
                  alt="INDEPENDENTE Official Emblem"
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                />
                <div>
                  <div className="font-serif text-xl font-bold text-navy-900 dark:text-white leading-tight">
                    INDEPENDENTE
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    An Independent Citizens Network
                  </div>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Think. Stand. Build. · Mag-isip. Manindigan. Magpanday.
              </p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                For the People. For Peace. For the Nation.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                Civic Ecosystem
              </h3>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li>
                  <button type="button" onClick={() => handleNav('media')} className="hover:text-navy-900 dark:hover:text-white cursor-pointer">
                    Multi-Publication Media Center
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNav('advocacy')} className="hover:text-navy-900 dark:hover:text-white cursor-pointer">
                    Advocacy &amp; Mobilizations
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNav('network')} className="hover:text-navy-900 dark:hover:text-white cursor-pointer">
                    Organization Hub &amp; Collaborations
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNav('events')} className="hover:text-navy-900 dark:hover:text-white cursor-pointer">
                    Events &amp; Activities
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                Operations &amp; Governance
              </h3>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li>
                  <button type="button" onClick={() => handleNav('operations')} className="hover:text-navy-900 dark:hover:text-white cursor-pointer">
                    Operations Center (OP-01 – OP-06)
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNav('workspace')} className="hover:text-navy-900 dark:hover:text-white cursor-pointer">
                    My Participation Workspace
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNav('isanguni')} className="hover:text-crimson-600 font-medium cursor-pointer">
                    Citizen Isanguni Portal
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNav('partner-portal')} className="hover:text-navy-900 dark:hover:text-white cursor-pointer">
                    Partner Organization Portal
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNav('contact')} className="hover:text-navy-900 dark:hover:text-white cursor-pointer">
                    About &amp; Secretariat Contact
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Safeguards &amp; Data Privacy
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                INDEPENDENTE operates in compliance with the Philippine Data Privacy Act of 2012
                (Republic Act No. 10173). Citizen Isanguni is an independent civic platform—not a
                law enforcement agency or 911 emergency responder.
              </p>
              <a
                href="/api/documents/download/privacy-protocol"
                className="inline-flex items-center gap-1 text-xs font-semibold text-navy-900 dark:text-slate-200 hover:underline"
              >
                Download RA 10173 Protocol <ArrowRight className="w-3 h-3" />
              </a>
              <div className="pt-1">
                <PWAInstallButton variant="footer" />
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span>© {new Date().getFullYear()} INDEPENDENTE — An Independent Citizens Network. Nonpartisan &amp; Citizen-Centered.</span>
            <span>English &amp; Filipino Civic Discourse</span>
          </div>
        </div>
      </footer>

      {/* Unified Public Search Modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-start justify-center pt-16 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Unified public search"
        >
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="search"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search publications, advocacy areas, campaigns, partner organizations, or events..."
                className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
                className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-4 space-y-5 text-sm">
              {!searchQuery.trim() && (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
                  Searches public publications, advocacy priorities, partner profiles, events, and
                  announcements. Confidential Citizen Isanguni cases and private partner records are
                  never indexed.
                </p>
              )}

              {searching && (
                <p className="text-xs text-slate-500 py-4 text-center">Searching network index...</p>
              )}

              {searchResults && !searching && (
                <>
                  {searchResults.publications.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Publications
                      </h4>
                      <div className="space-y-1.5">
                        {searchResults.publications.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleNav('media', p.slug)}
                            className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-3 cursor-pointer"
                          >
                            <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                              {p.title}
                            </span>
                            <span className="text-xs text-slate-500 shrink-0">{p.categorySlug}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.advocacy.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Advocacy Areas
                      </h4>
                      <div className="space-y-1.5">
                        {searchResults.advocacy.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => handleNav('advocacy', a.slug)}
                            className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            {a.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.organizations.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Partner Organizations
                      </h4>
                      <div className="space-y-1.5">
                        {searchResults.organizations.map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => handleNav('network', o.slug)}
                            className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-3 cursor-pointer"
                          >
                            <span>{o.name}</span>
                            <span className="text-xs text-slate-500">{o.geographicCoverage}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.events.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Events &amp; Activities
                      </h4>
                      <div className="space-y-1.5">
                        {searchResults.events.map((ev) => (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => handleNav('events', ev.slug)}
                            className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-3 cursor-pointer"
                          >
                            <span>{ev.title}</span>
                            <span className="text-xs font-mono text-slate-500">{ev.startAt}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.publications.length === 0 &&
                    searchResults.advocacy.length === 0 &&
                    searchResults.organizations.length === 0 &&
                    searchResults.events.length === 0 && (
                      <p className="text-sm text-slate-500 text-center py-6">
                        No public records matched "{searchQuery}".
                      </p>
                    )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <OfflineIndicator />
    </div>
  );
};
