/**
 * Relatório mensal em PDF (pdfkit, fontes padrão Helvetica).
 * Observação: as fontes padrão do PDF usam a codificação WinAnsi — acentos do
 * português funcionam, mas símbolos como setas e emojis não. Por isso todo texto
 * passa por `safe()`.
 */
const { formatBRL, formatPercent, formatMonthLabel, formatDateTimeBR, formatDateBR } = require('../lib/reportFormat');

const COLORS = {
  primary: '#0F6B72',
  primaryDark: '#0C5A63',
  accent: '#8FC97A',
  text: '#1F2A2C',
  muted: '#667478',
  light: '#EEF4F3',
  border: '#D5E0DF',
  danger: '#C0392B',
};

const MARGIN = 40;

/** Remove caracteres fora da codificação das fontes padrão. */
function safe(text) {
  return String(text ?? '')
    .replace(/[\u00A0\u202F]/g, ' ')
    .replace(/[\u2192\u2190]/g, '-')
    .replace(/[^\u0000-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026\u20AC]/g, '');
}

function contentWidth(doc) {
  return doc.page.width - MARGIN * 2;
}

function ensureSpace(doc, height) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function header(doc, report) {
  const w = doc.page.width;
  doc.rect(0, 0, w, 78).fill(COLORS.primary);
  doc.rect(0, 78, w, 4).fill(COLORS.accent);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18).text('ZEVO TECH', MARGIN, 22, { lineBreak: false });
  doc.font('Helvetica').fontSize(11).text(safe(`Relatório gerencial — ${formatMonthLabel(report.month)}`), MARGIN, 46, { lineBreak: false });
  doc
    .fontSize(8)
    .text(safe(`Gerado em ${formatDateTimeBR(report.generatedAt)}`), MARGIN, 50, { width: contentWidth(doc), align: 'right' });
  doc.fillColor(COLORS.text);
  doc.y = 100;
}

function sectionTitle(doc, title) {
  ensureSpace(doc, 60);
  doc.moveDown(0.6);
  const y = doc.y;
  doc.rect(MARGIN, y, 4, 16).fill(COLORS.primary);
  doc.fillColor(COLORS.primaryDark).font('Helvetica-Bold').fontSize(13).text(safe(title), MARGIN + 12, y + 1);
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(10);
  doc.moveDown(0.5);
}

/** Linha de caixas de indicador. items: [{ label, value, hint, danger }] */
function kpiRow(doc, items) {
  const gap = 10;
  const width = (contentWidth(doc) - gap * (items.length - 1)) / items.length;
  const height = 58;
  ensureSpace(doc, height + 10);
  const y = doc.y;
  items.forEach((item, i) => {
    const x = MARGIN + i * (width + gap);
    doc.roundedRect(x, y, width, height, 6).fillAndStroke(COLORS.light, COLORS.border);
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8).text(safe(item.label), x + 10, y + 9, { width: width - 20 });
    doc
      .fillColor(item.danger ? COLORS.danger : COLORS.text)
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(safe(item.value), x + 10, y + 22, { width: width - 20 });
    if (item.hint) {
      doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5).text(safe(item.hint), x + 10, y + 41, { width: width - 20 });
    }
  });
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(10);
  doc.y = y + height + 10;
  doc.x = MARGIN;
}

/**
 * Tabela simples com quebra de página e repetição do cabeçalho.
 * columns: [{ header, width (fração), align }] · rows: string[][]
 */
function table(doc, columns, rows, { emptyText = 'Sem registros.' } = {}) {
  const total = contentWidth(doc);
  const widths = columns.map((c) => c.width * total);
  const rowHeight = 18;

  const drawHeader = () => {
    const y = doc.y;
    doc.rect(MARGIN, y, total, rowHeight).fill(COLORS.primary);
    let x = MARGIN;
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5);
    columns.forEach((c, i) => {
      doc.text(safe(c.header), x + 6, y + 5, { width: widths[i] - 12, align: c.align || 'left', lineBreak: false });
      x += widths[i];
    });
    doc.y = y + rowHeight;
  };

  ensureSpace(doc, rowHeight * 2);
  drawHeader();
  if (rows.length === 0) {
    doc.fillColor(COLORS.muted).font('Helvetica-Oblique').fontSize(9).text(safe(emptyText), MARGIN + 6, doc.y + 5);
    doc.moveDown(0.5);
  }
  rows.forEach((row, index) => {
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
    }
    const y = doc.y;
    if (index % 2 === 1) doc.rect(MARGIN, y, total, rowHeight).fill(COLORS.light);
    let x = MARGIN;
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.5);
    row.forEach((cell, i) => {
      doc.text(safe(cell), x + 6, y + 5, { width: widths[i] - 12, align: columns[i].align || 'left', lineBreak: false, ellipsis: true });
      x += widths[i];
    });
    doc.y = y + rowHeight;
  });
  doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + total, doc.y).lineWidth(0.5).strokeColor(COLORS.border).stroke();
  doc.x = MARGIN;
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(10);
  doc.moveDown(0.8);
}

function paragraph(doc, text) {
  ensureSpace(doc, 20);
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9).text(safe(text), MARGIN, doc.y, { width: contentWidth(doc) });
  doc.fillColor(COLORS.text).fontSize(10).moveDown(0.4);
}

function footers(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    // Sem isso o pdfkit criaria uma página nova ao escrever abaixo da margem inferior
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(8)
      .text(safe(`Zevo Tech · Relatório gerencial · Página ${i + 1} de ${range.count}`), MARGIN, doc.page.height - 28, {
        width: contentWidth(doc),
        align: 'center',
        lineBreak: false,
      });
    doc.page.margins.bottom = bottom;
  }
}

