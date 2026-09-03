import { useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Lock, ShieldCheck, KeyRound, Plus, Eye, EyeOff, Copy, ExternalLink, Pencil,
  Trash2, Loader2, RefreshCw, Search, Download, AlertTriangle, Vault as VaultIcon,
  Check,
} from 'lucide-react';
import { TablePagination } from '@/components/ui/table-pagination';
import { useVault, type VaultItem } from '@/contexts/VaultContext';
import { generatePassword } from '@/lib/vaultCrypto';

const openUrl = (raw: string) => {
  if (!raw) return;
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};

const copyWithAutoClear = async (value: string, label: string) => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copiado — o clipboard será limpo em 30s`);
    setTimeout(() => { navigator.clipboard.writeText('').catch(() => {}); }, 30000);
  } catch {
    toast.error('Não foi possível copiar');
  }
};

// Cor estável a partir do título (avatar do item) — sem fetch externo (privacidade)
const colorFromString = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 360} 60% 45%)`;
};
const prettyHost = (url: string) => {
  if (!url) return '';
  try { return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, ''); }
  catch { return url; }
};

export default function Vault() {
  const vault = useVault();
  useEffect(() => { vault.refreshStatus(); }, [vault.refreshStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MainLayout>
      <Header title="Cofre de Senhas" subtitle="Suas senhas criptografadas de ponta a ponta" />
      <div className="p-6">
        {vault.status === 'loading' && (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando...
          </div>
        )}
        {vault.status === 'no-vault' && <SetupView />}
        {vault.status === 'locked' && <LockedView />}
        {vault.status === 'unlocked' && <UnlockedView />}
      </div>
    </MainLayout>
  );
}

/* ---------------- Setup (1º acesso) ---------------- */
function SetupView() {
  const { setupVault } = useVault();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  const strongEnough = pw.length >= 10;
  const matches = pw === confirm && confirm.length > 0;

  const handleCreate = async () => {
    if (!strongEnough) { toast.error('A senha mestra deve ter no mínimo 10 caracteres'); return; }
    if (!matches) { toast.error('As senhas não coincidem'); return; }
    setSaving(true);
    try {
      setRecoveryCode(await setupVault(pw));
    } catch (e) {
      console.error(e);
      toast.error('Erro ao criar o cofre');
    } finally {
      setSaving(false);
    }
  };

  if (recoveryCode) {
    return (
      <AuthCard>
        <div className="flex items-center gap-2 mb-2">
          <KeyRound className="w-5 h-5 text-amber-500" />
          <h2 className="text-xl font-bold">Guarde seu código de recuperação</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          É o <strong>único</strong> jeito de recuperar o cofre se você esquecer a senha mestra.
          Guarde-o em um lugar seguro. <strong>Ele não será mostrado de novo.</strong>
        </p>
        <div className="font-mono text-lg tracking-wider bg-muted rounded-lg p-4 text-center select-all break-all">
          {recoveryCode}
        </div>
        <div className="flex gap-2 mt-3">
          <Button variant="outline" className="flex-1" onClick={() => copyWithAutoClear(recoveryCode, 'Código')}>
            <Copy className="w-4 h-4 mr-2" /> Copiar
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => {
            const blob = new Blob([`Código de recuperação do Cofre Tarefaa:\n\n${recoveryCode}\n\nGuarde em local seguro.`], { type: 'text/plain' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tarefaa-recuperacao-cofre.txt'; a.click();
          }}>
            <Download className="w-4 h-4 mr-2" /> Baixar .txt
          </Button>
        </div>
        <Button className="w-full mt-4 gradient-primary text-white" onClick={() => setRecoveryCode(null)}>
          Guardei em local seguro, continuar
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-3">
          <VaultIcon className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold">Crie seu Cofre</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Defina uma <strong>senha mestra</strong> (diferente da senha de login). Ela criptografa tudo
          e <strong>não é armazenada</strong> — nem nós conseguimos vê-la.
        </p>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Senha mestra</Label>
          <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="mínimo 10 caracteres" />
        </div>
        <div className="space-y-2">
          <Label>Confirmar senha mestra</Label>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="repita a senha mestra" />
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          Se você esquecer a senha mestra, só o código de recuperação (mostrado a seguir) abre o cofre.
        </div>
        <Button className="w-full gradient-primary text-white" onClick={handleCreate} disabled={saving || !strongEnough || !matches}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar cofre'}
        </Button>
      </div>
    </AuthCard>
  );
}

/* ---------------- Locked (desbloquear / recuperar) ---------------- */
function LockedView() {
  const { unlock, unlockWithRecovery, resetMasterPassword } = useVault();
  const [mode, setMode] = useState<'unlock' | 'recover' | 'reset'>('unlock');
  const [pw, setPw] = useState('');
  const [code, setCode] = useState('');
  const [newPw, setNewPw] = useState('');
  const [busy, setBusy] = useState(false);

  const doUnlock = async () => {
    setBusy(true);
    try { if (!(await unlock(pw))) toast.error('Senha mestra incorreta'); }
    finally { setBusy(false); setPw(''); }
  };
  const doRecover = async () => {
    setBusy(true);
    try {
      if (await unlockWithRecovery(code)) { setMode('reset'); toast.success('Recuperação ok — defina uma nova senha mestra'); }
      else toast.error('Código de recuperação inválido');
    } finally { setBusy(false); }
  };
  const doReset = async () => {
    if (newPw.length < 10) { toast.error('A nova senha mestra deve ter no mínimo 10 caracteres'); return; }
    setBusy(true);
    try { await resetMasterPassword(newPw); toast.success('Senha mestra redefinida!'); }
    catch { toast.error('Erro ao redefinir'); }
    finally { setBusy(false); setNewPw(''); }
  };

  return (
    <AuthCard>
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-3">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold">Cofre bloqueado</h2>
      </div>

      {mode === 'unlock' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Senha mestra</Label>
            <Input type="password" value={pw} autoFocus onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doUnlock()} placeholder="sua senha mestra" />
          </div>
          <Button className="w-full gradient-primary text-white" onClick={doUnlock} disabled={busy || !pw}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Desbloquear'}
          </Button>
          <button className="w-full text-center text-sm text-muted-foreground hover:text-primary" onClick={() => setMode('recover')}>
            Esqueci a senha mestra
          </button>
        </div>
      )}

      {mode === 'recover' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Código de recuperação</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXXX-XXXXX-XXXXX-XXXXX" className="font-mono" />
          </div>
          <Button className="w-full gradient-primary text-white" onClick={doRecover} disabled={busy || !code}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Recuperar acesso'}
          </Button>
          <button className="w-full text-center text-sm text-muted-foreground hover:text-primary" onClick={() => setMode('unlock')}>Voltar</button>
        </div>
      )}

      {mode === 'reset' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Defina uma nova senha mestra (mín. 10 caracteres).</p>
          <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="nova senha mestra" />
          <Button className="w-full gradient-primary text-white" onClick={doReset} disabled={busy || newPw.length < 10}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar e entrar'}
          </Button>
        </div>
      )}
    </AuthCard>
  );
}

