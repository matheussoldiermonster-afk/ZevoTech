require('dotenv').config();
const { applyZodLocale } = require('./lib/zodLocale');

applyZodLocale();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const errorHandler = require('./middleware/errorHandler');
const { startOverdueJob } = require('./jobs/overdueJob');
const { startBackupJob } = require('./jobs/backupJob');

const authRoutes = require('./routes/authRoutes');
const clientRoutes = require('./routes/clientRoutes');
const companyRoutes = require('./routes/companyRoutes');
const addressRoutes = require('./routes/addressRoutes');
const technicianRoutes = require('./routes/technicianRoutes');
const serviceOrderRoutes = require('./routes/serviceOrderRoutes');
const contractRoutes = require('./routes/contractRoutes');
const monthlyPaymentRoutes = require('./routes/monthlyPaymentRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const equipmentTypeRoutes = require('./routes/equipmentTypeRoutes');
const equipmentRoutes = require('./routes/equipmentRoutes');
const financeRoutes = require('./routes/financeRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const alertRoutes = require('./routes/alertRoutes');
const reportRoutes = require('./routes/reportRoutes');
const userRoutes = require('./routes/userRoutes');
const backupRoutes = require('./routes/backupRoutes');

// ---------------------------------------------------------------------------
// Validação de configuração na subida (falha cedo em vez de rodar inseguro)
// ---------------------------------------------------------------------------
const isProduction = process.env.NODE_ENV === 'production';
const WEAK_SECRETS = ['troque-por-uma-chave-secreta-forte', 'secret', 'changeme'];

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET não definido no .env. Abortando.');
  process.exit(1);
}
if (isProduction && (WEAK_SECRETS.includes(process.env.JWT_SECRET) || process.env.JWT_SECRET.length < 32)) {
  console.error('JWT_SECRET fraco para produção (use ao menos 32 caracteres aleatórios). Abortando.');
  process.exit(1);
}

const allowedOrigins = (process.env.CORS_ORIGIN || (isProduction ? '' : 'http://localhost:5173'))
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
if (isProduction && allowedOrigins.length === 0) {
  console.error('CORS_ORIGIN não definido em produção. Abortando.');
  process.exit(1);
}

const app = express();

if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY);
app.disable('x-powered-by');

app.use(
  cors({
    origin(origin, cb) {
      // Requisições sem Origin (curl, health checks) são permitidas
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
  })
);
app.use(express.json({ limit: '1mb' }));

// Cabeçalhos básicos de segurança
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// ---------------------------------------------------------------------------
// Rate limit por USUÁRIO autenticado (e por IP para anônimos).
// Antes era 300 req/15 min por IP: num escritório, todos saem pelo mesmo IP
// e o limite estourava em uso normal.
// ---------------------------------------------------------------------------
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => (req.rateLimitUser ? 1500 : 300),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.rateLimitUser ? `u:${req.rateLimitUser}` : `ip:${req.ip}`),
  message: { error: 'Muitas requisições em pouco tempo. Aguarde um instante e tente novamente.' },
});
app.use('/api', (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) {
    try {
      req.rateLimitUser = jwt.verify(token, process.env.JWT_SECRET).sub;
    } catch (e) {
      /* token inválido: tratado como anônimo; o authMiddleware responde 401 */
    }
  }
  next();
});
app.use('/api', apiLimiter);

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'zevo-tech-api' }));

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/technicians', technicianRoutes);
app.use('/api/service-orders', serviceOrderRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/monthly-payments', monthlyPaymentRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/equipment-types', equipmentTypeRoutes);
app.use('/api/equipments', equipmentRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/backups', backupRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Recurso não encontrado.' }));

app.use(errorHandler);

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Zevo Tech API rodando na porta ${PORT}`);
  if (process.env.DISABLE_JOBS !== 'true') {
    startOverdueJob();
    startBackupJob();
  }
});
