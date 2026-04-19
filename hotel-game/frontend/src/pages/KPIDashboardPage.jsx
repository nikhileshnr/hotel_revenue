import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ResponsiveLine } from '@nivo/line';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsiveRadar } from '@nivo/radar';
import TopAppBar from '../components/TopAppBar';
import api from '../lib/api';

const KPI_CARDS = [
  { key: 'avg_revpar', label: 'RevPAR', icon: 'payments', prefix: '$', desc: 'Revenue Per Available Room' },
  { key: 'avg_adr', label: 'ADR', icon: 'price_check', prefix: '$', desc: 'Average Daily Rate' },
  { key: 'avg_occupancy', label: 'Occupancy', icon: 'hotel', suffix: '%', desc: 'Average Room Occupancy' },
  { key: 'yield_index', label: 'Yield Index', icon: 'trending_up', suffix: '%', desc: 'Revenue Efficiency' },
];

const NIVO_THEME = {
  background: 'transparent',
  text: { fontSize: 11, fill: '#6e6444', fontFamily: "'Outfit', sans-serif" },
  axis: {
    ticks: { text: { fill: '#6e6444', fontSize: 10, fontWeight: 700 } },
    legend: { text: { fill: '#56423e', fontSize: 12, fontWeight: 800 } },
  },
  grid: { line: { stroke: '#e8e0d4', strokeWidth: 1, strokeDasharray: '4 4' } },
  crosshair: { line: { stroke: '#4a3228', strokeWidth: 1.5 } },
  tooltip: {
    container: { background: '#fdf7ef', borderRadius: '16px', boxShadow: '4px 4px 0 0 #6e6444', border: '2px solid #6e6444', padding: '10px 14px', fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 12 },
  },
};

