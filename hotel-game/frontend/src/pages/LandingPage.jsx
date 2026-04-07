import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState('student');
  const [showSignUp, setShowSignUp] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const { login, register, loading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const user = await login(formData.email, formData.password);
      navigate(user.role === 'teacher' ? '/dashboard' : '/student-dashboard');
    } catch {
      // error is set in store
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    try {
      const user = await register(formData.name, formData.email, formData.password, 'student');
      navigate('/student-dashboard');
    } catch {
      // error is set in store
    }
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setShowSignUp(false);
    setFormData({ name: '', email: '', password: '' });
    clearError();
  };

  // Sign Up View
  if (showSignUp) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 overflow-x-hidden"
           style={{ backgroundColor: '#9f402d' }}>
        {/* Hotel Building */}
        <HotelBuilding />

        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="font-headline text-4xl md:text-5xl font-extrabold text-surface-container-lowest tracking-tight uppercase leading-none drop-shadow-[5px_5px_0px_#5a0d02]">
            Hotel Revenue<br />Management Game
          </h1>
        </div>

        {/* Sign Up Card */}
        <div className="w-full max-w-md bg-surface-bright rounded-xl p-8 clay-card-shadow border-t-4 border-l-4 border-white">
          <h2 className="font-headline text-2xl font-extrabold text-primary mb-6 text-center">
            Create Student Account
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-error-container rounded-lg text-on-error-container font-body text-sm">
              {error}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSignUp}>
            <div className="space-y-2">
              <label className="block font-headline text-secondary font-bold text-sm ml-4">Full Name</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">person</span>
                <input
                  className="w-full pl-12 pr-6 py-4 bg-surface-container-highest border-none rounded-lg font-body text-on-surface placeholder:text-outline clay-inset-shadow focus:ring-4 focus:ring-primary-container outline-none"
                  placeholder="Enter your full name..."
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block font-headline text-secondary font-bold text-sm ml-4">Email</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">mail</span>
                <input
                  className="w-full pl-12 pr-6 py-4 bg-surface-container-highest border-none rounded-lg font-body text-on-surface placeholder:text-outline clay-inset-shadow focus:ring-4 focus:ring-primary-container outline-none"
                  placeholder="Enter your email..."
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block font-headline text-secondary font-bold text-sm ml-4">Password</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">lock</span>
                <input
                  className="w-full pl-12 pr-6 py-4 bg-surface-container-highest border-none rounded-lg font-body text-on-surface placeholder:text-outline clay-inset-shadow focus:ring-4 focus:ring-primary-container outline-none"
                  placeholder="Create a password..."
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                className="w-full py-5 bg-tertiary text-white font-headline text-xl font-black rounded-full clay-button-shadow transition-all active:translate-y-1 active:shadow-none hover:bg-tertiary-container group disabled:opacity-50"
                type="submit"
                disabled={loading}
              >
                <span className="flex items-center justify-center gap-2">
                  {loading ? 'CREATING ACCOUNT...' : 'JOIN THE GAME'}
                  <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </span>
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <button
              className="text-sm font-bold text-outline hover:text-primary transition-colors"
              onClick={() => { setShowSignUp(false); clearError(); }}
            >
              Already have an account? Log in
            </button>
          </div>
        </div>

        <DecorativeElements />
      </div>
    );
  }

  // Login View (Teacher/Student toggle)
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 overflow-x-hidden"
         style={{ backgroundColor: '#9f402d' }}>
      {/* Hotel Building */}
      <HotelBuilding />

      {/* Title */}
      <div className="text-center mb-12">
        <h1 className="font-headline text-4xl md:text-5xl font-extrabold text-surface-container-lowest tracking-tight uppercase leading-none drop-shadow-[5px_5px_0px_#5a0d02]">
          Hotel Revenue<br />Management Game
        </h1>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-md bg-surface-bright rounded-xl p-8 clay-card-shadow border-t-4 border-l-4 border-white">
        {/* Role Toggle */}
        <div className="flex gap-4 mb-10 bg-surface-container-high p-2 rounded-full clay-inset-shadow">
          <button
            className={`flex-1 py-3 px-6 font-headline font-bold rounded-full transition-all ${
              activeTab === 'teacher'
                ? 'bg-tertiary text-white clay-button-shadow active:translate-y-1 active:shadow-none'
                : 'bg-surface-container-highest text-secondary hover:bg-surface-variant'
            }`}
            onClick={() => switchTab('teacher')}
          >
            Teacher
          </button>
          <button
            className={`flex-1 py-3 px-6 font-headline font-bold rounded-full transition-all ${
              activeTab === 'student'
                ? 'bg-tertiary text-white clay-button-shadow active:translate-y-1 active:shadow-none'
                : 'bg-surface-container-highest text-secondary hover:bg-surface-variant'
            }`}
            onClick={() => switchTab('student')}
          >
            Student
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-error-container rounded-lg text-on-error-container font-body text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form className="space-y-6" onSubmit={handleLogin}>
          <div className="space-y-2">
            <label className="block font-headline text-secondary font-bold text-sm ml-4">
              {activeTab === 'teacher' ? 'User ID' : 'Student ID'}
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">key</span>
              <input
                className="w-full pl-12 pr-6 py-4 bg-surface-container-highest border-none rounded-lg font-body text-on-surface placeholder:text-outline clay-inset-shadow focus:ring-4 focus:ring-primary-container outline-none"
                placeholder={activeTab === 'teacher' ? 'Enter your user ID...' : 'Enter your student ID...'}
                type="text"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block font-headline text-secondary font-bold text-sm ml-4">Password</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">person</span>
              <input
                className="w-full pl-12 pr-6 py-4 bg-surface-container-highest border-none rounded-lg font-body text-on-surface placeholder:text-outline clay-inset-shadow focus:ring-4 focus:ring-primary-container outline-none"
                placeholder="Enter password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              className="w-full py-5 bg-tertiary text-white font-headline text-xl font-black rounded-full clay-button-shadow transition-all active:translate-y-1 active:shadow-none hover:bg-tertiary-container group disabled:opacity-50"
              type="submit"
              disabled={loading}
            >
              <span className="flex items-center justify-center gap-2">
                {loading
                  ? 'SIGNING IN...'
                  : activeTab === 'teacher'
                    ? 'OPEN THE LEDGER'
                    : 'ENTER CLASSROOM'
                }
                <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </span>
            </button>
          </div>
        </form>

        {/* Footer Links */}
        <div className="mt-8 flex justify-between items-center px-2">
          {activeTab === 'student' ? (
            <button
              className="text-xs font-bold text-outline hover:text-primary transition-colors flex items-center gap-1"
              onClick={() => { setShowSignUp(true); clearError(); }}
            >
              <span className="material-symbols-outlined text-sm">person_add</span>
              Create Account
            </button>
          ) : (
            <a className="text-xs font-bold text-outline hover:text-primary transition-colors flex items-center gap-1" href="#">
              <span className="material-symbols-outlined text-sm">help</span>
              Need Access?
            </a>
          )}
          <a className="text-xs font-bold text-outline hover:text-primary transition-colors flex items-center gap-1" href="#">
            <span className="material-symbols-outlined text-sm">language</span>
            Language
          </a>
        </div>
      </div>

      <DecorativeElements />
    </div>
  );
}

