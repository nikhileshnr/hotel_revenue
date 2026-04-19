import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopAppBar from '../components/TopAppBar';
import api from '../lib/api';

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [selectedBranch]);

  const fetchBranches = async () => {
    try {
      const res = await api.get('/api/sessions/branches');
      setBranches(res.data || []);
    } catch (err) {
      console.error('[Leaderboard] Failed to load branches:', err);
    }
  };

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const params = selectedBranch ? `?branch=${encodeURIComponent(selectedBranch)}` : '';
      const res = await api.get(`/api/sessions/leaderboard${params}`);
      setLeaderboard(res.data || []);
    } catch (err) {
      console.error('[Leaderboard] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  };

  const getMedalIcon = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen">
      <TopAppBar />
      <main className="pt-28 px-8 pb-24 max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between animate-slide-up">
          <div className="flex items-center gap-4">
            <button
              className="w-10 h-10 bg-surface-container-low rounded-xl shadow-[0_3px_0_0_#dbdad7] flex items-center justify-center hover:-translate-y-0.5 transition-all"
              onClick={() => navigate('/dashboard')}
            >
              <span className="material-symbols-outlined text-on-surface-variant text-lg">arrow_back</span>
            </button>
            <div>
              <h1 className="text-3xl font-black font-headline text-on-surface-variant uppercase tracking-tight">Leaderboard</h1>
              <p className="text-outline font-medium text-xs">Top players ranked by total revenue</p>
            </div>
          </div>
        </div>

        {/* Branch Filter */}
        {branches.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap animate-slide-up" style={{ animationDelay: '0.05s' }}>
            <span className="material-symbols-outlined text-outline text-lg">filter_list</span>
            <button
              className={`px-4 py-2 rounded-full font-bold text-xs uppercase tracking-wider transition-all ${
                !selectedBranch
                  ? 'bg-primary text-white shadow-[0_3px_0_0_#2a1410]'
                  : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-variant'
              }`}
              onClick={() => setSelectedBranch('')}
            >
              All
            </button>
            {branches.map((b) => (
              <button
                key={b}
                className={`px-4 py-2 rounded-full font-bold text-xs uppercase tracking-wider transition-all ${
                  selectedBranch === b
                    ? 'bg-primary text-white shadow-[0_3px_0_0_#2a1410]'
                    : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-variant'
                }`}
                onClick={() => setSelectedBranch(b)}
              >
                {b}
              </button>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {loading ? (
            <div className="text-center py-16">
              <span className="material-symbols-outlined text-outline text-5xl animate-spin">progress_activity</span>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-20 bg-surface-container-low rounded-[2.5rem] shadow-[0_6px_0_0_#dbdad7]">
              <div className="w-16 h-16 bg-surface-container-highest rounded-3xl flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-outline text-3xl">emoji_events</span>
              </div>
              <p className="font-headline font-bold text-on-surface-variant text-lg">No completed sessions yet</p>
              <p className="text-outline text-sm mt-1">Complete a game to appear on the leaderboard!</p>
            </div>
          ) : (
            <div className="bg-surface-container-low rounded-[2rem] shadow-[0_6px_0_0_#dbdad7] overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-12 gap-4 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-outline border-b border-outline/10">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-6">Player</div>
                <div className="col-span-2 text-center">Hotel</div>
                <div className="col-span-3 text-right">Revenue</div>
              </div>

              {/* Rows */}
              {leaderboard.map((entry, i) => (
                <div
                  key={`${entry.user_id}-${entry.rank}`}
                  className={`grid grid-cols-12 gap-4 px-6 py-4 items-center transition-colors ${
                    i % 2 === 0 ? '' : 'bg-surface-container-highest/30'
                  } ${entry.rank <= 3 ? 'border-l-4' : 'border-l-4 border-transparent'} ${
                    entry.rank === 1 ? 'border-l-yellow-400' : entry.rank === 2 ? 'border-l-gray-400' : entry.rank === 3 ? 'border-l-orange-400' : ''
                  }`}
                >
                  {/* Rank */}
                  <div className="col-span-1 text-center">
                    {getMedalIcon(entry.rank) ? (
                      <span className="text-xl">{getMedalIcon(entry.rank)}</span>
                    ) : (
                      <span className="text-sm font-black text-outline">{entry.rank}</span>
                    )}
                  </div>

                  {/* Player */}
                  <div className="col-span-6 flex items-center gap-3">
                    <div className="w-9 h-9 bg-surface-container-highest rounded-xl flex items-center justify-center shrink-0">
                      <span className="text-sm font-black text-on-surface-variant">{(entry.name?.[0] || '?').toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-bold text-sm text-on-surface leading-tight">{entry.name}</p>
                      {entry.branch && (
                        <span className="text-[10px] font-bold text-outline uppercase tracking-wider">{entry.branch}</span>
                      )}
                    </div>
                  </div>

                  {/* Hotel */}
                  <div className="col-span-2 text-center">
                    <span className="text-xs font-bold text-outline capitalize flex items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-xs">{entry.hotel_type === 'resort' ? 'holiday_village' : 'location_city'}</span>
                      {entry.hotel_type}
                    </span>
                  </div>

                  {/* Revenue */}
                  <div className="col-span-3 text-right">
                    <span className={`text-lg font-black font-headline ${entry.rank <= 3 ? 'text-tertiary' : 'text-on-surface-variant'}`}>
                      ${entry.total_revenue.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
