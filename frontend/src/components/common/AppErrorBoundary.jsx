import { Component } from 'react';
import { Box, Button, Typography } from '@mui/material';

/** Evita tela branca: qualquer erro de renderização mostra uma mensagem amigável. */
export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Erro de interface:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Box sx={{ minHeight: this.props.fullScreen ? '100vh' : 320, display: 'grid', placeItems: 'center', p: 3 }}>
        <Box sx={{ textAlign: 'center', maxWidth: 420 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Algo deu errado nesta tela
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            O erro foi registrado. Você pode tentar novamente sem perder a sessão.
          </Typography>
          <Button variant="contained" onClick={() => this.setState({ error: null })} sx={{ mr: 1 }}>
            Tentar novamente
          </Button>
          <Button onClick={() => window.location.reload()}>Recarregar página</Button>
        </Box>
      </Box>
    );
  }
}
