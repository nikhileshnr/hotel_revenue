import { useState } from 'react';
import api from '../lib/api';

export default function CreateSessionModal({ onClose, onCreated }) {
  const [formData, setFormData] = useState({
    hotel_type: 'city',
    total_weeks: 12,
    game_mode: 'pricing',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? (parseInt(value, 10) || 0) : value,
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/api/sessions', formData);
      onCreated(res.data.session || res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  const GAME_MODES = [
    {
      key: 'pricing',
      icon: 'sell',
      label: 'Pricing Mode',
      description: 'Set room prices per tier each week. Guests auto-book based on willingness-to-pay. Master pricing strategy.',
      color: 'tertiary',
      badge: 'Strategic',
    },
    {
      key: 'classic',
      icon: 'person_search',
      label: 'Classic Mode',
      description: 'Guests arrive one-by-one on a timer. Accept or reject each based on revenue, risk, and availability.',
      color: 'primary',
      badge: 'Real-Time',
    },
  ];

  const HOTEL_TYPES = [
    {
      key: 'city',
      icon: 'location_city',
      label: 'City Center',
      description: 'High corporate traffic, steady demand, strong weekday occupancy.',
    },
    {
      key: 'resort',
      icon: 'holiday_village',
      label: 'Resort',
      description: 'Seasonal leisure demand, longer stays, higher weekend peaks.',
    },
  ];

  const DURATION_PRESETS = [
    { weeks: 6, label: 'Quick', description: '~10 min', icon: 'bolt' },
    { weeks: 12, label: 'Standard', description: '~20 min', icon: 'timer' },
    { weeks: 20, label: 'Full Season', description: '~35 min', icon: 'calendar_month' },
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-on-surface/40 flex items-center justify-center p-6">
      <div className="relative w-full max-w-4xl bg-secondary-container rounded-[60px] shadow-[12px_12px_0px_0px_#6e6444] p-10 flex flex-col gap-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="font-headline text-4xl font-black text-on-secondary-container tracking-tight uppercase">New Simulation</h1>
            <p className="font-body text-on-secondary-container/70 font-bold">Choose your hotel, mode, and season length.</p>
          </div>
          <button
            className="w-12 h-12 bg-primary rounded-full shadow-[4px_4px_0px_0px_#802918] flex items-center justify-center text-on-primary hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
            onClick={onClose}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {error && (
          <div className="bg-error-container text-on-error-container p-4 rounded-lg font-body text-sm font-bold">
            {error}
          </div>
        )}

        {/* Tray 1: Game Mode */}
        <section className="bg-surface-container-low rounded-lg p-6 shadow-[6px_6px_0px_0px_#56423e] flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary font-bold">sports_esports</span>
            <h2 className="font-headline text-xl font-extrabold uppercase text-on-surface-variant">GAME MODE</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {GAME_MODES.map((mode) => {
              const isSelected = formData.game_mode === mode.key;
              return (
                <div
                  key={mode.key}
                  className={`relative p-6 rounded-[2rem] cursor-pointer select-none transition-all ${
                    isSelected
                      ? mode.color === 'primary'
                        ? 'bg-primary text-white shadow-[0_8px_0_0_#2a1410] -translate-y-1'
                        : 'bg-tertiary text-white shadow-[0_8px_0_0_#1a5a4c] -translate-y-1'
                      : 'bg-surface-container-highest text-on-surface-variant shadow-[0_6px_0_0_#dbdad7] hover:-translate-y-0.5'
                  }`}
                  onClick={() => setFormData((prev) => ({ ...prev, game_mode: mode.key }))}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      isSelected ? 'bg-white/20' : 'bg-surface-container'
                    }`}>
                      <span
                        className={`material-symbols-outlined text-2xl ${isSelected ? 'text-white' : 'text-on-surface-variant'}`}
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >{mode.icon}</span>
                    </div>
                    <div>
                      <h3 className="font-headline text-lg font-black uppercase tracking-tight">{mode.label}</h3>
                      <span className={`text-[9px] font-black uppercase tracking-widest ${isSelected ? 'text-white/60' : 'text-outline'}`}>{mode.badge}</span>
                    </div>
                  </div>
                  <p className={`text-sm font-medium ${isSelected ? 'text-white/80' : 'text-outline'}`}>
                    {mode.description}
                  </p>
                  {isSelected && (
                    <div className="absolute top-4 right-4">
                      <span className="material-symbols-outlined text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Tray 2: Hotel Type */}
        <section className="bg-surface-container-low rounded-lg p-6 shadow-[6px_6px_0px_0px_#56423e] flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary font-bold">apartment</span>
            <h2 className="font-headline text-xl font-extrabold uppercase text-on-surface-variant">HOTEL TYPE</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {HOTEL_TYPES.map((hotel) => {
              const isSelected = formData.hotel_type === hotel.key;
              return (
                <div
                  key={hotel.key}
                  className={`p-5 rounded-[2rem] cursor-pointer select-none transition-all flex items-center gap-4 ${
                    isSelected
                      ? 'bg-surface-container-highest shadow-[0_6px_0_0_#56423e] -translate-y-0.5 ring-3 ring-primary/40'
                      : 'bg-surface-container-highest shadow-[0_4px_0_0_#dbdad7] hover:-translate-y-0.5'
                  }`}
                  onClick={() => setFormData((prev) => ({ ...prev, hotel_type: hotel.key }))}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant'
                  } transition-colors`}>
                    <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>{hotel.icon}</span>
                  </div>
                  <div>
                    <h3 className={`font-headline font-black uppercase tracking-tight ${isSelected ? 'text-primary' : 'text-on-surface-variant'}`}>{hotel.label}</h3>
                    <p className="text-xs text-outline font-medium mt-0.5">{hotel.description}</p>
                  </div>
                  {isSelected && (
                    <span className="material-symbols-outlined text-primary text-xl ml-auto" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Tray 3: Season Duration */}
        <section className="bg-surface-container-low rounded-lg p-6 shadow-[6px_6px_0px_0px_#56423e] flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary font-bold">schedule</span>
            <h2 className="font-headline text-xl font-extrabold uppercase text-on-surface-variant">SEASON LENGTH</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {DURATION_PRESETS.map((preset) => {
              const isSelected = formData.total_weeks === preset.weeks;
              return (
                <div
                  key={preset.weeks}
                  className={`p-5 rounded-[2rem] cursor-pointer select-none transition-all text-center ${
                    isSelected
                      ? 'bg-tertiary text-white shadow-[0_6px_0_0_#1a5a4c] -translate-y-1'
                      : 'bg-surface-container-highest text-on-surface-variant shadow-[0_4px_0_0_#dbdad7] hover:-translate-y-0.5'
                  }`}
                  onClick={() => setFormData((prev) => ({ ...prev, total_weeks: preset.weeks }))}
                >
                  <div className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center mb-2 ${
                    isSelected ? 'bg-white/20' : 'bg-surface-container'
                  }`}>
                    <span className={`material-symbols-outlined ${isSelected ? 'text-white' : 'text-on-surface-variant'}`} style={{ fontVariationSettings: "'FILL' 1" }}>{preset.icon}</span>
                  </div>
                  <p className="font-black text-lg">{preset.weeks}</p>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-white/70' : 'text-outline'}`}>{preset.label}</p>
                  <p className={`text-[9px] font-bold mt-1 ${isSelected ? 'text-white/50' : 'text-outline/50'}`}>{preset.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Action Footer */}
        <div className="pt-4">
          <button
            className="w-full py-6 bg-tertiary text-on-tertiary rounded-full font-headline text-2xl font-black uppercase tracking-widest shadow-[6px_6px_0px_0px_#1a5a4c] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center gap-4 disabled:opacity-50"
            onClick={handleSubmit}
            disabled={loading}
          >
            <span>{loading ? 'LAUNCHING...' : 'LAUNCH SESSION'}</span>
            <span className="material-symbols-outlined text-3xl">play_circle</span>
          </button>
        </div>
      </div>
    </div>
  );
}
