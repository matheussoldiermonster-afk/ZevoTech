/**
 * Relatório mensal em Excel (exceljs).
 * Valores são números com formato de moeda e datas são datas de verdade, para
 * que a planilha possa ser somada, filtrada e ordenada.
 */
const { formatMonthLabel, formatDateTimeBR, toExcelLocal } = require('../lib/reportFormat');

const MONEY = '"R$" #,##0.00';
const DATE = 'dd/mm/yyyy';
const DATETIME = 'dd/mm/yyyy hh:mm';
const PRIMARY = 'FF0F6B72';
const LIGHT = 'FFEEF4F3';

const PAYMENT_STATUS = { PENDING: 'Pendente', PAID: 'Pago', OVERDUE: 'Atrasado', CANCELLED: 'Cancelado' };
const PAYMENT_METHOD = {
  PIX: 'Pix',
  BOLETO: 'Boleto',
  BANK_TRANSFER: 'Transferência',
  CASH: 'Dinheiro',
  DEBIT_CARD: 'Cartão de débito',
  CREDIT_CARD: 'Cartão de crédito',
};
const OS_STATUS = { OPEN: 'Aberta', IN_PROGRESS: 'Em andamento', COMPLETED: 'Concluída', CANCELLED: 'Cancelada' };
const PRIORITY = { LOW: 'Baixa', NORMAL: 'Normal', HIGH: 'Alta', URGENT: 'Urgente' };
const TYPE = { INSTALLATION: 'Instalação', CORRECTIVE: 'Corretiva', PREVENTIVE: 'Preventiva', KIT_REMOVAL: 'Retirada de kit', OTHER: 'Outro' };

function styleHeader(ws) {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.alignment = { vertical: 'middle' };
  row.height = 20;
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY } };
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };
}

/** Planilha tabular: columns [{ header, key, width, numFmt }] */
function dataSheet(wb, name, columns, rows) {
  const ws = wb.addWorksheet(name);
  ws.columns = columns.map(({ header, key, width }) => ({ header, key, width }));
  rows.forEach((r) => ws.addRow(r));
  columns.forEach((c) => {
    if (c.numFmt) ws.getColumn(c.key).numFmt = c.numFmt;
  });
  styleHeader(ws);
  return ws;
}

