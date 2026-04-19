import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';

export default function LandingPage() {
  const [showSignUp, setShowSignUp] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', branch: '' });
  const { login, register, loading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await login(formData.email, formData.password);
      navigate('/dashboard');
    } catch {
      // error is set in store
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    try {
      await register(formData.name, formData.email, formData.password, formData.branch || null);
      navigate('/dashboard');
    } catch {
      // error is set in store
    }
  };

  const toggleMode = () => {
    setShowSignUp(!showSignUp);
    clearError();
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden" style={{ backgroundColor: '#f5f0eb' }}>
      {/* Left — Branding Panel */}
      <div
        className="hidden md:flex md:w-[45%] flex-col items-center justify-center relative"
        style={{ backgroundColor: '#4a3228' }}
      >
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }} />

        {/* Hotel illustration */}
        <div className="relative z-10 flex flex-col items-center">
          <AnimatedHotel />
          <div className="mt-8 text-center">
            <h1 className="font-headline text-4xl font-extrabold text-white/95 tracking-tight uppercase leading-none">
              RoomSet
            </h1>
            <p className="mt-3 text-white/50 text-sm font-bold tracking-widest uppercase">
              Hotel Revenue Management
            </p>
          </div>

          {/* Feature pills */}
          <div className="mt-10 flex flex-col gap-3 items-center">
            {[
              { icon: 'psychology', text: 'ML-Driven Guest Simulation' },
              { icon: 'monitoring', text: 'Real-time Revenue Analytics' },
              { icon: 'emoji_events', text: 'Competitive Leaderboards' },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
                <span className="material-symbols-outlined text-white/70 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{f.icon}</span>
                <span className="text-white/70 text-[11px] font-bold tracking-wide">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom subtle decoration */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          <div className="w-2 h-2 rounded-full bg-white/20" />
          <div className="w-2 h-2 rounded-full bg-white/30" />
          <div className="w-2 h-2 rounded-full bg-white/20" />
        </div>
      </div>

      {/* Right — Form Panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 relative">
        {/* Mobile-only branding */}
        <div className="md:hidden text-center mb-8">
          <h1 className="font-headline text-3xl font-extrabold tracking-tight uppercase" style={{ color: '#4a3228' }}>
            RoomSet
          </h1>
          <p className="text-outline text-xs font-bold tracking-widest uppercase mt-1">Hotel Revenue Management</p>
        </div>

        {/* Form card */}
        <div className="w-full max-w-sm">
          <div className="mb-6">
            <h2 className="font-headline text-2xl font-extrabold text-on-surface">
              {showSignUp ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-outline text-sm mt-1">
              {showSignUp ? 'Join the simulation and start managing' : 'Sign in to continue your game'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-error-container rounded-xl text-on-error-container font-body text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-error text-base">warning</span>
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={showSignUp ? handleSignUp : handleLogin}>
            {showSignUp && (
              <InputField
                icon="person"
                label="Full Name"
                placeholder="Enter your full name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            )}

            <InputField
              icon="mail"
              label="Email"
              placeholder="Enter your email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />

            <InputField
              icon="lock"
              label="Password"
              placeholder={showSignUp ? 'Create a password' : 'Enter your password'}
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />

            {showSignUp && (
              <InputField
                icon="school"
                label="Branch (optional)"
                placeholder="e.g. CSE, ECE, ME"
                type="text"
                name="branch"
                value={formData.branch}
                onChange={handleChange}
              />
            )}

            <button
              className="w-full py-3.5 mt-2 text-white font-headline text-sm font-black rounded-2xl shadow-[0_5px_0_0_#2a1410] hover:-translate-y-0.5 hover:shadow-[0_7px_0_0_#2a1410] active:translate-y-0.5 active:shadow-[0_2px_0_0_#2a1410] transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#4a3228' }}
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                  {showSignUp ? 'Creating...' : 'Signing in...'}
                </>
              ) : (
                <>
                  {showSignUp ? 'Create Account' : 'Sign In'}
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          {/* Toggle mode */}
          <div className="mt-6 text-center">
            <button
              className="text-sm text-outline hover:text-on-surface transition-colors"
              onClick={toggleMode}
            >
              {showSignUp ? (
                <>Already have an account? <span className="font-bold" style={{ color: '#4a3228' }}>Sign in</span></>
              ) : (
                <>Don't have an account? <span className="font-bold" style={{ color: '#4a3228' }}>Create one</span></>
              )}
            </button>
          </div>
        </div>


      </div>
    </div>
  );
}

/* --- Sub-Components --- */

function InputField({ icon, label, placeholder, type, name, value, onChange, required }) {
  return (
    <div>
      <label className="block text-xs font-bold text-on-surface-variant mb-1.5 ml-1">{label}</label>
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-lg">{icon}</span>
        <input
          className="w-full pl-11 pr-4 py-3 bg-surface-container-high border-2 border-outline/10 rounded-xl font-body text-sm text-on-surface placeholder:text-outline/50 focus:border-primary/40 focus:bg-surface-container-lowest outline-none transition-all"
          placeholder={placeholder}
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
        />
      </div>
    </div>
  );
}


function AnimatedHotel() {
  // Window states: some lit, some dim, some flickering
  const floors = [
    [true, true, false, true],   // top floor
    [false, true, true, true],   // 3rd
    [true, false, true, false],  // 2nd
    [true, true, true, true],    // 1st
  ];

  return (
    <div className="relative select-none" style={{ width: 180, height: 220 }}>
      {/* Ambient glow behind building */}
      <div className="absolute -inset-8 rounded-full opacity-20" style={{
        background: 'radial-gradient(ellipse at center bottom, rgba(255,200,100,0.4) 0%, transparent 70%)',
      }} />

      {/* Main building */}
      <div className="relative w-full h-full">
        {/* Building body */}
        <div className="absolute bottom-0 left-4 right-4 top-6 rounded-t-lg" style={{
          backgroundColor: '#d4a88c',
          boxShadow: '6px 6px 0 0 rgba(60,20,10,0.25)',
        }}>
          {/* Decorative cornice */}
          <div className="absolute -top-2 -left-1 -right-1 h-3 rounded-t-md" style={{ backgroundColor: '#c4957a' }} />
          <div className="absolute top-2 left-0 right-0 h-[2px]" style={{ backgroundColor: '#b8876c' }} />

          {/* Windows grid */}
          <div className="px-3 pt-5">
            {floors.map((row, fi) => (
              <div key={fi} className="flex justify-between mb-3">
                {row.map((lit, wi) => (
                  <Window key={wi} lit={lit} delay={fi * 0.8 + wi * 1.2} />
                ))}
              </div>
            ))}
          </div>

          {/* Floor dividers */}
          {[0, 1, 2].map(i => (
            <div key={i} className="absolute left-0 right-0 h-[1px] opacity-30" style={{
              top: `${28 + i * 22}%`,
              backgroundColor: '#b8876c',
            }} />
          ))}
        </div>

        {/* Roof */}
        <div className="absolute top-0 left-1 right-1 h-8 rounded-t-xl" style={{
          backgroundColor: '#8b5e3c',
          boxShadow: '0 -2px 0 0 #7a5234 inset',
        }}>
          {/* Roof trim */}
          <div className="absolute -bottom-1 left-0 right-0 h-2" style={{ backgroundColor: '#a06b48' }} />
        </div>

        {/* Flag pole */}
        <div className="absolute top-[-12px] left-1/2 -translate-x-1/2">
          <div className="w-[2px] h-5 bg-[#7a5234] mx-auto" />
          <div className="absolute top-0 left-1 animate-[sway_3s_ease-in-out_infinite]" style={{ transformOrigin: 'left center' }}>
            <div className="w-5 h-3 rounded-sm" style={{ backgroundColor: '#c0392b' }} />
          </div>
        </div>

        {/* Entrance */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14">
          {/* Canopy */}
          <div className="absolute -top-3 -left-2 -right-2 h-4 rounded-t-lg" style={{
            backgroundColor: '#8b3a2a',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }} />
          {/* Door frame */}
          <div className="w-full h-14 rounded-t-xl overflow-hidden" style={{ backgroundColor: '#5a2d1a' }}>
            {/* Door glow */}
            <div className="w-full h-full animate-[glow_4s_ease-in-out_infinite]" style={{
              background: 'linear-gradient(to top, rgba(255,200,100,0.5) 0%, rgba(255,180,80,0.15) 60%, transparent 100%)',
            }} />
            {/* Door line */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[1px] h-10 bg-white/10" />
            {/* Door handle */}
            <div className="absolute top-6 right-3 w-1.5 h-1.5 rounded-full bg-yellow-300/60" />
          </div>
        </div>

        {/* Steps */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-20 h-2 rounded-b" style={{ backgroundColor: '#c4957a' }} />
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-24 h-2 rounded-b" style={{ backgroundColor: '#b8876c' }} />
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes sway {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(6deg); }
        }
        @keyframes glow {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @keyframes flicker {
          0%, 100% { opacity: 1; }
          40% { opacity: 1; }
          42% { opacity: 0.3; }
          44% { opacity: 1; }
          80% { opacity: 1; }
          82% { opacity: 0.4; }
          84% { opacity: 1; }
        }
        @keyframes softPulse {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function Window({ lit, delay }) {
  const style = lit ? {
    backgroundColor: '#ffeebb',
    boxShadow: '0 0 6px 1px rgba(255,220,120,0.3)',
    animation: `softPulse ${3 + delay * 0.5}s ease-in-out ${delay}s infinite`,
  } : {
    backgroundColor: '#7a5c4a',
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)',
  };

  return (
    <div className="w-7 h-8 rounded-t-md rounded-b-sm relative" style={style}>
      {/* Window panes */}
      <div className="absolute inset-0 flex">
        <div className="flex-1 border-r" style={{ borderColor: lit ? 'rgba(180,140,80,0.3)' : 'rgba(0,0,0,0.15)' }} />
        <div className="flex-1" />
      </div>
      <div className="absolute left-0 right-0 top-1/2 h-[1px]" style={{ backgroundColor: lit ? 'rgba(180,140,80,0.3)' : 'rgba(0,0,0,0.15)' }} />
      {/* Sill */}
      <div className="absolute -bottom-[2px] -left-[1px] -right-[1px] h-[2px] rounded-b" style={{ backgroundColor: '#b8876c' }} />
    </div>
  );
}
