// src/utils/crypto.ts

export async function generateKeyPair() {
  return await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportPublicKey(key: CryptoKey) {
  const exported = await window.crypto.subtle.exportKey("spki", key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function importPublicKey(pem: string) {
  const binaryDer = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  return await window.crypto.subtle.importKey(
    "spki",
    binaryDer,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["encrypt"]
  );
}

export async function encryptMessage(message: string, publicKey: CryptoKey) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    data
  );
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

export async function decryptMessage(encryptedMessage: string, privateKey: CryptoKey) {
  const binaryData = Uint8Array.from(atob(encryptedMessage), (c) => c.charCodeAt(0));
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    binaryData
  );
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}
