import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ResponsiveBar } from '@nivo/bar';
import TopAppBar from '../components/TopAppBar';
import api from '../lib/api';

const NIVO_THEME = {
  background: 'transparent',
  text: { fontSize: 11, fill: '#6e6444', fontFamily: "'Outfit', sans-serif" },
  axis: {
    ticks: { text: { fill: '#6e6444', fontSize: 10, fontWeight: 700 } },
    legend: { text: { fill: '#56423e', fontSize: 12, fontWeight: 800 } },
  },
  grid: { line: { stroke: '#e8e0d4', strokeWidth: 1, strokeDasharray: '4 4' } },
  tooltip: {
    container: { background: '#fdf7ef', borderRadius: '16px', boxShadow: '4px 4px 0 0 #6e6444', border: '2px solid #6e6444', padding: '10px 14px', fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 700, fontSize: 12 },
  },
};

export default function ResultsPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [session, setSession] = useState(null);
  const [benchmark, setBenchmark] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resResults, resSession, resBench] = await Promise.all([
          api.get(`/api/sessions/${sessionId}/results`).catch(() => ({ data: {} })),
          api.get(`/api/sessions/${sessionId}`).catch(() => ({ data: {} })),
          api.get(`/api/sessions/${sessionId}/benchmark`).catch(() => ({ data: null })),
        ]);
        setResults(resResults.data);
        setSession(resSession.data);
        setBenchmark(resBench.data);
      } catch (err) {
        console.error('[Results] Failed to load:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="bg-surface min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined text-outline text-6xl animate-spin">progress_activity</span>
      </div>
    );
  }

  const summary = results?.summary;
  const weeks = results?.weeks || [];
  const gameMode = session?.game_mode || 'pricing';
  const isClassic = gameMode === 'classic';
  const efficiency = benchmark?.efficiency || 0;

  const barData = weeks.map(w => ({
    week: `W${w.week_number}`,
    revenue: w.week_revenue,
  }));

  return (
    <div className="bg-primary min-h-screen text-on-surface pb-32">
      <TopAppBar />
      <main className="pt-28 px-8 max-w-6xl mx-auto">
        {/* Title */}
        <div className="text-center mb-12 animate-slide-up">
          <h1 className="text-white text-4xl font-black uppercase tracking-tight drop-shadow-[0_4px_0_#802918] font-headline">
            Season Complete
          </h1>
          <div className="flex items-center justify-center gap-3 mt-3">
            <span className="text-primary-fixed-dim/80 font-medium text-sm">
              {summary?.weeks_played || 0} weeks • {session?.hotel_type === 'resort' ? 'Resort' : 'City Hotel'}
            </span>
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
              isClassic ? 'bg-white/15 text-white' : 'bg-tertiary/80 text-white'
            }`}>
              {isClassic ? 'Classic' : 'Pricing'}
            </span>
          </div>
        </div>

        {/* Key Metrics */}
        {summary && (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 animate-slide-up" style={{ animationDelay: '0.05s' }}>
            <MetricCard label="Total Revenue" value={`$${summary.total_revenue?.toLocaleString() || 0}`} icon="payments" accent="tertiary" />
            <MetricCard label="Avg Occupancy" value={`${summary.avg_occupancy || 0}%`} icon="hotel" accent="secondary" />
            <MetricCard label="Best Week" value={`W${summary.best_week}`} sub={`$${summary.best_week_revenue?.toLocaleString() || 0}`} icon="emoji_events" accent="secondary" />
            <MetricCard
              label={isClassic ? 'Accepted' : 'Booked'}
              value={`${summary.total_guests_booked || 0}`}
              sub={`${summary.total_cancellations + summary.total_no_shows} lost`}
              icon="group"
              accent="primary"
            />
          </section>
        )}

        {/* AI Benchmark Banner */}
        {benchmark && benchmark.ai_revenue > 0 && (
          <section className="mb-12 animate-slide-up" style={{ animationDelay: '0.1s' }} data-tutorial="ai-benchmark">
            <div className="bg-surface-container rounded-[2rem] shadow-[0_6px_0_0_#dbdad7] p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-tertiary/10 rounded-2xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-tertiary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-outline">AI Benchmark Comparison</p>
                    <p className="text-sm font-medium text-on-surface-variant">
                      You earned <span className="font-black text-tertiary">${benchmark.player_revenue.toLocaleString()}</span> vs AI's <span className="font-black text-primary">${benchmark.ai_revenue.toLocaleString()}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-16 h-16 rounded-2xl border-4 flex items-center justify-center ${
                    efficiency >= 80 ? 'border-tertiary bg-tertiary/5' : efficiency >= 60 ? 'border-amber-500 bg-amber-50' : 'border-error bg-error/5'
                  }`}>
                    <span className={`text-xl font-black font-headline ${
                      efficiency >= 80 ? 'text-tertiary' : efficiency >= 60 ? 'text-amber-600' : 'text-error'
                    }`}>{efficiency}%</span>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-black ${efficiency >= 80 ? 'text-tertiary' : efficiency >= 60 ? 'text-amber-600' : 'text-error'}`}>
                      {efficiency >= 90 ? 'Excellent!' : efficiency >= 80 ? 'Great' : efficiency >= 60 ? 'Good' : 'Room to grow'}
                    </p>
                    <p className="text-[10px] text-outline font-medium">Score vs AI</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Revenue Chart (Nivo) */}
        {weeks.length > 0 && (
          <section className="mb-12 animate-slide-up" style={{ animationDelay: '0.15s' }}>
            <h2 className="text-white text-xl font-black uppercase tracking-tight mb-4 font-headline flex items-center gap-2">
              <span className="material-symbols-outlined text-white/60" style={{ fontVariationSettings: "'FILL' 1" }}>bar_chart</span>
              Revenue by Week
            </h2>
            <div className="bg-surface-container p-6 rounded-[2rem] shadow-[0_6px_0_0_#dbdad7]">
              <div className="h-56">
                <ResponsiveBar
                  data={barData}
                  keys={['revenue']}
                  indexBy="week"
                  theme={NIVO_THEME}
                  margin={{ top: 10, right: 20, bottom: 40, left: 65 }}
                  padding={0.35}
                  colors={['#3b6934']}
                  borderRadius={8}
                  axisBottom={{ tickSize: 0, tickPadding: 10 }}
                  axisLeft={{ tickSize: 0, tickPadding: 10, format: v => `$${v.toLocaleString()}` }}
                  labelSkipWidth={20}
                  labelSkipHeight={16}
                  labelTextColor="#fff"
                  label={d => `$${d.value.toLocaleString()}`}
                />
              </div>
              <div className="mt-3 pt-3 border-t border-outline/10 flex items-center justify-between">
                <span className="text-xs font-bold text-outline uppercase">Season Total</span>
                <span className="text-2xl font-black text-tertiary font-headline">${summary?.total_revenue?.toLocaleString() || 0}</span>
              </div>
            </div>
          </section>
        )}

        {/* Guest Stats */}
        {summary && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <StatCard
              icon="check_circle" iconColor="text-tertiary" bg="bg-tertiary-container/50"
              label={isClassic ? 'Guests Accepted' : 'Guests Booked'}
              value={summary.total_guests_booked}
            />
            <StatCard
              icon={isClassic ? 'person_off' : 'block'} iconColor="text-on-secondary-container" bg="bg-secondary-container/50"
              label={isClassic ? 'Rejected / Timed Out' : 'Turned Away'}
              value={summary.total_guests_turned_away}
            />
            <StatCard
              icon="cancel" iconColor="text-error" bg="bg-error-container/50"
              label="Cancellations + No-Shows"
              value={summary.total_cancellations + summary.total_no_shows}
            />
          </section>
        )}

        {/* Classic Mode: Decision Quality */}
        {isClassic && summary && (
          <section className="mb-12 animate-slide-up" style={{ animationDelay: '0.25s' }}>
            <h2 className="text-white text-xl font-black uppercase tracking-tight mb-4 font-headline">Decision Quality</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface-container p-6 rounded-[2rem] shadow-[0_6px_0_0_#dbdad7]">
                <p className="text-[10px] font-black text-outline uppercase tracking-wider mb-3">Acceptance Rate</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-black text-tertiary font-headline">
                    {summary.total_guests_booked + summary.total_guests_turned_away > 0
                      ? Math.round((summary.total_guests_booked / (summary.total_guests_booked + summary.total_guests_turned_away)) * 100)
                      : 0}%
                  </span>
                  <span className="text-xs text-outline font-medium mb-1">of guests accepted</span>
                </div>
                <p className="text-xs text-outline mt-3 leading-relaxed">
                  {summary.total_guests_booked + summary.total_guests_turned_away > 0 && (
                    (summary.total_guests_booked / (summary.total_guests_booked + summary.total_guests_turned_away)) > 0.7
                      ? 'You accepted most guests — good for occupancy but watch out for overbooking risk.'
                      : (summary.total_guests_booked / (summary.total_guests_booked + summary.total_guests_turned_away)) < 0.3
                        ? 'Very selective! You rejected many guests — this only works if you targeted high-value ones.'
                        : 'Balanced approach — you were selective while maintaining decent volume.'
                  )}
                </p>
              </div>
              <div className="bg-surface-container p-6 rounded-[2rem] shadow-[0_6px_0_0_#dbdad7]">
                <p className="text-[10px] font-black text-outline uppercase tracking-wider mb-3">Revenue per Decision</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-black text-primary font-headline">
                    ${summary.total_guests_booked > 0
                      ? Math.round(summary.total_revenue / summary.total_guests_booked)
                      : 0}
                  </span>
                  <span className="text-xs text-outline font-medium mb-1">avg per accepted</span>
                </div>
                <p className="text-xs text-outline mt-3 leading-relaxed">
                  This measures how well you selected high-value guests. Higher means you picked guests that generated more revenue per booking.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Actions */}
        <section className="flex justify-center gap-4 mt-8 flex-wrap animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <button
            className="bg-white text-primary text-sm font-black px-8 py-4 rounded-2xl shadow-[0_5px_0_0_#dbdad7] active:translate-y-1 active:shadow-none transition-all uppercase tracking-widest font-headline flex items-center gap-2 hover:-translate-y-0.5"
            onClick={() => navigate(`/session/${sessionId}/kpis`)}
            data-tutorial="kpi-revpar"
          >
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
            KPI Dashboard
          </button>
          <button
            className="bg-secondary-container text-on-secondary-container text-sm font-black px-8 py-4 rounded-2xl shadow-[0_5px_0_0_#6e6444] active:translate-y-1 active:shadow-none transition-all uppercase tracking-widest font-headline flex items-center gap-2 hover:-translate-y-0.5"
            onClick={() => navigate(`/session/${sessionId}/insights`)}
            data-tutorial="strategy-profile"
          >
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
            Strategy Insights
          </button>
          <button
            className="bg-white/10 text-white text-sm font-black px-8 py-4 rounded-2xl shadow-[0_5px_0_0_rgba(0,0,0,0.15)] active:translate-y-1 active:shadow-none transition-all uppercase tracking-widest font-headline flex items-center gap-2 hover:-translate-y-0.5 hover:bg-white/20"
            onClick={() => navigate('/dashboard')}
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Dashboard
          </button>
        </section>
      </main>
    </div>
  );
}

function MetricCard({ label, value, sub, icon, accent }) {
  const colors = {
    tertiary: { bg: 'bg-white/15', icon: 'text-white/80' },
    secondary: { bg: 'bg-white/10', icon: 'text-white/70' },
    primary: { bg: 'bg-white/10', icon: 'text-white/70' },
  };
  const c = colors[accent] || colors.secondary;

  return (
    <div className={`${c.bg} backdrop-blur-sm px-5 py-4 rounded-2xl flex items-center gap-4`}>
      <span className={`material-symbols-outlined text-2xl ${c.icon}`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      <div>
        <p className="text-[9px] uppercase font-bold text-white/50 tracking-wider">{label}</p>
        <p className="text-lg font-black text-white leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-white/40 font-medium">{sub}</p>}
      </div>
    </div>
  );
}

function StatCard({ icon, iconColor, bg, label, value }) {
  return (
    <div className={`${bg} p-6 rounded-[2rem] shadow-[0_6px_0_0_rgba(0,0,0,0.08)] flex items-center gap-4`}>
      <span className={`material-symbols-outlined text-3xl ${iconColor}`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      <div>
        <p className="text-[10px] uppercase font-black opacity-60 tracking-wider">{label}</p>
        <p className="text-2xl font-black">{value}</p>
      </div>
    </div>
  );
}
