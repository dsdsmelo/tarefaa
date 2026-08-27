import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Key, 
  Loader2, 
  Mail, 
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/auditLog';
import { useRef } from 'react';
import { Turnstile, type TurnstileHandle } from '@/components/auth/Turnstile';

interface PasswordChangeCardProps {
  userEmail: string;
}

export const PasswordChangeCard = ({ userEmail }: PasswordChangeCardProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileHandle>(null);
  const { toast } = useToast();

  const handleRequestPasswordChange = async () => {
    if (!userEmail) {
      toast({
        title: 'Erro',
        description: 'Email do usuário não encontrado.',
        variant: 'destructive',
      });
      return;
    }

    // Verify email confirmation matches
    if (confirmEmail.toLowerCase() !== userEmail.toLowerCase()) {
      toast({
        title: 'Email não confere',
        description: 'Digite seu email corretamente para confirmar a solicitação.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${window.location.origin}/admin/reset-password`,
        captchaToken: captchaToken ?? undefined,
      });

      if (error) throw error;

      captchaRef.current?.reset();
      setCaptchaToken(null);

      // Log the password reset request
      await logAuditEvent({
        user_email: userEmail,
        action: 'password_reset_request',
        details: 'Solicitação de troca de senha via painel admin',
        level: 'info',
      });

      setEmailSent(true);
      toast({
        title: 'Email enviado!',
        description: 'Verifique sua caixa de entrada para redefinir a senha.',
      });
    } catch (error: any) {
      console.error('Password reset request error:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível enviar o email de redefinição.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setEmailSent(false);
    setConfirmEmail('');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-primary" />
            <div>
              <CardTitle>Alterar Senha</CardTitle>
              <CardDescription>
                Solicite uma troca de senha com confirmação por email
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline">
            <Mail className="w-3 h-3 mr-1" />
            Via Email
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!emailSent ? (
          <>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-600">Processo Seguro</p>
                  <p className="text-amber-600/80">
                    Por segurança, a troca de senha requer confirmação por email. 
                    Um link será enviado para <strong>{userEmail}</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-email">
                Confirme seu email para solicitar a troca
              </Label>
              <Input
                id="confirm-email"
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder="Digite seu email para confirmar"
              />
              <p className="text-xs text-muted-foreground">
                Digite exatamente <strong>{userEmail}</strong> para prosseguir
              </p>
            </div>

            <Turnstile
              ref={captchaRef}
              action="admin_change_password"
              onVerify={setCaptchaToken}
              onExpire={() => setCaptchaToken(null)}
            />

            <Button
              onClick={handleRequestPasswordChange}
              disabled={isLoading || !confirmEmail}
              className="w-full sm:w-auto"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Solicitar Troca de Senha
                </>
              )}
            </Button>
          </>
        ) : (
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Email Enviado!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Enviamos um link de redefinição para <strong>{userEmail}</strong>.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Clique no link do email para definir uma nova senha.
              </p>
            </div>
            <Button variant="outline" onClick={handleReset}>
              Solicitar Novamente
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
