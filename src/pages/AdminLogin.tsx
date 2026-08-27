import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, Loader2, Mail, ArrowLeft, Smartphone, Lock, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/auditLog';
import * as OTPAuth from 'otpauth';

type ViewMode = 'login' | 'forgot-password' | 'reset-sent' | '2fa-verify' | '2fa-blocked';

interface PendingAuth {
  userId: string;
  email: string;
}

interface LockoutState {
  attempts: number;
  lockedUntil: number | null;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('login');
  const [totpCode, setTotpCode] = useState('');
  const [pendingAuth, setPendingAuth] = useState<PendingAuth | null>(null);
  const [lockout, setLockout] = useState<LockoutState>({ attempts: 0, lockedUntil: null });
  const [remainingTime, setRemainingTime] = useState<string>('');
  const { toast } = useToast();
  const navigate = useNavigate();

  // Load lockout state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('admin_2fa_lockout');
    if (stored) {
      const parsed = JSON.parse(stored) as LockoutState;
      if (parsed.lockedUntil && Date.now() < parsed.lockedUntil) {
        setLockout(parsed);
        setViewMode('2fa-blocked');
      } else if (parsed.lockedUntil && Date.now() >= parsed.lockedUntil) {
        // Lockout expired, clear it
        localStorage.removeItem('admin_2fa_lockout');
      } else {
        setLockout(parsed);
      }
    }
  }, []);

  // Update remaining time for lockout
  useEffect(() => {
    if (!lockout.lockedUntil) return;

    const updateTimer = () => {
      const remaining = lockout.lockedUntil! - Date.now();
      if (remaining <= 0) {
        setLockout({ attempts: 0, lockedUntil: null });
        localStorage.removeItem('admin_2fa_lockout');
        setViewMode('login');
        setRemainingTime('');
        return;
      }
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setRemainingTime(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lockout.lockedUntil]);

  const recordFailedAttempt = async (userEmail?: string) => {
    const newAttempts = lockout.attempts + 1;
    let newLockout: LockoutState;

    if (newAttempts >= MAX_ATTEMPTS) {
      newLockout = {
        attempts: newAttempts,
        lockedUntil: Date.now() + LOCKOUT_DURATION_MS,
      };
      setViewMode('2fa-blocked');
      toast({
        title: 'Conta bloqueada temporariamente',
        description: `Muitas tentativas incorretas. Tente novamente em 15 minutos.`,
        variant: 'destructive',
      });
      
      // Log blocked event
      await logAuditEvent({
        user_email: userEmail,
        action: '2fa_blocked',
        details: `Conta bloqueada após ${MAX_ATTEMPTS} tentativas falhas de 2FA`,
        level: 'error',
      });
    } else {
      newLockout = { attempts: newAttempts, lockedUntil: null };
      toast({
        title: 'Código inválido',
        description: `Tentativa ${newAttempts} de ${MAX_ATTEMPTS}. ${MAX_ATTEMPTS - newAttempts} tentativas restantes.`,
        variant: 'destructive',
      });
      
      // Log failed 2FA attempt
      await logAuditEvent({
        user_email: userEmail,
        action: '2fa_failed',
        details: `Tentativa ${newAttempts} de ${MAX_ATTEMPTS} - código 2FA inválido`,
        level: 'warning',
      });
    }

    setLockout(newLockout);
    localStorage.setItem('admin_2fa_lockout', JSON.stringify(newLockout));
  };

  const clearLockout = () => {
    setLockout({ attempts: 0, lockedUntil: null });
    localStorage.removeItem('admin_2fa_lockout');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Sign in with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Falha na autenticação');
      }

      // Check if user is admin
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authData.user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (roleError) throw roleError;

      if (!roleData) {
        await supabase.auth.signOut();
        
        // Log unauthorized access attempt
        await logAuditEvent({
          user_id: authData.user.id,
          user_email: email,
          action: 'login_failed',
          details: 'Tentativa de acesso ao painel admin sem permissões de administrador',
          level: 'warning',
        });
        
        throw new Error('Acesso negado. Você não tem permissões de administrador.');
      }

      // Check if 2FA is enabled
      const { data: tfaData } = await supabase
        .from('admin_2fa')
        .select('enabled, secret')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (tfaData?.enabled) {
        // 2FA is enabled, require TOTP code
        setPendingAuth({ userId: authData.user.id, email: authData.user.email! });
        setViewMode('2fa-verify');
        setIsLoading(false);
        return;
      }

      // No 2FA, complete login
      completeLogin(authData.user.id, authData.user.email);
    } catch (error: any) {
      console.error('Admin login error:', error);
      
      // Log failed login attempt
      await logAuditEvent({
        user_email: email,
        action: 'login_failed',
        details: error.message || 'Credenciais inválidas',
        level: 'error',
      });
      
      toast({
        title: 'Erro no login',
        description: error.message || 'Credenciais inválidas ou sem permissão de admin.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  const verifyTOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if locked out
    if (lockout.lockedUntil && Date.now() < lockout.lockedUntil) {
      setViewMode('2fa-blocked');
      return;
    }
    
    if (!pendingAuth || totpCode.length !== 6) {
      toast({
        title: 'Código inválido',
        description: 'Digite o código de 6 dígitos do seu app autenticador.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Get the user's TOTP secret
      const { data: tfaData, error: tfaError } = await supabase
        .from('admin_2fa')
        .select('secret')
        .eq('user_id', pendingAuth.userId)
        .single();

      if (tfaError || !tfaData?.secret) {
        throw new Error('Erro ao verificar 2FA');
      }

      // Verify the TOTP code
      const totp = new OTPAuth.TOTP({
        issuer: 'Tarefaa Admin',
        label: pendingAuth.email,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(tfaData.secret)
      });

      const delta = totp.validate({ token: totpCode, window: 1 });

      if (delta === null) {
        // Invalid code - record failed attempt
        await recordFailedAttempt(pendingAuth.email);
        setTotpCode('');
        setIsLoading(false);
        return;
      }

      // 2FA verified, clear lockout and complete login
      clearLockout();
      
      // Log successful 2FA verification
      await logAuditEvent({
        user_id: pendingAuth.userId,
        user_email: pendingAuth.email,
        action: '2fa_success',
        details: 'Verificação 2FA bem-sucedida',
        level: 'success',
      });
      
      completeLogin(pendingAuth.userId, pendingAuth.email);
    } catch (error: any) {
      console.error('2FA verification error:', error);
      toast({
        title: 'Erro na verificação',
        description: error.message || 'Código inválido.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  const completeLogin = async (userId: string, userEmail?: string) => {
    sessionStorage.setItem('adminAuthenticated', 'true');
    sessionStorage.setItem('adminUserId', userId);

    // Log successful login
    await logAuditEvent({
      user_id: userId,
      user_email: userEmail || email,
      action: 'login',
      details: 'Login administrativo bem-sucedido',
      level: 'success',
    });

    toast({
      title: 'Bem-vindo, Admin!',
      description: 'Login administrativo realizado com sucesso.',
    });

    navigate('/admin/panel');
  };

  const cancelTwoFactor = async () => {
    await supabase.auth.signOut();
    setPendingAuth(null);
    setTotpCode('');
    setViewMode('login');
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: 'Email obrigatório',
        description: 'Digite seu email de administrador.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Dispara o e-mail de recuperação sem revelar se o e-mail existe/é admin
      // (evita enumeração de contas). A resposta é sempre genérica.
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/admin/reset-password`,
      });
    } catch (error) {
      console.error('Password reset error');
    } finally {
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
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">Painel Administrativo</h1>
          <p className="text-slate-400 mt-2">
            {viewMode === 'login' && 'Acesso restrito a administradores'}
            {viewMode === 'forgot-password' && 'Recuperar acesso à sua conta'}
            {viewMode === 'reset-sent' && 'Verifique seu email'}
            {viewMode === '2fa-verify' && 'Digite o código do seu autenticador'}
          </p>
        </div>

        {/* Login Form */}
        {viewMode === 'login' && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-6 shadow-xl">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@empresa.com"
                  required
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Acessar Painel
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={() => setViewMode('forgot-password')}
                className="w-full text-center text-sm text-slate-400 hover:text-primary transition-colors"
              >
                Esqueceu sua senha?
              </button>
            </form>
          </div>
        )}

        {/* Forgot Password Form */}
        {viewMode === 'forgot-password' && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-6 shadow-xl">
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="reset-email" className="text-slate-300">Email do Administrador</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@empresa.com"
                  required
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                />
                <p className="text-xs text-slate-500">
                  Um link de recuperação será enviado para este email.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Enviar Link de Recuperação
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={() => setViewMode('login')}
                className="w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-primary transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar ao login
              </button>
            </form>
          </div>
        )}

        {/* Reset Sent Confirmation */}
        {viewMode === 'reset-sent' && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-6 shadow-xl text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Email Enviado!</h3>
            <p className="text-slate-400 text-sm mb-6">
              Enviamos um link de recuperação para <span className="text-white font-medium">{email}</span>. 
              Clique no link para redefinir sua senha.
            </p>
            <p className="text-xs text-slate-500 mb-6">
              ⚠️ Somente quem tiver acesso ao email poderá redefinir a senha.
            </p>
            <Button
              variant="outline"
              onClick={() => setViewMode('login')}
              className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao login
            </Button>
          </div>
        )}

        {/* 2FA Verification */}
        {viewMode === '2fa-verify' && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-6 shadow-xl">
            <form onSubmit={verifyTOTP} className="space-y-5">
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-primary" />
                </div>
              </div>
              
              <p className="text-center text-slate-400 text-sm">
                Digite o código de 6 dígitos do seu app autenticador
              </p>

              {lockout.attempts > 0 && lockout.attempts < MAX_ATTEMPTS && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
                  <p className="text-xs text-amber-400">
                    ⚠️ {MAX_ATTEMPTS - lockout.attempts} tentativas restantes
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  autoFocus
                  className="bg-slate-700/50 border-slate-600 text-white text-center text-3xl tracking-[0.5em] font-mono placeholder:text-slate-500 placeholder:tracking-[0.5em]"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90"
                disabled={isLoading || totpCode.length !== 6}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  'Verificar Código'
                )}
              </Button>

              <button
                type="button"
                onClick={cancelTwoFactor}
                className="w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-primary transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar ao login
              </button>
            </form>
          </div>
        )}

        {/* 2FA Blocked */}
        {viewMode === '2fa-blocked' && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-red-500/30 p-6 shadow-xl text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Acesso Bloqueado</h3>
            <p className="text-slate-400 text-sm mb-4">
              Muitas tentativas incorretas de código 2FA. Por segurança, o acesso foi temporariamente bloqueado.
            </p>
            
            <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center gap-2 text-2xl font-mono text-white">
                <Clock className="w-5 h-5 text-slate-400" />
                {remainingTime || '...'}
              </div>
              <p className="text-xs text-slate-500 mt-1">Tempo restante</p>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Se você perdeu o acesso ao seu autenticador, entre em contato com o suporte.
            </p>

            <Button
              variant="outline"
              onClick={() => {
                cancelTwoFactor();
                setViewMode('login');
              }}
              className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao login
            </Button>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-6">
          Área restrita do sistema Tarefaa
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
