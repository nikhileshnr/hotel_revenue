import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopAppBar from '../components/TopAppBar';
import CreateSessionModal from '../components/CreateSessionModal';
import api from '../lib/api';

export default function Dashboard() {
  const [sessions, setSessions] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await api.get('/api/sessions/mine');
      setSessions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('[Dashboard] Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSessionCreated = (session) => {
    setShowCreateModal(false);
    if (session?.id) {
      const route = session.game_mode === 'classic' ? 'classic' : 'game';
      navigate(`/session/${session.id}/${route}`);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm('Delete this session? This cannot be undone.')) return;
    try {
      await api.delete(`/api/sessions/${sessionId}`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (err) {
      console.error('[Dashboard] Failed to delete session:', err);
    }
  };

  // Separate active and completed sessions
  const activeSessions = sessions.filter(s => s.status === 'active');
  const completedSessions = sessions.filter(s => s.status !== 'active');

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen">
      <TopAppBar />
      <main className="pt-24 px-6 pb-16 max-w-5xl mx-auto">

        {/* Welcome header */}
        <div className="flex items-end justify-between mb-8 animate-slide-up">
          <div>
            <p className="text-xs font-bold text-outline uppercase tracking-widest mb-1">Dashboard</p>
            <h1 className="text-2xl font-black font-headline text-on-surface tracking-tight">Your Simulations</h1>
          </div>
          <div className="flex gap-2">
            <button
              className="flex items-center gap-2 bg-surface-container-low px-4 py-2.5 rounded-xl border border-outline/10 hover:border-outline/25 transition-all text-on-surface-variant"
              onClick={() => navigate('/leaderboard')}
            >
              <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>leaderboard</span>
              <span className="font-bold text-xs uppercase tracking-wider">Leaderboard</span>
            </button>
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-all hover:-translate-y-0.5 shadow-[0_4px_0_0_#2a1410] active:translate-y-0 active:shadow-[0_1px_0_0_#2a1410]"
              style={{ backgroundColor: '#4a3228' }}
              onClick={() => setShowCreateModal(true)}
            >
              <span className="material-symbols-outlined text-lg">add</span>
              New Session
            </button>
          </div>
        </div>

        {/* Active Sessions */}
        {activeSessions.length > 0 && (
          <section className="mb-8 animate-slide-up" style={{ animationDelay: '0.05s' }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <h2 className="text-sm font-black font-headline text-on-surface-variant uppercase tracking-wider">Active</h2>
              <span className="text-[10px] font-bold text-outline bg-surface-container-highest px-2 py-0.5 rounded-full">{activeSessions.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeSessions.map((session) => (
                <SessionCard key={session.id} session={session} navigate={navigate} onDelete={handleDeleteSession} />
              ))}
            </div>
          </section>
        )}

        {/* All Sessions / Empty State */}
        <section className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {completedSessions.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-outline text-lg">history</span>
              <h2 className="text-sm font-black font-headline text-on-surface-variant uppercase tracking-wider">Past Sessions</h2>
              <span className="text-[10px] font-bold text-outline bg-surface-container-highest px-2 py-0.5 rounded-full">{completedSessions.length}</span>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-surface-container-low rounded-2xl h-44 skeleton-pulse" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-16 bg-surface-container-low/50 rounded-2xl border border-outline/5">
              <span className="material-symbols-outlined text-outline/30 text-5xl mb-3 block">sports_esports</span>
              <p className="font-headline font-bold text-on-surface-variant text-base">No simulations yet</p>
              <p className="text-outline text-sm mt-1 mb-5">Create your first session to start playing</p>
              <button
                className="text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest shadow-[0_4px_0_0_#2a1410] hover:-translate-y-0.5 transition-all"
                style={{ backgroundColor: '#4a3228' }}
                onClick={() => setShowCreateModal(true)}
              >
                Create Session
              </button>
            </div>
          ) : completedSessions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedSessions.map((session) => (
                <SessionCard key={session.id} session={session} navigate={navigate} onDelete={handleDeleteSession} />
              ))}
            </div>
          ) : null}
        </section>
      </main>

      {showCreateModal && (
        <CreateSessionModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleSessionCreated}
        />
      )}
    </div>
  );
}

function SessionCard({ session, navigate, onDelete }) {
  const hotelTypeIcons = {
    city: { icon: 'location_city', label: 'City' },
    resort: { icon: 'holiday_village', label: 'Resort' },
  };
  const ht = hotelTypeIcons[session.hotel_type] || hotelTypeIcons.city;
  const gameMode = session.game_mode || 'pricing';
  const modeLabel = gameMode === 'classic' ? 'Classic' : 'Pricing';
  const modeIcon = gameMode === 'classic' ? 'person_search' : 'sell';
  const isActive = session.status === 'active';
  const isCompleted = session.status === 'completed';
  const progress = session.total_weeks > 0 ? ((session.current_week || 0) / session.total_weeks) * 100 : 0;

  return (
    <div
      className="bg-surface-container-lowest rounded-2xl border border-outline/8 hover:border-outline/20 transition-all hover:-translate-y-0.5 flex flex-col cursor-pointer group"
      onClick={() => {
        if (isActive) {
          const route = gameMode === 'classic' ? 'classic' : 'game';
          navigate(`/session/${session.id}/${route}`);
        } else {
          navigate(`/session/${session.id}/results`);
        }
      }}
    >
      <div className="p-4 flex flex-col gap-3 flex-grow">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isActive ? 'bg-primary/10' : 'bg-surface-container-highest'
            }`}>
              <span className="material-symbols-outlined text-base" style={{
                fontVariationSettings: "'FILL' 1",
                color: isActive ? '#4a3228' : '#888',
              }}>{ht.icon}</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-on-surface">{ht.label} Hotel</span>
                <span className="text-[9px] text-outline">·</span>
                <span className={`text-[9px] font-bold uppercase tracking-wider ${
                  gameMode === 'classic' ? 'text-primary' : 'text-tertiary'
                }`}>
                  {modeLabel}
                </span>
              </div>
              <p className="text-[10px] text-outline">
                {session.created_at ? new Date(session.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
              </p>
            </div>
          </div>
          <div className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
            isActive ? 'bg-primary/10 text-primary' : isCompleted ? 'bg-tertiary/10 text-tertiary' : 'bg-outline/10 text-outline'
          }`}>
            {isActive ? 'Active' : isCompleted ? 'Done' : session.status}
          </div>
        </div>

        {/* Progress */}
        <div>
          <div className="flex justify-between mb-1.5">
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Progress</span>
            <span className="text-[10px] font-black text-on-surface-variant">
              Week {session.current_week || 0} / {session.total_weeks || '—'}
            </span>
          </div>
          <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-tertiary' : 'bg-primary'}`}
              style={{ width: `${isCompleted ? 100 : progress}%` }}
            />
          </div>
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between mt-auto pt-1">
          <button
            className="text-[10px] text-error/40 hover:text-error font-bold flex items-center gap-0.5 transition-colors"
            onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
            title="Delete session"
          >
            <span className="material-symbols-outlined text-xs">delete</span>
            Delete
          </button>
          <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 group-hover:gap-2 transition-all ${
            isActive ? 'text-primary' : 'text-on-surface-variant'
          }`}>
            {isActive ? 'Continue' : 'View Results'}
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </span>
        </div>
      </div>
    </div>
  );
}
