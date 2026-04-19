import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TopAppBar from '../components/TopAppBar';
import { getSocket } from '../lib/socket';

const TIER_NAMES = ['standard', 'mid', 'premium', 'suite'];
const TIER_DISPLAY = {
  standard: { label: 'Standard', icon: 'bed', color: 'bg-blue-100 text-blue-800' },
  mid: { label: 'Mid-Range', icon: 'king_bed', color: 'bg-amber-100 text-amber-800' },
  premium: { label: 'Premium', icon: 'spa', color: 'bg-purple-100 text-purple-800' },
  suite: { label: 'Suite', icon: 'villa', color: 'bg-rose-100 text-rose-800' },
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function GamePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  // Game state
  const [gamePhase, setGamePhase] = useState('loading'); // loading | pricing | simulating | results
  const [weekNumber, setWeekNumber] = useState(0);
  const [monthName, setMonthName] = useState('');
  const [demandLevel, setDemandLevel] = useState('Medium');
  const [guestCount, setGuestCount] = useState(0);
  const [totalWeeks, setTotalWeeks] = useState(20);

  // Pricing
  const [prices, setPrices] = useState({ standard: 100, mid: 150, premium: 250, suite: 400 });
  const [suggestedPrices, setSuggestedPrices] = useState(null);
  const [calendar, setCalendar] = useState(null);

  // Results
  const [weekResults, setWeekResults] = useState(null);
  const [cumulativeRevenue, setCumulativeRevenue] = useState(0);
  const [weekHistory, setWeekHistory] = useState([]);

  const startedRef = useRef(false);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const startOrRejoin = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      console.log('[GamePage] Emitting game:start for session', sessionId);
      socket.emit('game:start', { session_id: sessionId });
    };

    socket.on('connect', startOrRejoin);
    if (socket.connected) startOrRejoin();

    socket.on('error', (data) => console.error('[GamePage] Server error:', data.message || data));
    socket.on('pricing:error', (data) => {
      console.error('[GamePage] Pricing error:', data.message || data);
      setGamePhase('pricing'); // Go back to pricing on error
      alert('Pricing error: ' + (data.message || 'Unknown error'));
    });

    socket.on('game:started', (data) => {
      console.log('[GamePage] game:started', data);
      if (data.total_weeks) setTotalWeeks(data.total_weeks);
    });

    socket.on('week:started', (data) => {
      console.log('[GamePage] week:started', data);
      setWeekNumber(data.week_number);
      setMonthName(data.month_name);
      setGuestCount(data.guest_count);
      if (data.demand_level) setDemandLevel(data.demand_level);
      if (data.calendar) setCalendar(data.calendar);
      if (data.suggested_prices) setSuggestedPrices(data.suggested_prices);
      setWeekResults(null);
      setGamePhase('pricing');
      // Restore cumulative revenue on rejoin
      if (data.cumulative_revenue != null) setCumulativeRevenue(data.cumulative_revenue);

      // Set initial prices from suggested medians
      if (data.suggested_prices) {
        setPrices({
          standard: data.suggested_prices.standard?.median || 100,
          mid: data.suggested_prices.mid?.median || 150,
          premium: data.suggested_prices.premium?.median || 250,
          suite: data.suggested_prices.suite?.median || 400,
        });
      }
    });

    socket.on('week:simulating', () => {
      console.log('[GamePage] week:simulating');
      setGamePhase('simulating');
    });

    socket.on('week:results', (data) => {
      console.log('[GamePage] week:results', data);
      const myResult = data.results ? Object.values(data.results)[0] : null;
      if (myResult) {
        setWeekResults(myResult);
        setCumulativeRevenue(myResult.cumulative_revenue || 0);
        setWeekHistory(prev => [...prev, {
          week: data.week_number,
          revenue: myResult.week_revenue,
          cumulative: myResult.cumulative_revenue,
          occupancy: myResult.occupancy_rate,
          booked: myResult.guests_booked,
          turned_away: myResult.guests_turned_away,
        }]);
      }
      setGamePhase('results');
    });

    socket.on('game:completed', (data) => {
      console.log('[GamePage] game:completed');
      navigate(`/session/${sessionId}/results`);
    });

    return () => {
      socket.off('connect', startOrRejoin);
      socket.off('error');
      socket.off('pricing:error');
      socket.off('game:started');
      socket.off('week:started');
      socket.off('week:simulating');
      socket.off('week:results');
      socket.off('game:completed');
    };
  }, [sessionId, navigate]);

  const handleSubmitPrices = useCallback(() => {
    const socket = getSocket();
    if (!socket) return;
    console.log('[GamePage] Submitting prices:', prices);
    socket.emit('player:submit_prices', { session_id: sessionId, prices });
    setGamePhase('simulating');
  }, [sessionId, prices]);

  const handleNextWeek = useCallback(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('game:advance_week', { session_id: sessionId });
    setGamePhase('loading');
  }, [sessionId]);

  const handlePriceChange = (tier, value) => {
    const num = Math.max(1, Math.round(Number(value) || 0));
    setPrices(prev => ({ ...prev, [tier]: num }));
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col pt-24">
      <TopAppBar />
      <main className="flex-grow px-6 pb-6">
        {/* Week Header HUD */}
        <div className="flex items-center gap-4 mb-6">
          <div className="bg-primary text-white px-5 py-2.5 rounded-full font-headline font-black text-sm shadow-[0_4px_0_0_#2a1410]">
            Week {weekNumber} / {totalWeeks}
          </div>
          <div className="bg-secondary-container px-5 py-2.5 rounded-full font-bold text-on-secondary-container text-sm shadow-[0_4px_0_0_#56423e]">
            {monthName}
          </div>
          <div className="flex items-center bg-tertiary-container px-4 py-2 rounded-full shadow-[0_4px_0_0_#1a5a4c]">
            <span className="material-symbols-outlined text-on-tertiary-container mr-2">trending_up</span>
            <span className="font-bold text-on-tertiary-container uppercase text-xs">{demandLevel} Demand</span>
          </div>
          <div className="flex items-center gap-2 bg-surface-container-low px-4 py-2 rounded-full shadow-[0_4px_0_0_#dbdad7]">
            <span className="material-symbols-outlined text-on-surface-variant">group</span>
            <span className="font-bold text-on-surface-variant text-xs">{guestCount} Potential Guests</span>
          </div>
          <div className="bg-surface-container-highest px-6 py-2.5 rounded-full shadow-[0_4px_0_0_#56423e] flex items-center gap-2 ml-auto">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
            <span className="font-black text-on-surface-variant tracking-tight text-lg">${cumulativeRevenue.toLocaleString()}</span>
          </div>
        </div>

        {/* Main Content — depends on game phase */}
        {gamePhase === 'loading' && <LoadingState />}
        {gamePhase === 'pricing' && (
          <PricingPhase
            prices={prices}
            suggestedPrices={suggestedPrices}
            calendar={calendar}
            onPriceChange={handlePriceChange}
            onSubmit={handleSubmitPrices}
            demandLevel={demandLevel}
          />
        )}
        {gamePhase === 'simulating' && <SimulatingState />}
        {gamePhase === 'results' && weekResults && (
          <ResultsPhase
            results={weekResults}
            weekNumber={weekNumber}
            totalWeeks={totalWeeks}
            weekHistory={weekHistory}
            onNextWeek={handleNextWeek}
          />
        )}
      </main>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center space-y-4">
        <span className="material-symbols-outlined text-outline text-6xl animate-pulse">hourglass_top</span>
        <p className="font-headline font-bold text-on-secondary-container uppercase tracking-widest text-sm">
          Preparing next week...
        </p>
      </div>
    </div>
  );
}

