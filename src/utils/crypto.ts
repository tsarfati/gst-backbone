// Minimal crypto helpers for client-side AES-GCM encryption
// NOTE: Keep keys client-side; store only ciphertext, iv, salt in DB

export async function deriveKey(passphrase: string, saltB64: string) {
  const enc = new TextEncoder();
  const salt = saltB64 ? Uint8Array.from(atob(saltB64), c => c.charCodeAt(0)) : crypto.getRandomValues(new Uint8Array(16));
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  const saltOut = saltB64 || btoa(String.fromCharCode(...salt));
  return { key, saltB64: saltOut };
}

function bufToB64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function b64ToBuf(b64: string) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function encryptJson(payload: unknown, passphrase: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const { key, saltB64 } = await deriveKey(passphrase, '');
  const enc = new TextEncoder();
  const data = enc.encode(JSON.stringify(payload));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return {
    ciphertext: bufToB64(ct),
    iv: btoa(String.fromCharCode(...iv)),
    salt: saltB64,
    algo: 'AES-GCM-256',
    version: 1,
  };
}

export async function decryptJson(ciphertextB64: string, ivB64: string, saltB64: string, passphrase: string) {
  const { key } = await deriveKey(passphrase, saltB64);
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
  const ctBuf = b64ToBuf(ciphertextB64);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ctBuf);
  const dec = new TextDecoder();
  return JSON.parse(dec.decode(plain));
}
