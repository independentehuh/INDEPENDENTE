import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Calendar,
  Flag,
  FolderKanban,
  Handshake,
  MessageSquare,
  Newspaper,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { SharedProjectWorkspace } from '../components/SharedProjectWorkspace.tsx';
import { OrgAnnouncementsChat } from '../components/OrgAnnouncementsChat.tsx';
import { PageRoute } from '../types/index.ts';

interface OperationsCenterPageProps {
  onNavigate: (page: PageRoute, slug?: string) => void;
}

interface DivisionMetric {
  label: string;
  value: number;
}

interface DivisionData {
  code: string;
  name: string;
  leadRole: string;
  mandate: string;
  metrics: DivisionMetric[];
  targetPage: PageRoute;
  highlights: string[];
}

interface AuditSummaryItem {
  id: number;
  action: string;
  entityType: string;
  actorRole: string;
  createdAt: string;
}

const DIVISION_ICONS: Record<string, React.FC<{ className?: string }>> = {
  'OP-01': Newspaper,
  'OP-02': Flag,
  'OP-03': Building2,
  'OP-04': Handshake,
  'OP-05': Calendar,
  'OP-06': ShieldAlert,
};

const COLLAB_DIVISION_CODES = new Set(['OP-02', 'OP-03', 'OP-04']);

