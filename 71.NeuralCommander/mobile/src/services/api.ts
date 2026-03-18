/**
 * NeuralCommander API Service
 * Wraps all backend calls in a typed interface.
 */
import axios from 'axios';

const BASE_URL = __DEV__
  ? 'http://10.0.2.2:8000'   // Android emulator → localhost
  : 'https://api.neuralcommander.app';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {'Content-Type': 'application/json'},
});

// Attach JWT from AsyncStorage on every request
api.interceptors.request.use(async config => {
  const AsyncStorage =
    require('@react-native-async-storage/async-storage').default;
  const token = await AsyncStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// -------------------------------------------------------------------------
// Auth
// -------------------------------------------------------------------------
export const authAPI = {
  register: (email: string, password: string, fullName?: string) =>
    api.post('/api/v1/auth/register', {email, password, full_name: fullName}),

  login: (email: string, password: string) => {
    const form = new FormData();
    form.append('username', email);
    form.append('password', password);
    return api.post('/api/v1/auth/login', form, {
      headers: {'Content-Type': 'multipart/form-data'},
    });
  },

  googleAuthUrl: () => api.get('/api/v1/auth/google'),
};

// -------------------------------------------------------------------------
// Tasks
// -------------------------------------------------------------------------
export const tasksAPI = {
  list: (userId: number) => api.get(`/api/v1/tasks/${userId}`),

  create: (
    userId: number,
    task: {
      title: string;
      description?: string;
      course_name?: string;
      deadline?: string;
      difficulty_score?: number;
    },
  ) => api.post(`/api/v1/tasks/${userId}`, task),

  complete: (taskId: number) => api.patch(`/api/v1/tasks/${taskId}/complete`),
};

// -------------------------------------------------------------------------
// Notifications
// -------------------------------------------------------------------------
export const notificationsAPI = {
  list: (userId: number, limit = 50) =>
    api.get(`/api/v1/notifications/${userId}?limit=${limit}`),

  ingest: (
    userId: number,
    notification: {package_name: string; title?: string; body?: string},
  ) => api.post(`/api/v1/notifications/${userId}`, notification),
};

// -------------------------------------------------------------------------
// Focus
// -------------------------------------------------------------------------
export const focusAPI = {
  start: (userId: number, startTime: string) =>
    api.post(`/api/v1/focus/${userId}/start`, {start_time: startTime}),

  stop: (sessionId: number) =>
    api.post(`/api/v1/focus/${sessionId}/stop`),

  reportBypass: (sessionId: number) =>
    api.post(`/api/v1/focus/${sessionId}/bypass`),

  list: (userId: number) => api.get(`/api/v1/focus/${userId}`),
};

// -------------------------------------------------------------------------
// Classroom
// -------------------------------------------------------------------------
export const classroomAPI = {
  sync: (userId: number) => api.post(`/api/v1/classroom/sync/${userId}`),
};

export default api;
