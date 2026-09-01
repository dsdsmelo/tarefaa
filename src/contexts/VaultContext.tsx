import React, { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  DEFAULT_KDF, deriveKey, generateVaultKey, wrapVaultKey, unwrapVaultKey,
  encryptJSON, decryptJSON, randomBytes, toB64, fromB64,
  generateRecoveryCode, normalizeRecoveryCode,
} from '@/lib/vaultCrypto';

const AUTO_LOCK_MS = 8 * 60 * 1000; // 8 minutos de inatividade

export interface VaultItem {
  id: string;
  title: string;
  username: string;
  password: string;
  url: string;
}
type ItemData = Omit<VaultItem, 'id'>;

type VaultStatus = 'loading' | 'no-vault' | 'locked' | 'unlocked';

interface VaultContextType {
  status: VaultStatus;
  items: VaultItem[];
  refreshStatus: () => Promise<void>;
  setupVault: (masterPassword: string) => Promise<string>; // retorna o código de recuperação
  unlock: (masterPassword: string) => Promise<boolean>;
  unlockWithRecovery: (code: string) => Promise<boolean>;
  resetMasterPassword: (newPassword: string) => Promise<void>; // exige estar desbloqueado (via recovery)
  lock: () => void;
  addItem: (data: ItemData) => Promise<void>;
  updateItem: (id: string, data: ItemData) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  bump: () => void; // reinicia o timer de auto-bloqueio
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

interface MetaRow {
  kdf_salt: string; kdf_mem: number; kdf_iter: number; kdf_par: number;
  protected_by_master: string; recovery_salt: string | null; protected_by_recovery: string | null;
}

export const VaultProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<VaultStatus>('loading');
  const [items, setItems] = useState<VaultItem[]>([]);
  const vaultKeyRef = useRef<CryptoKey | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const clearMemory = useCallback(() => {
    vaultKeyRef.current = null;
    setItems([]);
  }, []);

  const lock = useCallback(() => {
    clearMemory();
    setStatus((s) => (s === 'no-vault' || s === 'loading' ? s : 'locked'));
  }, [clearMemory]);

  const bump = useCallback(() => { lastActivityRef.current = Date.now(); }, []);

