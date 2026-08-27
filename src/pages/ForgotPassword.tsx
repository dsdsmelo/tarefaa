import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { Turnstile, type TurnstileHandle } from '@/components/auth/Turnstile';
import { z } from 'zod';
import logoIcon from '@/assets/logo-icon.png';

const emailSchema = z.string().email('Email inválido');

type ViewMode = 'form' | 'sent';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('form');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = emailSchema.safeParse(email);
    if (!validation.success) {
      toast({
        title: 'Email inválido',
        description: 'Por favor, digite um email válido.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Não revela se o e-mail existe (anti-enumeração): sempre mostra "enviado".
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
        captchaToken: captchaToken ?? undefined,
      });
    } catch (error) {
      console.error('Password reset error');
    } finally {
      turnstileRef.current?.reset();
      setCaptchaToken(null);
      setViewMode('sent');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <img src={logoIcon} alt="Tarefaa" className="w-16 h-16 mx-auto rounded-xl shadow-md" />
          </Link>
        </div>

        {viewMode === 'form' ? (
          <>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground">Esqueceu a senha?</h2>
              <p className="text-muted-foreground mt-2">
                Digite seu email e enviaremos um link para redefinir sua senha
              </p>
            </div>

            <div className="bg-card rounded-2xl shadow-strong border border-border p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12"
                      required
                    />
                  </div>
                </div>

                <Turnstile
                  ref={turnstileRef}
                  action="recover"
                  onVerify={setCaptchaToken}
                  onExpire={() => setCaptchaToken(null)}
                />

                <Button
                  type="submit"
                  className="w-full h-12 gradient-primary text-white font-semibold shadow-md hover:shadow-lg transition-all"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Mail className="w-5 h-5 mr-2" />
                      Enviar link de recuperação
                    </>
                  )}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-3xl font-bold text-foreground">Email enviado!</h2>
              <p className="text-muted-foreground mt-2">
                Verifique sua caixa de entrada
              </p>
            </div>

            <div className="bg-card rounded-2xl shadow-strong border border-border p-8 text-center">
              <p className="text-muted-foreground mb-6">
                Enviamos um link de recuperação para <strong className="text-foreground">{email}</strong>. 
                Clique no link do email para criar uma nova senha.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Não recebeu o email? Verifique sua pasta de spam ou{' '}
                <button 
                  onClick={() => setViewMode('form')} 
                  className="text-primary hover:underline font-medium"
                >
                  tente novamente
                </button>
              </p>
            </div>
          </>
        )}

        <div className="text-center mt-6">
          <Link 
            to="/login" 
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
