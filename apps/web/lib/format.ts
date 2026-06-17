// Formatação de exibição (não usar para cálculo — números vêm como Decimal string da API).

export function formatBRL(value: string): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function venceEm(days: number): string {
  if (days < 0) return `vencido há ${Math.abs(days)}d`;
  if (days === 0) return 'vence hoje';
  return `em ${days}d`;
}
