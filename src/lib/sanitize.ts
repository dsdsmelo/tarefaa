import DOMPurify from 'dompurify';

// Sanitiza HTML de conteúdo do usuário antes de renderizar/imprimir.
// Remove scripts, handlers de evento (onerror, onclick...) e vetores de XSS.
export const sanitizeHtml = (html: string): string =>
  DOMPurify.sanitize(html || '', { USE_PROFILES: { html: true } });

// Escapa texto simples (títulos etc.) para interpolar com segurança em HTML.
export const escapeHtml = (value: string): string =>
  (value || '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