/* Cartão centralizado para as telas de setup/desbloqueio */
function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-medium">
        {children}
      </div>
    </div>
  );
}

/* ---------------- Unlocked (grade de cartões) ---------------- */
function UnlockedView() {
  const { items, addItem, updateItem, deleteItem, lock } = useVault();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<VaultItem | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<VaultItem | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [justCopied, setJustCopied] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((i) => i.title.toLowerCase().includes(q) || i.username.toLowerCase().includes(q) || i.url.toLowerCase().includes(q));
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  );

  // Volta para a 1ª página ao buscar e mantém a página válida ao excluir itens
  useEffect(() => { setPage(1); }, [search, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const toggleReveal = (id: string) => setRevealed((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const copy = (id: string, value: string, label: string) => {
    copyWithAutoClear(value, label);
    setJustCopied(id); setTimeout(() => setJustCopied((c) => (c === id ? null : c)), 1200);
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">
          <ShieldCheck className="w-4 h-4" /> Cofre aberto · {items.length} {items.length === 1 ? 'senha' : 'senhas'}
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por título, usuário ou site..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button className="gradient-primary text-white" onClick={() => setEditing('new')}>
            <Plus className="w-4 h-4 mr-2" /> Nova senha
          </Button>
          <Button variant="outline" onClick={lock}><Lock className="w-4 h-4 mr-2" /> Bloquear</Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-2xl border-2 border-dashed border-border">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <VaultIcon className="w-8 h-8 text-primary opacity-70" />
          </div>
          <p className="text-base font-medium mb-1">{items.length === 0 ? 'Seu cofre está vazio' : 'Nada encontrado'}</p>
          <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
            {items.length === 0 ? 'Guarde suas senhas de forma criptografada e acesse os sites com um clique.' : 'Tente outro termo de busca.'}
          </p>
          {items.length === 0 && (
            <Button className="gradient-primary text-white" onClick={() => setEditing('new')}>
              <Plus className="w-4 h-4 mr-2" /> Adicionar primeira senha
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {paged.map((it) => (
              <div key={it.id} className="group bg-card border border-border rounded-lg p-3 shadow-soft hover:shadow-medium hover:border-primary/30 transition-all">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                    style={{ backgroundColor: colorFromString(it.title) }}>
                    {(it.title[0] || '?').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate leading-tight">{it.title}</div>
                    {it.url && <div className="text-xs text-muted-foreground truncate leading-tight">{prettyHost(it.url)}</div>}
                  </div>
                  <div className="flex items-center flex-shrink-0">
                    {it.url && (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Abrir site" onClick={() => openUrl(it.url)}>
                        <ExternalLink className="w-3.5 h-3.5 text-primary" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity" title="Editar" onClick={() => setEditing(it)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" title="Excluir" onClick={() => setToDelete(it)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-2 space-y-1">
                  {it.username && (
                    <div className="flex items-center justify-between gap-2 text-sm bg-muted/40 rounded-md px-2.5 py-1">
                      <span className="truncate text-muted-foreground">{it.username}</span>
                      <button className="text-muted-foreground hover:text-primary flex-shrink-0" title="Copiar usuário"
                        onClick={() => copy(it.id + 'u', it.username, 'Usuário')}>
                        {justCopied === it.id + 'u' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                  {it.password && (
                    <div className="flex items-center justify-between gap-2 text-sm bg-muted/40 rounded-md px-2.5 py-1">
                      <span className="truncate font-mono">{revealed.has(it.id) ? it.password : '•'.repeat(10)}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button className="text-muted-foreground hover:text-foreground" title="Mostrar/ocultar" onClick={() => toggleReveal(it.id)}>
                          {revealed.has(it.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button className="text-muted-foreground hover:text-primary" title="Copiar senha"
                          onClick={() => copy(it.id + 'p', it.password, 'Senha')}>
                          {justCopied === it.id + 'p' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <TablePagination
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[12, 24, 48, 96]}
              className="border-t border-border"
            />
          )}
        </>
      )}

      {editing && (
        <ItemDialog
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            if (editing === 'new') await addItem(data);
            else await updateItem(editing.id, data);
            setEditing(null);
          }}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{toDelete?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => { if (toDelete) { await deleteItem(toDelete.id); setToDelete(null); } }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------------- Dialog de item ---------------- */
function ItemDialog({ item, onClose, onSave }: {
  item: VaultItem | null;
  onClose: () => void;
  onSave: (data: Omit<VaultItem, 'id'>) => Promise<void>;
}) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [username, setUsername] = useState(item?.username ?? '');
  const [password, setPassword] = useState(item?.password ?? '');
  const [url, setUrl] = useState(item?.url ?? '');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) { toast.error('Informe um título'); return; }
    setSaving(true);
    try { await onSave({ title: title.trim(), username: username.trim(), password, url: url.trim() }); }
    catch { toast.error('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            {item ? 'Editar senha' : 'Nova senha'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Gmail, AWS, Cliente X" autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Usuário / e-mail</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="login@exemplo.com" />
          </div>
          <div className="space-y-2">
            <Label>Senha</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10 font-mono" />
                <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button type="button" variant="outline" title="Gerar senha forte" onClick={() => { setPassword(generatePassword(20)); setShow(true); }}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>URL de login</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://site.com/login" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="gradient-primary text-white" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