/* --- Shared Sub-Components (from Stitch HTML) --- */

function HotelBuilding() {
  return (
    <div className="relative mb-8 group">
      <div className="w-40 h-48 bg-secondary-container rounded-t-xl rounded-b-md relative flex flex-col items-center justify-end p-4 shadow-[10px_10px_0_0_rgba(62,5,0,0.5)] border-b-8 border-r-8 border-secondary-fixed-dim">
        {/* Roof */}
        <div className="absolute -top-4 w-44 h-8 bg-primary rounded-full shadow-[0_4px_0_0_#5a0d02]"></div>
        {/* Windows */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="w-8 h-8 bg-on-secondary-container rounded-sm clay-inset-shadow"></div>
          <div className="w-8 h-8 bg-on-secondary-container rounded-sm clay-inset-shadow"></div>
          <div className="w-8 h-8 bg-on-secondary-container rounded-sm clay-inset-shadow"></div>
          <div className="w-8 h-8 bg-yellow-200 rounded-sm shadow-[0_0_10px_rgba(253,224,71,0.5)]"></div>
        </div>
        {/* Sign */}
        <div className="bg-tertiary px-3 py-1 rounded-full mb-2 shadow-[0_3px_0_0_#23501e]">
          <span className="text-[8px] font-black text-white uppercase tracking-widest">Grand Hotel</span>
        </div>
        {/* Door */}
        <div className="w-10 h-12 bg-on-primary-fixed-variant rounded-t-lg clay-inset-shadow"></div>
      </div>
    </div>
  );
}

function DecorativeElements() {
  return (
    <div className="fixed bottom-0 left-0 w-full flex justify-between p-8 pointer-events-none opacity-40">
      <div className="w-32 h-32 bg-primary-container rounded-full clay-card-shadow -translate-x-12 translate-y-12"></div>
      <div className="w-24 h-24 bg-tertiary-container rounded-full clay-card-shadow translate-x-12 translate-y-12"></div>
    </div>
  );
}
