import axios from 'axios';
import { toast } from 'sonner';
import { supabase } from '../config/supabaseClient';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  config.__wakeTimer = setTimeout(() => {
    config.__wakeToastId = toast.info('Server is waking up', {
      description: 'This can take up to a minute on the free plan.',
      duration: Infinity,
      closeButton: true,
    });
  }, 4000);
  return config;
});

const clearWakeNotice = (config) => {
  clearTimeout(config?.__wakeTimer);
  if (config?.__wakeToastId) toast.dismiss(config.__wakeToastId);
};

api.interceptors.response.use(
  (response) => {
    clearWakeNotice(response.config);
    return response;
  },
  async (error) => {
    const config = error.config;
    clearWakeNotice(config);
    const requestId = error.response?.headers?.['x-request-id'];
    if (requestId && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nova:request-error', { detail: { requestId } }));
    }

    const method = config?.method?.toLowerCase();
    const retryableStatus = [502, 503, 504].includes(error.response?.status);
    const networkError = !error.response && !error.code?.includes('CANCEL');
    const retryCount = config?.__retryCount || 0;
    if (method === 'get' && (retryableStatus || networkError) && retryCount < 2) {
      config.__retryCount = retryCount + 1;
      await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** retryCount)));
      return api(config);
    }

    return Promise.reject(error);
  },
);

export default api;