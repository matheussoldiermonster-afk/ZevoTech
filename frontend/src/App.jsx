import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeModeProvider } from './contexts/ThemeModeContext';
import { ConfirmProvider } from './components/common/ConfirmDialog';
import AppErrorBoundary from './components/common/AppErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import PageSkeleton from './components/layout/PageSkeleton';
import Login from './pages/Login';

// Cada tela é baixada só quando acessada (o login não carrega gráficos, relatórios etc.)
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const Clients = lazy(() => import('./pages/clients/Clients'));
const ClientDetail = lazy(() => import('./pages/clients/ClientDetail'));
const Agenda = lazy(() => import('./pages/agenda/Agenda'));
const ServiceOrders = lazy(() => import('./pages/service-orders/ServiceOrders'));
const Contracts = lazy(() => import('./pages/contracts/Contracts'));
const Financeiro = lazy(() => import('./pages/finance/Financeiro'));
const Equipment = lazy(() => import('./pages/equipment/Equipment'));
const Reports = lazy(() => import('./pages/reports/Reports'));
const Settings = lazy(() => import('./pages/settings/Settings'));

const page = (Component) => (
  <Suspense fallback={<PageSkeleton />}>
    <Component />
  </Suspense>
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeModeProvider>
        <SnackbarProvider
          maxSnack={3}
          autoHideDuration={4000}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          preventDuplicate
        >
          <ConfirmProvider>
            <AppErrorBoundary fullScreen>
              <BrowserRouter>
                <AuthProvider>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route
                      path="/"
                      element={
                        <ProtectedRoute>
                          <AppLayout />
                        </ProtectedRoute>
                      }
                    >
                      <Route index element={page(Dashboard)} />
                      <Route path="clientes" element={page(Clients)} />
                      <Route path="clientes/:id" element={page(ClientDetail)} />
                      <Route path="agenda" element={page(Agenda)} />
                      <Route path="ordens-servico" element={page(ServiceOrders)} />
                      <Route path="contratos" element={page(Contracts)} />
                      <Route path="financeiro" element={page(Financeiro)} />
                      <Route path="pagamentos" element={<Navigate to="/financeiro" replace />} />
                      <Route path="equipamentos" element={page(Equipment)} />
                      <Route path="relatorios" element={page(Reports)} />
                      <Route path="configuracoes" element={page(Settings)} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                  </Routes>
                </AuthProvider>
              </BrowserRouter>
            </AppErrorBoundary>
          </ConfirmProvider>
        </SnackbarProvider>
      </ThemeModeProvider>
    </QueryClientProvider>
  );
}