export default function KPIDashboardPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState(null);
  const [benchmark, setBenchmark] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('trends');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [kpiRes, benchRes] = await Promise.all([
          api.get(`/api/sessions/${sessionId}/kpis`),
          api.get(`/api/sessions/${sessionId}/benchmark`),
        ]);
        setKpis(kpiRes.data);
        setBenchmark(benchRes.data);
      } catch (err) {
        console.error('[KPIDashboard] Failed:', err);
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

  if (!kpis) {
    return (
      <div className="bg-surface min-h-screen flex items-center justify-center">
        <p className="text-on-surface-variant font-bold">No KPI data available</p>
      </div>
    );
  }

  const s = kpis.summary;
  const weeks = kpis.weeks || [];

  // --- Nivo data ---
  const revenueLineData = [
    {
      id: 'Your Revenue',
      color: '#2d6a4f',
      data: weeks.map(w => ({ x: `W${w.week}`, y: w.cumulative })),
    },
  ];
  if (benchmark?.ai_weeks?.length) {
    revenueLineData.push({
      id: 'AI Benchmark',
      color: '#4a3228',
      data: benchmark.ai_weeks.map(w => ({ x: `W${w.week_number}`, y: w.cumulative })),
    });
  }

  const kpiLineData = [
    { id: 'RevPAR', data: weeks.map(w => ({ x: `W${w.week}`, y: w.revpar })) },
    { id: 'ADR', data: weeks.map(w => ({ x: `W${w.week}`, y: w.adr })) },
  ];

  const occupancyBarData = weeks.map(w => ({
    week: `W${w.week}`,
    occupancy: w.occupancy,
    cancellations: w.cancellation_rate,
  }));

  // Radar: performance profile
  const radarData = [
    { metric: 'RevPAR', player: Math.min(100, (s.avg_revpar / (s.avg_adr || 1)) * 100), ai: benchmark ? Math.min(100, (benchmark.ai_weeks.reduce((a, w) => a + w.revpar, 0) / benchmark.ai_weeks.length / (s.avg_adr || 1)) * 100) : 0 },
    { metric: 'Occupancy', player: s.avg_occupancy, ai: benchmark ? benchmark.ai_weeks.reduce((a, w) => a + w.occupancy * 100, 0) / (benchmark.ai_weeks.length || 1) : 0 },
    { metric: 'ADR', player: Math.min(100, (s.avg_adr / 300) * 100), ai: benchmark ? Math.min(100, (benchmark.ai_weeks.reduce((a, w) => a + w.adr, 0) / benchmark.ai_weeks.length / 300) * 100) : 0 },
    { metric: 'Yield', player: Math.min(100, s.yield_index), ai: benchmark ? Math.min(100, s.yield_index * (benchmark.efficiency / 100)) : 0 },
    { metric: 'Guest Quality', player: s.total_checked_out > 0 ? Math.min(100, (s.total_checked_out / s.total_accepted) * 100) : 0, ai: 85 },
  ];

  const segmentBarData = Object.entries(kpis.segments || {}).map(([seg, data]) => ({
    segment: seg.length > 12 ? seg.substring(0, 12) + '…' : seg,
    guests: data.count,
    avgEv: data.avgEv,
  }));

  const TABS = [
    { id: 'trends', icon: 'show_chart', label: 'Trends' },
    { id: 'benchmark', icon: 'smart_toy', label: 'vs AI' },
    { id: 'segments', icon: 'groups', label: 'Segments' },
  ];

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen">
      <TopAppBar />
      <main className="pt-28 px-8 pb-24 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              className="w-12 h-12 bg-surface-container-low rounded-full shadow-[0_4px_0_0_#dbdad7] flex items-center justify-center hover:-translate-y-0.5 transition-all"
              onClick={() => navigate(`/session/${sessionId}/results`)}
            >
              <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
            </button>
            <div>
              <h1 className="text-3xl font-black font-headline text-on-surface-variant uppercase tracking-tighter">KPI Dashboard</h1>
              <p className="text-outline font-bold text-sm">
                {kpis.hotel_type === 'resort' ? '🏖️ Resort' : '🏙️ City'} • {kpis.game_mode === 'classic' ? 'Classic' : 'Pricing'} • {kpis.weeks_played} weeks
              </p>
            </div>
          </div>
          {benchmark && (
            <div className="bg-surface-container-low rounded-[2rem] px-6 py-3 shadow-[0_6px_0_0_#dbdad7] flex items-center gap-3">
              <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-outline">Your Score vs AI</p>
                <p className={`text-2xl font-black font-headline ${benchmark.efficiency >= 80 ? 'text-tertiary' : benchmark.efficiency >= 60 ? 'text-amber-600' : 'text-error'}`}>
                  {benchmark.efficiency}%
                </p>
              </div>
            </div>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {KPI_CARDS.map(card => {
            const val = s[card.key] || 0;
            // Trend arrow
            const firstWeek = weeks[0]?.[card.key === 'avg_revpar' ? 'revpar' : card.key === 'avg_adr' ? 'adr' : card.key === 'avg_occupancy' ? 'occupancy' : 'revpar'] || 0;
            const lastWeek = weeks[weeks.length - 1]?.[card.key === 'avg_revpar' ? 'revpar' : card.key === 'avg_adr' ? 'adr' : card.key === 'avg_occupancy' ? 'occupancy' : 'revpar'] || 0;
            const trend = lastWeek > firstWeek * 1.05 ? 'up' : lastWeek < firstWeek * 0.95 ? 'down' : 'flat';

            return (
              <div key={card.key} className="bg-surface-container-low rounded-[2rem] p-5 shadow-[0_6px_0_0_#dbdad7] flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 bg-tertiary/10 rounded-xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-tertiary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>{card.icon}</span>
                  </div>
                  <span className={`material-symbols-outlined text-sm ${trend === 'up' ? 'text-tertiary' : trend === 'down' ? 'text-error' : 'text-outline'}`}>
                    {trend === 'up' ? 'trending_up' : trend === 'down' ? 'trending_down' : 'trending_flat'}
                  </span>
                </div>
                <p className="text-2xl font-black font-headline text-on-surface-variant">
                  {card.prefix || ''}{typeof val === 'number' ? val.toLocaleString(undefined, { maximumFractionDigits: 1 }) : val}{card.suffix || ''}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-outline">{card.label}</p>
                <p className="text-[9px] text-outline/60 font-medium">{card.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Tab switcher */}
        <div className="bg-surface-container-low rounded-[2rem] p-2 shadow-[0_4px_0_0_#dbdad7] flex gap-2">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`flex-1 py-3 rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                activeTab === tab.id
                  ? 'bg-primary text-white shadow-[0_4px_0_0_#2a1410]'
                  : 'text-on-surface-variant hover:bg-surface-container-highest'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="material-symbols-outlined text-sm" style={activeTab === tab.id ? { fontVariationSettings: "'FILL' 1" } : {}}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'trends' && (
          <div className="space-y-6">
            {/* Revenue trend */}
            <div className="bg-surface-container-low rounded-[2rem] p-6 shadow-[0_8px_0_0_#dbdad7]">
              <h3 className="font-headline font-black text-sm uppercase text-on-surface-variant tracking-wider mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>show_chart</span>
                Cumulative Revenue
              </h3>
              <div className="h-72">
                <ResponsiveLine
                  data={revenueLineData}
                  theme={NIVO_THEME}
                  margin={{ top: 20, right: 110, bottom: 50, left: 70 }}
                  xScale={{ type: 'point' }}
                  yScale={{ type: 'linear', min: 0, max: 'auto' }}
                  curve="monotoneX"
                  axisBottom={{ tickSize: 0, tickPadding: 12, legend: 'Week', legendOffset: 40, legendPosition: 'middle' }}
                  axisLeft={{ tickSize: 0, tickPadding: 12, legend: 'Revenue ($)', legendOffset: -55, legendPosition: 'middle', format: v => `$${v.toLocaleString()}` }}
                  colors={d => d.id === 'AI Benchmark' ? '#4a3228' : '#2d6a4f'}
                  lineWidth={3}
                  pointSize={8}
                  pointColor={{ theme: 'background' }}
                  pointBorderWidth={3}
                  pointBorderColor={{ from: 'serieColor' }}
                  enableArea={true}
                  areaOpacity={0.08}
                  useMesh={true}
                  legends={[
                    { anchor: 'bottom-right', direction: 'column', translateX: 100, itemWidth: 80, itemHeight: 20, symbolSize: 12, symbolShape: 'circle', effects: [{ on: 'hover', style: { itemOpacity: 1 } }] }
                  ]}
                />
              </div>
            </div>

            {/* RevPAR + ADR */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-surface-container-low rounded-[2rem] p-6 shadow-[0_8px_0_0_#dbdad7]">
                <h3 className="font-headline font-black text-sm uppercase text-on-surface-variant tracking-wider mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-tertiary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
                  RevPAR & ADR Trend
                </h3>
                <div className="h-56">
                  <ResponsiveLine
                    data={kpiLineData}
                    theme={NIVO_THEME}
                    margin={{ top: 10, right: 110, bottom: 40, left: 60 }}
                    xScale={{ type: 'point' }}
                    yScale={{ type: 'linear', min: 0, max: 'auto' }}
                    curve="monotoneX"
                    axisBottom={{ tickSize: 0, tickPadding: 10 }}
                    axisLeft={{ tickSize: 0, tickPadding: 10, format: v => `$${v}` }}
                    colors={['#2d6a4f', '#e07a3a']}
                    lineWidth={2.5}
                    pointSize={6}
                    pointBorderWidth={2}
                    pointBorderColor={{ from: 'serieColor' }}
                    pointColor={{ theme: 'background' }}
                    useMesh={true}
                    legends={[
                      { anchor: 'bottom-right', direction: 'column', translateX: 100, itemWidth: 80, itemHeight: 20, symbolSize: 10, symbolShape: 'circle' }
                    ]}
                  />
                </div>
              </div>

              <div className="bg-surface-container-low rounded-[2rem] p-6 shadow-[0_8px_0_0_#dbdad7]">
                <h3 className="font-headline font-black text-sm uppercase text-on-surface-variant tracking-wider mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-tertiary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>hotel</span>
                  Occupancy & Cancellations
                </h3>
                <div className="h-56">
                  <ResponsiveBar
                    data={occupancyBarData}
                    keys={['occupancy', 'cancellations']}
                    indexBy="week"
                    theme={NIVO_THEME}
                    margin={{ top: 10, right: 110, bottom: 40, left: 50 }}
                    padding={0.3}
                    groupMode="grouped"
                    colors={['#2d6a4f', '#4a3228']}
                    borderRadius={6}
                    axisBottom={{ tickSize: 0, tickPadding: 10 }}
                    axisLeft={{ tickSize: 0, tickPadding: 10, format: v => `${v}%` }}
                    legends={[
                      { dataFrom: 'keys', anchor: 'bottom-right', direction: 'column', translateX: 100, itemWidth: 90, itemHeight: 20, symbolSize: 10 }
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'benchmark' && benchmark && (
          <div className="space-y-6">
            {/* Big comparison */}
            <div className="bg-surface-container-low rounded-[2rem] p-8 shadow-[0_8px_0_0_#dbdad7]">
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-outline mb-2">Your Revenue</p>
                  <p className="text-3xl font-black font-headline text-tertiary">${benchmark.player_revenue.toLocaleString()}</p>
                </div>
                <div className="flex flex-col items-center justify-center">
                  <div className={`w-24 h-24 rounded-full border-8 flex items-center justify-center ${
                    benchmark.efficiency >= 80 ? 'border-tertiary' : benchmark.efficiency >= 60 ? 'border-amber-500' : 'border-error'
                  }`}>
                    <span className="text-2xl font-black font-headline">{benchmark.efficiency}%</span>
                  </div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-outline mt-2">Efficiency</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-outline mb-2">AI Revenue</p>
                  <p className="text-3xl font-black font-headline text-primary">${benchmark.ai_revenue.toLocaleString()}</p>
                  <p className="text-[9px] text-outline font-bold mt-1">{benchmark.ai_strategy}</p>
                </div>
              </div>
            </div>

            {/* Revenue comparison chart */}
            <div className="bg-surface-container-low rounded-[2rem] p-6 shadow-[0_8px_0_0_#dbdad7]">
              <h3 className="font-headline font-black text-sm uppercase text-on-surface-variant tracking-wider mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>compare</span>
                Week-by-Week Revenue Comparison
              </h3>
              <div className="h-72">
                <ResponsiveLine
                  data={[
                    { id: 'You', data: benchmark.player_weeks.map(w => ({ x: `W${w.week}`, y: w.revenue })) },
                    { id: 'AI', data: benchmark.ai_weeks.map(w => ({ x: `W${w.week_number}`, y: w.revenue })) },
                  ]}
                  theme={NIVO_THEME}
                  margin={{ top: 20, right: 110, bottom: 50, left: 70 }}
                  xScale={{ type: 'point' }}
                  yScale={{ type: 'linear', min: 0, max: 'auto' }}
                  curve="monotoneX"
                  axisBottom={{ tickSize: 0, tickPadding: 12, legend: 'Week', legendOffset: 40, legendPosition: 'middle' }}
                  axisLeft={{ tickSize: 0, tickPadding: 12, legend: 'Weekly Revenue ($)', legendOffset: -55, legendPosition: 'middle', format: v => `$${v.toLocaleString()}` }}
                  colors={['#2d6a4f', '#4a3228']}
                  lineWidth={3}
                  pointSize={8}
                  pointColor={{ theme: 'background' }}
                  pointBorderWidth={3}
                  pointBorderColor={{ from: 'serieColor' }}
                  enableArea={true}
                  areaOpacity={0.06}
                  useMesh={true}
                  legends={[
                    { anchor: 'bottom-right', direction: 'column', translateX: 100, itemWidth: 80, itemHeight: 20, symbolSize: 12, symbolShape: 'circle' }
                  ]}
                />
              </div>
            </div>

            {/* Radar comparison */}
            <div className="bg-surface-container-low rounded-[2rem] p-6 shadow-[0_8px_0_0_#dbdad7]">
              <h3 className="font-headline font-black text-sm uppercase text-on-surface-variant tracking-wider mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>radar</span>
                Performance Profile
              </h3>
              <div className="h-72">
                <ResponsiveRadar
                  data={radarData}
                  keys={['player', 'ai']}
                  indexBy="metric"
                  theme={NIVO_THEME}
                  maxValue={100}
                  margin={{ top: 40, right: 80, bottom: 40, left: 80 }}
                  curve="linearClosed"
                  borderWidth={2}
                  borderColor={{ from: 'color' }}
                  gridLevels={5}
                  gridShape="circular"
                  colors={['#2d6a4f', '#4a3228']}
                  fillOpacity={0.15}
                  blendMode="multiply"
                  dotSize={8}
                  dotColor={{ theme: 'background' }}
                  dotBorderWidth={2}
                  dotBorderColor={{ from: 'color' }}
                  legends={[
                    { anchor: 'top-left', direction: 'column', translateX: -40, translateY: -30, itemWidth: 60, itemHeight: 20, symbolSize: 10, symbolShape: 'circle' }
                  ]}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'segments' && (
          <div className="space-y-6">
            <div className="bg-surface-container-low rounded-[2rem] p-6 shadow-[0_8px_0_0_#dbdad7]">
              <h3 className="font-headline font-black text-sm uppercase text-on-surface-variant tracking-wider mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>groups</span>
                Guest Volume by Segment
              </h3>
              <div className="h-72">
                <ResponsiveBar
                  data={segmentBarData}
                  keys={['guests']}
                  indexBy="segment"
                  theme={NIVO_THEME}
                  margin={{ top: 10, right: 30, bottom: 60, left: 60 }}
                  padding={0.35}
                  colors={['#2d6a4f']}
                  borderRadius={8}
                  axisBottom={{ tickSize: 0, tickPadding: 10, tickRotation: -25 }}
                  axisLeft={{ tickSize: 0, tickPadding: 10, legend: 'Guests', legendOffset: -45, legendPosition: 'middle' }}
                  labelSkipWidth={16}
                  labelSkipHeight={16}
                  labelTextColor="#fff"
                />
              </div>
            </div>

            {/* Segment table */}
            <div className="bg-surface-container-low rounded-[2rem] p-6 shadow-[0_8px_0_0_#dbdad7]">
              <h3 className="font-headline font-black text-sm uppercase text-on-surface-variant tracking-wider mb-4">Segment Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-wider text-outline border-b-2 border-outline/20">
                      <th className="text-left py-3 px-4">Segment</th>
                      <th className="text-right py-3 px-4">Guests</th>
                      <th className="text-right py-3 px-4">Total Revenue</th>
                      <th className="text-right py-3 px-4">Avg Expected Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(kpis.segments || {}).map(([seg, data]) => (
                      <tr key={seg} className="border-b border-outline/10 hover:bg-surface-container-highest/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-on-surface-variant">{seg}</td>
                        <td className="py-3 px-4 text-right font-bold">{data.count}</td>
                        <td className="py-3 px-4 text-right font-bold text-tertiary">${data.revenue.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-bold">${data.avgEv}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Week-by-week KPI table */}
        <div className="bg-surface-container-low rounded-[2rem] p-6 shadow-[0_8px_0_0_#dbdad7]">
          <h3 className="font-headline font-black text-sm uppercase text-on-surface-variant tracking-wider mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>table_chart</span>
            Weekly Performance Table
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-wider text-outline border-b-2 border-outline/20">
                  <th className="text-left py-3 px-3">Week</th>
                  <th className="text-right py-3 px-3">Revenue</th>
                  <th className="text-right py-3 px-3">RevPAR</th>
                  <th className="text-right py-3 px-3">ADR</th>
                  <th className="text-right py-3 px-3">Occ %</th>
                  <th className="text-right py-3 px-3">Accepted</th>
                  <th className="text-right py-3 px-3">Canc</th>
                  <th className="text-right py-3 px-3">No-Show</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map(w => (
                  <tr key={w.week} className="border-b border-outline/10 hover:bg-surface-container-highest/50 transition-colors">
                    <td className="py-3 px-3 font-black text-primary">W{w.week}</td>
                    <td className="py-3 px-3 text-right font-bold text-tertiary">${w.revenue.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right font-bold">${w.revpar}</td>
                    <td className="py-3 px-3 text-right font-bold">${w.adr}</td>
                    <td className="py-3 px-3 text-right font-bold">{w.occupancy}%</td>
                    <td className="py-3 px-3 text-right">{w.accepted}</td>
                    <td className="py-3 px-3 text-right text-error font-bold">{w.cancellations}</td>
                    <td className="py-3 px-3 text-right text-amber-600 font-bold">{w.no_shows}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
