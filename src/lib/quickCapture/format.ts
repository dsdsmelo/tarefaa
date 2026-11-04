// Formatação para a prévia da captura e a triagem.

/** "sex., 06/11" (ano só quando não é o atual) */
export function formatShortDate(iso: string, today: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const sameYear = today.slice(0, 4) === iso.slice(0, 4);
  return date.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}
