import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../stores/authStore';

export default function TopAppBar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  const NAV_ITEMS = [
    { path: '/dashboard', label: 'Dashboard', icon: 'space_dashboard' },
    { path: '/leaderboard', label: 'Leaderboard', icon: 'leaderboard' },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-8 h-[72px] bg-[#685e3e] shadow-[0_6px_0_0_rgba(59,53,35,1)]">
      {/* Brand */}
      <div
        className="flex items-center gap-3 cursor-pointer group"
        onClick={() => navigate('/dashboard')}
      >
        <div className="w-10 h-10 bg-secondary-container rounded-2xl shadow-[0_3px_0_0_rgba(0,0,0,0.15)] flex items-center justify-center group-hover:scale-105 transition-transform">
          <span
            className="material-symbols-outlined text-primary text-2xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >apartment</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-black text-[#f0e2ba] uppercase tracking-tight font-headline leading-none">RoomSet</span>
          <span className="text-[8px] font-bold text-[#f0e2ba]/40 uppercase tracking-[0.3em] leading-none">Revenue Sim</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="hidden md:flex items-center bg-[#5c5336]/50 rounded-full p-1 gap-1">
        {NAV_ITEMS.map(item => (
          <button
            key={item.path}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold font-headline tracking-tight transition-all ${
              isActive(item.path)
                ? 'bg-[#f0e2ba] text-[#4f4629] shadow-[0_3px_0_0_rgba(0,0,0,0.1)]'
                : 'text-[#f0e2ba]/60 hover:text-[#f0e2ba] hover:bg-[#f0e2ba]/10'
            }`}
            onClick={() => navigate(item.path)}
          >
            <span
              className="material-symbols-outlined text-base"
              style={isActive(item.path) ? { fontVariationSettings: "'FILL' 1" } : {}}
            >{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {/* User */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-end">
          <span className="text-[#f0e2ba] font-bold text-sm leading-tight">{user?.name || 'Player'}</span>
          {user?.branch && (
            <span className="text-[#f0e2ba]/40 text-[9px] uppercase font-bold tracking-widest leading-tight">{user.branch}</span>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="w-9 h-9 rounded-xl bg-[#f0e2ba]/10 text-[#f0e2ba]/70 flex items-center justify-center hover:bg-[#f0e2ba]/20 hover:text-[#f0e2ba] transition-all"
          title="Sign out"
        >
          <span className="material-symbols-outlined text-lg">logout</span>
        </button>
      </div>
    </nav>
  );
}
