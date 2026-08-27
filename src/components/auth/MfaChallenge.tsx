import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, ShieldCheck } from 'lucide-react';

interface MfaChallengeProps {
  onVerified: () => void;
}

export function MfaChallenge({ onVerified }: MfaChallengeProps) {
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const totp = data?.totp?.find((f) => f.status === 'verified');
      if (totp) setFactorId(totp.id);
    })();
  }, []);

  const verify = async () => {
    if (code.length !== 6 || verifying || !factorId) return;
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
      onVerified();
    } catch (err) {
      console.error('MFA challenge error:', err);
      toast.error('Código inválido. Tente novamente.');
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
        <h2 className="text-2xl font-bold">Verificação em duas etapas</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Digite o código de 6 dígitos do seu app autenticador.
        </p>
      </div>

      <div className="space-y-2">
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => e.key === 'Enter' && verify()}
          className="text-center text-lg tracking-[0.4em] font-mono h-12"
          autoFocus
        />
      </div>

      <Button onClick={verify} disabled={code.length !== 6 || verifying} className="w-full h-12 gradient-primary text-white">
        {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar'}
      </Button>
    </div>
  );
}

export default MfaChallenge;
