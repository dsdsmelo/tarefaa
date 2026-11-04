// Utilitários de texto do parser da captura rápida.

/**
 * Minúsculas e sem acentos, com o MESMO comprimento do texto original, para que
 * as posições encontradas no texto "dobrado" valham no original.
 */
export function fold(text: string): string {
  let out = '';
  for (const ch of text) {
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (base.length === ch.length) out += base;
    else {
      const lower = ch.toLowerCase();
      out += lower.length === ch.length ? lower : ch;
    }
  }
  return out;
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

export const isWordChar = (ch: string | undefined): boolean => !!ch && WORD_CHAR.test(ch);

/** Substitui o trecho por espaços (mantém as posições) */
export function mask(text: string, start: number, end: number): string {
  return text.slice(0, start) + ' '.repeat(end - start) + text.slice(end);
}

export interface Span {
  start: number;
  end: number;
  /** Trecho do texto original */
  text: string;
}

/** Remove os trechos do texto original e arruma espaços e pontuação solta */
export function removeSpans(text: string, spans: { start: number; end: number }[]): string {
  const sorted = [...spans].sort((a, b) => b.start - a.start);
  let out = text;
  for (const s of sorted) out = out.slice(0, s.start) + ' ' + out.slice(s.end);
  return out
    .replace(/\s+([,;:.!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,;:\-–—\s]+|[,;:\-–—\s]+$/g, '')
    .trim();
}
