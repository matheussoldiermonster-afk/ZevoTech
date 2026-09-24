/** Helpers Zod reutilizados pelos controllers. */
const { z } = require('zod');
const { parseDateOnly } = require('./dates');

/** '' e null viram null; string é aparada. Útil para campos opcionais de formulário. */
const nullableText = (max = 500) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : v),
    z.string().max(max).nullable().optional()
  );

const requiredText = (min = 1, max = 200) =>
  z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().min(min).max(max));

const uuid = () => z.string().uuid({ message: 'Identificador inválido.' });

/** UUID opcional: '' / null → null. */
const nullableUuid = () =>
  z.preprocess((v) => (v === '' ? null : v), z.string().uuid({ message: 'Identificador inválido.' }).nullable().optional());

/** Data civil (ver lib/dates.js). Aceita "YYYY-MM-DD" ou ISO. */
const dateOnly = () =>
  z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      const d = parseDateOnly(v);
      return d || v; // mantém inválido para o Zod reportar
    },
    z.date({ invalid_type_error: 'Data inválida.', required_error: 'Data obrigatória.' })
  );

const nullableDateOnly = () =>
  z.preprocess(
    (v) => {
      if (v === '' || v === null) return null;
      if (v === undefined) return undefined;
      const d = parseDateOnly(v);
      return d || v;
    },
    z.date({ invalid_type_error: 'Data inválida.' }).nullable().optional()
  );

/** Valor monetário: número ≥ 0 com no máximo 2 casas. */
const money = () =>
  z.coerce
    .number({ invalid_type_error: 'Valor inválido.' })
    .nonnegative('O valor não pode ser negativo.')
    .max(99999999.99, 'Valor muito alto.')
    .transform((v) => Math.round(v * 100) / 100);

/** Horário "HH:mm". */
const time = () =>
  z.preprocess(
    (v) => (v === '' ? null : v),
    z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido (use HH:mm).')
      .nullable()
      .optional()
  );

const serviceOrderStatus = z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
const serviceOrderType = z.enum(['INSTALLATION', 'CORRECTIVE', 'PREVENTIVE', 'KIT_REMOVAL', 'OTHER']);
const serviceOrderPriority = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
const paymentStatus = z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']);
const paymentMethod = z.enum(['CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'BOLETO']);
const schedulePeriod = z.enum(['MORNING', 'AFTERNOON', 'EVENING']);
const equipmentStatus = z.enum(['IN_STOCK', 'INSTALLED', 'MAINTENANCE', 'DAMAGED', 'DISCARDED']);
const contractPeriodicity = z.enum(['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']);
const contractStatus = z.enum(['ACTIVE', 'SUSPENDED', 'CANCELLED', 'ENDED']);

/** Valida um valor de enum vindo da query string; ignora valores inválidos. */
function enumFilter(schema, value) {
  if (value === undefined || value === '') return undefined;
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/** Lista separada por vírgula (?status=OPEN,IN_PROGRESS) validada contra o enum. */
function enumListFilter(schema, value) {
  if (value === undefined || value === '') return undefined;
  const list = String(value)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => schema.safeParse(s).success);
  return list.length ? list : undefined;
}

function uuidFilter(value) {
  if (!value) return undefined;
  return z.string().uuid().safeParse(value).success ? String(value) : '00000000-0000-0000-0000-000000000000';
}

module.exports = {
  nullableText,
  requiredText,
  uuid,
  nullableUuid,
  dateOnly,
  nullableDateOnly,
  money,
  time,
  serviceOrderStatus,
  serviceOrderType,
  serviceOrderPriority,
  paymentStatus,
  paymentMethod,
  schedulePeriod,
  equipmentStatus,
  contractPeriodicity,
  contractStatus,
  enumFilter,
  enumListFilter,
  uuidFilter,
};
