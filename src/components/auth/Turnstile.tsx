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
    };
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface TurnstileHandle {
  reset: () => void;
}

interface TurnstileProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  action?: string;
}

export const Turnstile = forwardRef<TurnstileHandle, TurnstileProps>(
  ({ onVerify, onExpire, action = 'auth' }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const onVerifyRef = useRef(onVerify);
    const onExpireRef = useRef(onExpire);
    onVerifyRef.current = onVerify;
    onExpireRef.current = onExpire;

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (widgetIdRef.current && window.turnstile) {
          try { window.turnstile.reset(widgetIdRef.current); } catch { /* noop */ }
        }
      },
    }));

    useEffect(() => {
      let cancelled = false;
      let poll: ReturnType<typeof setInterval> | null = null;

      const render = () => {
        if (cancelled || !containerRef.current || !window.turnstile || widgetIdRef.current) return;
        // Combina com o tema do app (claro/escuro)
        const isDark = document.documentElement.classList.contains('dark');
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          action,
          theme: isDark ? 'dark' : 'light',
          size: 'flexible',
          callback: (token: string) => onVerifyRef.current(token),
          'expired-callback': () => onExpireRef.current?.(),
          'error-callback': () => onExpireRef.current?.(),
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
    }, [action]);

    return <div ref={containerRef} className="w-full" />;
  }
);

Turnstile.displayName = 'Turnstile';

export default Turnstile;
