import { create } from 'zustand';
import api from '../lib/api';

const useAuthStore = create((set, get) => ({
  // State
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  loading: false,
  error: null,

  // Computed
  isAuthenticated: () => !!get().token,
  isTeacher: () => get().user?.role === 'teacher',
  isStudent: () => get().user?.role === 'student',

  // Actions
  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await api.post('/api/auth/login', { email, password });
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      set({ token, user, loading: false });
      return user;
    } catch (err) {
      const message = err.response?.data?.error || 'Login failed';
      set({ error: message, loading: false });
      throw new Error(message);
    }
  },

  register: async (name, email, password, role = 'student') => {
    set({ loading: true, error: null });
    try {
      const res = await api.post('/api/auth/register', { name, email, password, role });
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      set({ token, user, loading: false });
      return user;
    } catch (err) {
      const message = err.response?.data?.error || 'Registration failed';
      set({ error: message, loading: false });
      throw new Error(message);
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null, error: null });
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
