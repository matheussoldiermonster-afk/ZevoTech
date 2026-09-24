import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Tooltip,
  Button,
  Fade,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/DashboardOutlined';
import PeopleIcon from '@mui/icons-material/PeopleOutline';
import AssignmentIcon from '@mui/icons-material/AssignmentOutlined';
import DescriptionIcon from '@mui/icons-material/DescriptionOutlined';
import PaymentsIcon from '@mui/icons-material/PaymentsOutlined';
import RouterIcon from '@mui/icons-material/RouterOutlined';
import LogoutIcon from '@mui/icons-material/LogoutOutlined';
import Brightness4Icon from '@mui/icons-material/Brightness4Outlined';
import Brightness7Icon from '@mui/icons-material/Brightness7Outlined';
import { useAuth } from '../contexts/AuthContext';
import { useThemeMode } from '../contexts/ThemeModeContext';

const navItems = [
  { label: 'Dashboard', path: '/', icon: <DashboardIcon fontSize="small" /> },
  { label: 'Clientes', path: '/clientes', icon: <PeopleIcon fontSize="small" /> },
  { label: 'Ordens de Serviço', path: '/ordens-servico', icon: <AssignmentIcon fontSize="small" /> },
  { label: 'Contratos', path: '/contratos', icon: <DescriptionIcon fontSize="small" /> },
  { label: 'Pagamentos', path: '/pagamentos', icon: <PaymentsIcon fontSize="small" /> },
  { label: 'Equipamentos', path: '/equipamentos', icon: <RouterIcon fontSize="small" /> },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="sticky" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
            <img src="/logo-zevo.png" alt="Zevo Tech" style={{ width: 32, height: 32 }} />
            <Typography variant="h6" noWrap sx={{ display: { xs: 'none', sm: 'block' } }}>
              Zevo Tech
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              overflowX: 'auto',
              flex: 1,
              justifyContent: 'center',
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            {navItems.map((item) => (
              <Button
                key={item.path}
                component={NavLink}
                to={item.path}
                end={item.path === '/'}
                startIcon={item.icon}
                sx={{
                  color: 'rgba(255,255,255,0.85)',
                  whiteSpace: 'nowrap',
                  borderRadius: 2,
                  px: 1.5,
                  transition: 'all 0.2s ease',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.12)', color: '#fff' },
                  '&.active': { bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', fontWeight: 700 },
                }}
              >
                {item.label}
              </Button>
            ))}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            <Tooltip title={mode === 'light' ? 'Modo escuro' : 'Modo claro'}>
              <IconButton color="inherit" onClick={toggleMode}>
                {mode === 'light' ? <Brightness4Icon /> : <Brightness7Icon />}
              </IconButton>
            </Tooltip>
            <Tooltip title={user?.name || ''}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main', fontSize: 14 }}>
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </Avatar>
            </Tooltip>
            <Tooltip title="Sair">
              <IconButton color="inherit" onClick={handleLogout}>
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flexGrow: 1, p: 3, bgcolor: 'background.default' }}>
        <Fade in key={location.pathname} timeout={350}>
          <Box>
            <Outlet />
          </Box>
        </Fade>
      </Box>
    </Box>
  );
}
