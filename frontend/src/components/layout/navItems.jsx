import DashboardIcon from '@mui/icons-material/DashboardOutlined';
import PeopleIcon from '@mui/icons-material/PeopleOutline';
import AssignmentIcon from '@mui/icons-material/AssignmentOutlined';
import EventIcon from '@mui/icons-material/EventOutlined';
import DescriptionIcon from '@mui/icons-material/DescriptionOutlined';
import PaymentsIcon from '@mui/icons-material/PaymentsOutlined';
import RouterIcon from '@mui/icons-material/RouterOutlined';
import AssessmentIcon from '@mui/icons-material/AssessmentOutlined';
import SettingsIcon from '@mui/icons-material/SettingsOutlined';

/**
 * Itens da sidebar. `available: false` deixa o item visível porém desabilitado
 * (útil para telas futuras, sem página vazia ou dados fictícios).
 */
export const navItems = [
  { label: 'Dashboard', path: '/', icon: <DashboardIcon />, available: true },
  { label: 'Clientes', path: '/clientes', icon: <PeopleIcon />, available: true },
  { label: 'Ordens de Serviço', path: '/ordens-servico', icon: <AssignmentIcon />, available: true },
  { label: 'Agenda', path: '/agenda', icon: <EventIcon />, available: true },
  { label: 'Contratos', path: '/contratos', icon: <DescriptionIcon />, available: true },
  { label: 'Financeiro', path: '/financeiro', icon: <PaymentsIcon />, available: true },
  { label: 'Equipamentos', path: '/equipamentos', icon: <RouterIcon />, available: true },
  { label: 'Relatórios', path: '/relatorios', icon: <AssessmentIcon />, available: true },
  { label: 'Configurações', path: '/configuracoes', icon: <SettingsIcon />, available: true },
];