function summarySheet(wb, report) {
  const ws = wb.addWorksheet('Resumo', { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 44 }, { width: 22 }, { width: 22 }];

  ws.mergeCells('A1:C1');
  ws.getCell('A1').value = `Zevo Tech — Relatório gerencial de ${formatMonthLabel(report.month)}`;
  ws.getCell('A1').font = { bold: true, size: 14, color: { argb: PRIMARY } };
  ws.getCell('A2').value = `Gerado em ${formatDateTimeBR(report.generatedAt)}`;
  ws.getCell('A2').font = { italic: true, color: { argb: 'FF667478' } };

  const section = (title) => {
    ws.addRow([]);
    const row = ws.addRow([title]);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ['A', 'B', 'C'].forEach((col) => {
      ws.getCell(`${col}${row.number}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY } };
    });
  };
  const line = (label, value, numFmt, extra) => {
    const row = ws.addRow([label, value, extra ?? null]);
    if (numFmt) row.getCell(2).numFmt = numFmt;
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
    return row;
  };
  const pctValue = (v) => (v === null || v === undefined ? '—' : v / 100);

  const f = report.finance;
  section('Resumo financeiro');
  line('Previsto no mês', f.expected, MONEY);
  line('Variação do previsto vs. mês anterior', pctValue(f.changes.expected), '0.0%');
  line('Recebido no mês', f.received, MONEY);
  line('Variação do recebido vs. mês anterior', pctValue(f.changes.received), '0.0%');
  line('Em aberto no mês', f.open, MONEY);
  line('Atrasado com vencimento no mês', f.overdueInMonth, MONEY);
  line('Em atraso (todos os meses)', f.overdueTotal, MONEY, `${f.overdueTotalCount} cobrança(s)`);
  line('Receita recorrente mensal', f.recurringRevenue, MONEY, `${f.activeContracts} contrato(s) ativo(s)`);
  line('Taxa de recebimento', pctValue(f.receivedRate), '0.0%');
  f.byStatus.forEach((s) => line(`Cobranças do mês — ${s.label.toLowerCase()}`, s.amount, MONEY, `${s.count} cobrança(s)`));

  const o = report.operations;
  section('Operação');
  line('OS abertas no mês', o.created);
  line('OS concluídas no mês', o.completed);
  line('OS canceladas no mês', o.cancelled);
  line('Em aberto hoje (abertas)', o.backlog.open);
  line('Em aberto hoje (em andamento)', o.backlog.inProgress);
  line('Tempo médio de conclusão (dias)', o.avgResolutionDays ?? '—', o.avgResolutionDays === null ? undefined : '0.0');
  o.byType.forEach((t) => line(`Tipo — ${t.label}`, t.count, undefined, pctValue(t.percent)));
  ws.eachRow((row) => {
    const c = row.getCell(3);
    if (typeof c.value === 'number' && String(row.getCell(1).value || '').startsWith('Tipo — ')) c.numFmt = '0.0%';
  });
  o.byTechnician.forEach((t) => line(`Concluídas — ${t.name}`, t.count));

  const c = report.clients;
  section('Clientes');
  line('Clientes ativos', c.active);
  line('Novos no mês', c.newInMonth);
  line('Com OS no mês', c.withOrders);
  line('Inadimplentes', c.delinquent);

  const e = report.equipment;
  section('Equipamentos');
  line('Disponíveis', e.available);
  line('Instalados', e.installed);
  line('Em manutenção', e.maintenance);
  line('Danificados', e.damaged);
  line('Instalações no mês', e.installedInMonth);
  line('Retiradas para o estoque no mês', e.removedInMonth);

  ws.addRow([]);
  const note = ws.addRow([
    'Critérios: previsto = cobranças não canceladas com vencimento no mês; recebido = pagamentos registrados no mês ' +
      '(horário de Brasília); atraso = vencida e não paga. Inclui contratos e ordens de serviço.',
  ]);
  ws.mergeCells(`A${note.number}:C${note.number}`);
  note.getCell(1).alignment = { wrapText: true };
  note.height = 42;
  note.font = { italic: true, color: { argb: 'FF667478' } };
}

/**
 * Escreve o .xlsx no stream. O exceljs é carregado aqui para não pesar
 * na subida do servidor.
 */
async function renderMonthlyExcel(report, stream) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Zevo Tech';
  wb.created = new Date();

  summarySheet(wb, report);

  const d = report.details || { receivables: [], orders: [], delinquents: [] };

  dataSheet(
    wb,
    'Cobranças do mês',
    [
      { header: 'Cliente', key: 'client', width: 32 },
      { header: 'Empresa', key: 'company', width: 30 },
      { header: 'Origem', key: 'source', width: 18 },
      { header: 'Vencimento', key: 'dueDate', width: 13, numFmt: DATE },
      { header: 'Valor', key: 'amount', width: 14, numFmt: MONEY },
      { header: 'Situação', key: 'status', width: 12 },
      { header: 'Pago em', key: 'paidAt', width: 17, numFmt: DATETIME },
      { header: 'Forma', key: 'method', width: 18 },
    ],
    d.receivables.map((r) => ({
      client: r.clientName,
      company: r.companyName,
      source: r.source === 'CONTRACT' ? 'Contrato' : `OS #${r.orderNumber}`,
      dueDate: r.dueDate ? new Date(r.dueDate) : null,
      amount: Number(r.amount),
      status: PAYMENT_STATUS[r.status] || r.status,
      paidAt: toExcelLocal(r.paidAt),
      method: PAYMENT_METHOD[r.method] || '',
    }))
  );

  dataSheet(
    wb,
    'OS abertas no mês',
    [
      { header: 'Nº', key: 'number', width: 8 },
      { header: 'Aberta em', key: 'openedAt', width: 17, numFmt: DATETIME },
      { header: 'Título', key: 'title', width: 36 },
      { header: 'Cliente', key: 'client', width: 30 },
      { header: 'Empresa', key: 'company', width: 28 },
      { header: 'Tipo', key: 'type', width: 16 },
      { header: 'Prioridade', key: 'priority', width: 11 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Técnico', key: 'technician', width: 22 },
      { header: 'Valor', key: 'total', width: 14, numFmt: MONEY },
      { header: 'Concluída em', key: 'completedAt', width: 17, numFmt: DATETIME },
    ],
    d.orders.map((o) => ({
      number: o.orderNumber,
      openedAt: toExcelLocal(o.openedAt),
      title: o.title,
      client: o.client?.name,
      company: o.company?.name,
      type: TYPE[o.type] || o.type,
      priority: PRIORITY[o.priority] || o.priority,
      status: OS_STATUS[o.status] || o.status,
      technician: o.technician?.name || '',
      total: Number(o.totalValue),
      completedAt: toExcelLocal(o.completedAt),
    }))
  );

  dataSheet(
    wb,
    'Inadimplentes',
    [
      { header: 'Cliente', key: 'client', width: 36 },
      { header: 'Cobranças atrasadas', key: 'count', width: 20 },
      { header: 'Vencimento mais antigo', key: 'oldest', width: 22, numFmt: DATE },
      { header: 'Total em atraso', key: 'total', width: 18, numFmt: MONEY },
    ],
    d.delinquents.map((x) => ({
      client: x.clientName,
      count: x.count,
      oldest: x.oldestDueDate ? new Date(x.oldestDueDate) : null,
      total: x.total,
    }))
  );

  dataSheet(
    wb,
    'Estoque',
    [
      { header: 'Tipo', key: 'name', width: 34 },
      { header: 'Disponíveis', key: 'inStock', width: 13 },
      { header: 'Estoque mínimo', key: 'min', width: 16 },
      { header: 'Situação', key: 'situation', width: 18 },
    ],
    report.equipment.stockByType.map((t) => ({
      name: t.name,
      inStock: t.inStock,
      min: t.minimumStock,
      situation: t.belowMinimum ? 'Abaixo do mínimo' : 'OK',
    }))
  );

  if (d.truncated) {
    const ws = wb.getWorksheet('Resumo');
    const row = ws.addRow(['Atenção: as abas de detalhe foram limitadas a 5.000 linhas.']);
    row.font = { bold: true, color: { argb: 'FFC0392B' } };
  }

  await wb.xlsx.write(stream);
}

module.exports = { renderMonthlyExcel };
