import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Drawer,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/LogoutOutlined';
import Brightness4Icon from '@mui/icons-material/Brightness4Outlined';
import Brightness7Icon from '@mui/icons-material/Brightness7Outlined';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeMode } from '../../contexts/ThemeModeContext';
import usePersistentState from '../../hooks/usePersistentState';
import useOnlineStatus from '../../hooks/useOnlineStatus';
import AppErrorBoundary from '../common/AppErrorBoundary';
import Sidebar, { DRAWER_COLLAPSED_WIDTH, DRAWER_WIDTH } from './Sidebar';
import { navItems } from './navItems';

const ROLE_LABEL = { ADMIN: 'Administrador', FINANCIAL: 'Financeiro' };

export default function AppLayout() {
  const theme = useTheme();
  // Celular e tablet em pé: menu flutuante. Notebook/desktop/tablet deitado: menu fixo.
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));
  const [collapsed, setCollapsed] = usePersistentState('zevo-sidebar-collapsed', false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(null);
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const location = useLocation();

  const width = isCompact ? 0 : collapsed ? DRAWER_COLLAPSED_WIDTH : DRAWER_WIDTH;
  const current = navItems.find((i) => (i.path === '/' ? location.pathname === '/' : location.pathname.startsWith(i.path)));

  function handleLogout() {
    setUserMenu(null);
    logout();
    navigate('/login', { replace: true });
  }

  const drawerPaperSx = {
    boxSizing: 'border-box',
    borderRight: 1,
    borderColor: 'divider',
    bgcolor: 'background.paper',
    transition: theme.transitions.create('width', { duration: theme.transitions.duration.shorter }),
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {isCompact ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { ...drawerPaperSx, width: DRAWER_WIDTH } }}
        >
          <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} showCollapseButton={false} />
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width,
            flexShrink: 0,
            transition: theme.transitions.create('width', { duration: theme.transitions.duration.shorter }),
            '& .MuiDrawer-paper': { ...drawerPaperSx, width },
          }}
        >
          <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((c) => !c)} />
        </Drawer>
      )}

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <AppBar
          position="sticky"
          elevation={0}
          color="inherit"
          sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', background: 'none', backgroundColor: 'background.paper' }}
        >
          <Toolbar sx={{ gap: 1 }}>
            {isCompact && (
              <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
                <MenuIcon />
              </IconButton>
            )}
            <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ flex: 1 }}>
              {current?.label || ''}
            </Typography>
            <Tooltip title={mode === 'light' ? 'Modo escuro' : 'Modo claro'}>
              <IconButton onClick={toggleMode} aria-label="Alternar tema">
                {mode === 'light' ? <Brightness4Icon /> : <Brightness7Icon />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Conta">
              <IconButton onClick={(e) => setUserMenu(e.currentTarget)} aria-label="Menu da conta" sx={{ p: 0.5 }}>
                <Avatar sx={{ width: 34, height: 34, bgcolor: 'secondary.main', color: 'secondary.contrastText', fontSize: 15 }}>
                  {user?.name?.[0]?.toUpperCase() || 'U'}
                </Avatar>
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={userMenu}
              open={Boolean(userMenu)}
              onClose={() => setUserMenu(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <Box sx={{ px: 2, py: 1, minWidth: 200 }}>
                <Typography variant="body2" fontWeight={700}>
                  {user?.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="div">
                  {user?.email}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {ROLE_LABEL[user?.role] || user?.role}
                </Typography>
              </Box>
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                Sair
              </MenuItem>
            </Menu>
          </Toolbar>
          {!online && (
            <Alert severity="warning" square sx={{ py: 0 }}>
              Você está sem conexão. Os dados exibidos podem estar desatualizados.
            </Alert>
          )}
        </AppBar>

        <Box component="main" sx={{ flex: 1, p: { xs: 2, sm: 3 }, maxWidth: 1600, width: '100%', mx: 'auto' }}>
          <AppErrorBoundary key={location.pathname}>
            <Outlet />
          </AppErrorBoundary>
        </Box>
      </Box>
    </Box>
  );
}
