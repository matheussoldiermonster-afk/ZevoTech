const { parseMonth, currentMonth } = require('../lib/dates');
const { badRequest } = require('../lib/httpError');
const { buildMonthlyReport } = require('../services/reportService');
const { renderMonthlyPdf } = require('../services/reportPdf');
const { renderMonthlyExcel } = require('../services/reportExcel');

function monthFrom(req) {
  if (!req.query.month) return currentMonth();
  const ref = parseMonth(req.query.month);
  if (!ref) throw badRequest('Mês inválido. Use o formato AAAA-MM.');
  return ref;
}

/** GET /api/reports/monthly?month=AAAA-MM */
async function monthly(req, res, next) {
  try {
    return res.json(await buildMonthlyReport(monthFrom(req)));
  } catch (err) {
    return next(err);
  }
}

/** GET /api/reports/monthly/pdf?month=AAAA-MM */
async function monthlyPdf(req, res, next) {
  try {
    const report = await buildMonthlyReport(monthFrom(req));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-zevo-${report.month}.pdf"`);
    return renderMonthlyPdf(report, res);
  } catch (err) {
    if (res.headersSent) return res.destroy(err);
    return next(err);
  }
}

/** GET /api/reports/monthly/xlsx?month=AAAA-MM */
async function monthlyXlsx(req, res, next) {
  try {
    const report = await buildMonthlyReport(monthFrom(req), { details: true });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-zevo-${report.month}.xlsx"`);
    await renderMonthlyExcel(report, res);
    return res.end();
  } catch (err) {
    if (res.headersSent) return res.destroy(err);
    return next(err);
  }
}

module.exports = { monthly, monthlyPdf, monthlyXlsx };
