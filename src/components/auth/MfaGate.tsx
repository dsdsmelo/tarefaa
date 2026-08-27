import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut } from 'lucide-react';
import { MfaEnroll } from './MfaEnroll';
import { MfaChallenge } from './MfaChallenge';
import logoIcon from '@/assets/logo-icon.png';

// Portão de 2FA obrigatório: todo usuário autenticado precisa ter um fator
// TOTP verificado e a sessão elevada (AAL2) para acessar o app.
export function MfaGate({ children }: { children: ReactNode }) {
  const {
    isAuthenticated, mfaChecked, hasVerifiedFactor, aalCurrent, refreshMfa, signOut,
  } = useAuth();

  // Não autenticado: quem cuida do redirect é o ProtectedRoute
  if (!isAuthenticated) return <>{children}</>;

  if (!mfaChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const needsEnroll = !hasVerifiedFactor;
  const needsChallenge = hasVerifiedFactor && aalCurrent !== 'aal2';

  if (needsEnroll || needsChallenge) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <img src={logoIcon} alt="Tarefaa" className="w-14 h-14 mx-auto rounded-xl shadow-md" />
          </div>
          <div className="bg-card rounded-2xl shadow-strong border border-border p-8">
            {needsEnroll ? (
              <MfaEnroll onEnrolled={refreshMfa} />
            ) : (
              <MfaChallenge onVerified={refreshMfa} />
            )}
          </div>
          <div className="text-center mt-6">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default MfaGate;
