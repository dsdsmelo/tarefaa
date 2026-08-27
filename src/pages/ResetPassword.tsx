import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/auditLog';
import { strongPasswordSchema } from '@/lib/passwordSchema';
import { z } from 'zod';
import logoIcon from '@/assets/logo-icon.png';

const passwordSchema = z.object({
  password: strongPasswordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type ViewMode = 'form' | 'success' | 'error';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('form');
  const { toast } = useToast();
  const navigate = useNavigate();

  // Check if we have a valid session from the reset/invite link
  useEffect(() => {
    const hash = window.location.hash;
    const isInviteOrRecovery = hash && (hash.includes('type=recovery') || hash.includes('type=invite'));

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Session exists (from recovery or invite link) - show the form
        setViewMode('form');
      } else if (!isInviteOrRecovery) {
        // No session and no tokens means the link is invalid or expired
        setViewMode('error');
      }
      // If no session but tokens are present, wait for onAuthStateChange
    };

    // Listen for auth state changes (when user clicks reset/invite link)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && isInviteOrRecovery)) {
        setViewMode('form');
      }
    });

    checkSession();

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = passwordSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      toast({
        title: 'Erro de validação',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      await logAuditEvent({
        action: 'password_changed',
        level: 'success',
        details: 'Senha alterada com sucesso',
      });

      setViewMode('success');
      
      // Sign out after password change and redirect to login
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate('/login');
      }, 3000);
    } catch (error: any) {
      console.error('Password update error:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível atualizar a senha. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
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

        {viewMode === 'form' && (
          <>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground">Criar nova senha</h2>
              <p className="text-muted-foreground mt-2">
                Digite sua nova senha abaixo
              </p>
            </div>

            <div className="bg-card rounded-2xl shadow-strong border border-border p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Nova senha
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirmar senha
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 pr-10 h-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 gradient-primary text-white font-semibold shadow-md hover:shadow-lg transition-all"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar nova senha'
                  )}
                </Button>
              </form>
            </div>
          </>
        )}

        {viewMode === 'success' && (
          <>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-3xl font-bold text-foreground">Senha alterada!</h2>
              <p className="text-muted-foreground mt-2">
                Sua senha foi atualizada com sucesso
              </p>
            </div>

            <div className="bg-card rounded-2xl shadow-strong border border-border p-8 text-center">
              <p className="text-muted-foreground mb-4">
                Você será redirecionado para a página de login em instantes...
              </p>
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            </div>
          </>
        )}

        {viewMode === 'error' && (
          <>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground">Link expirado</h2>
              <p className="text-muted-foreground mt-2">
                O link de recuperação é inválido ou expirou
              </p>
            </div>

            <div className="bg-card rounded-2xl shadow-strong border border-border p-8 text-center">
              <p className="text-muted-foreground mb-6">
                Por favor, solicite um novo link de recuperação de senha.
              </p>
              <Link to="/forgot-password">
                <Button className="gradient-primary text-white">
                  Solicitar novo link
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