  // Auto-bloqueio por inatividade (só enquanto desbloqueado)
  useEffect(() => {
    if (status !== 'unlocked') return;
    const onActivity = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener('mousemove', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    window.addEventListener('click', onActivity);
    const timer = setInterval(() => {
      if (Date.now() - lastActivityRef.current > AUTO_LOCK_MS) lock();
    }, 15000);
    return () => {
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('click', onActivity);
      clearInterval(timer);
    };
  }, [status, lock]);

  // Ao deslogar, zera tudo
  useEffect(() => {
    if (!user) { clearMemory(); setStatus('loading'); }
  }, [user, clearMemory]);

  const getMeta = useCallback(async (): Promise<MetaRow | null> => {
    const { data, error } = await supabase
      .from('vault_meta')
      .select('kdf_salt, kdf_mem, kdf_iter, kdf_par, protected_by_master, recovery_salt, protected_by_recovery')
      .eq('user_id', user!.id)
      .maybeSingle();
    if (error) throw error;
    return (data as MetaRow) ?? null;
  }, [user]);

  const refreshStatus = useCallback(async () => {
    if (!user) return;
    if (vaultKeyRef.current) { setStatus('unlocked'); return; }
    setStatus('loading');
    try {
      const meta = await getMeta();
      setStatus(meta ? 'locked' : 'no-vault');
    } catch {
      setStatus('no-vault');
    }
  }, [user, getMeta]);

  const loadItems = useCallback(async (vaultKey: CryptoKey) => {
    const { data, error } = await supabase
      .from('vault_items')
      .select('id, blob')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    const decrypted: VaultItem[] = [];
    for (const row of (data ?? []) as { id: string; blob: string }[]) {
      try {
        const d = await decryptJSON<ItemData>(row.blob, vaultKey);
        decrypted.push({ id: row.id, ...d });
      } catch {
        // item ilegível (não deveria acontecer) — ignora
      }
    }
    decrypted.sort((a, b) => a.title.localeCompare(b.title));
    setItems(decrypted);
  }, [user]);

  const setupVault = useCallback(async (masterPassword: string): Promise<string> => {
    const salt = randomBytes(16);
    const recoverySalt = randomBytes(16);
    const recoveryCode = generateRecoveryCode();

    const masterKey = await deriveKey(masterPassword, { salt, memKiB: DEFAULT_KDF.memKiB, iterations: DEFAULT_KDF.iterations, parallelism: DEFAULT_KDF.parallelism });
    const recoveryKey = await deriveKey(normalizeRecoveryCode(recoveryCode), { salt: recoverySalt, memKiB: DEFAULT_KDF.memKiB, iterations: DEFAULT_KDF.iterations, parallelism: DEFAULT_KDF.parallelism });
    const vaultKey = await generateVaultKey();

    const protectedByMaster = await wrapVaultKey(vaultKey, masterKey);
    const protectedByRecovery = await wrapVaultKey(vaultKey, recoveryKey);

    const { error } = await supabase.from('vault_meta').insert({
      user_id: user!.id,
      kdf: DEFAULT_KDF.kdf,
      kdf_salt: toB64(salt),
      kdf_mem: DEFAULT_KDF.memKiB,
      kdf_iter: DEFAULT_KDF.iterations,
      kdf_par: DEFAULT_KDF.parallelism,
      protected_by_master: protectedByMaster,
      recovery_salt: toB64(recoverySalt),
      protected_by_recovery: protectedByRecovery,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;

    vaultKeyRef.current = vaultKey;
    setItems([]);
    setStatus('unlocked');
    bump();
    return recoveryCode;
  }, [user, bump]);

  const unlock = useCallback(async (masterPassword: string): Promise<boolean> => {
    const meta = await getMeta();
    if (!meta) return false;
    try {
      const masterKey = await deriveKey(masterPassword, {
        salt: fromB64(meta.kdf_salt), memKiB: meta.kdf_mem, iterations: meta.kdf_iter, parallelism: meta.kdf_par,
      });
      const vaultKey = await unwrapVaultKey(meta.protected_by_master, masterKey);
      vaultKeyRef.current = vaultKey;
      await loadItems(vaultKey);
      setStatus('unlocked');
      bump();
      return true;
    } catch {
      return false; // senha mestra incorreta (falha de autenticação do AES-GCM)
    }
  }, [getMeta, loadItems, bump]);

  const unlockWithRecovery = useCallback(async (code: string): Promise<boolean> => {
    const meta = await getMeta();
    if (!meta || !meta.recovery_salt || !meta.protected_by_recovery) return false;
    try {
      const recoveryKey = await deriveKey(normalizeRecoveryCode(code), {
        salt: fromB64(meta.recovery_salt), memKiB: meta.kdf_mem, iterations: meta.kdf_iter, parallelism: meta.kdf_par,
      });
      const vaultKey = await unwrapVaultKey(meta.protected_by_recovery, recoveryKey);
      vaultKeyRef.current = vaultKey;
      await loadItems(vaultKey);
      setStatus('unlocked');
      bump();
      return true;
    } catch {
      return false;
    }
  }, [getMeta, loadItems, bump]);

  const resetMasterPassword = useCallback(async (newPassword: string): Promise<void> => {
    if (!vaultKeyRef.current) throw new Error('Cofre bloqueado');
    const salt = randomBytes(16);
    const masterKey = await deriveKey(newPassword, { salt, memKiB: DEFAULT_KDF.memKiB, iterations: DEFAULT_KDF.iterations, parallelism: DEFAULT_KDF.parallelism });
    const protectedByMaster = await wrapVaultKey(vaultKeyRef.current, masterKey);
    const { error } = await supabase.from('vault_meta').update({
      kdf_salt: toB64(salt),
      kdf_mem: DEFAULT_KDF.memKiB, kdf_iter: DEFAULT_KDF.iterations, kdf_par: DEFAULT_KDF.parallelism,
      protected_by_master: protectedByMaster,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user!.id);
    if (error) throw error;
  }, [user]);

  const addItem = useCallback(async (data: ItemData) => {
    if (!vaultKeyRef.current) throw new Error('Cofre bloqueado');
    const blob = await encryptJSON(data, vaultKeyRef.current);
    const { data: row, error } = await supabase
      .from('vault_items')
      .insert({ user_id: user!.id, blob, updated_at: new Date().toISOString() })
      .select('id')
      .single();
    if (error) throw error;
    setItems((prev) => [...prev, { id: row.id, ...data }].sort((a, b) => a.title.localeCompare(b.title)));
    bump();
  }, [user, bump]);

  const updateItem = useCallback(async (id: string, data: ItemData) => {
    if (!vaultKeyRef.current) throw new Error('Cofre bloqueado');
    const blob = await encryptJSON(data, vaultKeyRef.current);
    const { error } = await supabase.from('vault_items').update({ blob, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    setItems((prev) => prev.map((it) => (it.id === id ? { id, ...data } : it)).sort((a, b) => a.title.localeCompare(b.title)));
    bump();
  }, [bump]);

  const deleteItem = useCallback(async (id: string) => {
    const { error } = await supabase.from('vault_items').delete().eq('id', id);
    if (error) throw error;
    setItems((prev) => prev.filter((it) => it.id !== id));
    bump();
  }, [bump]);

  return (
    <VaultContext.Provider value={{
      status, items, refreshStatus, setupVault, unlock, unlockWithRecovery,
      resetMasterPassword, lock, addItem, updateItem, deleteItem, bump,
    }}>
      {children}
    </VaultContext.Provider>
  );
};

export const useVault = (): VaultContextType => {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault must be used within a VaultProvider');
  return ctx;
};
