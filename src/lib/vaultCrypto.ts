import { argon2id } from 'hash-wasm';

// =========================================================
// Criptografia do Cofre (zero-knowledge, 100% no navegador)
// - KDF: Argon2id (memory-hard) para derivar chave da senha mestra
// - Cifra: AES-GCM 256 (autenticada) via Web Crypto
// Nada aqui persiste chaves; elas vivem só em memória.
// =========================================================

// Parâmetros padrão do Argon2id (base OWASP, reforçado para um cofre).
// São gravados no vault_meta para permitir evolução futura.
export const DEFAULT_KDF = {
  kdf: 'argon2id' as const,
  memKiB: 65536, // 64 MiB
  iterations: 3,
  parallelism: 1,
};

const enc = new TextEncoder();
const dec = new TextDecoder();

// ---- base64 helpers ----
export const toB64 = (bytes: Uint8Array): string => {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};
export const fromB64 = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export const randomBytes = (n: number): Uint8Array => {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
};

// ---- Derivação da chave (Argon2id) -> CryptoKey AES-GCM ----
export interface KdfParams {
  memKiB: number;
  iterations: number;
  parallelism: number;
  salt: Uint8Array;
}

export const deriveKey = async (password: string, params: KdfParams): Promise<CryptoKey> => {
  const raw = await argon2id({
    password,
    salt: params.salt,
    memorySize: params.memKiB,
    iterations: params.iterations,
    parallelism: params.parallelism,
    hashLength: 32,
    outputType: 'binary',
  });
  return crypto.subtle.importKey('raw', raw as Uint8Array, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
    'wrapKey',
    'unwrapKey',
  ]);
};

// ---- Chave do cofre (aleatória) ----
export const generateVaultKey = (): Promise<CryptoKey> =>
  crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

// ---- Embrulhar / desembrulhar a chave do cofre com uma chave derivada ----
// Formato de saída: base64(iv[12] + wrapped)
export const wrapVaultKey = async (vaultKey: CryptoKey, wrappingKey: CryptoKey): Promise<string> => {
  const iv = randomBytes(12);
  const wrapped = new Uint8Array(
    await crypto.subtle.wrapKey('raw', vaultKey, wrappingKey, { name: 'AES-GCM', iv })
  );
  const out = new Uint8Array(iv.length + wrapped.length);
  out.set(iv, 0);
  out.set(wrapped, iv.length);
  return toB64(out);
};

export const unwrapVaultKey = async (packed: string, wrappingKey: CryptoKey): Promise<CryptoKey> => {
  const data = fromB64(packed);
  const iv = data.slice(0, 12);
  const wrapped = data.slice(12);
  return crypto.subtle.unwrapKey(
    'raw',
    wrapped,
    wrappingKey,
    { name: 'AES-GCM', iv },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
};

// ---- Cifrar / decifrar um item (JSON) com a chave do cofre ----
export const encryptJSON = async (obj: unknown, vaultKey: CryptoKey): Promise<string> => {
  const iv = randomBytes(12);
  const plaintext = enc.encode(JSON.stringify(obj));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, vaultKey, plaintext)
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return toB64(out);
};

export const decryptJSON = async <T>(packed: string, vaultKey: CryptoKey): Promise<T> => {
  const data = fromB64(packed);
  const iv = data.slice(0, 12);
  const ct = data.slice(12);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, vaultKey, ct);
  return JSON.parse(dec.decode(pt)) as T;
};

// ---- Código de recuperação (alta entropia, mostrado uma vez) ----
// 20 chars base32 (Crockford) em grupos de 5 -> ~100 bits
export const generateRecoveryCode = (): string => {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const bytes = randomBytes(20);
  let s = '';
  for (let i = 0; i < 20; i++) s += alphabet[bytes[i] % alphabet.length];
  return s.match(/.{1,5}/g)!.join('-'); // XXXXX-XXXXX-XXXXX-XXXXX
};

export const normalizeRecoveryCode = (code: string): string =>
  code.toUpperCase().replace(/[^0-9A-Z]/g, '');

// ---- Gerador de senha forte ----
export const generatePassword = (length = 20, opts?: { symbols?: boolean }): string => {
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%^&*()-_=+[]{};:,.?';
  const pool = lower + upper + digits + (opts?.symbols === false ? '' : symbols);
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += pool[bytes[i] % pool.length];
  return out;
};
