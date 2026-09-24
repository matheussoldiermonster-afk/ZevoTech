import { Chip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutline';
import ScheduleIcon from '@mui/icons-material/ScheduleOutlined';
import ErrorIcon from '@mui/icons-material/ErrorOutlineOutlined';
import AutorenewIcon from '@mui/icons-material/AutorenewOutlined';
import CancelIcon from '@mui/icons-material/CancelOutlined';
import Inventory2Icon from '@mui/icons-material/Inventory2Outlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmberOutlined';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUncheckedOutlined';
import BuildCircleIcon from '@mui/icons-material/BuildCircleOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';

// Vocabulário único de estados visuais usado em todo o sistema:
// Pago, Pendente, Em atraso, Em andamento, Concluído, Cancelado,
// Estoque baixo, Alertas — cada um com cor + ícone consistentes.
export const STATUS_MAP = {
  // Pagamentos / financeiro
  PAID: { label: 'Pago', color: 'success', icon: CheckCircleIcon },
  PENDING: { label: 'Pendente', color: 'warning', icon: ScheduleIcon },
  OVERDUE: { label: 'Em atraso', color: 'error', icon: ErrorIcon },
  CANCELLED: { label: 'Cancelado', color: 'default', icon: CancelIcon },

  // Ordens de serviço
  OPEN: { label: 'Aberta', color: 'info', icon: RadioButtonUncheckedIcon },
  IN_PROGRESS: { label: 'Em andamento', color: 'warning', icon: AutorenewIcon },
  COMPLETED: { label: 'Concluído', color: 'success', icon: CheckCircleIcon },

  // Contratos / empresas
  ACTIVE: { label: 'Ativo', color: 'success', icon: CheckCircleIcon },
  INACTIVE: { label: 'Inativo', color: 'default', icon: CancelIcon },

  // Equipamentos
  IN_STOCK: { label: 'Em estoque', color: 'info', icon: Inventory2Icon },
  INSTALLED: { label: 'Instalado', color: 'success', icon: CheckCircleIcon },
  MAINTENANCE: { label: 'Manutenção', color: 'warning', icon: BuildCircleIcon },
  DAMAGED: { label: 'Danificado', color: 'error', icon: WarningAmberIcon },
  DISCARDED: { label: 'Descartado', color: 'default', icon: DeleteOutlineIcon },

  // Alertas genéricos
  LOW_STOCK: { label: 'Estoque baixo', color: 'error', icon: WarningAmberIcon },
  ALERT: { label: 'Alerta', color: 'warning', icon: WarningAmberIcon },
};

const colorStyles = {
  success: { bg: 'rgba(46, 125, 79, 0.12)', fg: '#2E7D4F' },
  warning: { bg: 'rgba(181, 117, 11, 0.14)', fg: '#B5750B' },
  error: { bg: 'rgba(193, 59, 59, 0.12)', fg: '#C13B3B' },
  info: { bg: 'rgba(46, 111, 167, 0.12)', fg: '#2E6FA7' },
  default: { bg: 'rgba(91, 107, 109, 0.12)', fg: '#5B6B6D' },
};

export default function StatusChip({ status, label, size = 'small', variant = 'filled', onClick, sx }) {
  const config = STATUS_MAP[status] || { label: label || status, color: 'default', icon: null };
  const Icon = config.icon;
  const style = colorStyles[config.color] || colorStyles.default;

  return (
    <Chip
      size={size}
      variant={variant}
      icon={Icon ? <Icon style={{ color: style.fg }} /> : undefined}
      label={label || config.label}
      onClick={onClick}
      clickable={Boolean(onClick)}
      sx={{
        bgcolor: style.bg,
        color: style.fg,
        border: 'none',
        '& .MuiChip-icon': { color: style.fg },
        ...sx,
      }}
    />
  );
}
