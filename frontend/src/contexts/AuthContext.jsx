import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import api, { TOKEN_KEY, UNAUTHORIZED_EVENT } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const userRef = useRef(null);
  userRef.current = user;

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => setUser(res.data))
      .catch((err) => {
        // Só descarta o token se o servidor recusou a sessão; erro de rede mantém.
        if (err.response?.status === 401) localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => setLoading(false));
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    queryClient.clear(); // não deixa dados de um usuário no cache do próximo
  }, [queryClient]);

  // Sessão expirada em qualquer requisição (disparado pelo interceptor do axios)
  useEffect(() => {
    const onUnauthorized = () => {
      if (userRef.current) {
        enqueueSnackbar('Sua sessão expirou. Entre novamente.', { variant: 'info', preventDuplicate: true });
      }
      setUser(null);
      queryClient.clear();
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [queryClient]);

  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, res.data.token);
    queryClient.clear();
    setUser(res.data.user);
    return res.data.user;
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout: clearSession, isAdmin: user?.role === 'ADMIN' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
