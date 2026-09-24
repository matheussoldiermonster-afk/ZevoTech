import { NavLink } from 'react-router-dom';
import {
  Box,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { navItems } from './navItems';

export const DRAWER_WIDTH = 248;
export const DRAWER_COLLAPSED_WIDTH = 72;

export default function Sidebar({ collapsed, onToggleCollapsed, onNavigate, showCollapseButton = true }) {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
      <Box
        sx={{
          height: 64,
          px: collapsed ? 0 : 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 1.5,
          flexShrink: 0,
        }}
      >
        <img src="/logo-zevo.png" alt="" width={32} height={32} />
        {!collapsed && (
          <Typography variant="h6" fontWeight={700} noWrap>
            Zevo Tech
          </Typography>
        )}
      </Box>
      <Divider />

      <List component="nav" aria-label="Menu principal" sx={{ flex: 1, px: 1, py: 1.5, overflowY: 'auto' }}>
        {navItems.map((item) => {
          const button = (
            <ListItemButton
              component={item.available ? NavLink : 'div'}
              to={item.available ? item.path : undefined}
              end={item.path === '/' ? true : undefined}
              onClick={item.available ? onNavigate : undefined}
              disabled={!item.available}
              sx={{
                minHeight: 44,
                borderRadius: 2,
                mb: 0.5,
                px: collapsed ? 0 : 1.5,
                justifyContent: collapsed ? 'center' : 'flex-start',
                color: 'text.secondary',
                '&.active': {
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
                  '&:hover': { bgcolor: 'primary.dark' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 0, mr: collapsed ? 0 : 1.5, color: 'inherit', justifyContent: 'center' }}>
                {item.icon}
              </ListItemIcon>
              {!collapsed && (
                <ListItemText
                  primary={item.label}
                  secondary={item.available ? null : 'Em breve'}
                  primaryTypographyProps={{ fontSize: 14, fontWeight: 600, noWrap: true }}
                  secondaryTypographyProps={{ fontSize: 11 }}
                />
              )}
            </ListItemButton>
          );

          const tooltip = collapsed ? `${item.label}${item.available ? '' : ' (em breve)'}` : item.available ? '' : 'Disponível em breve';
          return (
            <Tooltip key={item.path} title={tooltip} placement="right" arrow>
              {/* span: Tooltip precisa de um filho que receba eventos mesmo quando o botão está desabilitado */}
              <span style={{ display: 'block' }}>{button}</span>
            </Tooltip>
          );
        })}
      </List>

      {showCollapseButton && (
        <>
          <Divider />
          <Box sx={{ p: 1, display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end' }}>
            <Tooltip title={collapsed ? 'Expandir menu' : 'Recolher menu'} placement="right">
              <IconButton onClick={onToggleCollapsed} size="small" aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}>
                {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
              </IconButton>
            </Tooltip>
          </Box>
        </>
      )}
    </Box>
  );
}
