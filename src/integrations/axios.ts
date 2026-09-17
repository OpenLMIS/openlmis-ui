import axios from 'axios';
import { useLoginData } from '@/features/auth/store/login-data';
import { router } from '@/integrations/tanstack-router';

// Relative by default so the dev proxy decides which OpenLMIS instance is used.
export const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 60_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

client.interceptors.request.use(
  (config) => {
    const { accessToken } = useLoginData.getState();

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// A rejected token drops the session and returns to the login screen.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useLoginData.getState().clearLoginData();
      router.navigate({ to: '/login' });
    }

    return Promise.reject(error);
  },
);
