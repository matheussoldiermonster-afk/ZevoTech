import axios from 'axios';

export const TOKEN_KEY = 'zevo-token';
export const UNAUTHORIZED_EVENT = 'zevo:unauthorized';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3333/api',
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginRequest) {
      // Antes: window.location.href = '/login' (recarregava a aplicação inteira).
      // Agora o AuthContext escuta este evento, encerra a sessão e o
      // ProtectedRoute redireciona para o login sem recarregar a página.
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    return Promise.reject(error);
  }
);

/** Mensagem amigável para qualquer erro de requisição. */
export function getErrorMessage(error, fallback = 'Ocorreu um erro inesperado. Tente novamente.') {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'Você está sem conexão com a internet.';
  }
  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
    return 'O servidor demorou para responder. Tente novamente.';
  }
  if (error?.response) {
    const serverMessage = error.response.data?.error;
    if (serverMessage) return serverMessage;
    if (error.response.status === 403) return 'Você não tem permissão para esta ação.';
    if (error.response.status === 404) return 'Registro não encontrado.';
    if (error.response.status >= 500) return 'O servidor encontrou um problema. Tente novamente em instantes.';
  } else if (error?.request) {
    return 'Não foi possível conectar ao servidor.';
  }
  return fallback;
}

export default api;