function SimulatingState() {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center space-y-4">
        <span className="material-symbols-outlined text-tertiary text-6xl animate-spin">autorenew</span>
        <p className="font-headline font-bold text-on-secondary-container uppercase tracking-widest text-sm">
          Running demand simulation...
        </p>
        <p className="text-outline text-xs">Guests are checking your prices...</p>
      </div>
    </div>
  );
}

function PricingPhase({ prices, suggestedPrices, calendar, onPriceChange, onSubmit, demandLevel }) {
  return (
    <div className="grid grid-cols-12 gap-6" style={{ height: 'calc(100vh - 200px)' }}>
      {/* Left: Pricing Cards */}
      <section className="col-span-5 flex flex-col gap-4 overflow-y-auto pr-2">
        <h2 className="text-xl font-black font-headline text-on-surface tracking-tight flex items-center gap-2">
          <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>sell</span>
          Set Your Room Prices
        </h2>
        <p className="text-xs text-outline font-bold uppercase tracking-wider -mt-2 mb-2">
          Price per night — guests book if your price ≤ their budget
        </p>

        {TIER_NAMES.map(tier => {
          const display = TIER_DISPLAY[tier];
          const suggested = suggestedPrices?.[tier];
          return (
            <div key={tier} className="bg-surface-container-low p-5 rounded-[2rem] shadow-[0_6px_0_0_#dbdad7] border-2 border-white/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${display.color} rounded-xl flex items-center justify-center`}>
                    <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>{display.icon}</span>
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-on-surface">{display.label}</h3>
                    {suggested && (
                      <p className="text-[9px] text-outline font-bold">{suggested.count} guests interested</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <span className="text-xl font-black text-on-surface">$</span>
                    <input
                      type="number"
                      value={prices[tier]}
                      onChange={(e) => onPriceChange(tier, e.target.value)}
                      className="w-24 text-2xl font-black text-on-surface bg-surface-container-highest rounded-xl px-3 py-1.5 text-center border-2 border-outline/20 focus:border-primary focus:outline-none transition-colors"
                      min="1"
                    />
                  </div>
                  <p className="text-[8px] text-outline font-bold uppercase mt-1">per night</p>
                </div>
              </div>

              {/* Price range indicator */}
              {suggested && (
                <div className="mt-2">
                  <div className="flex justify-between text-[8px] font-bold text-outline uppercase mb-1">
                    <span>Budget: ${suggested.min}</span>
                    <span>Median: ${suggested.median}</span>
                    <span>Luxury: ${suggested.max}</span>
                  </div>
                  <div className="relative h-2 bg-surface-container-highest rounded-full overflow-hidden">
                    <div
                      className="absolute h-full bg-tertiary/40 rounded-full"
                      style={{
                        left: '0%',
                        width: '100%',
                      }}
                    />
                    {/* Player price marker */}
                    <div
                      className="absolute top-0 w-1 h-full bg-primary rounded-full shadow-md"
                      style={{
                        left: `${Math.min(100, Math.max(0, ((prices[tier] - suggested.min) / Math.max(1, suggested.max - suggested.min)) * 100))}%`,
                      }}
                    />
                  </div>
                  <p className="text-[8px] text-outline mt-1 text-center">
                    {prices[tier] <= suggested.median ? '📈 Competitive — more bookings likely' : '💰 Premium — fewer but higher-value bookings'}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        <button
          onClick={onSubmit}
          className="w-full bg-tertiary text-white py-4 rounded-2xl font-headline font-black text-sm uppercase tracking-widest shadow-[0_8px_0_0_#1a5a4c] hover:-translate-y-1 hover:shadow-[0_10px_0_0_#1a5a4c] active:translate-y-1 active:shadow-[0_2px_0_0_#1a5a4c] transition-all flex items-center justify-center gap-2 mt-2"
        >
          <span className="material-symbols-outlined">rocket_launch</span>
          Lock In Prices & Simulate Week
        </button>
      </section>

      {/* Right: Room Availability Grid */}
      <section className="col-span-7">
        <div className="bg-surface-container-high h-full rounded-[2rem] p-6 clay-slab flex flex-col border-4 border-white/20">
          <h2 className="text-xl font-black font-headline text-on-surface tracking-tight mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">calendar_month</span>
            Room Availability This Week
          </h2>

          {calendar ? (
            <div className="flex-grow overflow-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left text-[10px] font-black text-outline uppercase tracking-wider pb-3 pl-2 w-28">Room Tier</th>
                    {DAY_LABELS.map(d => (
                      <th key={d} className="text-center text-[10px] font-black text-outline uppercase tracking-wider pb-3">{d}</th>
                    ))}
                    <th className="text-center text-[10px] font-black text-outline uppercase tracking-wider pb-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {TIER_NAMES.map(tierKey => {
                    const days = calendar[tierKey];
                    if (!days) return null;
                    const total = days.reduce((s, v) => s + v, 0);
                    const display = TIER_DISPLAY[tierKey];
                    return (
                      <tr key={tierKey} className="border-t border-outline/10">
                        <td className="py-3 pl-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 ${display.color} rounded-lg flex items-center justify-center`}>
                              <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>{display.icon}</span>
                            </div>
                            <span className="font-black text-xs text-on-surface">{display.label}</span>
                          </div>
                        </td>
                        {days.map((avail, i) => (
                          <td key={i} className="py-3 px-1 text-center">
                            <div className={`rounded-xl py-2 font-black text-sm ${avail > 10 ? 'bg-tertiary/20 text-tertiary' :
                                avail > 5 ? 'bg-amber-400/20 text-amber-700' :
                                  avail > 0 ? 'bg-error/20 text-error' :
                                    'bg-error/50 text-white'
                              }`}>
                              {avail}
                            </div>
                          </td>
                        ))}
                        <td className="py-3 px-2 text-center">
                          <span className="font-black text-sm text-on-surface-variant">{total}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex-grow flex items-center justify-center">
              <p className="text-outline font-bold uppercase text-xs tracking-widest">Loading inventory...</p>
            </div>
          )}

          {/* Demand Info */}
          <div className="mt-4 bg-surface-container rounded-2xl p-4 clay-inset-shadow">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-tertiary">lightbulb</span>
              <div>
                <p className="font-black text-xs text-on-surface">Pricing Strategy Hint</p>
                <p className="text-[10px] text-outline">
                  {demandLevel === 'High' && 'High demand — guests have higher budgets. Consider premium pricing.'}
                  {demandLevel === 'Medium' && 'Moderate demand — balanced pricing will fill rooms without losing high-value guests.'}
                  {demandLevel === 'Low' && 'Low demand — competitive pricing will help fill rooms. Many guests are price-sensitive.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ResultsPhase({ results, weekNumber, totalWeeks, weekHistory, onNextWeek }) {
  const isLast = weekNumber >= totalWeeks;

  return (
    <div className="grid grid-cols-12 gap-6" style={{ height: 'calc(100vh - 200px)' }}>
      {/* Left: Week Summary */}
      <section className="col-span-5 flex flex-col gap-4 overflow-y-auto pr-2">
        <h2 className="text-xl font-black font-headline text-on-surface tracking-tight flex items-center gap-2">
          <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>summarize</span>
          Week {weekNumber} Results
        </h2>

        {/* Revenue Card */}
        <div className="bg-tertiary p-6 rounded-[2rem] shadow-[0_8px_0_0_#1a5a4c] text-white text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-1">Week Revenue</p>
          <p className="text-4xl font-black tracking-tight">${(results.week_revenue || 0).toLocaleString()}</p>
          <p className="text-xs mt-2 text-white/60">Cumulative: ${(results.cumulative_revenue || 0).toLocaleString()}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Guests Booked" value={results.guests_booked || 0} icon="check_circle" color="text-tertiary" />
          <StatCard label="Turned Away" value={results.guests_turned_away || 0} icon="block" color="text-error" />
          <StatCard label="Cancellations" value={results.cancellations || 0} icon="event_busy" color="text-amber-600" />
          <StatCard label="No-Shows" value={results.no_shows || 0} icon="person_off" color="text-error" />
          <StatCard label="Occupancy" value={`${Math.round((results.occupancy_rate || 0) * 100)}%`} icon="hotel" color="text-primary" />
          <StatCard label="ADR" value={`$${results.adr || 0}`} icon="price_check" color="text-tertiary" />
        </div>

        {/* Per-Tier Breakdown */}
        {results.tier_stats && (
          <div className="bg-surface-container-low p-4 rounded-[2rem] shadow-[0_6px_0_0_#dbdad7]">
            <h3 className="font-black text-xs text-on-surface uppercase tracking-wider mb-3">Revenue by Tier</h3>
            {TIER_NAMES.map(tier => {
              const ts = results.tier_stats[tier];
              if (!ts) return null;
              const display = TIER_DISPLAY[tier];
              return (
                <div key={tier} className="flex items-center justify-between py-2 border-b border-outline/10 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 ${display.color} rounded-lg flex items-center justify-center`}>
                      <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>{display.icon}</span>
                    </div>
                    <span className="font-bold text-xs">{display.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-xs text-on-surface">${ts.revenue?.toLocaleString() || 0}</span>
                    <span className="text-[9px] text-outline ml-2">({ts.guests_booked}B / {ts.priced_out}P / {ts.no_rooms}F)</span>
                  </div>
                </div>
              );
            })}
            <p className="text-[8px] text-outline mt-2">B=Booked, P=Priced Out, F=Full (no rooms)</p>
          </div>
        )}

        {/* Next Week Button */}
        <button
          onClick={onNextWeek}
          className="w-full bg-primary text-white py-4 rounded-2xl font-headline font-black text-sm uppercase tracking-widest shadow-[0_8px_0_0_#2a1410] hover:-translate-y-1 hover:shadow-[0_10px_0_0_#2a1410] active:translate-y-1 active:shadow-[0_2px_0_0_#2a1410] transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined">{isLast ? 'emoji_events' : 'skip_next'}</span>
          {isLast ? 'View Final Results' : `Start Week ${weekNumber + 1}`}
        </button>
      </section>

      {/* Right: Price Comparison & Trend */}
      <section className="col-span-7">
        <div className="bg-surface-container-high h-full rounded-[2rem] p-6 clay-slab flex flex-col border-4 border-white/20">
          <h2 className="text-xl font-black font-headline text-on-surface tracking-tight mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">analytics</span>
            Performance Overview
          </h2>

          {/* Prices You Set */}
          {results.prices_submitted && (
            <div className="mb-4">
              <h3 className="font-black text-xs text-outline uppercase tracking-wider mb-2">Prices You Set This Week</h3>
              <div className="flex gap-3">
                {TIER_NAMES.map(tier => (
                  <div key={tier} className="flex-1 bg-surface-container rounded-xl p-3 text-center clay-inset-shadow">
                    <p className="text-[8px] font-bold text-outline uppercase">{TIER_DISPLAY[tier].label}</p>
                    <p className="text-lg font-black text-on-surface">${results.prices_submitted[tier]}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Revenue Trend */}
          {weekHistory.length > 0 && (
            <div className="flex-grow bg-surface-container rounded-[1.5rem] p-4 clay-inset-shadow overflow-auto">
              <h3 className="font-black text-xs text-outline uppercase tracking-wider mb-3">Revenue Trend</h3>
              <div className="space-y-2">
                {weekHistory.map((wh, i) => {
                  const maxRev = Math.max(...weekHistory.map(h => h.revenue), 1);
                  const pct = (wh.revenue / maxRev) * 100;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-outline w-8">W{wh.week}</span>
                      <div className="flex-grow h-6 bg-surface-container-highest rounded-full overflow-hidden relative">
                        <div
                          className="h-full bg-tertiary/60 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                        <span className="absolute right-2 top-0.5 text-[9px] font-black text-on-surface">
                          ${wh.revenue.toLocaleString()}
                        </span>
                      </div>
                      <span className="text-[9px] font-bold text-outline w-12 text-right">
                        {Math.round((wh.occupancy || 0) * 100)}% occ
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Summary Stats Footer */}
          <div className="mt-4 flex justify-between items-center bg-surface-container-highest p-4 rounded-[2rem] clay-inset-shadow">
            <div className="text-center px-4 border-r border-outline/20">
              <p className="text-[10px] font-bold text-outline uppercase">RevPAR</p>
              <p className="text-xl font-black text-tertiary">${results.revpar || 0}</p>
            </div>
            <div className="text-center px-4 border-r border-outline/20">
              <p className="text-[10px] font-bold text-outline uppercase">Occupancy</p>
              <p className="text-xl font-black">{Math.round((results.occupancy_rate || 0) * 100)}%</p>
            </div>
            <div className="text-center px-4 border-r border-outline/20">
              <p className="text-[10px] font-bold text-outline uppercase">ADR</p>
              <p className="text-xl font-black">${results.adr || 0}</p>
            </div>
            <div className="text-center px-4">
              <p className="text-[10px] font-bold text-outline uppercase">Total Revenue</p>
              <p className="text-xl font-black text-primary">${(results.cumulative_revenue || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <div className="bg-surface-container-low p-3 rounded-xl shadow-[0_4px_0_0_#dbdad7] flex items-center gap-3">
      <span className={`material-symbols-outlined ${color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      <div>
        <p className="text-[8px] font-bold text-outline uppercase">{label}</p>
        <p className="font-black text-base text-on-surface">{value}</p>
      </div>
    </div>
  );
}
