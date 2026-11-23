import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import type { CryptoKey, JWTPayload } from 'jose';
import { JwtTokenVerifier } from '../../src/core/authentication';

export const TEST_ISSUER = 'https://auth.test';
export const TEST_RESOURCE = 'https://mcp.test/mcp';
export const TEST_KID = 'test-key';

export interface TestAuth {
  /** Signs an ES256 token with the test key; claims override the defaults. */
  sign(claims?: JWTPayload): Promise<string>;
  /** A verifier that trusts only the test key. */
  verifier(clockSkewSeconds?: number): JwtTokenVerifier;
  privateKey: CryptoKey;
}

/**
 * Creates an ES256 key pair, as Upsun Auth uses, and a verifier that trusts it.
 * Default claims: issuer, audience = the test resource, issued now, expires in 5 minutes.
 */
export async function createTestAuth(): Promise<TestAuth> {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const jwk = { ...(await exportJWK(publicKey)), kid: TEST_KID, alg: 'ES256' };
  const keys = createLocalJWKSet({ keys: [jwk] });
  const now = Math.floor(Date.now() / 1000);

  return {
    privateKey,
    sign: (claims = {}) =>
      new SignJWT({ iss: TEST_ISSUER, aud: TEST_RESOURCE, iat: now, exp: now + 300, ...claims })
        .setProtectedHeader({ alg: 'ES256', kid: TEST_KID })
        .sign(privateKey),
    verifier: clockSkewSeconds =>
      new JwtTokenVerifier({
        keys,
        issuer: TEST_ISSUER,
        resource: TEST_RESOURCE,
        clockSkewSeconds,
      }),
  };
}
