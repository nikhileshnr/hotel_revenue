import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TopAppBar from '../components/TopAppBar';
import api from '../lib/api';

const TIER_DISPLAY = {
  standard: { label: 'Standard', icon: 'bed', color: 'bg-blue-100 text-blue-800' },
  mid: { label: 'Mid-Range', icon: 'king_bed', color: 'bg-amber-100 text-amber-800' },
  premium: { label: 'Premium', icon: 'spa', color: 'bg-purple-100 text-purple-800' },
  suite: { label: 'Suite', icon: 'villa', color: 'bg-rose-100 text-rose-800' },
};

const PRICING_TABS = [
  { id: 'summary', icon: 'analytics', label: 'Summary' },
  { id: 'pricing', icon: 'sell', label: 'Pricing vs WTP' },
  { id: 'segments', icon: 'groups', label: 'Segments' },
  { id: 'optimal', icon: 'trending_up', label: 'Optimal Strategy' },
];

const CLASSIC_TABS = [
  { id: 'summary', icon: 'analytics', label: 'Summary' },
  { id: 'decisions', icon: 'person_search', label: 'Decision Analysis' },
  { id: 'segments', icon: 'groups', label: 'Segments' },
  { id: 'risk', icon: 'shield', label: 'Risk Assessment' },
];

