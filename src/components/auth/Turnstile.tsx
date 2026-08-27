import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

// Site key do Cloudflare Turnstile (pública — pode ficar no código)
const SITE_KEY = '0x4AAAAAAEeHkhOmID7LjIpr';
const SCRIPT_ID = 'cf-turnstile-script';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, any>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
      execute: (id?: string, opts?: Record<string, any>) => void;
    };
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface TurnstileHandle {
  reset: () => void;
  // Executa o desafio (modo invisível) e resolve com o token (ou null)
  getToken: () => Promise<string | null>;
}

interface TurnstileProps {
  onVerify?: (token: string) => void;
  onExpire?: () => void;
  action?: string;
  // 'render' (visível, resolve no load) | 'execute' (invisível, sob demanda)
  execution?: 'render' | 'execute';
  appearance?: 'always' | 'execute' | 'interaction-only';
}

export const Turnstile = forwardRef<TurnstileHandle, TurnstileProps>(
  ({ onVerify, onExpire, action = 'auth', execution = 'render', appearance = 'always' }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const tokenRef = useRef<string | null>(null);
    const resolverRef = useRef<((t: string | null) => void) | null>(null);
    const onVerifyRef = useRef(onVerify);
    const onExpireRef = useRef(onExpire);
    onVerifyRef.current = onVerify;
    onExpireRef.current = onExpire;

    useImperativeHandle(ref, () => ({
      reset: () => {
        tokenRef.current = null;
        if (widgetIdRef.current && window.turnstile) {
          try { window.turnstile.reset(widgetIdRef.current); } catch { /* noop */ }
        }
      },
      getToken: () =>
        new Promise((resolve) => {
          if (tokenRef.current) return resolve(tokenRef.current);
          resolverRef.current = resolve;
          if (window.turnstile && widgetIdRef.current) {
            try { window.turnstile.execute(widgetIdRef.current); } catch { /* noop */ }
          }
          // fallback: não trava a UI se o widget não responder
          setTimeout(() => {
            if (resolverRef.current) { resolverRef.current = null; resolve(tokenRef.current); }
          }, 8000);
        }),
    }));

    useEffect(() => {
      let cancelled = false;
      let poll: ReturnType<typeof setInterval> | null = null;

      const handleToken = (token: string) => {
        tokenRef.current = token;
        onVerifyRef.current?.(token);
        if (resolverRef.current) { resolverRef.current(token); resolverRef.current = null; }
      };

      const render = () => {
        if (cancelled || !containerRef.current || !window.turnstile || widgetIdRef.current) return;
        const isDark = document.documentElement.classList.contains('dark');
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          action,
          theme: isDark ? 'dark' : 'light',
          size: 'flexible',
          execution,
          appearance,
          callback: (token: string) => handleToken(token),
          'expired-callback': () => { tokenRef.current = null; onExpireRef.current?.(); },
          'error-callback': () => { tokenRef.current = null; onExpireRef.current?.(); },
        });
      };

      if (window.turnstile) {
        render();
      } else {
        let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
        if (!script) {
          script = document.createElement('script');
          script.id = SCRIPT_ID;
          script.src = SCRIPT_SRC;
          script.async = true;
          script.defer = true;
          document.head.appendChild(script);
        }
        poll = setInterval(() => {
          if (window.turnstile) {
            if (poll) clearInterval(poll);
            render();
          }
        }, 150);
      }

      return () => {
        cancelled = true;
        if (poll) clearInterval(poll);
        if (widgetIdRef.current && window.turnstile) {
          try { window.turnstile.remove(widgetIdRef.current); } catch { /* noop */ }
          widgetIdRef.current = null;
        }
      };
    }, [action, execution, appearance]);

    return <div ref={containerRef} className="w-full" />;
  }
);

Turnstile.displayName = 'Turnstile';

export default Turnstile;
