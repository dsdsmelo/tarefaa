import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, Copy } from 'lucide-react';

interface MfaEnrollProps {
  onEnrolled: () => void;
}

export function MfaEnroll({ onEnrolled }: MfaEnrollProps) {
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState('');
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        // Remove fatores TOTP não verificados antes de criar um novo (evita acúmulo)
        const { data: list } = await supabase.auth.mfa.listFactors();
        const unverified = (list?.all ?? []).filter(
          (f) => f.factor_type === 'totp' && f.status !== 'verified'
        );
        for (const f of unverified) {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }

        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: `Tarefaa-${Date.now()}`,
        });
        if (error) throw error;
        setFactorId(data.id);
        setQr(data.totp.qr_code);
        setSecret(data.totp.secret);
      } catch (err) {
        console.error('MFA enroll error:', err);
        toast.error('Não foi possível iniciar a configuração do 2FA.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const verify = async () => {
    if (code.length !== 6 || verifying) return;
    setVerifying(true);
    try {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
      if (cErr) throw cErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (vErr) throw vErr;
      toast.success('2FA ativado com sucesso!');
      onEnrolled();
    } catch (err) {
      console.error('MFA verify error:', err);
      toast.error('Código inválido. Verifique o app e tente novamente.');
      setCode('');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-3">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold">Ative a verificação em duas etapas</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Obrigatória para proteger sua conta. Use um app autenticador
          (Google Authenticator, Authy, 1Password…).
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Gerando QR Code...
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center gap-3">
            {qr && (
              <img
                src={qr}
                alt="QR Code do 2FA"
                className="w-44 h-44 rounded-lg border border-border bg-white p-2"
              />
            )}
            <div className="w-full">
              <p className="text-xs text-muted-foreground text-center mb-1">
                Ou insira o código manualmente:
              </p>
              <button
                type="button"
                onClick={() => { navigator.clipboard?.writeText(secret); toast.success('Código copiado'); }}
                className="w-full flex items-center justify-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs break-all hover:bg-muted transition-colors"
              >
                {secret}
                <Copy className="w-3.5 h-3.5 flex-shrink-0" />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Código de 6 dígitos do app</label>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && verify()}
              className="text-center text-lg tracking-[0.4em] font-mono h-12"
            />
          </div>

          <Button onClick={verify} disabled={code.length !== 6 || verifying} className="w-full h-12 gradient-primary text-white">
            {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ativar 2FA'}
          </Button>
        </>
      )}
    </div>
  );
}

export default MfaEnroll;
