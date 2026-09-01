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
} from 'lucide-react';
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
      const code = await setupVault(pw);
      setRecoveryCode(code);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao criar o cofre');
    } finally {
      setSaving(false);
    }
  };

  if (recoveryCode) {
    return (
      <div className="max-w-lg mx-auto bg-card border border-border rounded-2xl p-8 shadow-soft">
        <div className="flex items-center gap-2 mb-2">
          <KeyRound className="w-5 h-5 text-amber-500" />
          <h2 className="text-xl font-bold">Guarde seu código de recuperação</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Este é o <strong>único</strong> jeito de recuperar o cofre se você esquecer a senha mestra.
          Guarde-o em um lugar seguro (fora do sistema). <strong>Ele não será mostrado de novo.</strong>
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
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto bg-card border border-border rounded-2xl p-8 shadow-soft">
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
          Se você esquecer a senha mestra, só o código de recuperação (mostrado a seguir) abre o cofre. Não há outra forma.
        </div>
        <Button className="w-full gradient-primary text-white" onClick={handleCreate} disabled={saving || !strongEnough || !matches}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar cofre'}
        </Button>
      </div>
    </div>
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
    try {
      const ok = await unlock(pw);
      if (!ok) toast.error('Senha mestra incorreta');
    } finally { setBusy(false); setPw(''); }
  };

  const doRecover = async () => {
    setBusy(true);
    try {
      const ok = await unlockWithRecovery(code);
      if (ok) { setMode('reset'); toast.success('Recuperação ok — defina uma nova senha mestra'); }
      else toast.error('Código de recuperação inválido');
    } finally { setBusy(false); }
  };

  const doReset = async () => {
    if (newPw.length < 10) { toast.error('A nova senha mestra deve ter no mínimo 10 caracteres'); return; }
    setBusy(true);
    try {
      await resetMasterPassword(newPw);
      toast.success('Senha mestra redefinida!');
    } catch { toast.error('Erro ao redefinir'); }
    finally { setBusy(false); setNewPw(''); }
  };

  return (
    <div className="max-w-md mx-auto bg-card border border-border rounded-2xl p-8 shadow-soft">
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
            <Input type="password" value={pw} autoFocus
              onChange={(e) => setPw(e.target.value)}
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
          <button className="w-full text-center text-sm text-muted-foreground hover:text-primary" onClick={() => setMode('unlock')}>
            Voltar
          </button>
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
    </div>
  );
}

/* ---------------- Unlocked (lista + CRUD) ---------------- */
function UnlockedView() {
  const { items, addItem, updateItem, deleteItem, lock } = useVault();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<VaultItem | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<VaultItem | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((i) => i.title.toLowerCase().includes(q) || i.username.toLowerCase().includes(q) || i.url.toLowerCase().includes(q));
  }, [items, search]);

  const toggleReveal = (id: string) => setRevealed((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <ShieldCheck className="w-4 h-4" /> Cofre aberto · {items.length} {items.length === 1 ? 'senha' : 'senhas'}
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button className="gradient-primary text-white" onClick={() => setEditing('new')}>
            <Plus className="w-4 h-4 mr-2" /> Nova senha
          </Button>
          <Button variant="outline" onClick={lock}><Lock className="w-4 h-4 mr-2" /> Bloquear</Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-xl border-2 border-dashed border-border">
          <VaultIcon className="w-10 h-10 text-muted-foreground opacity-50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{items.length === 0 ? 'Nenhuma senha guardada ainda.' : 'Nada encontrado.'}</p>
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {filtered.map((it) => (
            <div key={it.id} className="group flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/30">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{it.title}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {it.username}
                  {it.password && <> · <span className="font-mono">{revealed.has(it.id) ? it.password : '••••••••'}</span></>}
                </div>
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {it.password && (
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Mostrar/ocultar" onClick={() => toggleReveal(it.id)}>
                    {revealed.has(it.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                )}
                {it.username && (
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Copiar usuário" onClick={() => copyWithAutoClear(it.username, 'Usuário')}>
                    <Copy className="w-4 h-4" />
                  </Button>
                )}
                {it.password && (
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Copiar senha" onClick={() => copyWithAutoClear(it.password, 'Senha')}>
                    <KeyRound className="w-4 h-4" />
                  </Button>
                )}
                {it.url && (
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Abrir site" onClick={() => openUrl(it.url)}>
                    <ExternalLink className="w-4 h-4 text-primary" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Editar" onClick={() => setEditing(it)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" title="Excluir" onClick={() => setToDelete(it)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
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
    try {
      await onSave({ title: title.trim(), username: username.trim(), password, url: url.trim() });
    } catch { toast.error('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar senha' : 'Nova senha'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Gmail, AWS, Cliente X" />
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
