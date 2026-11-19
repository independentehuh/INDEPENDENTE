import { useEffect, useState } from 'react';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { Layout } from './components/Layout.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { MediaCenterPage } from './pages/MediaCenterPage.tsx';
import { AdvocacyCenterPage } from './pages/AdvocacyCenterPage.tsx';
import { NetworkPage } from './pages/NetworkPage.tsx';
import { EventsPage } from './pages/EventsPage.tsx';
import { PartnerPortalPage } from './pages/PartnerPortalPage.tsx';
import { CitizenIsanguniPage } from './pages/CitizenIsanguniPage.tsx';
import { AboutContactPage } from './pages/AboutContactPage.tsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.tsx';
import { OperationsCenterPage } from './pages/OperationsCenterPage.tsx';
import { MyWorkspacePage } from './pages/MyWorkspacePage.tsx';
import {
  BootstrapData,
  Campaign,
  NetworkEvent,
  Organization,
  PageRoute,
  Publication,
} from './types/index.ts';

function AppShell() {
  const [page, setPage] = useState<PageRoute>('home');
  const [detailSlug, setDetailSlug] = useState<string | undefined>(undefined);

  const [bootstrap, setBootstrap] = useState<BootstrapData>({
    publicationCategories: [],
    citizenCategories: [],
    advocacyAreas: [],
    announcements: [],
    publicDocuments: [],
    settings: {},
  });
  const [publications, setPublications] = useState<Publication[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [events, setEvents] = useState<NetworkEvent[]>([]);

  const loadAllPublicData = async () => {
    try {
      const [bRes, pRes, aRes, oRes, eRes] = await Promise.all([
        fetch('/api/bootstrap'),
        fetch('/api/publications'),
        fetch('/api/advocacy'),
        fetch('/api/organizations'),
        fetch('/api/events'),
      ]);
      if (bRes.ok) setBootstrap(await bRes.json());
      if (pRes.ok) setPublications(await pRes.json());
      if (aRes.ok) {
        const advData = await aRes.json();
        setCampaigns(advData.campaigns || []);
      }
      if (oRes.ok) setOrganizations(await oRes.json());
      if (eRes.ok) setEvents(await eRes.json());
    } catch (err) {
      console.error('Initial data load error:', err);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('page') as PageRoute | null;
    const s = params.get('slug') || undefined;
    if (p) setPage(p);
    if (s) setDetailSlug(s);
    loadAllPublicData();
  }, []);

  const handleNavigate = (nextPage: PageRoute, slug?: string) => {
    setPage(nextPage);
    setDetailSlug(slug);
    const url = new URL(window.location.href);
    url.searchParams.set('page', nextPage);
    if (slug) url.searchParams.set('slug', slug);
    else url.searchParams.delete('slug');
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <Layout currentPage={page} onNavigate={handleNavigate}>
      {page === 'home' && (
        <HomePage
          publications={publications}
          advocacyAreas={bootstrap.advocacyAreas}
          campaigns={campaigns}
          organizations={organizations}
          events={events}
          announcements={bootstrap.announcements}
          onNavigate={handleNavigate}
        />
      )}
      {page === 'media' && (
        <MediaCenterPage
          categories={bootstrap.publicationCategories}
          initialSlug={detailSlug}
          correctionPolicy={bootstrap.settings.correction_policy}
        />
      )}
      {page === 'advocacy' && (
        <AdvocacyCenterPage initialSlug={detailSlug} onNavigate={handleNavigate} />
      )}
      {page === 'network' && <NetworkPage initialSlug={detailSlug} onNavigate={handleNavigate} />}
      {page === 'events' && <EventsPage initialSlug={detailSlug} />}
      {page === 'partner-portal' && <PartnerPortalPage onNavigate={handleNavigate} />}
      {page === 'operations' && <OperationsCenterPage onNavigate={handleNavigate} />}
      {page === 'workspace' && <MyWorkspacePage onNavigate={handleNavigate} />}
      {page === 'isanguni' && (
        <CitizenIsanguniPage categories={bootstrap.citizenCategories} initialTab={detailSlug} />
      )}
      {page === 'about' && (
        <AboutContactPage
          mode="about"
          publicDocuments={bootstrap.publicDocuments}
          correctionPolicy={bootstrap.settings.correction_policy}
        />
      )}
      {page === 'contact' && (
        <AboutContactPage
          mode="contact"
          publicDocuments={bootstrap.publicDocuments}
          correctionPolicy={bootstrap.settings.correction_policy}
        />
      )}
      {page === 'admin' && (
        <AdminDashboardPage
          publicationCategories={bootstrap.publicationCategories}
          onRefreshPublic={loadAllPublicData}
        />
      )}
    </Layout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ThemeProvider>
  );
}
