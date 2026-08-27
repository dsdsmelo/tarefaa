import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, Loader2, Mail, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/auditLog';
import { useAuth } from '@/contexts/AuthContext';
import { Turnstile, type TurnstileHandle } from '@/components/auth/Turnstile';
import { MfaEnroll } from '@/components/auth/MfaEnroll';
import { MfaChallenge } from '@/components/auth/MfaChallenge';

type ViewMode = 'login' | 'forgot-password' | 'reset-sent' | 'mfa';

const errMessage = (e: unknown) =>
  (e as { message?: string })?.message ?? 'Erro inesperado';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('login');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { refreshMfa, hasVerifiedFactor } = useAuth();

  const resetCaptcha = () => {
    turnstileRef.current?.reset();
    setCaptchaToken(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: captchaToken ? { captchaToken } : undefined,
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('Falha na autenticação');

      // Confere se é admin
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authData.user.id)
        .eq('role', 'admin')
        .maybeSingle();
      if (roleError) throw roleError;

      if (!roleData) {
        await supabase.auth.signOut();
        await logAuditEvent({
          user_id: authData.user.id,
          user_email: email,
          action: 'login_failed',
          details: 'Tentativa de acesso ao painel admin sem permissões de administrador',
          level: 'warning',
        });
        throw new Error('Acesso negado. Você não tem permissões de administrador.');
      }

      // Sessão em AAL1: exige 2FA nativo (enroll se não tiver fator, challenge se tiver)
      await refreshMfa();
      setViewMode('mfa');
      setIsLoading(false);
    } catch (error) {
      await logAuditEvent({
        user_email: email,
        action: 'login_failed',
        details: errMessage(error) || 'Credenciais inválidas',
        level: 'error',
      });
      let msg = errMessage(error) || 'Credenciais inválidas ou sem permissão de admin.';
      if (msg.toLowerCase().includes('captcha')) msg = 'Falha na verificação de segurança. Tente novamente.';
      resetCaptcha();
      toast({ title: 'Erro no login', description: msg, variant: 'destructive' });
      setIsLoading(false);
    }
  };

  const handleMfaDone = async () => {
    await refreshMfa();
    await logAuditEvent({
      user_email: email,
      action: 'login',
      details: 'Login administrativo com 2FA bem-sucedido',
      level: 'success',
    });
    toast({ title: 'Bem-vindo, Admin!', description: 'Acesso liberado.' });
    navigate('/admin/panel');
  };

  const backToLogin = async () => {
    await supabase.auth.signOut();
    setViewMode('login');
    setPassword('');
    resetCaptcha();
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: 'Email obrigatório', description: 'Digite seu email de administrador.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      // Anti-enumeração: resposta sempre genérica
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/admin/reset-password`,
        captchaToken: captchaToken ?? undefined,
      });
    } catch {
      console.error('Password reset error');
    } finally {
      resetCaptcha();
      setViewMode('reset-sent');
      toast({
        title: 'Se o e-mail existir, enviaremos as instruções',
        description: 'Verifique sua caixa de entrada para redefinir a senha.',
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">Painel Administrativo</h1>
          <p className="text-slate-400 mt-2">
            {viewMode === 'login' && 'Acesso restrito a administradores'}
            {viewMode === 'forgot-password' && 'Recuperar acesso à sua conta'}
            {viewMode === 'reset-sent' && 'Verifique seu email'}
            {viewMode === 'mfa' && 'Verificação em duas etapas'}
          </p>
        </div>

        {/* Login */}
        {viewMode === 'login' && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-6 shadow-xl">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@empresa.com" required
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Senha</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'} value={password}
                    onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Turnstile ref={turnstileRef} action="admin_login"
                onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />

              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
                {isLoading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Entrando...</>)
                  : (<><Shield className="w-4 h-4 mr-2" />Acessar Painel</>)}
              </Button>

              <button type="button" onClick={() => setViewMode('forgot-password')}
                className="w-full text-center text-sm text-slate-400 hover:text-primary transition-colors">
                Esqueceu sua senha?
              </button>
            </form>
          </div>
        )}

        {/* Forgot password */}
        {viewMode === 'forgot-password' && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-6 shadow-xl">
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="reset-email" className="text-slate-300">Email do Administrador</Label>
                <Input id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@empresa.com" required
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500" />
              </div>
              <Turnstile ref={turnstileRef} action="admin_recover"
                onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
                {isLoading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</>)
                  : (<><Mail className="w-4 h-4 mr-2" />Enviar Link de Recuperação</>)}
              </Button>
              <button type="button" onClick={() => setViewMode('login')}
                className="w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-primary transition-colors">
                <ArrowLeft className="w-4 h-4" />Voltar ao login
              </button>
            </form>
          </div>
        )}

        {/* Reset sent */}
        {viewMode === 'reset-sent' && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-6 shadow-xl text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Verifique seu email</h3>
            <p className="text-slate-400 text-sm mb-6">
              Se o e-mail existir, enviamos um link de recuperação. Clique nele para redefinir a senha.
            </p>
            <Button variant="outline" onClick={() => setViewMode('login')}
              className="w-full border-slate-600 text-slate-300 hover:bg-slate-700">
              <ArrowLeft className="w-4 h-4 mr-2" />Voltar ao login
            </Button>
          </div>
        )}

        {/* MFA nativo (enroll ou challenge) */}
        {viewMode === 'mfa' && (
          <div className="bg-card rounded-2xl border border-border p-8 shadow-xl">
            {hasVerifiedFactor ? (
              <MfaChallenge onVerified={handleMfaDone} />
            ) : (
              <MfaEnroll onEnrolled={handleMfaDone} />
            )}
            <div className="text-center mt-4">
              <button type="button" onClick={backToLogin}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />Voltar ao login
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-slate-500 text-sm mt-6">Área restrita do sistema Tarefaa</p>
      </div>
    </div>
  );
};

export default AdminLogin;
