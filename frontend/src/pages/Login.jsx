import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Paper, TextField, Button, Typography, Alert } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../services/api';
import zevoColors from '../theme/theme';
import ZevoIntro from '../components/ZevoIntro';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showIntro, setShowIntro] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
setShowIntro(true);
    } catch (err) {
      setError(err.response ? err.response.data?.error || 'Falha ao entrar. Verifique suas credenciais.' : getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Box
        sx={{
          flex: 1,
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(160deg, ${zevoColors.tealDark} 0%, ${zevoColors.teal} 60%, ${zevoColors.greenDark} 130%)`,
          color: '#fff',
          p: 6,
        }}
      >
        <img src="/logo-zevo.png" alt="Zevo Tech" style={{ width: 160, marginBottom: 24 }} />
        <Typography variant="h4" fontWeight={700} textAlign="center">
          Zevo Tech
        </Typography>
        <Typography variant="body1" textAlign="center" sx={{ mt: 1, opacity: 0.85, maxWidth: 320 }}>
          Gestão de clientes, contratos, ordens de serviço e pagamentos em um só lugar.
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
        }}
      >
        <Paper elevation={0} sx={{ p: 5, width: '100%', maxWidth: 380 }}>
          <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'center', mb: 3 }}>
            <img src="/logo-zevo.png" alt="Zevo Tech" style={{ width: 90 }} />
          </Box>

          <Typography variant="h5" fontWeight={700} gutterBottom>
            Entrar
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Acesse sua conta Zevo Tech
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <form onSubmit={handleSubmit}>
            <TextField
              label="E-mail"
              type="email"
              fullWidth
              required
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label="Senha"
              type="password"
              fullWidth
              required
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              size="large"
              sx={{ mt: 3 }}
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </Paper>
      </Box>
            {showIntro && (
        <ZevoIntro
          onFinish={() => {
            navigate(
              location.state?.from?.pathname
                ? `${location.state.from.pathname}${location.state.from.search || ''}`
                : '/',
              { replace: true }
            );
          }}
        />
      )}
    </Box>
  );
}