/**
 * Escreve o PDF no stream (normalmente a resposta HTTP).
 * O pdfkit é carregado aqui para não pesar na subida do servidor.
 */
function renderMonthlyPdf(report, stream) {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGIN,
    bufferPages: true,
    info: { Title: safe(`Relatório gerencial ${report.month}`), Author: 'Zevo Tech' },
  });
  doc.pipe(stream);

  const f = report.finance;
  const o = report.operations;
  const c = report.clients;
  const e = report.equipment;

  header(doc, report);

  sectionTitle(doc, 'Resumo financeiro');
  kpiRow(doc, [
    { label: 'Previsto no mês', value: formatBRL(f.expected), hint: f.changes.expected === null ? 'sem base no mês anterior' : `${formatPercent(f.changes.expected, true)} vs. mês anterior` },
    { label: 'Recebido no mês', value: formatBRL(f.received), hint: f.changes.received === null ? 'sem base no mês anterior' : `${formatPercent(f.changes.received, true)} vs. mês anterior` },
    { label: 'Em aberto no mês', value: formatBRL(f.open) },
    { label: 'Em atraso (todos os meses)', value: formatBRL(f.overdueTotal), hint: `${f.overdueTotalCount} cobrança(s)`, danger: f.overdueTotal > 0 },
  ]);
  kpiRow(doc, [
    { label: 'Receita recorrente mensal', value: formatBRL(f.recurringRevenue), hint: `${f.activeContracts} contrato(s) ativo(s)` },
    { label: 'Taxa de recebimento', value: f.receivedRate === null ? '—' : formatPercent(f.receivedRate), hint: 'recebido ÷ previsto' },
    { label: 'Atrasado com vencimento no mês', value: formatBRL(f.overdueInMonth), danger: f.overdueInMonth > 0 },
  ]);
  table(
    doc,
    [
      { header: 'Situação das cobranças do mês', width: 0.5 },
      { header: 'Quantidade', width: 0.2, align: 'right' },
      { header: 'Valor', width: 0.3, align: 'right' },
    ],
    f.byStatus.map((s) => [s.label, String(s.count), formatBRL(s.amount)])
  );

  sectionTitle(doc, 'Operação');
  kpiRow(doc, [
    { label: 'OS abertas no mês', value: String(o.created) },
    { label: 'Concluídas no mês', value: String(o.completed) },
    { label: 'Canceladas no mês', value: String(o.cancelled) },
    { label: 'Tempo médio de conclusão', value: o.avgResolutionDays === null ? '—' : `${String(o.avgResolutionDays).replace('.', ',')} dia(s)` },
  ]);
  paragraph(doc, `Em aberto hoje: ${o.backlog.open} aberta(s) e ${o.backlog.inProgress} em andamento.`);
  table(
    doc,
    [
      { header: 'Tipo de serviço (OS abertas no mês)', width: 0.55 },
      { header: 'Quantidade', width: 0.2, align: 'right' },
      { header: '%', width: 0.25, align: 'right' },
    ],
    o.byType.map((t) => [t.label, String(t.count), formatPercent(t.percent)])
  );
  table(
    doc,
    [
      { header: 'Técnico (OS concluídas no mês)', width: 0.7 },
      { header: 'Concluídas', width: 0.3, align: 'right' },
    ],
    o.byTechnician.map((t) => [t.name, String(t.count)]),
    { emptyText: 'Nenhuma OS concluída no mês.' }
  );

  sectionTitle(doc, 'Clientes');
  kpiRow(doc, [
    { label: 'Clientes ativos', value: String(c.active) },
    { label: 'Novos no mês', value: String(c.newInMonth) },
    { label: 'Com OS no mês', value: String(c.withOrders) },
    { label: 'Inadimplentes', value: String(c.delinquent), danger: c.delinquent > 0 },
  ]);
  table(
    doc,
    [
      { header: 'Maiores inadimplências', width: 0.45 },
      { header: 'Cobranças', width: 0.15, align: 'right' },
      { header: 'Mais antiga', width: 0.18, align: 'right' },
      { header: 'Em atraso', width: 0.22, align: 'right' },
    ],
    c.topDelinquents.map((d) => [d.clientName, String(d.count), formatDateBR(d.oldestDueDate), formatBRL(d.total)]),
    { emptyText: 'Nenhum cliente inadimplente.' }
  );

  sectionTitle(doc, 'Equipamentos');
  kpiRow(doc, [
    { label: 'Disponíveis', value: String(e.available) },
    { label: 'Instalados', value: String(e.installed), hint: `${e.installedInMonth} instalação(ões) no mês` },
    { label: 'Em manutenção', value: String(e.maintenance) },
    { label: 'Danificados', value: String(e.damaged), danger: e.damaged > 0 },
  ]);
  paragraph(doc, `Retiradas para o estoque no mês: ${e.removedInMonth}.`);
  table(
    doc,
    [
      { header: 'Estoque por tipo', width: 0.5 },
      { header: 'Disponíveis', width: 0.17, align: 'right' },
      { header: 'Mínimo', width: 0.15, align: 'right' },
      { header: 'Situação', width: 0.18, align: 'right' },
    ],
    e.stockByType.map((t) => [t.name, String(t.inStock), t.minimumStock ? String(t.minimumStock) : '—', t.belowMinimum ? 'Abaixo do mínimo' : 'OK']),
    { emptyText: 'Nenhum tipo de equipamento cadastrado.' }
  );

  paragraph(
    doc,
    'Critérios: previsto = cobranças não canceladas com vencimento no mês; recebido = pagamentos registrados no mês ' +
      '(horário de Brasília); atraso = vencida e não paga. Inclui cobranças de contratos e de ordens de serviço.'
  );

  footers(doc);
  doc.end();
}

module.exports = { renderMonthlyPdf, safe };
