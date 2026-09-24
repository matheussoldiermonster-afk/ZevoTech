import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Grid, Tab, Tabs, Typography } from '@mui/material';
import EngineeringIcon from '@mui/icons-material/EngineeringOutlined';
import PageHeader from '../../components/common/PageHeader';
import SectionCard from '../../components/common/SectionCard';
import { useAuth } from '../../contexts/AuthContext';
import TechniciansDialog from '../agenda/TechniciansDialog';
import ChangePasswordCard from './ChangePasswordCard';
import UsersCard from './UsersCard';
import BackupCard from './BackupCard';
import { ROLE_OPTIONS } from './UserDialog';

const TABS = ['conta', 'usuarios', 'tecnicos', 'backup'];

export default function Settings() {
  const { user, isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const [techOpen, setTechOpen] = useState(false);
  const requested = TABS.includes(params.get('aba')) ? params.get('aba') : 'conta';
  const tab = !isAdmin ? 'conta' : requested;

  return (
    <>
      <PageHeader title="Configurações" />
      <Tabs value={tab} onChange={(e, v) => setParams(v === 'conta' ? {} : { aba: v }, { replace: true })} sx={{ mb: 2 }}>
        <Tab value="conta" label="Minha conta" />
        {isAdmin && <Tab value="usuarios" label="Usuários" />}
        {isAdmin && <Tab value="tecnicos" label="Técnicos" />}
        {isAdmin && <Tab value="backup" label="Backup" />}
      </Tabs>

      {tab === 'conta' && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <SectionCard title="Dados de acesso">
              <Typography variant="body2">
                <strong>{user?.name}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user?.email}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Perfil: {ROLE_OPTIONS[user?.role]?.label || user?.role}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {ROLE_OPTIONS[user?.role]?.description}
              </Typography>
            </SectionCard>
          </Grid>
          <Grid item xs={12} md={7}>
            <ChangePasswordCard />
          </Grid>
        </Grid>
      )}

      {tab === 'usuarios' && <UsersCard />}

      {tab === 'backup' && <BackupCard />}

      {tab === 'tecnicos' && (
        <SectionCard title="Técnicos" subtitle="Profissionais que executam as ordens de serviço (não acessam o sistema)">
          <Button variant="contained" startIcon={<EngineeringIcon />} onClick={() => setTechOpen(true)}>
            Gerenciar técnicos
          </Button>
          <TechniciansDialog open={techOpen} onClose={() => setTechOpen(false)} />
        </SectionCard>
      )}
    </>
  );
}
