import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TopAppBar from '../components/TopAppBar';
import TutorialOverlay, { CLASSIC_TUTORIAL_STEPS } from '../components/TutorialOverlay';
import { getSocket } from '../lib/socket';

const TIER_MAP = { 1: 'standard', 2: 'mid', 3: 'premium', 4: 'suite' };
const TIER_DISPLAY = {
  standard: { label: 'Standard', icon: 'bed', color: 'bg-blue-100 text-blue-800' },
  mid: { label: 'Deluxe', icon: 'king_bed', color: 'bg-amber-100 text-amber-800' },
  premium: { label: 'Premium', icon: 'spa', color: 'bg-purple-100 text-purple-800' },
  suite: { label: 'Suite', icon: 'villa', color: 'bg-rose-100 text-rose-800' },
};
const TIER_NAMES = ['standard', 'mid', 'premium', 'suite'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Segment color mapping (matches Stitch design)
const SEGMENT_COLORS = {
  Corporate: { bg: 'bg-segment-corporate', label: 'Corporate Elite', icon: 'corporate_fare' },
  Direct: { bg: 'bg-primary', label: 'Direct Booking', icon: 'storefront' },
  'Online TA': { bg: 'bg-segment-transient', label: 'Online TA', icon: 'travel_explore' },
  'Offline TA/TO': { bg: 'bg-segment-leisure', label: 'Offline TA/TO', icon: 'beach_access' },
  Groups: { bg: 'bg-segment-leisure', label: 'Groups', icon: 'groups' },
  Aviation: { bg: 'bg-on-surface-variant', label: 'Aviation', icon: 'flight' },
  Complementary: { bg: 'bg-outline', label: 'Complementary', icon: 'redeem' },
};

const RISK_STYLES = {
  Low: 'risk-low',
  Medium: 'risk-medium',
  High: 'risk-high',
};

export default function ClassicGamePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  // Game state
  const [gamePhase, setGamePhase] = useState('loading'); // loading | guest_active | transitioning | resolving | results
  const [weekNumber, setWeekNumber] = useState(0);
  const [monthName, setMonthName] = useState('');
  const [demandLevel, setDemandLevel] = useState('Medium');
  const [guestCount, setGuestCount] = useState(0);
  const [totalWeeks, setTotalWeeks] = useState(20);

  // Guest state
  const [currentGuest, setCurrentGuest] = useState(null);
  const [guestIndex, setGuestIndex] = useState(0);
  const [totalGuests, setTotalGuests] = useState(0);
  const [timerMs, setTimerMs] = useState(30000);
  const [decisionMade, setDecisionMade] = useState(false);
  const [lastDecision, setLastDecision] = useState(null);
  const [pendingDecision, setPendingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState(null);
  const [showTutorial, setShowTutorial] = useState(0);

  // Room inventory
  const [calendar, setCalendar] = useState(null);

  // Decision history for current week
  const [decisions, setDecisions] = useState([]);

  // Results
  const [weekResults, setWeekResults] = useState(null);
  const [cumulativeRevenue, setCumulativeRevenue] = useState(0);
  const [weekHistory, setWeekHistory] = useState([]);

  const startedRef = useRef(false);
  const currentGuestRef = useRef(null);

  // Keep ref in sync with currentGuest so socket handlers always read latest
  useEffect(() => { currentGuestRef.current = currentGuest; }, [currentGuest]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const startOrRejoin = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      console.log('[ClassicGamePage] Emitting game:start for session', sessionId);
      socket.emit('game:start', { session_id: sessionId });
    };

    socket.on('connect', startOrRejoin);
    if (socket.connected) startOrRejoin();

    socket.on('error', (data) => console.error('[ClassicGamePage] Server error:', data.message || data));

    socket.on('game:started', (data) => {
      console.log('[ClassicGamePage] game:started', data);
      if (data.total_weeks) setTotalWeeks(data.total_weeks);
    });

    socket.on('week:started', (data) => {
      console.log('[ClassicGamePage] week:started', data);
      setWeekNumber(data.week_number);
      setMonthName(data.month_name);
      setGuestCount(data.guest_count);
      if (data.demand_level) setDemandLevel(data.demand_level);
      if (data.calendar) setCalendar(data.calendar);
      setWeekResults(null);
      setDecisions([]);
      setGamePhase('loading'); // Will switch to guest_active when first guest arrives
      // Restore cumulative revenue on rejoin
      if (data.cumulative_revenue != null) setCumulativeRevenue(data.cumulative_revenue);
    });

    socket.on('guest:arrived', (data) => {
      console.log('[ClassicGamePage] guest:arrived', data);
      setCurrentGuest(data.guest);
      setGuestIndex(data.guest_index);
      setTotalGuests(data.total_guests);
      setTimerMs(data.timer_ms);
      setDecisionMade(false);
      setLastDecision(null);
      setPendingDecision(false);
      setDecisionError(null);
      setGamePhase('guest_active');
    });

    socket.on('guest:countdown', (data) => {
      setTimerMs(data.remaining_ms);
    });

    socket.on('guest:expired', (data) => {
      console.log('[ClassicGamePage] guest:expired', data);
      if (!decisionMade) {
        setDecisions(prev => [...prev, { index: data.guest_index, decision: 'timeout', guest: currentGuestRef.current }]);
      }
      setPendingDecision(false);
      setGamePhase('transitioning');
    });

    socket.on('decision:confirmed', (data) => {
      console.log('[ClassicGamePage] decision:confirmed', data);
      setDecisionMade(true);
      setLastDecision(data.decision);
      setPendingDecision(false);
      setDecisionError(null);
      if (data.week_calendar) setCalendar(data.week_calendar);
      // Add to decision history on server confirmation
      setDecisions(prev => [...prev, { index: data.guest_index ?? guestIndex, decision: data.decision, guest: currentGuestRef.current }]);
    });

    socket.on('decision:error', (data) => {
      console.error('[ClassicGamePage] Decision error:', data.message);
      setPendingDecision(false);
      setDecisionError(data.message || 'No rooms available for this guest');
      // Don't set decisionMade — keep buttons active so player can reject instead
    });

    socket.on('week:results', (data) => {
      console.log('[ClassicGamePage] week:results', data);
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

    socket.on('game:completed', () => {
      console.log('[ClassicGamePage] game:completed');
      navigate(`/session/${sessionId}/results`);
    });

    return () => {
      socket.off('connect', startOrRejoin);
      socket.off('error');
      socket.off('game:started');
      socket.off('week:started');
      socket.off('guest:arrived');
      socket.off('guest:countdown');
      socket.off('guest:expired');
      socket.off('decision:confirmed');
      socket.off('decision:error');
      socket.off('week:results');
      socket.off('game:completed');
    };
  }, [sessionId, navigate]);

  const handleDecision = useCallback((decision) => {
    if (decisionMade || pendingDecision) return;
    const socket = getSocket();
    if (!socket) return;

    const roomTier = currentGuest?.room_tier || 1;
    console.log('[ClassicGamePage] Sending decision:', { guest_index: guestIndex, decision, room_tier: roomTier });
    socket.emit('player:decision', {
      guest_index: guestIndex,
      decision,
      room_tier: roomTier,
    });

    // Only mark as pending — actual confirmation comes from server
    setPendingDecision(true);
    setDecisionError(null);
  }, [decisionMade, pendingDecision, guestIndex, currentGuest]);

  const handleNextWeek = useCallback(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('game:advance_week', { session_id: sessionId });
    setGamePhase('loading');
  }, [sessionId]);

  // Timer progress (0 to 1)
  const timerProgress = Math.max(0, timerMs / 30000);
  const timerSeconds = Math.ceil(timerMs / 1000);

  return (
    <div className="min-h-screen bg-surface flex flex-col pt-24">
      <TopAppBar />
      <TutorialOverlay key={showTutorial} steps={CLASSIC_TUTORIAL_STEPS} storageKey={showTutorial > 0 ? `classic-tutorial-forced-${showTutorial}` : 'classic-tutorial-v1'} />
      <main className="flex-grow px-8 pb-8">
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
          {gamePhase === 'guest_active' && (
            <div className="flex items-center gap-2 bg-surface-container-low px-4 py-2 rounded-full shadow-[0_4px_0_0_#dbdad7]">
              <span className="material-symbols-outlined text-on-surface-variant">person</span>
              <span className="font-bold text-on-surface-variant text-xs">Guest {guestIndex + 1} / {totalGuests}</span>
            </div>
          )}
          <div className="bg-surface-container-highest px-6 py-2.5 rounded-full shadow-[0_4px_0_0_#56423e] flex items-center gap-2 ml-auto">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
            <span className="font-black text-on-surface-variant tracking-tight text-lg">${cumulativeRevenue.toLocaleString()}</span>
          </div>
          <button
            className="w-10 h-10 bg-surface-container-low rounded-full shadow-[0_4px_0_0_#dbdad7] flex items-center justify-center hover:-translate-y-0.5 transition-all"
            onClick={() => setShowTutorial(prev => prev + 1)}
            title="Show Tutorial"
          >
            <span className="material-symbols-outlined text-on-surface-variant text-sm">help</span>
          </button>
        </div>

        {/* Main Content */}
        {gamePhase === 'loading' && <LoadingState />}
        {gamePhase === 'transitioning' && <TransitioningState />}
        {gamePhase === 'resolving' && <ResolvingState />}
        {(gamePhase === 'guest_active') && currentGuest && (
          <div className="grid grid-cols-12 gap-8 h-[calc(100vh-200px)] overflow-hidden">
            {/* Left: Guest Card */}
            <GuestCard
              guest={currentGuest}
              guestIndex={guestIndex}
              totalGuests={totalGuests}
              timerSeconds={timerSeconds}
              timerProgress={timerProgress}
              decisionMade={decisionMade}
              lastDecision={lastDecision}
              pendingDecision={pendingDecision}
              decisionError={decisionError}
              onAccept={() => handleDecision('accepted')}
              onReject={() => handleDecision('rejected')}
            />

            {/* Center: Availability Outlook */}
            <section className="col-span-6 h-full overflow-hidden">
              <AvailabilityGrid calendar={calendar} guestIndex={guestIndex} totalGuests={totalGuests} guestCount={guestCount} decisions={decisions} />
            </section>

            {/* Right: Decision History */}
            <section className="col-span-3 h-full overflow-hidden" data-tutorial="decision-log">
              <DecisionHistory decisions={decisions} guestIndex={guestIndex} />
            </section>
          </div>
        )}
        {gamePhase === 'results' && weekResults && (
          <ClassicResultsPhase
            results={weekResults}
            weekNumber={weekNumber}
            totalWeeks={totalWeeks}
            weekHistory={weekHistory}
            decisions={decisions}
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

function TransitioningState() {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center space-y-4">
        <span className="material-symbols-outlined text-primary text-6xl animate-bounce">directions_walk</span>
        <p className="font-headline font-bold text-on-secondary-container uppercase tracking-widest text-sm">
          Next guest arriving...
        </p>
      </div>
    </div>
  );
}

function ResolvingState() {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center space-y-4">
        <span className="material-symbols-outlined text-tertiary text-6xl animate-spin">autorenew</span>
        <p className="font-headline font-bold text-on-secondary-container uppercase tracking-widest text-sm">
          Resolving week outcomes...
        </p>
        <p className="text-outline text-xs">Applying cancellations and no-shows...</p>
      </div>
    </div>
  );
}

function GuestCard({ guest, guestIndex, totalGuests, timerSeconds, timerProgress, decisionMade, lastDecision, pendingDecision, decisionError, onAccept, onReject }) {
  const segment = SEGMENT_COLORS[guest.market_segment] || { bg: 'bg-on-surface-variant', label: guest.market_segment, icon: 'person' };
  const tierName = TIER_MAP[guest.room_tier] || 'standard';
  const tierDisplay = TIER_DISPLAY[tierName];
  const riskBadge = guest.risk_badge || 'Medium';
  const riskStyle = RISK_STYLES[riskBadge] || RISK_STYLES.Medium;

  // Timer color based on urgency
  const timerColor = timerSeconds > 20 ? 'text-tertiary' : timerSeconds > 10 ? 'text-amber-600' : 'text-error';
  const timerBarColor = timerSeconds > 20 ? 'bg-tertiary' : timerSeconds > 10 ? 'bg-amber-500' : 'bg-error';

  return (
    <section className="col-span-3 flex flex-col h-full overflow-hidden" data-tutorial="guest-card">
      <div className="bg-secondary-container/30 rounded-[36px] p-3 h-full flex flex-col items-center clay-slab border-4 border-white/20 overflow-hidden">
        <div className="w-full h-full bg-surface-container-lowest rounded-[24px] shadow-[8px_8px_0_0_#6e6444] relative overflow-hidden flex flex-col">
          {/* Segment identity banner */}
          <div className={`${segment.bg} rounded-t-[18px] flex items-center justify-between px-5 py-4 shrink-0`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>{segment.icon}</span>
              </div>
              <div>
                <p className="text-white/70 text-[8px] font-bold uppercase tracking-[0.1em]">{guest.market_segment}</p>
                <h3 className="text-white text-lg font-black leading-tight">{segment.label}</h3>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              {guest.is_repeated_guest ? (
                <span className="bg-white/25 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full">↻ Repeat</span>
              ) : null}
              {guest.has_special_requests ? (
                <span className="bg-white/25 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full">★ Special</span>
              ) : null}
              {guest.deposit_type === 'Non Refund' ? (
                <span className="bg-white/25 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full">⚠ Non-Ref</span>
              ) : null}
            </div>
          </div>

          {/* Content — justify-between spreads items evenly across height */}
          <div className="px-4 py-3 flex-grow flex flex-col justify-between min-h-0">
            {/* Room details */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-surface-container-low px-2 py-2 rounded-xl clay-inset-shadow text-center">
                <p className="text-[8px] font-bold text-on-surface-variant uppercase">Room</p>
                <p className="font-black text-xs">{tierDisplay.label}</p>
              </div>
              <div className="bg-surface-container-low px-2 py-2 rounded-xl clay-inset-shadow text-center">
                <p className="text-[8px] font-bold text-on-surface-variant uppercase">Stay</p>
                <p className="font-black text-xs">{guest.los} Night{guest.los > 1 ? 's' : ''}</p>
              </div>
              <div className="bg-surface-container-low px-2 py-2 rounded-xl clay-inset-shadow text-center">
                <p className="text-[8px] font-bold text-on-surface-variant uppercase">Arrival</p>
                <p className="font-black text-xs">Day {String(guest.arrival_day || 1).padStart(2, '0')}</p>
              </div>
            </div>

            {/* Financials */}
            <div className="py-3 text-center bg-surface-container-high/40 rounded-2xl border-2 border-white/50" data-tutorial="revenue-info">
              <p className="text-[9px] font-bold text-outline uppercase tracking-tighter">Revenue</p>
              <p className="text-2xl font-black text-on-surface tracking-tighter leading-none">${Math.round(guest.revenue_offered || 0).toLocaleString()}</p>
              <div className="mt-1 flex items-center justify-center gap-2">
                <span className="text-[9px] font-bold text-outline uppercase">Expected:</span>
                <span className="text-sm font-black text-tertiary">${Math.round(guest.expected_value || 0).toLocaleString()}</span>
              </div>
            </div>

            {/* Risk badge */}
            <div className={`${riskStyle} py-2 rounded-xl flex items-center justify-center gap-2 text-white`} data-tutorial="risk-badge">
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
              <span className="font-black text-[10px] uppercase tracking-widest">{riskBadge} Risk</span>
            </div>

            {/* Cancel / No-show / Extra — single 3-col row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-surface-container-low px-2 py-2 rounded-xl clay-inset-shadow text-center">
                <p className="text-[8px] font-bold text-outline uppercase">Cancel</p>
                <p className="font-black text-xs text-error">{Math.round((guest.p_cancel || 0) * 100)}%</p>
              </div>
              <div className="bg-surface-container-low px-2 py-2 rounded-xl clay-inset-shadow text-center">
                <p className="text-[8px] font-bold text-outline uppercase">No-Show</p>
                <p className="font-black text-xs text-error">{Math.round((guest.p_noshow || 0) * 100)}%</p>
              </div>
            </div>
          </div>

          {/* Timer bar */}
          <div className="px-4 py-2 shrink-0">
            <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
              <div
                className={`h-full ${timerBarColor} rounded-full transition-all duration-1000 ease-linear`}
                style={{ width: `${timerProgress * 100}%` }}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="px-4 pb-4 pt-2 shrink-0" data-tutorial="action-buttons">
            {decisionError && (
              <div className="mb-2 bg-error/10 border-2 border-error/30 rounded-xl px-3 py-1.5 flex items-center gap-2">
                <span className="material-symbols-outlined text-error text-sm">warning</span>
                <p className="text-[9px] font-bold text-error uppercase tracking-wider flex-grow">{decisionError}</p>
              </div>
            )}

            {pendingDecision ? (
              <div className="h-11 rounded-2xl flex items-center justify-center font-black text-[10px] uppercase tracking-widest bg-surface-container-highest/50 text-outline">
                <span className="material-symbols-outlined text-sm mr-2 animate-spin">progress_activity</span>
                Processing...
              </div>
            ) : !decisionMade ? (
              <div className="flex gap-3">
                <button
                  onClick={onAccept}
                  disabled={!!decisionError}
                  className={`flex-1 h-11 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                    decisionError
                      ? 'bg-outline/30 text-outline cursor-not-allowed shadow-[0_4px_0_0_#999]'
                      : 'bg-tertiary text-white shadow-[0_5px_0_0_#1a5a4c] hover:translate-y-0.5 hover:shadow-[0_2px_0_0_#1a5a4c]'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">check_circle</span> Accept
                </button>
                <button
                  onClick={onReject}
                  className="flex-1 bg-error text-white h-11 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-[0_5px_0_0_#93000a] hover:translate-y-0.5 hover:shadow-[0_2px_0_0_#93000a] transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">cancel</span> Reject
                </button>
              </div>
            ) : (
              <div className={`h-11 rounded-2xl flex items-center justify-center font-black text-[10px] uppercase tracking-widest ${
                lastDecision === 'accepted' ? 'bg-tertiary/20 text-tertiary' : 'bg-error/20 text-error'
              }`}>
                <span className="material-symbols-outlined text-base mr-2">
                  {lastDecision === 'accepted' ? 'check_circle' : 'cancel'}
                </span>
                {lastDecision === 'accepted' ? 'Accepted' : 'Rejected'} — next guest incoming
              </div>
            )}
          </div>
        </div>
        {/* Timer text under card */}
        <p className={`mt-2 font-black uppercase text-[9px] tracking-[0.15em] ${timerColor}`} data-tutorial="timer">
          {decisionMade ? 'Next guest incoming...' : `⏱ ${timerSeconds}s remaining`}
        </p>
      </div>
    </section>
  );
}

function AvailabilityGrid({ calendar, guestIndex = 0, totalGuests = 0, guestCount = 0, decisions = [] }) {
  return (
    <div className="bg-surface-container-high h-full rounded-[48px] p-6 clay-slab relative flex flex-col border-4 border-white/20 overflow-hidden" data-tutorial="availability">
      <h2 className="text-2xl font-black text-on-surface tracking-tight mb-4">Availability Outlook</h2>

      {calendar ? (
        <div className="flex-grow overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-black text-outline uppercase tracking-wider pb-3 pl-2 w-24">Tier</th>
                {DAY_LABELS.map(d => (
                  <th key={d} className="text-center text-[10px] font-black text-outline uppercase tracking-wider pb-3">{d}</th>
                ))}
                <th className="text-center text-[10px] font-black text-outline uppercase tracking-wider pb-3">Avg</th>
              </tr>
            </thead>
            <tbody>
              {TIER_NAMES.map(tierKey => {
                const days = calendar[tierKey];
                if (!days) return null;
                const avg = (days.reduce((s, v) => s + v, 0) / days.length).toFixed(1);
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
                      <span className="font-black text-sm text-tertiary">{avg}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Free rooms summary row */}
          <div className="mt-4 pt-4 border-t-2 border-dashed border-outline/20 grid grid-cols-8 gap-2">
            {DAY_LABELS.map((d, i) => {
              const free = TIER_NAMES.reduce((sum, t) => sum + (calendar[t]?.[i] || 0), 0);
              return (
                <div key={d} className="text-center">
                  <p className="text-[9px] font-bold text-outline uppercase mb-1">Free</p>
                  <p className="text-lg font-black text-primary">{free}</p>
                </div>
              );
            })}
            <div className="text-center bg-tertiary/10 rounded-xl p-1">
              <p className="text-[8px] font-bold text-tertiary uppercase">Avg Free</p>
              <p className="text-lg font-black text-tertiary">
                {(DAY_LABELS.reduce((sum, _, i) =>
                  sum + TIER_NAMES.reduce((s, t) => s + (calendar[t]?.[i] || 0), 0), 0) / 7).toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-grow flex items-center justify-center">
          <p className="text-outline font-bold uppercase text-xs tracking-widest">Loading inventory...</p>
        </div>
      )}

      {/* Stats Footer */}
      <div className="mt-4 flex justify-between items-center bg-surface-container-highest p-4 rounded-[2rem] clay-inset-shadow">
        <div className="text-center px-4 border-r border-outline/20">
          <p className="text-[10px] font-bold text-outline uppercase">Occupancy</p>
          <p className="text-xl font-black">
            {calendar ? `${Math.round((1 - TIER_NAMES.reduce((sum, t) => {
              const days = calendar[t] || [];
              return sum + days.reduce((s, v) => s + v, 0);
            }, 0) / Math.max(1, TIER_NAMES.reduce((sum, t) => {
              const days = calendar[t] || [];
              return sum + days.length * (days[0] !== undefined ? Math.max(...days, days.reduce((s, v) => s + v, 0) / days.length) : 0);
            }, 1))) * 100)}%` : '—'}
          </p>
        </div>
        <div className="text-center px-4 border-r border-outline/20">
          <p className="text-[10px] font-bold text-outline uppercase">Guests Seen</p>
          <p className="text-xl font-black">{guestIndex + 1} / {totalGuests || guestCount}</p>
        </div>
        <div className="text-center px-4">
          <p className="text-[10px] font-bold text-outline uppercase">Accepted</p>
          <p className="text-xl font-black text-tertiary">
            {decisions.filter(d => d.decision === 'accepted').length}
          </p>
        </div>
      </div>
    </div>
  );
}

function DecisionHistory({ decisions, guestIndex }) {
  return (
    <aside className="bg-stone-100 h-full rounded-[48px] p-6 shadow-[-8px_0_0_0_rgba(104,94,62,1)] flex flex-col border-4 border-white/10 overflow-hidden">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center shadow-[4px_4px_0_0_#ddc0ba]">
          <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>history</span>
        </div>
        <div>
          <h2 className="text-lg font-extrabold leading-none">Decision Log</h2>
          <p className="text-xs text-stone-500 font-bold">{decisions.length} decisions made</p>
        </div>
      </div>

      <div className="space-y-2 overflow-y-auto pr-2 flex-grow min-h-0">
        {decisions.length === 0 ? (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-outline text-4xl mb-2">pending</span>
            <p className="text-outline text-xs font-bold">No decisions yet</p>
          </div>
        ) : (
          decisions.map((d, i) => {
            const isAccepted = d.decision === 'accepted';
            const isTimeout = d.decision === 'timeout';
            const guest = d.guest;
            const tierName = guest ? (TIER_MAP[guest.room_tier] || 'standard') : null;
            const tierDisplay = tierName ? TIER_DISPLAY[tierName] : null;
            const riskBadge = guest?.risk_badge || 'Medium';
            return (
              <div
                key={i}
                className={`p-3 rounded-2xl flex items-center gap-3 transition-all ${
                  isAccepted ? 'bg-tertiary/10' : isTimeout ? 'bg-amber-100' : 'bg-error/10'
                }`}
              >
                <span className="font-black text-stone-400 w-6 text-xs">
                  {String(d.index + 1).padStart(2, '0')}
                </span>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  isAccepted ? 'bg-tertiary' : isTimeout ? 'bg-amber-500' : 'bg-error'
                }`}>
                  <span className="material-symbols-outlined text-white text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {isAccepted ? 'check' : isTimeout ? 'timer_off' : 'close'}
                  </span>
                </div>
                <div className="flex-grow min-w-0">
                  <p className="font-bold text-xs text-on-surface truncate">{guest?.market_segment || 'Guest'}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] text-outline font-bold">${Math.round(guest?.revenue_offered || 0)}</span>
                    <span className="text-[9px] text-outline">·</span>
                    <span className="text-[9px] text-outline font-bold">{guest?.los || '?'}N</span>
                    {tierDisplay && (
                      <>
                        <span className="text-[9px] text-outline">·</span>
                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${tierDisplay.color}`}>{tierDisplay.label}</span>
                      </>
                    )}
                    {guest && (
                      <>
                        <span className="text-[9px] text-outline">·</span>
                        <span className={`text-[8px] font-black uppercase ${
                          riskBadge === 'Low' ? 'text-tertiary' : riskBadge === 'High' ? 'text-error' : 'text-amber-600'
                        }`}>{riskBadge}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className={`text-[9px] font-black uppercase shrink-0 ${
                  isAccepted ? 'text-tertiary' : isTimeout ? 'text-amber-600' : 'text-error'
                }`}>
                  {isAccepted ? '✓' : isTimeout ? '⏱' : '✗'}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Summary stats at bottom */}
      <div className="mt-auto pt-4 border-t border-outline/10 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[9px] font-bold text-outline uppercase">Accepted</p>
          <p className="font-black text-tertiary">{decisions.filter(d => d.decision === 'accepted').length}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold text-outline uppercase">Rejected</p>
          <p className="font-black text-error">{decisions.filter(d => d.decision === 'rejected').length}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold text-outline uppercase">Timeout</p>
          <p className="font-black text-amber-600">{decisions.filter(d => d.decision === 'timeout').length}</p>
        </div>
      </div>
    </aside>
  );
}

function ClassicResultsPhase({ results, weekNumber, totalWeeks, weekHistory, decisions, onNextWeek }) {
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
          <StatCard label="Total Guests" value={results.total_guests || 0} icon="groups" color="text-on-surface-variant" />
        </div>

        {/* Next Week Button */}
        <button
          onClick={onNextWeek}
          className="w-full bg-primary text-white py-4 rounded-2xl font-headline font-black text-sm uppercase tracking-widest shadow-[0_8px_0_0_#2a1410] hover:-translate-y-1 hover:shadow-[0_10px_0_0_#2a1410] active:translate-y-1 active:shadow-[0_2px_0_0_#2a1410] transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined">{isLast ? 'emoji_events' : 'skip_next'}</span>
          {isLast ? 'View Final Results' : `Start Week ${weekNumber + 1}`}
        </button>
      </section>

      {/* Right: Decision Summary & Trend */}
      <section className="col-span-7">
        <div className="bg-surface-container-high h-full rounded-[2rem] p-6 clay-slab flex flex-col border-4 border-white/20">
          <h2 className="text-xl font-black font-headline text-on-surface tracking-tight mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">analytics</span>
            Decision Analysis
          </h2>

          {/* Decision distribution */}
          <div className="mb-4">
            <h3 className="font-black text-xs text-outline uppercase tracking-wider mb-2">Your Decisions This Week</h3>
            <div className="flex gap-3">
              {[
                { label: 'Accepted', count: decisions.filter(d => d.decision === 'accepted').length, color: 'bg-tertiary', textColor: 'text-white' },
                { label: 'Rejected', count: decisions.filter(d => d.decision === 'rejected').length, color: 'bg-error', textColor: 'text-white' },
                { label: 'Timeout', count: decisions.filter(d => d.decision === 'timeout').length, color: 'bg-amber-500', textColor: 'text-white' },
              ].map(item => (
                <div key={item.label} className={`flex-1 ${item.color} ${item.textColor} rounded-xl p-3 text-center`}>
                  <p className="text-2xl font-black">{item.count}</p>
                  <p className="text-[8px] font-bold uppercase tracking-wider opacity-80">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

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
              <p className="text-[10px] font-bold text-outline uppercase">Checked Out</p>
              <p className="text-xl font-black text-tertiary">{results.guests_checked_out || 0}</p>
            </div>
            <div className="text-center px-4 border-r border-outline/20">
              <p className="text-[10px] font-bold text-outline uppercase">Occupancy</p>
              <p className="text-xl font-black">{Math.round((results.occupancy_rate || 0) * 100)}%</p>
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
