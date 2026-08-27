import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FolderKanban, Mail, Lock, Loader2, User, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { auditLog } from '@/lib/auditLog';
import { strongPasswordSchema } from '@/lib/passwordSchema';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Informe a senha'),
});

const signupSchema = z.object({
  email: z.string().email('Email inválido'),
  password: strongPasswordSchema,
  fullName: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
});

type AuthMode = 'login' | 'signup';

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const validation = loginSchema.safeParse({ email, password });
        if (!validation.success) {
          toast({
            title: 'Erro de validação',
            description: validation.error.errors[0].message,
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }

        const { error } = await signIn(email, password);
        if (error) {
          let message = 'Email ou senha incorretos.';
          let reason = error.message;
          if (error.message.includes('Invalid login credentials')) {
            message = 'Email ou senha incorretos.';
            reason = 'Credenciais inválidas';
          } else if (error.message.includes('Email not confirmed')) {
            message = 'Por favor, confirme seu email antes de fazer login.';
            reason = 'Email não confirmado';
          }

          // Log failed login attempt
          await auditLog.loginFailed(email, reason);

          toast({
            title: 'Erro no login',
            description: message,
            variant: 'destructive',
          });
        } else {
          // Log successful login
          await auditLog.login(email);

          toast({
            title: 'Bem-vindo!',
            description: 'Login realizado com sucesso.',
          });
          navigate('/dashboard');
        }
      } else {
        const validation = signupSchema.safeParse({ email, password, fullName });
        if (!validation.success) {
          toast({
            title: 'Erro de validação',
            description: validation.error.errors[0].message,
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }

        const { error } = await signUp(email, password, fullName);
        if (error) {
          let message = 'Erro ao criar conta.';
          let reason = error.message;
          if (error.message.includes('already registered')) {
            message = 'Este email já está cadastrado.';
            reason = 'Email já registrado';
          }

          // Log failed signup attempt
          await auditLog.signupFailed(email, reason);

          toast({
            title: 'Erro no cadastro',
            description: message,
            variant: 'destructive',
          });
        } else {
          // Log successful signup
          await auditLog.signup(email);

          toast({
            title: 'Conta criada!',
            description: 'Verifique seu email para confirmar o cadastro.',
          });
        }
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary shadow-strong mb-4">
              <FolderKanban className="w-8 h-8 text-white" />
            </div>
          </Link>
          <h1 className="text-3xl font-bold text-foreground">TaskFlow</h1>
          <p className="text-muted-foreground mt-2">
            {mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-card rounded-2xl shadow-strong border border-border p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-medium">
                  Nome completo
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Seu nome"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10 h-12"
                    required
                  />
                </div>
              </div>
            )}

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

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Senha
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
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
                  {mode === 'login' ? 'Entrando...' : 'Cadastrando...'}
                </>
              ) : (
                mode === 'login' ? 'Entrar' : 'Criar conta'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {mode === 'login' ? (
                <>
                  Não tem conta?{' '}
                  <button
                    onClick={() => setMode('signup')}
                    className="text-primary hover:underline font-medium"
                  >
                    Cadastre-se
                  </button>
                </>
              ) : (
                <>
                  Já tem conta?{' '}
                  <button
                    onClick={() => setMode('login')}
                    className="text-primary hover:underline font-medium"
                  >
                    Entrar
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
