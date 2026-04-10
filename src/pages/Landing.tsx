import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FolderKanban, 
  CheckCircle2, 
  BarChart3, 
  Users, 
  Shield,
  ArrowRight,
  Loader2,
  GanttChart,
  Layers,
  Target,
  Mail,
  CreditCard,
  Lock,
  Sparkles,
  ChevronRight,
  HelpCircle,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Import images
import mockupDashboard from '@/assets/mockup-dashboard.png';
import mockupGantt from '@/assets/mockup-gantt.png';
import mockupTasks from '@/assets/mockup-tasks.png';
import logoTarefaa from '@/assets/logo-tarefaa.png';
import logoIcon from '@/assets/logo-icon.png';
import demoVideo from '@/assets/demo-video.mp4';

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 }
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 }
};

// Format price from cents to BRL
const formatPrice = (amountInCents: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountInCents / 100);
};

const Landing = () => {
  const { isAuthenticated, hasActiveSubscription } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [priceAmount, setPriceAmount] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(true);
  const { toast } = useToast();

  const subscriptionRequired = searchParams.get('subscription') === 'required';

  // Detect recovery/invite tokens in URL hash and redirect to /reset-password
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && (hash.includes('type=recovery') || hash.includes('type=invite'))) {
      navigate('/reset-password' + hash, { replace: true });
    }
  }, [navigate]);

  // Fetch price from Stripe on mount
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-stripe-price');
        if (error) throw error;
        if (data?.amount) {
          setPriceAmount(data.amount);
        }
      } catch (error) {
        console.error('Error fetching price:', error);
        // Fallback to default price if fetch fails
        setPriceAmount(4900); // R$ 49 in cents
      } finally {
        setPriceLoading(false);
      }
    };
    fetchPrice();
  }, []);

  const handleSubscribe = async () => {
    // Se já tem assinatura ativa, vai para dashboard
    if (isAuthenticated && hasActiveSubscription) {
      navigate('/dashboard');
      return;
    }

    // Cria checkout session via edge function (guest checkout - não requer autenticação)
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-guest-checkout');

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('URL de checkout não retornada');
      }
    } catch (error: any) {
      console.error('Erro ao criar checkout:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível iniciar o checkout. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    {
      icon: FolderKanban,
      title: 'Projetos e Tarefas',
      description: 'Organize projetos e tarefas com visões em lista, Kanban e Gantt.',
    },
    {
      icon: Layers,
      title: 'Fluxo Personalizável',
      description: 'Crie, renomeie e organize colunas do seu jeito. Adapte ao seu fluxo de trabalho.',
    },
    {
      icon: BarChart3,
      title: 'Dashboards Inteligentes',
      description: 'Acompanhe o progresso de projetos e tarefas em tempo real.',
    },
    {
      icon: Users,
      title: 'Colaboração em Equipe',
      description: 'Atribua tarefas, defina prazos e acompanhe o trabalho da equipe.',
    },
    {
      icon: GanttChart,
      title: 'Cronograma Gantt',
      description: 'Visualize prazos e dependências entre tarefas de forma clara.',
    },
    {
      icon: Shield,
      title: 'Seguro e Confiável',
      description: 'Seus projetos e tarefas protegidos com criptografia ponta a ponta.',
    },
  ];

  const benefits = [
    'Projetos ilimitados',
    'Tarefas ilimitadas',
    'Colunas personalizáveis',
    'Dashboard completo',
    'Gráfico de Gantt',
    'Gestão de equipe',
    'Suporte prioritário',
    'Atualizações contínuas',
  ];

  const screenshots = [
    { image: mockupDashboard, title: 'Dashboard Inteligente', description: 'Visualize o progresso de todos os projetos em tempo real' },
    { image: mockupGantt, title: 'Gráfico de Gantt', description: 'Planeje cronogramas e acompanhe dependências entre tarefas' },
    { image: mockupTasks, title: 'Gestão de Tarefas', description: 'Organize tarefas com colunas totalmente personalizáveis' },
  ];

  const faqs = [
    {
      question: 'Como funciona o período de assinatura?',
      answer: 'A assinatura é mensal e renovada automaticamente. Você tem acesso completo a todas as funcionalidades desde o primeiro dia, sem limitações. Pode cancelar a qualquer momento pelo portal do cliente.'
    },
    {
      question: 'Posso cancelar minha assinatura a qualquer momento?',
      answer: 'Sim! Você pode cancelar sua assinatura quando quiser através do portal do cliente. O acesso continua ativo até o final do período já pago.'
    },
    {
      question: 'Quais formas de pagamento são aceitas?',
      answer: 'Aceitamos cartões de crédito (Visa, Mastercard, American Express), PIX e boleto bancário. Todos os pagamentos são processados de forma segura pelo Stripe.'
    },
    {
      question: 'Meus dados estão seguros?',
      answer: 'Absolutamente! Utilizamos criptografia de ponta a ponta e servidores seguros. Seus dados são isolados e acessíveis apenas por você e sua equipe.'
    },
    {
      question: 'Quantos projetos e tarefas posso criar?',
      answer: 'Não há limites! Com a assinatura você pode criar projetos ilimitados, tarefas ilimitadas, adicionar quantos membros precisar e personalizar tudo conforme sua necessidade.'
    },
    {
      question: 'Há suporte técnico disponível?',
      answer: 'Sim, oferecemos suporte prioritário por e-mail para todos os assinantes. Nossa equipe está pronta para ajudar com qualquer dúvida ou problema.'
    },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <img src={logoTarefaa} alt="Tarefaa" className="h-10 w-auto" />
            </div>
            
            <div className="flex items-center gap-3">
              {isAuthenticated && hasActiveSubscription ? (
                <Link to="/dashboard">
                  <Button size="sm" className="group">
                    Acessar Dashboard
                    <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </Link>
              ) : isAuthenticated ? (
                <>
                  <Link to="/login">
                    <Button variant="ghost" size="sm">Entrar</Button>
                  </Link>
                  <Button
                    onClick={handleSubscribe}
                    disabled={isLoading}
                    size="sm"
                    variant="success"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Assinar Agora
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="ghost" size="sm">Entrar</Button>
                  </Link>
                  <Button
                    onClick={handleSubscribe}
                    size="sm"
                    variant="success"
                    className="group"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Carregando...
                      </>
                    ) : (
                      <>
                        Começar Agora
                        <Sparkles className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-24 pb-12 lg:pt-28 lg:pb-16">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(207,90%,45%)]/5 via-transparent to-[hsl(130,70%,40%)]/5" />
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-[hsl(207,90%,45%)]/10 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[hsl(130,70%,40%)]/10 rounded-full blur-3xl opacity-50" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left column - Text content */}
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="text-center lg:text-left"
            >
              <motion.div 
                variants={fadeInUp}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[hsl(35,95%,55%)]/10 rounded-full text-[hsl(35,95%,55%)] text-sm font-medium mb-6"
              >
                <Target className="w-4 h-4" />
                Substitua planilhas complexas
              </motion.div>
              
              <motion.h1
                variants={fadeInUp}
                transition={{ duration: 0.6 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight"
              >
                Gestão de projetos<br />
                <span className="text-gradient">e tarefas simplificada</span>
              </motion.h1>

              <motion.p
                variants={fadeInUp}
                transition={{ duration: 0.6 }}
                className="text-lg text-muted-foreground mb-8 max-w-xl leading-relaxed"
              >
                Organize seus projetos e tarefas em um só lugar.
                Dashboards, cronogramas Gantt, Kanban e controle total da sua equipe.
              </motion.p>
              
              <motion.div 
                variants={fadeInUp}
                transition={{ duration: 0.6 }}
                className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4 mb-6"
              >
                <Button
                  size="xl"
                  onClick={handleSubscribe}
                  disabled={isLoading}
                  variant="success"
                  className="group min-w-[220px]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Preparando checkout...
                    </>
                  ) : (
                    <>
                      {priceLoading ? 'Assinar agora' : `Assinar por ${formatPrice(priceAmount!)}/mês`}
                      <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>
                <a
                  href="https://wa.me/5511994831461?text=Queria%20saber%20mais%20sobre%20o%20Tarefaa!"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    Fale com A Gente!
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </a>
              </motion.div>

              <motion.div 
                variants={fadeIn}
                transition={{ duration: 0.6 }}
                className="flex items-center justify-center lg:justify-start gap-6 text-sm text-muted-foreground flex-wrap"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[hsl(130,70%,40%)]" />
                  Acesso imediato
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[hsl(130,70%,40%)]" />
                  Cancele quando quiser
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[hsl(130,70%,40%)]" />
                  Pagamento seguro
                </div>
              </motion.div>
            </motion.div>

            {/* Right column - Video Demo */}
            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border/50">
                <video 
                  autoPlay 
                  loop 
                  muted 
                  playsInline
                  className="w-full h-auto"
                >
                  <source src={demoVideo} type="video/mp4" />
                  Seu navegador não suporta vídeos.
                </video>
                <div className="absolute inset-0 bg-gradient-to-t from-background/30 via-transparent to-transparent pointer-events-none" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>


      {/* Screenshots Gallery */}
      <section className="py-12 relative overflow-hidden">
        {/* Geometric background pattern */}
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(207,90%,45%)]/5 to-[hsl(130,70%,40%)]/5" />
        <div className="absolute inset-0" style={{ 
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(207 90% 45% / 0.08) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="text-center mb-10"
          >
            <motion.div 
              variants={fadeInUp}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[hsl(130,70%,40%)]/10 rounded-full text-[hsl(130,70%,40%)] text-sm font-medium mb-4"
            >
              <Layers className="w-4 h-4" />
              Screenshots
            </motion.div>
            <motion.h2 
              variants={fadeInUp}
              className="text-3xl sm:text-4xl font-bold text-foreground mb-4"
            >
              Conheça a plataforma por dentro
            </motion.h2>
            <motion.p 
              variants={fadeInUp}
              className="text-lg text-muted-foreground max-w-2xl mx-auto"
            >
              Interface moderna e intuitiva projetada para máxima produtividade
            </motion.p>
          </motion.div>
          
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid lg:grid-cols-3 gap-6"
          >
            {screenshots.map((item, index) => (
              <motion.div
                key={index}
                variants={scaleIn}
                transition={{ duration: 0.5 }}
                whileHover={{ y: -8, transition: { duration: 0.2 } }}
                className="group bg-card rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-xl transition-shadow duration-300"
              >
                <div className="aspect-video overflow-hidden">
                  <img 
                    src={item.image} 
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 bg-sidebar/5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[hsl(207,90%,45%)]/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[hsl(130,70%,40%)]/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="text-center mb-10"
          >
            <motion.h2
              variants={fadeInUp}
              className="text-3xl sm:text-4xl font-bold text-foreground mb-4"
            >
              Tudo para gerenciar projetos e tarefas
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="text-lg text-muted-foreground max-w-2xl mx-auto"
            >
              Ferramentas completas para organizar projetos, acompanhar tarefas e entregar resultados
            </motion.p>
          </motion.div>
          
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                transition={{ duration: 0.5 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="bg-card rounded-2xl p-5 border border-border shadow-sm hover:shadow-lg hover:border-[hsl(207,90%,45%)]/20 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[hsl(207,90%,45%)] to-[hsl(130,70%,40%)] flex items-center justify-center mb-3">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 relative overflow-hidden bg-gradient-to-br from-sidebar via-sidebar to-[hsl(210,40%,10%)]">
        {/* Background decorations */}
        <div className="absolute inset-0" style={{ 
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(207 90% 45% / 0.1) 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }} />
        <div className="absolute top-1/4 left-0 w-[500px] h-[500px] bg-[hsl(207,90%,45%)]/20 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-1/4 right-0 w-[400px] h-[400px] bg-[hsl(130,70%,40%)]/20 rounded-full blur-3xl opacity-50" />
        
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="text-center mb-10"
          >
            <motion.div 
              variants={fadeInUp}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[hsl(35,95%,55%)]/20 rounded-full text-[hsl(35,95%,55%)] text-sm font-medium mb-4"
            >
              <CreditCard className="w-4 h-4" />
              Investimento
            </motion.div>
            <motion.h2 
              variants={fadeInUp}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4"
            >
              Um único plano,<br />
              <span className="text-gradient">tudo incluso</span>
            </motion.h2>
            <motion.p 
              variants={fadeInUp}
              className="text-lg text-white/70 max-w-2xl mx-auto"
            >
              Sem surpresas, sem taxas ocultas. Acesso completo a todas as funcionalidades.
            </motion.p>
          </motion.div>
          
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid lg:grid-cols-2 gap-8 items-stretch"
          >
            {/* Left column - Benefits */}
            <motion.div
              variants={fadeInUp}
              className="space-y-6"
            >
              <h3 className="text-2xl font-bold text-white mb-6">
                Gerencie projetos e tarefas com facilidade
              </h3>

              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { icon: FolderKanban, title: 'Projetos ilimitados', desc: 'Crie quantos projetos precisar' },
                  { icon: CheckCircle2, title: 'Tarefas ilimitadas', desc: 'Sem limites de tarefas' },
                  { icon: Layers, title: 'Colunas personalizáveis', desc: 'Adapte ao seu fluxo' },
                  { icon: BarChart3, title: 'Dashboard completo', desc: 'Métricas em tempo real' },
                  { icon: GanttChart, title: 'Gráfico de Gantt', desc: 'Visualize cronogramas' },
                  { icon: Users, title: 'Gestão de equipe', desc: 'Controle de responsáveis' },
                  { icon: Shield, title: 'Dados seguros', desc: 'Criptografia ponta a ponta' },
                  { icon: Mail, title: 'Suporte prioritário', desc: 'Atendimento dedicado' },
                ].map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start gap-3 p-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[hsl(207,90%,45%)] to-[hsl(130,70%,40%)] flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white text-sm">{item.title}</h4>
                      <p className="text-white/60 text-xs">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Right column - Price card - Futuristic Design */}
            <motion.div
              variants={scaleIn}
              className="relative flex items-stretch"
            >
              <div className="tech-card relative w-full rounded-2xl overflow-hidden">
                {/* Animated gradient border */}
                <div className="absolute inset-0 bg-gradient-to-r from-[hsl(207,90%,50%)] via-[hsl(130,70%,45%)] to-[hsl(207,90%,50%)] bg-[length:200%_100%] animate-[gradient-x_3s_ease-in-out_infinite] rounded-2xl" />

                {/* Inner card */}
                <div className="relative m-[1px] bg-[hsl(220,25%,10%)] rounded-[15px] p-8 flex flex-col justify-center">
                  {/* Grid pattern overlay */}
                  <div className="absolute inset-0 opacity-[0.03]" style={{
                    backgroundImage: `linear-gradient(hsl(130,70%,50%) 1px, transparent 1px), linear-gradient(90deg, hsl(130,70%,50%) 1px, transparent 1px)`,
                    backgroundSize: '20px 20px'
                  }} />

                  {/* Glow orbs */}
                  <div className="absolute -top-20 -right-20 w-40 h-40 bg-[hsl(130,70%,50%)] rounded-full blur-[80px] opacity-20" />
                  <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-[hsl(207,90%,50%)] rounded-full blur-[80px] opacity-15" />

                  {/* Scan line effect */}
                  <div className="absolute inset-0 overflow-hidden rounded-[14px] pointer-events-none">
                    <div className="absolute inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[hsl(130,70%,50%)]/30 to-transparent animate-[scan_4s_ease-in-out_infinite]" />
                  </div>

                  <div className="relative text-center space-y-6 z-10">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-[hsl(130,70%,45%)]/10 border border-[hsl(130,70%,45%)]/30 rounded-full">
                      <div className="w-2 h-2 rounded-full bg-[hsl(130,70%,50%)] animate-pulse" />
                      <span className="text-[hsl(130,70%,50%)] text-sm font-semibold uppercase tracking-wider">Plano Pro</span>
                    </div>

                    {/* Price */}
                    <div className="space-y-1">
                      <div className="flex items-baseline justify-center gap-2">
                        {priceLoading ? (
                          <span className="text-6xl font-black text-white">...</span>
                        ) : (
                          <span className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70">{formatPrice(priceAmount!)}</span>
                        )}
                        <span className="text-lg text-white/50 font-medium">/mês</span>
                      </div>
                      <p className="text-white/40 text-sm">Acesso completo a todas as funcionalidades</p>
                    </div>

                    {/* CTA Button */}
                    <button
                      onClick={handleSubscribe}
                      disabled={isLoading}
                      className="group relative w-full py-4 px-8 rounded-xl font-bold text-lg flex items-center justify-center gap-3 disabled:opacity-70 overflow-hidden transition-all duration-300 hover:scale-[1.02]"
                      style={{
                        background: 'linear-gradient(135deg, hsl(130,70%,42%) 0%, hsl(130,70%,35%) 100%)',
                        boxShadow: '0 0 20px hsl(130,70%,45%,0.3), inset 0 1px 0 hsl(130,70%,60%,0.2)'
                      }}
                    >
                      <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                      {isLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin text-white" />
                          <span className="text-white">Preparando checkout...</span>
                        </>
                      ) : (
                        <>
                          <span className="text-white">Começar Agora</span>
                          <ArrowRight className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>

                    {/* Trust badges */}
                    <div className="flex items-center justify-center gap-6 text-sm">
                      <div className="flex items-center gap-2 text-white/50">
                        <Lock className="w-4 h-4 text-[hsl(130,70%,50%)]" />
                        <span>Seguro</span>
                      </div>
                      <div className="w-px h-4 bg-white/20" />
                      <span className="text-white/50">Cancele quando quiser</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Social Proof */}
      <motion.section 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={staggerContainer}
        className="py-12 bg-gradient-to-r from-[hsl(207,90%,45%)]/5 via-transparent to-[hsl(130,70%,40%)]/5"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { value: '100%', label: 'Personalizável', icon: Layers, color: 'hsl(207,90%,45%)' },
              { value: '∞', label: 'Projetos ilimitados', icon: FolderKanban, color: 'hsl(130,70%,40%)' },
              { value: '24/7', label: 'Acesso disponível', icon: Zap, color: 'hsl(35,95%,55%)' }
            ].map((stat, index) => (
              <motion.div 
                key={index} 
                variants={fadeInUp}
                className="text-center p-6 rounded-2xl bg-card border border-border shadow-sm"
              >
                <div 
                  className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
                  style={{ backgroundColor: `${stat.color.replace(')', ' / 0.1)')}` }}
                >
                  <stat.icon className="w-7 h-7" style={{ color: stat.color }} />
                </div>
                <div className="text-4xl font-bold text-foreground mb-2">{stat.value}</div>
                <p className="text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* FAQ Section */}
      <section className="py-16 relative overflow-hidden bg-gradient-to-br from-muted/50 via-background to-muted/30">
        <div className="absolute inset-0 opacity-50" style={{ 
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%230a7cc4' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="text-center mb-10"
          >
            <motion.div 
              variants={fadeInUp}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[hsl(35,95%,55%)]/10 rounded-full text-[hsl(35,95%,55%)] text-sm font-medium mb-4"
            >
              <HelpCircle className="w-4 h-4" />
              Perguntas Frequentes
            </motion.div>
            <motion.h2 
              variants={fadeInUp}
              className="text-3xl sm:text-4xl font-bold text-foreground mb-4"
            >
              Tire suas dúvidas
            </motion.h2>
            <motion.p 
              variants={fadeInUp}
              className="text-lg text-muted-foreground"
            >
              Tudo o que você precisa saber sobre o Tarefaa
            </motion.p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="grid md:grid-cols-2 gap-4"
          >
            {/* Left column */}
            <div className="space-y-3">
              {faqs.slice(0, 3).map((faq, index) => (
                <Accordion key={index} type="single" collapsible>
                  <AccordionItem 
                    value={`item-${index}`}
                    className="bg-card border border-border rounded-xl px-5 overflow-hidden shadow-sm"
                  >
                    <AccordionTrigger className="text-left text-foreground font-medium py-4 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 leading-relaxed text-sm">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              ))}
            </div>
            
            {/* Right column */}
            <div className="space-y-3">
              {faqs.slice(3).map((faq, index) => (
                <Accordion key={index + 3} type="single" collapsible>
                  <AccordionItem 
                    value={`item-${index + 3}`}
                    className="bg-card border border-border rounded-xl px-5 overflow-hidden shadow-sm"
                  >
                    <AccordionTrigger className="text-left text-foreground font-medium py-4 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 leading-relaxed text-sm">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(207,90%,45%)]/5 via-transparent to-[hsl(130,70%,40%)]/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[hsl(207,90%,45%)]/10 rounded-full blur-3xl opacity-30" />
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[hsl(130,70%,40%)]/10 rounded-full text-[hsl(130,70%,40%)] text-sm font-medium mb-4">
            <Zap className="w-4 h-4" />
            Comece agora mesmo
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Organize projetos e tarefas<br />
            <span className="text-gradient">de forma simples</span>
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Comece agora e transforme a gestão de projetos e tarefas da sua equipe.
          </p>
          <Button
            size="xl"
            onClick={handleSubscribe}
            disabled={isLoading}
            variant="success"
            className="group min-w-[220px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Preparando checkout...
              </>
            ) : (
              <>
                {priceLoading ? 'Assinar agora' : `Assinar por ${formatPrice(priceAmount!)}/mês`}
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </Button>
          <p className="text-sm text-muted-foreground mt-6">
            Acesso imediato • Cancele quando quiser • Suporte prioritário
          </p>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-sidebar text-sidebar-foreground">
        {/* Main Footer */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
            {/* Brand Column */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <img src={logoIcon} alt="Tarefaa" className="w-12 h-12" />
                <span className="text-2xl font-bold">Tarefaa</span>
              </div>
              <p className="text-sidebar-foreground/70 mb-6 max-w-sm leading-relaxed">
                Plataforma completa para gestão de projetos e tarefas.
                Organize, acompanhe e entregue resultados com sua equipe.
              </p>
              <div className="flex items-center gap-4">
                <a href="mailto:contato@tarefaa.com.br" className="flex items-center gap-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors">
                  <Mail className="w-4 h-4" />
                  contato@tarefaa.com.br
                </a>
              </div>
            </div>

            {/* Links Column */}
            <div>
              <h4 className="font-semibold mb-4 text-lg">Produto</h4>
              <ul className="space-y-3">
                <li>
                  <a href="#" className="text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors flex items-center gap-1">
                    <ChevronRight className="w-3 h-3" />
                    Funcionalidades
                  </a>
                </li>
                <li>
                  <a href="#" className="text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors flex items-center gap-1">
                    <ChevronRight className="w-3 h-3" />
                    Preços
                  </a>
                </li>
                <li>
                  <a href="#" className="text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors flex items-center gap-1">
                    <ChevronRight className="w-3 h-3" />
                    Suporte
                  </a>
                </li>
                <li>
                  <Link to="/login" className="text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors flex items-center gap-1">
                    <ChevronRight className="w-3 h-3" />
                    Entrar
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal Column */}
            <div>
              <h4 className="font-semibold mb-4 text-lg">Legal</h4>
              <ul className="space-y-3">
                <li>
                  <Link to="/terms" className="text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors flex items-center gap-1">
                    <ChevronRight className="w-3 h-3" />
                    Termos de Uso
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors flex items-center gap-1">
                    <ChevronRight className="w-3 h-3" />
                    Privacidade
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Payment Methods & Copyright */}
        <div className="border-t border-sidebar-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              {/* Copyright */}
              <div className="flex items-center gap-2 text-sm text-sidebar-foreground/60">
                <span>© {new Date().getFullYear()} Tarefaa. Todos os direitos reservados.</span>
              </div>

              {/* Payment Methods */}
              <div className="flex items-center gap-4">
                <span className="text-xs text-sidebar-foreground/50 uppercase tracking-wide">Formas de pagamento:</span>
                <div className="flex items-center gap-2">
                  {/* Visa */}
                  <div className="w-10 h-6 bg-white rounded flex items-center justify-center">
                    <svg viewBox="0 0 48 32" className="w-8 h-5">
                      <rect fill="#1A1F71" width="48" height="32" rx="4"/>
                      <text x="24" y="20" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="Arial">VISA</text>
                    </svg>
                  </div>
                  {/* Mastercard */}
                  <div className="w-10 h-6 bg-white rounded flex items-center justify-center">
                    <svg viewBox="0 0 48 32" className="w-8 h-5">
                      <rect fill="#F9F9F9" width="48" height="32" rx="4"/>
                      <circle cx="18" cy="16" r="10" fill="#EB001B"/>
                      <circle cx="30" cy="16" r="10" fill="#F79E1B"/>
                      <path d="M24 8a10 10 0 000 16 10 10 0 000-16z" fill="#FF5F00"/>
                    </svg>
                  </div>
                  {/* Amex */}
                  <div className="w-10 h-6 bg-[#006FCF] rounded flex items-center justify-center">
                    <span className="text-white text-[8px] font-bold">AMEX</span>
                  </div>
                  {/* Pix */}
                  <div className="w-10 h-6 bg-[#32BCAD] rounded flex items-center justify-center">
                    <span className="text-white text-[8px] font-bold">PIX</span>
                  </div>
                  {/* Boleto */}
                  <div className="w-10 h-6 bg-gray-700 rounded flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>

              {/* Security Badge */}
              <div className="flex items-center gap-2 text-sm text-sidebar-foreground/60">
                <Lock className="w-4 h-4" />
                <span>Pagamento 100% seguro</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Loading Overlay */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="bg-card border border-border rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-6 max-w-sm mx-4"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-muted animate-pulse" />
              <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-[hsl(130,70%,45%)] animate-spin" />
              <CreditCard className="absolute inset-0 m-auto w-6 h-6 text-[hsl(130,70%,45%)]" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Preparando checkout seguro
              </h3>
              <p className="text-sm text-muted-foreground">
                Você será redirecionado para o pagamento...
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="w-3 h-3" />
              <span>Ambiente seguro Stripe</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default Landing;