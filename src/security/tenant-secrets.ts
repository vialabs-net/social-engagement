import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { KeyManagementServiceClient } from '@google-cloud/kms';

const DEK_BYTES = 32;
const GCM_IV_BYTES = 12;
const ENCRYPTED_TOKEN_PREFIX = 'enc-v1';

interface TenantSecretsInput {
  readonly bufferAccessToken?: string | null;
  readonly linkedinAccessToken?: string | null;
  readonly githubPat?: string | null;
}

interface LoadedDek {
  readonly encryptedDek: string;
  readonly plaintextDek: Buffer;
}

export interface TenantSecretsRow {
  readonly encrypted_dek: string | null;
  readonly buffer_access_token: string | null;
  readonly linkedin_access_token?: string | null;
  readonly github_pat?: string | null;
}

export interface ResolvedTenantSecrets {
  readonly bufferAccessToken: string | null;
  readonly linkedinAccessToken: string | null;
  readonly githubPat: string | null;
}

export interface SealedTenantSecrets {
  readonly encryptedDek: string;
  bufferAccessToken?: string | null;
  linkedinAccessToken?: string | null;
  githubPat?: string | null;
}

let kmsClient: KeyManagementServiceClient | null = null;

function getKmsClient(): KeyManagementServiceClient {
  if (!kmsClient) kmsClient = new KeyManagementServiceClient();
  return kmsClient;
}

function getKmsKeyName(): string {
  const keyName = process.env['GCP_KMS_KEY_NAME'] ?? process.env['KMS_KEY_NAME'] ?? '';
  if (!keyName) {
    throw new Error('GCP_KMS_KEY_NAME is required to encrypt tenant tokens');
  }
  return keyName;
}

function encode(value: Uint8Array): string {
  return Buffer.from(value).toString('base64url');
}

function decode(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

export function isEncryptedToken(token: string): boolean {
  return token.startsWith(`${ENCRYPTED_TOKEN_PREFIX}:`);
}

function encryptWithDek(plaintextDek: Buffer, token: string): string {
  const iv = randomBytes(GCM_IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', plaintextDek, iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    ENCRYPTED_TOKEN_PREFIX,
    encode(iv),
    encode(authTag),
    encode(ciphertext),
  ].join(':');
}

function decryptWithDek(plaintextDek: Buffer, token: string): string {
  const [prefix, ivRaw, authTagRaw, ciphertextRaw] = token.split(':');
  if (
    prefix !== ENCRYPTED_TOKEN_PREFIX ||
    !ivRaw ||
    !authTagRaw ||
    !ciphertextRaw
  ) {
    throw new Error('Invalid encrypted token format');
  }

  const decipher = createDecipheriv('aes-256-gcm', plaintextDek, decode(ivRaw));
  decipher.setAuthTag(decode(authTagRaw));
  const plaintext = Buffer.concat([
    decipher.update(decode(ciphertextRaw)),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

async function wrapDek(plaintextDek: Buffer): Promise<string> {
  const [response] = await getKmsClient().encrypt({
    name: getKmsKeyName(),
    plaintext: plaintextDek,
  });

  if (!response.ciphertext) {
    throw new Error('KMS encrypt returned no ciphertext for tenant DEK');
  }

  return typeof response.ciphertext === 'string'
    ? encode(Buffer.from(response.ciphertext, 'base64'))
    : encode(response.ciphertext);
}

async function unwrapDek(encryptedDek: string): Promise<Buffer> {
  const [response] = await getKmsClient().decrypt({
    name: getKmsKeyName(),
    ciphertext: decode(encryptedDek),
  });

  if (!response.plaintext) {
    throw new Error('KMS decrypt returned no plaintext for tenant DEK');
  }

  return Buffer.from(response.plaintext);
}

async function loadDek(existingEncryptedDek: string | null): Promise<LoadedDek> {
  if (existingEncryptedDek) {
    return {
      encryptedDek: existingEncryptedDek,
      plaintextDek: await unwrapDek(existingEncryptedDek),
    };
  }

  const plaintextDek = randomBytes(DEK_BYTES);
  return {
    encryptedDek: await wrapDek(plaintextDek),
    plaintextDek,
  };
}

export async function sealTenantSecrets(
  secrets: TenantSecretsInput,
  existingEncryptedDek: string | null,
): Promise<SealedTenantSecrets> {
  const dek = await loadDek(existingEncryptedDek);
  const sealed: SealedTenantSecrets = { encryptedDek: dek.encryptedDek };

  if (secrets.bufferAccessToken !== undefined) {
    sealed.bufferAccessToken = secrets.bufferAccessToken
      ? encryptWithDek(dek.plaintextDek, secrets.bufferAccessToken)
      : null;
  }

  if (secrets.linkedinAccessToken !== undefined) {
    sealed.linkedinAccessToken = secrets.linkedinAccessToken
      ? encryptWithDek(dek.plaintextDek, secrets.linkedinAccessToken)
      : null;
  }

  if (secrets.githubPat !== undefined) {
    sealed.githubPat = secrets.githubPat
      ? encryptWithDek(dek.plaintextDek, secrets.githubPat)
      : null;
  }

  return sealed;
}

export async function resolveTenantSecrets(row: TenantSecretsRow): Promise<ResolvedTenantSecrets> {
  if (!row.encrypted_dek) {
    return {
      bufferAccessToken: row.buffer_access_token,
      linkedinAccessToken: row.linkedin_access_token ?? null,
      githubPat: row.github_pat ?? null,
    };
  }

  const plaintextDek = await unwrapDek(row.encrypted_dek);

  function decryptField(value: string | null | undefined): string | null {
    if (!value) return null;
    return isEncryptedToken(value) ? decryptWithDek(plaintextDek, value) : value;
  }

  return {
    bufferAccessToken: decryptField(row.buffer_access_token),
    linkedinAccessToken: decryptField(row.linkedin_access_token),
    githubPat: decryptField(row.github_pat),
  };
}
