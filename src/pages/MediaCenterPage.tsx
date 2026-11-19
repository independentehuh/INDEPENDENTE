import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  Copy,
  FilePlus2,
  Handshake,
  Newspaper,
  Plus,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { MediaOutlet, Publication, PublicationCategory } from '../types/index.ts';
import { MediaImage } from '../components/MediaImage.tsx';
import { useAuth } from '../context/AuthContext.tsx';

interface MediaCenterPageProps {
  categories: PublicationCategory[];
  initialSlug?: string;
  correctionPolicy?: string;
}

interface EditorialWorkspacePayload {
  outlet: MediaOutlet;
  yourRole: string;
  articles: Publication[];
  members: Array<{
    id: number;
    email: string;
    displayName: string;
    editorialRole: string;
    isActive: boolean;
  }>;
  collaborations: Array<{
    id: number;
    publicationId: number;
    leadOutletId: number;
    partnerOutletId: number;
    collaborationNote: string;
    status: string;
  }>;
}

export const MediaCenterPage: React.FC<MediaCenterPageProps> = ({
  categories,
  initialSlug,
  correctionPolicy,
}) => {
  const { idToken, partnerToken, dbUser } = useAuth();
  const activeToken = idToken || partnerToken;

  const [outlets, setOutlets] = useState<MediaOutlet[]>([]);
  const [selectedOutletSlug, setSelectedOutletSlug] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [publications, setPublications] = useState<Publication[]>([]);
  const [activeArticle, setActiveArticle] = useState<Publication | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  // Multi-publication admin & isolated editorial dashboard state
  const [showCreateOutlet, setShowCreateOutlet] = useState(false);
  const [outletForm, setOutletForm] = useState({
    name: '',
    abbreviation: '',
    logoUrl: '/assets/aistudio/Kampus_Independente_logo__1__80e86dcb.jpg',
    coverImageUrl: '/assets/aistudio/Kampus_Independente_logo_856d9f00.png',
    description: '',
    editorialMission: '',
    category: 'Community & Grassroots',
    primaryAudience: 'Citizens & Community Partners',
    editorialContact: '',
    socialLinks: '',
    adminEmail: '',
    assignedTeamText: '',
    status: 'Active',
  });
  const [editorialWorkspace, setEditorialWorkspace] = useState<EditorialWorkspacePayload | null>(null);
  const [editorialError, setEditorialError] = useState('');
  const [notice, setNotice] = useState('');

  // Editorial desk compose & team forms
  const [articleForm, setArticleForm] = useState({
    title: '',
    subheadline: '',
    categorySlug: 'news',
    bodyMarkdown: '',
    referencesText: '',
    tags: '',
    status: 'review',
    coOutletId: '',
  });
  const [memberForm, setMemberForm] = useState({
    displayName: '',
    email: '',
    editorialRole: 'Staff Writer',
  });
  const [collabForm, setCollabForm] = useState({
    publicationId: '',
    partnerOutletId: '',
    collaborationNote: '',
  });

  const canRegisterOutlet =
    dbUser && ['super_admin', 'secretariat_admin', 'editor_in_chief'].includes(dbUser.roleSlug);

  const notify = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 5000);
  };

  const loadOutlets = async () => {
    const res = await fetch('/api/media/outlets');
    if (res.ok) setOutlets(await res.json());
  };

  const loadList = async (
    cat = selectedCategory,
    q = searchQuery,
    tag = selectedTag,
    outletSlug = selectedOutletSlug
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (cat && cat !== 'all') params.set('category', cat);
      if (outletSlug && outletSlug !== 'all') params.set('outletSlug', outletSlug);
      if (q.trim()) params.set('q', q.trim());
      if (tag.trim()) params.set('tag', tag.trim());
      const res = await fetch(`/api/publications?${params.toString()}`);
      if (res.ok) setPublications(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const openArticle = async (slug: string) => {
    const res = await fetch(`/api/publications/${encodeURIComponent(slug)}`);
    if (res.ok) {
      setActiveArticle(await res.json());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const openEditorialDesk = async (outletId: number) => {
    setEditorialError('');
    if (!activeToken) {
      setEditorialError('Sign in to access this publication editorial dashboard.');
      return;
    }
    const res = await fetch(`/api/media/outlets/${outletId}/editorial`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    const data = await res.json();
    if (!res.ok) {
      setEditorialError(data.error || 'Access denied to this editorial workspace.');
      setEditorialWorkspace(null);
    } else {
      setEditorialWorkspace(data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    loadOutlets();
  }, []);

  useEffect(() => {
    loadList();
  }, [selectedCategory, selectedTag, selectedOutletSlug]);

  useEffect(() => {
    if (initialSlug) {
      if (initialSlug.startsWith('editorial-')) {
        const oid = Number(initialSlug.replace('editorial-', ''));
        if (oid && activeToken) openEditorialDesk(oid);
      } else {
        openArticle(initialSlug);
      }
    }
  }, [initialSlug, activeToken]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadList();
  };

  const handleCopyShareLink = async (slug: string) => {
    const shareUrl = `${window.location.origin}/?page=media&slug=${encodeURIComponent(slug)}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback ignored
    }
  };

  const selectedOutletObj = outlets.find((o) => o.slug === selectedOutletSlug) || null;

  // 1. Scoped Publication Editorial Dashboard
  if (editorialWorkspace) {
    const { outlet, yourRole, articles, members, collaborations } = editorialWorkspace;
    const otherOutlets = outlets.filter((o) => o.id !== outlet.id);

    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <button
              type="button"
              onClick={() => setEditorialWorkspace(null)}
              className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-navy-900 mb-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Multi-Publication Newsroom
            </button>
            <div className="text-xs font-mono text-crimson-600 dark:text-red-400">
              {outlet.abbreviation} · Isolated Publication Editorial Dashboard · Role: {yourRole}
            </div>
            <h1 className="font-serif text-3xl font-semibold text-navy-900 dark:text-white mt-1">
              {outlet.name} — Editorial Desk
            </h1>
          </div>
          <div className="grid grid-cols-3 gap-4 text-xs border border-slate-200 dark:border-slate-800 rounded-md p-3">
            <div>
              <div className="text-slate-500">Articles</div>
              <div className="font-mono text-lg font-semibold tabular-nums">{articles.length}</div>
            </div>
            <div>
              <div className="text-slate-500">Editorial Team</div>
              <div className="font-mono text-lg font-semibold tabular-nums">{members.length}</div>
            </div>
            <div>
              <div className="text-slate-500">Collaborations</div>
              <div className="font-mono text-lg font-semibold tabular-nums">{collaborations.length}</div>
            </div>
          </div>
        </div>

        {notice && (
          <div className="p-3 rounded border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 text-sm text-emerald-900 dark:text-emerald-200">
            {notice}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Compose Article for This Outlet */}
          <div className="lg:col-span-5 space-y-6">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await fetch(`/api/media/outlets/${outlet.id}/articles`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${activeToken}`,
                  },
                  body: JSON.stringify(articleForm),
                });
                if (res.ok) {
                  setArticleForm({
                    title: '',
                    subheadline: '',
                    categorySlug: 'news',
                    bodyMarkdown: '',
                    referencesText: '',
                    tags: '',
                    status: 'review',
                    coOutletId: '',
                  });
                  notify('Manuscript recorded under this publication.');
                  openEditorialDesk(outlet.id);
                  loadList();
                }
              }}
              className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3"
            >
              <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
                <FilePlus2 className="w-4 h-4" /> Submit Manuscript to {outlet.abbreviation}
              </h2>
              <input
                required
                placeholder="Headline"
                value={articleForm.title}
                onChange={(e) => setArticleForm({ ...articleForm, title: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-transparent"
              />
              <input
                required
                placeholder="Subheadline / Deck"
                value={articleForm.subheadline}
                onChange={(e) => setArticleForm({ ...articleForm, subheadline: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-transparent"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={articleForm.categorySlug}
                  onChange={(e) => setArticleForm({ ...articleForm, categorySlug: e.target.value })}
                  className="px-2.5 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                >
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={articleForm.status}
                  onChange={(e) => setArticleForm({ ...articleForm, status: e.target.value })}
                  className="px-2.5 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                >
                  <option value="draft">Draft</option>
                  <option value="review">Submit for Review</option>
                  <option value="published">Publish (Editor-in-Chief / Admin)</option>
                </select>
              </div>
              <select
                value={articleForm.coOutletId}
                onChange={(e) => setArticleForm({ ...articleForm, coOutletId: e.target.value })}
                className="w-full px-2.5 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
              >
                <option value="">Single-Publication Story (No Co-Publisher)</option>
                {otherOutlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    Co-Publish with {o.name}
                  </option>
                ))}
              </select>
              <textarea
                required
                rows={4}
                placeholder="Body text (separate paragraphs with blank lines)"
                value={articleForm.bodyMarkdown}
                onChange={(e) => setArticleForm({ ...articleForm, bodyMarkdown: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-transparent"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-navy-900 text-white rounded cursor-pointer"
              >
                Save Manuscript
              </button>
            </form>

            {/* Editorial Team Assignment */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await fetch(`/api/media/outlets/${outlet.id}/members`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${activeToken}`,
                  },
                  body: JSON.stringify(memberForm),
                });
                if (res.ok) {
                  setMemberForm({ displayName: '', email: '', editorialRole: 'Staff Writer' });
                  notify('Editorial team member added.');
                  openEditorialDesk(outlet.id);
                }
              }}
              className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3"
            >
              <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
                <Users className="w-4 h-4" /> Assign Editorial Team Member
              </h2>
              <input
                required
                placeholder="Full Name"
                value={memberForm.displayName}
                onChange={(e) => setMemberForm({ ...memberForm, displayName: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-transparent"
              />
              <input
                required
                type="email"
                placeholder="Email"
                value={memberForm.email}
                onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-transparent"
              />
              <select
                value={memberForm.editorialRole}
                onChange={(e) => setMemberForm({ ...memberForm, editorialRole: e.target.value })}
                className="w-full px-2.5 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
              >
                <option>Publication Administrator</option>
                <option>Editor-in-Chief</option>
                <option>Managing Editor</option>
                <option>Staff Writer</option>
                <option>Fact-checker</option>
                <option>Contributor</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded cursor-pointer"
              >
                Add Team Member
              </button>
            </form>
          </div>

          {/* Right: Outlet Queue, Team & Co-Publishing */}
          <div className="lg:col-span-7 space-y-6">
            <section className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
              <h2 className="font-serif text-lg font-semibold">
                {outlet.name} — Manuscripts &amp; Published Stories
              </h2>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {articles.map((a) => (
                  <div key={a.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-slate-500">
                        {a.categorySlug} · Status: <strong>{a.status}</strong> · {a.viewCount} reads
                      </div>
                      <div className="font-semibold text-sm">{a.title}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
              <h2 className="font-serif text-lg font-semibold">Assigned Editorial Roster</h2>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {members.map((m) => (
                  <div key={m.id} className="py-2 flex items-center justify-between">
                    <span>
                      <strong>{m.displayName}</strong> ({m.email})
                    </span>
                    <span className="font-medium text-navy-900 dark:text-slate-200">
                      {m.editorialRole}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4">
              <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
                <Handshake className="w-4 h-4" /> Inter-Publication Editorial Collaboration
              </h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const res = await fetch(`/api/media/outlets/${outlet.id}/collaborations`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${activeToken}`,
                    },
                    body: JSON.stringify(collabForm),
                  });
                  if (res.ok) {
                    setCollabForm({ publicationId: '', partnerOutletId: '', collaborationNote: '' });
                    notify('Co-publishing proposal sent.');
                    openEditorialDesk(outlet.id);
                  }
                }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs"
              >
                <select
                  required
                  value={collabForm.publicationId}
                  onChange={(e) => setCollabForm({ ...collabForm, publicationId: e.target.value })}
                  className="px-2.5 py-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                >
                  <option value="">Select Story</option>
                  {articles.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
                <select
                  required
                  value={collabForm.partnerOutletId}
                  onChange={(e) => setCollabForm({ ...collabForm, partnerOutletId: e.target.value })}
                  className="px-2.5 py-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                >
                  <option value="">Partner Publication</option>
                  {otherOutlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="px-3 py-2 font-semibold bg-navy-900 text-white rounded cursor-pointer"
                >
                  Propose Co-Publishing
                </button>
              </form>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {collaborations.map((c) => (
                  <div key={c.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <div>
                        Story #{c.publicationId} · Status: <strong>{c.status}</strong>
                      </div>
                      <div className="text-slate-500">{c.collaborationNote}</div>
                    </div>
                    {c.partnerOutletId === outlet.id && c.status === 'Proposed' && (
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch(`/api/media/collaborations/${c.id}`, {
                            method: 'PATCH',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${activeToken}`,
                            },
                            body: JSON.stringify({ status: 'Accepted' }),
                          });
                          openEditorialDesk(outlet.id);
                        }}
                        className="px-3 py-1 bg-emerald-700 text-white rounded cursor-pointer"
                      >
                        Accept Co-Publishing
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  // 2. Article Reader View
  if (activeArticle) {
    const tags = (activeArticle.tags || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    return (
      <div className="max-w-[1040px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <button
          type="button"
          onClick={() => setActiveArticle(null)}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Media &amp; Publications Center
        </button>

        <article className="space-y-6">
          <header className="space-y-4 border-b border-slate-200 dark:border-slate-800 pb-6">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
              {activeArticle.outletName && (
                <>
                  <span className="font-semibold text-navy-900 dark:text-white">
                    {activeArticle.outletName}
                    {activeArticle.coOutletName ? ` × ${activeArticle.coOutletName}` : ''}
                  </span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <span className="font-semibold uppercase tracking-wider text-crimson-600 dark:text-red-400">
                {activeArticle.categorySlug.replace(/-/g, ' ')}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{activeArticle.publishedAt}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{activeArticle.viewCount} reads</span>
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-navy-900 dark:text-white leading-tight headline-balance">
              {activeArticle.title}
            </h1>

            <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
              {activeArticle.subheadline}
            </p>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 text-sm">
              <div>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {activeArticle.authorName}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {' '}
                  — {activeArticle.authorRole}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopyShareLink(activeArticle.slug)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink ? 'Link Copied' : 'Copy Shareable Link'}
              </button>
            </div>
          </header>

          {activeArticle.correctionNote && (
            <div className="p-4 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/30 text-sm text-amber-950 dark:text-amber-200">
              <strong className="font-semibold">Correction &amp; Clarification Note:</strong>{' '}
              {activeArticle.correctionNote}
            </div>
          )}

          {activeArticle.featuredImageUrl && (
            <figure className="space-y-2">
              <div className="aspect-[16/9] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
                <MediaImage
                  src={activeArticle.featuredImageUrl}
                  alt={activeArticle.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <figcaption className="text-xs text-slate-500 dark:text-slate-400 italic">
                {activeArticle.subheadline}
              </figcaption>
            </figure>
          )}

          <div className="max-w-prose space-y-5 text-base leading-[1.8] text-slate-800 dark:text-slate-200">
            {activeArticle.bodyMarkdown.split('\n\n').map((para, idx) => (
              <p
                key={idx}
                className={
                  idx === 0
                    ? 'first-letter:text-5xl first-letter:font-serif first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:text-navy-900 dark:first-letter:text-white'
                    : ''
                }
              >
                {para}
              </p>
            ))}
          </div>

          {activeArticle.referencesText && (
            <section className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                References &amp; Primary Sources
              </h2>
              <div className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-line leading-relaxed">
                {activeArticle.referencesText}
              </div>
            </section>
          )}

          {tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 pt-4 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Keywords:</span>
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    setSelectedTag(tag);
                    setActiveArticle(null);
                  }}
                  className="hover:text-navy-900 dark:hover:text-white underline underline-offset-4 cursor-pointer"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {activeArticle.related && activeArticle.related.length > 0 && (
            <section className="pt-8 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
                Related Publications
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {activeArticle.related.map((rel) => (
                  <button
                    key={rel.id}
                    type="button"
                    onClick={() => openArticle(rel.slug)}
                    className="text-left p-4 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 space-y-1.5 cursor-pointer"
                  >
                    <div className="text-xs text-slate-500">{rel.publishedAt}</div>
                    <div className="font-serif text-base font-semibold text-slate-900 dark:text-white">
                      {rel.title}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </article>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      {/* Newsroom Masthead Banner */}
      <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-navy-950">
        <img
          src="/assets/aistudio/Kampus_Independente_logo_856d9f00.png"
          alt="INDEPENDENTE Publication Masthead — Think. Stand. Build."
          referrerPolicy="no-referrer"
          className="w-full max-h-56 object-cover object-center"
        />
      </div>

      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-widest text-crimson-600 dark:text-red-400">
            OP-01: Multi-Publication Media Operations
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-navy-900 dark:text-white">
            Media &amp; Publications Center
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
            Explore independent civic publications across our network—including national desks,
            investigative reviews, campus journalism, and grassroots community correspondence.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full lg:w-80">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search headlines, authors..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 focus:outline-none focus:border-navy-900"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-semibold bg-navy-900 text-white rounded-md hover:bg-navy-800 cursor-pointer"
            >
              Search
            </button>
          </form>
          {canRegisterOutlet && (
            <button
              type="button"
              onClick={() => setShowCreateOutlet((v) => !v)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-crimson-600 text-white rounded-md hover:bg-crimson-700 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Create New Publication
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 text-sm text-emerald-900 dark:text-emerald-200">
          {notice}
        </div>
      )}
      {editorialError && (
        <div className="p-3 rounded border border-red-300 bg-red-50 text-sm text-red-700">
          {editorialError}
        </div>
      )}

      {/* Administrative Function: CREATE NEW PUBLICATION */}
      {showCreateOutlet && canRegisterOutlet && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await fetch('/api/media/outlets', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify(outletForm),
            });
            if (res.ok) {
              setShowCreateOutlet(false);
              setOutletForm({
                name: '',
                abbreviation: '',
                logoUrl: '/assets/aistudio/Kampus_Independente_logo__1__80e86dcb.jpg',
                coverImageUrl: '/assets/aistudio/Kampus_Independente_logo_856d9f00.png',
                description: '',
                editorialMission: '',
                category: 'Community & Grassroots',
                primaryAudience: 'Citizens & Community Partners',
                editorialContact: '',
                socialLinks: '',
                adminEmail: '',
                assignedTeamText: '',
                status: 'Active',
              });
              notify('New independent publication registered and editorial dashboard provisioned.');
              loadOutlets();
            }
          }}
          className="p-6 border border-navy-900/30 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
              Create New Publication (OP-01 Registration)
            </h2>
            <button
              type="button"
              onClick={() => setShowCreateOutlet(false)}
              className="text-xs text-slate-500 hover:underline cursor-pointer"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <input
              required
              placeholder="Publication Name *"
              value={outletForm.name}
              onChange={(e) => setOutletForm({ ...outletForm, name: e.target.value })}
              className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
            />
            <input
              required
              placeholder="Abbreviation (e.g., VISAYAS-DESK) *"
              value={outletForm.abbreviation}
              onChange={(e) => setOutletForm({ ...outletForm, abbreviation: e.target.value })}
              className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
            />
            <select
              value={outletForm.category}
              onChange={(e) => setOutletForm({ ...outletForm, category: e.target.value })}
              className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
            >
              <option>National Civic News</option>
              <option>Investigative &amp; Policy</option>
              <option>Campus &amp; Youth Press</option>
              <option>Community &amp; Grassroots</option>
              <option>Sectoral &amp; Research</option>
            </select>
            <input
              required
              placeholder="Primary Audience *"
              value={outletForm.primaryAudience}
              onChange={(e) => setOutletForm({ ...outletForm, primaryAudience: e.target.value })}
              className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
            />
            <input
              required
              placeholder="Editorial Contact Email *"
              value={outletForm.editorialContact}
              onChange={(e) => setOutletForm({ ...outletForm, editorialContact: e.target.value })}
              className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
            />
            <input
              placeholder="Publication Administrator Email"
              value={outletForm.adminEmail}
              onChange={(e) => setOutletForm({ ...outletForm, adminEmail: e.target.value })}
              className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
            />
            <input
              placeholder="Logo URL (optional)"
              value={outletForm.logoUrl}
              onChange={(e) => setOutletForm({ ...outletForm, logoUrl: e.target.value })}
              className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
            />
            <input
              placeholder="Cover Image URL (optional)"
              value={outletForm.coverImageUrl}
              onChange={(e) => setOutletForm({ ...outletForm, coverImageUrl: e.target.value })}
              className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
            />
            <input
              placeholder="Social Links (optional)"
              value={outletForm.socialLinks}
              onChange={(e) => setOutletForm({ ...outletForm, socialLinks: e.target.value })}
              className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <textarea
              required
              rows={2}
              placeholder="Publication Description *"
              value={outletForm.description}
              onChange={(e) => setOutletForm({ ...outletForm, description: e.target.value })}
              className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
            />
            <textarea
              required
              rows={2}
              placeholder="Editorial Mission *"
              value={outletForm.editorialMission}
              onChange={(e) => setOutletForm({ ...outletForm, editorialMission: e.target.value })}
              className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <input
              placeholder="Assigned Editorial Team Emails (comma-separated)"
              value={outletForm.assignedTeamText}
              onChange={(e) => setOutletForm({ ...outletForm, assignedTeamText: e.target.value })}
              className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
            />
            <select
              value={outletForm.status}
              onChange={(e) => setOutletForm({ ...outletForm, status: e.target.value })}
              className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
            >
              <option value="Active">Active</option>
              <option value="Editorial Review">Editorial Review</option>
            </select>
          </div>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-semibold bg-navy-900 text-white rounded cursor-pointer"
          >
            Register Publication
          </button>
        </form>
      )}

      {/* Registered Publications Showcase (Multi-Publication Directory) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-crimson-600" /> Network Publications &amp; Independent Desks
          </h2>
          {selectedOutletSlug !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedOutletSlug('all')}
              className="text-xs font-semibold text-crimson-600 hover:underline cursor-pointer"
            >
              Show Stories from All Publications
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {outlets.map((o) => {
            const active = selectedOutletSlug === o.slug;
            return (
              <div
                key={o.id}
                className={`p-5 rounded-lg border flex flex-col justify-between space-y-3 transition-colors ${
                  active
                    ? 'border-navy-900 dark:border-slate-400 bg-slate-50 dark:bg-slate-900'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                    <span>{o.abbreviation}</span>
                    <span>{o.status}</span>
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-navy-900 dark:text-white leading-snug">
                    {o.name}
                  </h3>
                  <div className="text-xs text-crimson-600 dark:text-red-400 font-medium">
                    {o.category}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                    {o.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-500 font-mono tabular-nums">
                    <span>{o.publishedCount || 0} published</span>
                    <span>{o.totalReads || 0} reads</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedOutletSlug(active ? 'all' : o.slug)}
                      className="font-semibold text-navy-900 dark:text-slate-200 hover:underline cursor-pointer"
                    >
                      {active ? 'Viewing Outlet' : 'Read Outlet'}
                    </button>
                    {activeToken && (
                      <button
                        type="button"
                        onClick={() => openEditorialDesk(o.id)}
                        className="text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white cursor-pointer"
                      >
                        Editorial Desk →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Publication Identity Banner */}
        {selectedOutletObj && (
          <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/70 dark:bg-slate-900/40 flex flex-col md:flex-row items-start justify-between gap-6">
            <div className="space-y-2 max-w-3xl">
              <div className="text-xs font-mono text-slate-500">
                {selectedOutletObj.abbreviation} · {selectedOutletObj.category} · Audience:{' '}
                {selectedOutletObj.primaryAudience}
              </div>
              <h3 className="font-serif text-2xl font-semibold text-navy-900 dark:text-white">
                {selectedOutletObj.name}
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                <strong>Editorial Mission:</strong> {selectedOutletObj.editorialMission}
              </p>
              <div className="text-xs text-slate-500">
                Contact: {selectedOutletObj.editorialContact}
                {selectedOutletObj.socialLinks ? ` · ${selectedOutletObj.socialLinks}` : ''}
              </div>
            </div>
            {activeToken && (
              <button
                type="button"
                onClick={() => openEditorialDesk(selectedOutletObj.id)}
                className="px-4 py-2 text-xs font-semibold bg-navy-900 text-white rounded-md cursor-pointer shrink-0"
              >
                Open {selectedOutletObj.abbreviation} Editorial Workspace
              </button>
            )}
          </div>
        )}
      </section>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 pb-2">
        <button
          type="button"
          onClick={() => {
            setSelectedCategory('all');
            setSelectedTag('');
          }}
          className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
            selectedCategory === 'all'
              ? 'bg-navy-900 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          All Sections
        </button>
        {categories.map((cat) => (
          <button
            key={cat.slug}
            type="button"
            onClick={() => setSelectedCategory(cat.slug)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              selectedCategory === cat.slug
                ? 'bg-navy-900 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {cat.name}
          </button>
        ))}
        {selectedTag && (
          <button
            type="button"
            onClick={() => setSelectedTag('')}
            className="px-3 py-2 text-xs font-medium text-crimson-600 underline cursor-pointer"
          >
            Clear keyword: {selectedTag}
          </button>
        )}
      </div>

      {/* Articles Grid */}
      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">Loading publications...</div>
      ) : publications.length === 0 ? (
        <div className="py-16 text-center border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
          <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            No published articles matched this filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {publications.map((pub) => (
            <article
              key={pub.id}
              className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900/60 flex flex-col justify-between"
            >
              <div>
                <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <MediaImage
                    src={pub.featuredImageUrl}
                    alt={pub.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-5 space-y-2.5">
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5">
                    {pub.outletName && (
                      <>
                        <span className="font-semibold text-navy-900 dark:text-slate-200">
                          {pub.outletName}
                        </span>
                        <span aria-hidden="true">·</span>
                      </>
                    )}
                    <span className="font-semibold uppercase text-crimson-600 dark:text-red-400">
                      {pub.categorySlug.replace(/-/g, ' ')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{pub.publishedAt}</span>
                  </div>
                  <h2 className="font-serif text-xl font-semibold text-slate-900 dark:text-white leading-snug">
                    <button
                      type="button"
                      onClick={() => openArticle(pub.slug)}
                      className="text-left hover:text-navy-800 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {pub.title}
                    </button>
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                    {pub.subheadline}
                  </p>
                </div>
              </div>
              <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="truncate max-w-[60%]">{pub.authorName}</span>
                <button
                  type="button"
                  onClick={() => openArticle(pub.slug)}
                  className="font-semibold text-navy-900 dark:text-slate-200 hover:underline cursor-pointer shrink-0"
                >
                  Read Article
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Editorial Correction & Clarification Policy */}
      <section className="p-6 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-start gap-4">
        <ShieldCheck className="w-5 h-5 text-navy-900 dark:text-slate-300 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Editorial Independence, Fact-Checking &amp; Correction Policy
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {correctionPolicy ||
              'No submitted manuscript is published automatically without editorial review and source verification. Factual errors are corrected promptly and transparently with an explicit editorial note.'}
          </p>
        </div>
      </section>
    </div>
  );
};
