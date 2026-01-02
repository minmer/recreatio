const textEncoder = new TextEncoder();

export function toBase64(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin);
}

export function fromBase64(input: string): Uint8Array {
  const bin = atob(input);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

export function randomSalt(bytes = 32): string {
  const buffer = crypto.getRandomValues(new Uint8Array(bytes));
  return toBase64(buffer);
}

async function sha256(data: ArrayBuffer): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', data);
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number, length: number): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  return crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    length * 8
  );
}

export async function deriveH3(password: string, saltBase64: string, iterations = 150000): Promise<string> {
  const saltBytes = fromBase64(saltBase64);
  const h1 = await pbkdf2(password, saltBytes, iterations, 32);
  const h2 = await sha256(h1);
  const h3 = await sha256(h2);
  return toBase64(h3);
}
