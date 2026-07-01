import type { PortfolioRow } from '@pacific/shared';
import { riskLevel } from '@pacific/shared';
import { STATUS_LABEL } from './status';

const RISK_LABEL: Record<string, string> = { LOW: 'Baixo', MEDIUM: 'Médio', HIGH: 'Alto' };
const numBR = (v: string) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

/**
 * Baixa um CSV no navegador (sem servidor). Separador ';' e números em pt-BR (vírgula decimal) →
 * abre direto no Excel brasileiro; BOM UTF-8 garante acentuação correta. Campos sempre entre aspas.
 */
export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [headers, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + lines], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Exporta a carteira (já filtrada) para CSV — registro/contabilidade do padrinho. */
export function exportCarteiraCsv(rows: PortfolioRow[]): void {
  const headers = ['Sobrinho', 'Principal', 'Devido agora', 'Vencimento', 'Dias restantes', 'Situação', 'Recuperabilidade', 'Risco', 'Etiquetas', 'Quitada'];
  const body = rows.map((r) => [
    r.debtorName,
    numBR(r.principal),
    numBR(r.amountDue),
    dateBR(r.dueDate),
    String(r.daysRemaining),
    r.settled ? 'Quitada' : STATUS_LABEL[r.status],
    String(r.recoverability),
    RISK_LABEL[riskLevel(r.recoverability)] ?? '—',
    r.tags.join(', '),
    r.settled ? 'Sim' : 'Não',
  ]);
  downloadCsv(`pacific-carteira-${new Date().toISOString().slice(0, 10)}.csv`, headers, body);
}