export default function InsightsPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('summary');
  const [insights, setInsights] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resInsights, resSession] = await Promise.all([
          api.get(`/api/sessions/${sessionId}/insights`).catch(() => ({ data: {} })),
          api.get(`/api/sessions/${sessionId}`).catch(() => ({ data: {} })),
        ]);
        setInsights(resInsights.data);
        setSession(resSession.data);
      } catch (err) {
        console.error('[Insights] Failed:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [sessionId]);

  const gameMode = session?.game_mode || 'pricing';
  const isClassic = gameMode === 'classic';
  const tabs = isClassic ? CLASSIC_TABS : PRICING_TABS;

  return (
    <div className="bg-background font-body text-on-surface flex overflow-hidden h-screen">
      {/* Sidebar Navigation */}
      <aside className="hidden md:flex flex-col p-6 gap-4 h-screen w-72 border-r-4 border-outline/20 bg-surface-container-low shadow-[6px_0px_0px_0px_rgba(212,212,210,1)] z-40">
        <div className="mb-8">
          <h1 className="text-xl font-extrabold text-primary font-headline">Educational Insights</h1>
          <p className="text-xs font-bold text-outline uppercase tracking-tighter">
            {isClassic ? 'Decision Strategy Analysis' : 'Pricing Strategy Analysis'}
          </p>
          {isClassic && (
            <div className="mt-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">person_search</span>
              Classic Mode
            </div>
          )}
        </div>
        <nav className="flex flex-col gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-full font-bold font-headline text-sm transition-all duration-150 ${
                activeTab === tab.id
                  ? 'bg-primary text-white shadow-[4px_4px_0px_0px_#2a1410] translate-x-1'
                  : 'text-on-surface-variant hover:bg-surface-container-highest hover:scale-[1.02]'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="material-symbols-outlined">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-6 flex flex-col gap-4">
          <button
            className="flex items-center gap-2 p-3 bg-surface-container-highest rounded-full hover:bg-surface-variant transition-colors"
            onClick={() => navigate(`/session/${sessionId}/results`)}
          >
            <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
            <span className="text-xs font-bold text-on-surface-variant">Back to Results</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <TopAppBar />
        <div className="flex-1 overflow-y-auto p-8 pt-28 space-y-8 pb-24">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <span className="material-symbols-outlined text-outline text-6xl animate-spin">progress_activity</span>
            </div>
          ) : (
            <>
              {/* Shared tabs */}
              {activeTab === 'summary' && <SummaryTab insights={insights} isClassic={isClassic} />}
              {activeTab === 'segments' && <SegmentsTab insights={insights} />}

              {/* Pricing-only tabs */}
              {activeTab === 'pricing' && <PricingTab insights={insights} />}
              {activeTab === 'optimal' && <OptimalTab insights={insights} />}

              {/* Classic-only tabs */}
              {activeTab === 'decisions' && <DecisionAnalysisTab insights={insights} />}
              {activeTab === 'risk' && <RiskAssessmentTab insights={insights} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Summary Tab ────────────────────────────────────────────────────────

function SummaryTab({ insights, isClassic }) {
  if (!insights) return <EmptyState />;

  const PROFILE_ICONS = {
    'Volume Maximizer': 'speed',
    'Yield Optimizer': 'diamond',
    'Adaptive Learner': 'school',
    'Risk Taker': 'casino',
    'Balanced Strategist': 'balance',
  };

  const trendIcon = (trend) => trend === 'improving' ? '📈' : trend === 'declining' ? '📉' : '➡️';

  return (
    <>
      {/* Key Metrics */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-tertiary-container p-6 rounded-xl shadow-[6px_6px_0px_0px_#1a5a4c] flex flex-col justify-between h-36">
          <span className="text-on-tertiary-container font-bold uppercase text-[10px] tracking-widest">Guests Seen</span>
          <div className="flex items-end justify-between">
            <span className="text-4xl font-black text-on-tertiary-container">{insights.totalGuests || '—'}</span>
            <span className="material-symbols-outlined text-3xl text-on-tertiary-container/40">group</span>
          </div>
        </div>
        <div className="bg-secondary-container p-6 rounded-xl shadow-[6px_6px_0px_0px_#56423e] flex flex-col justify-between h-36">
          <span className="text-on-secondary-container font-bold uppercase text-[10px] tracking-widest">
            {isClassic ? 'Accept Rate' : 'Booking Rate'}
          </span>
          <div className="flex items-end justify-between">
            <span className="text-4xl font-black text-on-secondary-container">{insights.bookingRate || '—'}%</span>
            <span className="material-symbols-outlined text-3xl text-on-secondary-container/40">check_circle</span>
          </div>
        </div>
        <div className="bg-primary-container p-6 rounded-xl shadow-[6px_6px_0px_0px_#802918] flex flex-col justify-between h-36">
          <span className="text-on-primary-container font-bold uppercase text-[10px] tracking-widest">Avg Occupancy {trendIcon(insights.occTrend)}</span>
          <div className="flex items-end justify-between">
            <span className="text-4xl font-black text-on-primary-container">{insights.avgOccupancy || '—'}%</span>
            <span className="material-symbols-outlined text-3xl text-on-primary-container/40">hotel</span>
          </div>
        </div>
        <div className="bg-tertiary-container p-6 rounded-xl shadow-[6px_6px_0px_0px_#1a5a4c] flex flex-col justify-between h-36">
          <span className="text-on-tertiary-container font-bold uppercase text-[10px] tracking-widest">Revenue Efficiency {trendIcon(insights.revTrend)}</span>
          <div className="flex items-end justify-between">
            <span className="text-4xl font-black text-on-tertiary-container">{insights.revenueEfficiency || '—'}%</span>
            <span className="material-symbols-outlined text-3xl text-on-tertiary-container/40">trending_up</span>
          </div>
        </div>
      </section>

      {/* Strategy Profile & Takeaway */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-secondary-container p-6 rounded-xl shadow-[6px_6px_0px_0px_#56423e] border-l-8 border-secondary">
          <h2 className="text-xl font-black mb-3 uppercase font-headline text-on-secondary-container">Your Strategy Profile</h2>
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-secondary-fixed-dim flex items-center justify-center shadow-[4px_4px_0px_0px_#56423e] shrink-0">
              <span className="material-symbols-outlined text-4xl text-secondary">
                {PROFILE_ICONS[insights.strategyProfile] || 'balance'}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-secondary">{insights.strategyProfile || 'Balanced Strategist'}</h3>
              <p className="text-on-secondary-container/80 font-medium text-sm leading-snug">{insights.strategyDescription}</p>
            </div>
          </div>
        </div>
        <div className="bg-tertiary p-6 rounded-xl shadow-[6px_6px_0px_0px_#002201] text-white flex flex-col justify-center relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-20">
            <span className="material-symbols-outlined text-[100px]">lightbulb</span>
          </div>
          <h2 className="text-[10px] uppercase font-black tracking-widest mb-2 text-tertiary-fixed">Key Takeaway</h2>
          <p className="text-lg font-bold leading-snug">{insights.keyTakeaway}</p>
        </div>
      </section>

      {/* Loss breakdown */}
      {(insights.totalCancellations > 0 || insights.totalNoShows > 0) && (
        <section className="bg-surface-container-low p-5 rounded-xl shadow-[4px_4px_0px_0px_#dbdad7] flex items-center gap-6">
          <span className="material-symbols-outlined text-error text-3xl">warning</span>
          <div>
            <p className="font-black text-sm text-on-surface">Revenue Leakage</p>
            <p className="text-xs text-outline">
              {insights.totalCancellations} cancellations + {insights.totalNoShows} no-shows
              ({insights.cancellationRate}% cancellation rate).
              {insights.cancellationRate > 20 && ' This is above the industry average of ~20%.'}
            </p>
          </div>
        </section>
      )}
    </>
  );
}

// ─── Decision Analysis Tab (Classic Mode) ────────────────────────────────

function DecisionAnalysisTab({ insights }) {
  if (!insights) return <EmptyState />;

  const acceptRate = insights.bookingRate || 0;
  const totalDecisions = insights.totalBooked + insights.totalTurnedAway;

  return (
    <>
      <h2 className="text-2xl font-black font-headline text-on-surface uppercase tracking-tight">
        Accept/Reject Decision Analysis
      </h2>
      <p className="text-outline text-sm font-bold -mt-4 mb-4">
        How effectively did you evaluate each guest's value before deciding?
      </p>

      {/* Decision funnel */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-tertiary-container p-6 rounded-[2rem] shadow-[0_8px_0_0_#1a5a4c] text-center">
          <span className="material-symbols-outlined text-on-tertiary-container text-4xl mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
          <p className="text-[10px] uppercase font-black text-on-tertiary-container/60 tracking-wider">Total Guests</p>
          <p className="text-4xl font-black text-on-tertiary-container">{insights.totalGuests || 0}</p>
        </div>
        <div className="bg-secondary-container p-6 rounded-[2rem] shadow-[0_8px_0_0_#6e6444] text-center">
          <span className="material-symbols-outlined text-on-secondary-container text-4xl mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <p className="text-[10px] uppercase font-black text-on-secondary-container/60 tracking-wider">Accepted</p>
          <p className="text-4xl font-black text-on-secondary-container">{insights.totalBooked || 0}</p>
          <p className="text-xs font-bold text-on-secondary-container/60 mt-1">{acceptRate}% accept rate</p>
        </div>
        <div className="bg-primary-container p-6 rounded-[2rem] shadow-[0_8px_0_0_#802918] text-center">
          <span className="material-symbols-outlined text-on-primary-container text-4xl mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>block</span>
          <p className="text-[10px] uppercase font-black text-on-primary-container/60 tracking-wider">Rejected / Timed Out</p>
          <p className="text-4xl font-black text-on-primary-container">{insights.totalTurnedAway || 0}</p>
        </div>
      </section>

      {/* Post-decision outcomes */}
      <section className="bg-surface-container-low p-6 rounded-[2rem] shadow-[0_8px_0_0_#dbdad7]">
        <h3 className="font-black text-sm text-on-surface uppercase tracking-wider mb-4">What Happened After You Accepted</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-tertiary/10 p-4 rounded-xl text-center">
            <p className="text-3xl font-black text-tertiary">
              {(insights.totalBooked || 0) - (insights.totalCancellations || 0) - (insights.totalNoShows || 0)}
            </p>
            <p className="text-[9px] font-bold text-outline uppercase mt-1">Checked Out ✅</p>
          </div>
          <div className="bg-amber-100 p-4 rounded-xl text-center">
            <p className="text-3xl font-black text-amber-700">{insights.totalCancellations || 0}</p>
            <p className="text-[9px] font-bold text-outline uppercase mt-1">Cancelled ⚠️</p>
          </div>
          <div className="bg-error/10 p-4 rounded-xl text-center">
            <p className="text-3xl font-black text-error">{insights.totalNoShows || 0}</p>
            <p className="text-[9px] font-bold text-outline uppercase mt-1">No-Show ❌</p>
          </div>
        </div>
        <p className="text-xs text-outline mt-4">
          💡 In classic mode, choosing which guests to accept is your key lever. High-risk guests (high cancel/no-show probability) can erode your revenue even when accepted.
        </p>
      </section>

      {/* ADR Distribution — still useful for classic mode */}
      {insights.adrDistribution && (
        <section className="bg-surface-container-low p-6 rounded-[2rem] shadow-[0_8px_0_0_#dbdad7]">
          <h3 className="font-black text-sm text-on-surface uppercase tracking-wider mb-4">Guest Revenue Distribution</h3>
          <div className="flex items-end gap-1 h-40">
            {Object.entries(insights.adrDistribution)
              .sort((a, b) => Number(a[0]) - Number(b[0]))
              .map(([bucket, count]) => {
                const maxCount = Math.max(...Object.values(insights.adrDistribution), 1);
                const pct = (count / maxCount) * 100;
                return (
                  <div key={bucket} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[7px] font-bold text-outline">{count}</span>
                    <div className="w-full bg-tertiary/40 rounded-t-md" style={{ height: `${pct}%`, minHeight: '2px' }} />
                    <span className="text-[7px] font-bold text-outline">${bucket}</span>
                  </div>
                );
              })}
          </div>
          <p className="text-[10px] text-outline mt-2">ADR per night — higher bars = more guests at that price point</p>
        </section>
      )}
    </>
  );
}

// ─── Risk Assessment Tab (Classic Mode) ──────────────────────────────────

function RiskAssessmentTab({ insights }) {
  if (!insights) return <EmptyState />;

  const lossRate = insights.cancellationRate + (insights.totalNoShows > 0 ? Math.round((insights.totalNoShows / Math.max(1, insights.totalBooked)) * 100 * 10) / 10 : 0);

  return (
    <>
      <h2 className="text-2xl font-black font-headline text-on-surface uppercase tracking-tight">
        Risk Assessment
      </h2>
      <p className="text-outline text-sm font-bold -mt-4 mb-4">
        How well did you manage booking risk? In classic mode, evaluating cancel/no-show probability is crucial.
      </p>

      {/* Risk overview */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface-container-low p-6 rounded-[2rem] shadow-[0_8px_0_0_#dbdad7]">
          <h3 className="font-black text-sm text-on-surface uppercase tracking-wider mb-4">Cancellation Rate</h3>
          <div className="flex items-center gap-6">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center ${
              insights.cancellationRate > 25 ? 'bg-error/20' : insights.cancellationRate > 15 ? 'bg-amber-100' : 'bg-tertiary/20'
            }`}>
              <span className={`text-3xl font-black ${
                insights.cancellationRate > 25 ? 'text-error' : insights.cancellationRate > 15 ? 'text-amber-700' : 'text-tertiary'
              }`}>{insights.cancellationRate || 0}%</span>
            </div>
            <div>
              <p className="text-sm font-bold text-on-surface">
                {insights.cancellationRate > 25
                  ? 'High cancellation rate'
                  : insights.cancellationRate > 15
                    ? 'Moderate cancellation rate'
                    : 'Low cancellation rate'
                }
              </p>
              <p className="text-xs text-outline mt-1">
                {insights.cancellationRate > 25
                  ? 'You accepted too many high-risk guests. Look for non-refundable deposit types and low cancel probabilities.'
                  : insights.cancellationRate > 15
                    ? 'Room for improvement. Consider the cancel probability shown on each guest card before accepting.'
                    : 'Excellent risk management! You successfully filtered out high-cancellation guests.'
                }
              </p>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-low p-6 rounded-[2rem] shadow-[0_8px_0_0_#dbdad7]">
          <h3 className="font-black text-sm text-on-surface uppercase tracking-wider mb-4">Total Loss Rate</h3>
          <div className="flex items-center gap-6">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center ${
              lossRate > 30 ? 'bg-error/20' : lossRate > 20 ? 'bg-amber-100' : 'bg-tertiary/20'
            }`}>
              <span className={`text-3xl font-black ${
                lossRate > 30 ? 'text-error' : lossRate > 20 ? 'text-amber-700' : 'text-tertiary'
              }`}>{Math.round(lossRate)}%</span>
            </div>
            <div>
              <p className="text-sm font-bold text-on-surface">Cancellations + No-Shows combined</p>
              <p className="text-xs text-outline mt-1">
                Of the guests you accepted, {Math.round(lossRate)}% didn't generate full revenue. Industry benchmark is typically 15-20%.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Educational section */}
      <section className="bg-tertiary p-8 rounded-[2rem] shadow-[0_8px_0_0_#1a5a4c] text-white">
        <h3 className="text-sm font-black uppercase tracking-widest mb-3 text-tertiary-fixed">Risk Management in Revenue Management</h3>
        <div className="space-y-3 font-medium leading-relaxed">
          <p>
            In real hotel revenue management, <strong>overbooking</strong> is a common strategy to compensate for expected cancellations and no-shows.
            Hotels intentionally accept more bookings than they have rooms, betting that some guests won't show up.
          </p>
          <p>
            The key indicators on each guest card help you make informed decisions:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><strong>Cancel Probability</strong> — guests with high cancel rates waste room-nights you could've sold to others</li>
            <li><strong>No-Show Probability</strong> — worse than cancellations since you get zero revenue and zero notice</li>
            <li><strong>Risk Badge</strong> (Low/Medium/High) — a quick composite score combining both risks</li>
            <li><strong>Expected Value</strong> — revenue × (1 - cancel probability) — the risk-adjusted worth of accepting</li>
            <li><strong>Deposit Type</strong> — non-refundable deposits recover some revenue even on cancellation</li>
          </ul>
        </div>
      </section>
    </>
  );
}

// ─── Pricing vs WTP Tab (Pricing Mode only) ─────────────────────────────

function PricingTab({ insights }) {
  if (!insights?.tierAdrDistribution) return <EmptyState />;

  const tiers = insights.tierAdrDistribution;

  return (
    <>
      <h2 className="text-2xl font-black font-headline text-on-surface uppercase tracking-tight">
        Market Willingness to Pay (WTP) by Room Tier
      </h2>
      <p className="text-outline text-sm font-bold -mt-4 mb-4">
        Shows what guests were willing to pay per tier. Compare against your pricing to understand demand capture.
      </p>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(tiers).map(([tierName, stats]) => {
          const display = TIER_DISPLAY[tierName];
          const optimal = insights.optimalPrices?.[tierName] || 0;
          return (
            <div key={tierName} className="bg-surface-container-low p-6 rounded-[2rem] shadow-[0_8px_0_0_#dbdad7]">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 ${display.color} rounded-xl flex items-center justify-center`}>
                  <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>{display.icon}</span>
                </div>
                <div>
                  <h3 className="font-black text-sm text-on-surface">{display.label}</h3>
                  <p className="text-[9px] text-outline font-bold">{stats.count} guests in pool</p>
                </div>
              </div>

              {/* WTP Range Bar */}
              <div className="mb-3">
                <div className="flex justify-between text-[9px] font-bold text-outline uppercase mb-1">
                  <span>Min: ${stats.min}</span>
                  <span>Median: ${stats.median}</span>
                  <span>Max: ${stats.max}</span>
                </div>
                <div className="relative h-4 bg-surface-container-highest rounded-full overflow-hidden">
                  <div className="absolute h-full bg-tertiary/30 rounded-full" style={{ width: '100%' }} />
                  {optimal > 0 && (
                    <div
                      className="absolute top-0 w-1.5 h-full bg-tertiary rounded-full shadow-md"
                      style={{
                        left: `${Math.min(100, Math.max(0, ((optimal - stats.min) / Math.max(1, stats.max - stats.min)) * 100))}%`,
                      }}
                      title={`Optimal: $${optimal}`}
                    />
                  )}
                </div>
                <div className="flex justify-between text-[8px] text-outline mt-1">
                  <span>Avg WTP: ${stats.avg}</span>
                  <span className="text-tertiary font-black">Optimal: ${optimal}/night</span>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* ADR Distribution Histogram */}
      {insights.adrDistribution && (
        <section className="bg-surface-container-low p-6 rounded-[2rem] shadow-[0_8px_0_0_#dbdad7]">
          <h3 className="font-black text-sm text-on-surface uppercase tracking-wider mb-4">Guest Budget Distribution (All Tiers)</h3>
          <div className="flex items-end gap-1 h-40">
            {Object.entries(insights.adrDistribution)
              .sort((a, b) => Number(a[0]) - Number(b[0]))
              .map(([bucket, count]) => {
                const maxCount = Math.max(...Object.values(insights.adrDistribution), 1);
                const pct = (count / maxCount) * 100;
                return (
                  <div key={bucket} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[7px] font-bold text-outline">{count}</span>
                    <div className="w-full bg-tertiary/40 rounded-t-md" style={{ height: `${pct}%`, minHeight: '2px' }} />
                    <span className="text-[7px] font-bold text-outline">${bucket}</span>
                  </div>
                );
              })}
          </div>
        </section>
      )}
    </>
  );
}

// ─── Segments Tab (shared) ──────────────────────────────────────────────

function SegmentsTab({ insights }) {
  if (!insights?.segments) return <EmptyState />;

  const segments = Object.entries(insights.segments).sort((a, b) => b[1].count - a[1].count);
  const maxCount = Math.max(...segments.map(([, s]) => s.count), 1);

  const SEGMENT_COLORS = {
    'Direct': 'bg-tertiary',
    'Corporate': 'bg-blue-500',
    'Online TA': 'bg-amber-500',
    'Offline TA/TO': 'bg-orange-500',
    'Groups': 'bg-purple-500',
    'Aviation': 'bg-sky-500',
    'Complementary': 'bg-gray-400',
  };

  return (
    <>
      <h2 className="text-2xl font-black font-headline text-on-surface uppercase tracking-tight">
        Market Segment Breakdown
      </h2>
      <p className="text-outline text-sm font-bold -mt-4 mb-4">
        Shows guest distribution by market segment and their average willingness to pay.
      </p>

      <section className="space-y-4">
        {segments.map(([seg, data]) => {
          const pct = (data.count / maxCount) * 100;
          const barColor = SEGMENT_COLORS[seg] || 'bg-on-surface-variant';
          return (
            <div key={seg} className="bg-surface-container-low p-5 rounded-2xl shadow-[0_6px_0_0_#dbdad7]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-black text-sm text-on-surface">{seg}</h3>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-bold text-outline">{data.count} guests</span>
                  <span className="text-xs font-black text-tertiary">Avg WTP: ${data.avgAdr}</span>
                </div>
              </div>
              <div className="h-4 bg-surface-container-highest rounded-full overflow-hidden">
                <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}

// ─── Optimal Strategy Tab (Pricing Mode only) ───────────────────────────

function OptimalTab({ insights }) {
  if (!insights?.optimalPrices) return <EmptyState />;

  return (
    <>
      <h2 className="text-2xl font-black font-headline text-on-surface uppercase tracking-tight">
        Revenue-Maximizing Prices
      </h2>
      <p className="text-outline text-sm font-bold -mt-4 mb-4">
        These are the per-night prices that would have maximized total revenue given the guest demand pool.
      </p>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(insights.optimalPrices).map(([tierName, optPrice]) => {
          const display = TIER_DISPLAY[tierName];
          const tierData = insights.tierAdrDistribution?.[tierName];
          return (
            <div key={tierName} className="bg-surface-container-low p-6 rounded-[2rem] shadow-[0_8px_0_0_#dbdad7]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 ${display.color} rounded-xl flex items-center justify-center`}>
                    <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{display.icon}</span>
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-on-surface">{display.label}</h3>
                    <p className="text-[9px] text-outline font-bold">{tierData?.count || 0} guests in market</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-tertiary">${optPrice}</p>
                  <p className="text-[8px] text-outline font-bold uppercase">optimal per night</p>
                </div>
              </div>

              {tierData && (
                <div className="bg-surface-container-highest p-3 rounded-xl clay-inset-shadow">
                  <div className="flex justify-between text-[9px] font-bold">
                    <span className="text-outline">Market range: ${tierData.min} – ${tierData.max}</span>
                    <span className="text-outline">Median WTP: ${tierData.median}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Educational Explanation */}
      <section className="bg-tertiary p-8 rounded-[2rem] shadow-[0_8px_0_0_#1a5a4c] text-white">
        <h3 className="text-sm font-black uppercase tracking-widest mb-3 text-tertiary-fixed">How Optimal Pricing Works</h3>
        <p className="font-medium leading-relaxed">
          The optimal price for each tier is calculated by finding the price point that maximizes
          <strong> total revenue = price × number of guests willing to pay that price</strong>.
          Setting prices too high loses volume; too low leaves money on the table.
          The sweet spot balances occupancy with yield — this is the core of revenue management.
        </p>
      </section>
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-outline">
      <span className="material-symbols-outlined text-6xl mb-4">info</span>
      <p className="font-bold text-sm uppercase tracking-widest">No data available yet</p>
    </div>
  );
}