export const OperationsCenterPage: React.FC<OperationsCenterPageProps> = ({ onNavigate }) => {
  const { idToken, partnerToken } = useAuth();
  const activeToken = idToken || partnerToken;

  const [centerView, setCenterView] = useState<'divisions' | 'shared-projects' | 'org-comms'>('divisions');
  const [divisions, setDivisions] = useState<DivisionData[]>([]);
  const [selectedCode, setSelectedCode] = useState<string>('OP-01');
  const [auditSummary, setAuditSummary] = useState<AuditSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const headers: Record<string, string> = activeToken ? { Authorization: `Bearer ${activeToken}` } : {};
        const res = await fetch('/api/operations/overview', { headers });
        if (res.ok) {
          const data = await res.json();
          setDivisions(data.divisions || []);
          setAuditSummary(data.recentAuditSummary || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [activeToken]);

  const activeDivision = divisions.find((d) => d.code === selectedCode) || divisions[0];

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-widest text-crimson-600 dark:text-red-400">
              Central Network Governance · Six Operational Divisions
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-navy-900 dark:text-white">
              Operations Center
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              INDEPENDENTE coordinates independent media newsrooms, civic advocacy and mobilizations,
              autonomous organizations, institutional partnerships, public assemblies, and Citizen
              Isanguni safeguards across six designated operational divisions under Central Secretariat
              oversight.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('workspace')}
              className="px-4 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
            >
              Open My Workspace
            </button>
            <button
              type="button"
              onClick={() => onNavigate('admin')}
              className="px-4 py-2 text-xs font-semibold bg-navy-900 text-white rounded-md hover:bg-navy-800 cursor-pointer whitespace-nowrap"
            >
              Central Secretariat Console
            </button>
          </div>
        </div>

        {/* Operations Center View Switcher */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCenterView('divisions')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md border cursor-pointer whitespace-nowrap ${
              centerView === 'divisions'
                ? 'bg-navy-900 text-white border-navy-900 dark:border-slate-400'
                : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Operational Divisions (OP-01 – OP-06)
          </button>
          <button
            type="button"
            onClick={() => setCenterView('shared-projects')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md border cursor-pointer whitespace-nowrap ${
              centerView === 'shared-projects'
                ? 'bg-navy-900 text-white border-navy-900 dark:border-slate-400'
                : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <FolderKanban className="w-3.5 h-3.5" />
            Shared Project Workspace
          </button>
          <button
            type="button"
            onClick={() => setCenterView('org-comms')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md border cursor-pointer whitespace-nowrap ${
              centerView === 'org-comms'
                ? 'bg-navy-900 text-white border-navy-900 dark:border-slate-400'
                : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Announcements &amp; Group Chat
          </button>
        </div>
      </div>

      {centerView === 'shared-projects' ? (
        <SharedProjectWorkspace onNavigate={onNavigate} />
      ) : centerView === 'org-comms' ? (
        <OrgAnnouncementsChat onNavigate={onNavigate} />
      ) : loading ? (
        <div className="py-16 text-center text-sm text-slate-500">
          Loading operational divisions...
        </div>
      ) : (
        <>
          {/* Division Grid */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {divisions.map((div) => {
              const Icon = DIVISION_ICONS[div.code] || Building2;
              const isSelected = activeDivision?.code === div.code;
              return (
                <div
                  key={div.code}
                  className={`p-6 rounded-lg border transition-colors flex flex-col justify-between space-y-4 ${
                    isSelected
                      ? 'border-navy-900 dark:border-slate-400 bg-slate-50/70 dark:bg-slate-900'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-mono font-semibold text-crimson-600 dark:text-red-400">
                        {div.code}
                      </span>
                      <Icon className="w-4 h-4 text-navy-900 dark:text-slate-300" />
                    </div>
                    <h2 className="font-serif text-xl font-semibold text-navy-900 dark:text-white">
                      {div.name}
                    </h2>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Designated Lead: {div.leadRole}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {div.mandate}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {div.metrics.slice(0, 2).map((m) => (
                        <div key={m.label}>
                          <div className="text-slate-500 truncate">{m.label}</div>
                          <div className="font-mono text-base font-semibold text-navy-900 dark:text-white tabular-nums">
                            {m.value}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setSelectedCode(div.code)}
                        className="text-xs font-semibold text-navy-900 dark:text-slate-200 hover:underline cursor-pointer"
                      >
                        Inspect Division Dashboard
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate(div.targetPage)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-crimson-600 dark:text-red-400 hover:underline cursor-pointer"
                      >
                        Open Portal <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>

          {/* Active Division Detailed Dashboard */}
          {activeDivision && (
            <section className="p-8 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/60 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
                <div>
                  <div className="font-mono text-xs font-semibold text-crimson-600 dark:text-red-400">
                    {activeDivision.code} · Division Dashboard &amp; Activity Summary
                  </div>
                  <h2 className="font-serif text-2xl font-semibold text-navy-900 dark:text-white mt-1">
                    {activeDivision.name}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Authority &amp; Oversight: {activeDivision.leadRole} · Central Secretariat Oversight Active
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {activeDivision.code === 'OP-03' && (
                    <button
                      type="button"
                      onClick={() => setCenterView('org-comms')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border border-navy-900 dark:border-slate-400 text-navy-900 dark:text-white rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Announcements &amp; Group Chat
                    </button>
                  )}
                  {COLLAB_DIVISION_CODES.has(activeDivision.code) && (
                    <button
                      type="button"
                      onClick={() => setCenterView('shared-projects')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border border-navy-900 dark:border-slate-400 text-navy-900 dark:text-white rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                    >
                      <FolderKanban className="w-3.5 h-3.5" />
                      Open Shared Project Workspace
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onNavigate(activeDivision.targetPage)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-navy-900 text-white rounded-md hover:bg-navy-800 cursor-pointer whitespace-nowrap"
                  >
                    Launch {activeDivision.name} Module <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                {activeDivision.metrics.map((m) => (
                  <div
                    key={m.label}
                    className="p-4 border border-slate-200 dark:border-slate-800 rounded-md"
                  >
                    <div className="text-xs text-slate-500">{m.label}</div>
                    <div className="font-mono text-2xl font-semibold text-navy-900 dark:text-white tabular-nums mt-1">
                      {activeDivision.code === 'OP-06' && m.label === 'Access Mode'
                        ? m.value === 1
                          ? 'Authorized'
                          : 'Restricted'
                        : m.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Active Division Directory &amp; Operational Records
                </h3>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {activeDivision.highlights.length === 0 ? (
                    <li className="py-2 text-slate-500">No active entries recorded yet.</li>
                  ) : (
                    activeDivision.highlights.map((h, i) => (
                      <li key={i} className="py-2.5 text-slate-700 dark:text-slate-300">
                        {h}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </section>
          )}

          {/* Staff Operational Activity Ledger */}
          {auditSummary.length > 0 && (
            <section className="p-6 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-navy-900 dark:text-slate-200" />
                <h3 className="font-serif text-lg font-semibold text-navy-900 dark:text-white">
                  Recent Cross-Division Secretariat Activity Log
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2 pr-3">Action</th>
                      <th className="py-2 pr-3">Entity</th>
                      <th className="py-2 pr-3">Authority Role</th>
                      <th className="py-2">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {auditSummary.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2 pr-3 font-mono">{item.action}</td>
                        <td className="py-2 pr-3">{item.entityType}</td>
                        <td className="py-2 pr-3">{item.actorRole}</td>
                        <td className="py-2 font-mono tabular-nums text-slate-500">
                          {new Date(item.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};
