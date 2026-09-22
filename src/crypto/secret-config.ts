/**
 * @system core-encryption
 * @status handwritten
 * @edit edit directly
 *
 * Encrypts/decrypts the token field in registry secret configs.
 * Used by registry_edit (writer) and load-secret (reader) to keep
 * secret tokens encrypted at rest in the registry_entries JSONB.
 */

import { decrypt } from "./decrypt";
import { encrypt } from "./encrypt";
import { isEncrypted } from "./is-encrypted";

export interface SecretConfigLike {
	token?: string;
	auth_json?: string;
	env_vars?: Record<string, string>;
	[key: string]: unknown;
}

export function encryptSecretConfig(
	config: SecretConfigLike,
): SecretConfigLike {
	if (config.token && !isEncrypted(config.token)) {
		return { ...config, token: encrypt(config.token) };
	}
	return config;
}

export function decryptSecretConfig(
	config: SecretConfigLike,
): SecretConfigLike {
	if (config.token && isEncrypted(config.token)) {
		try {
			return { ...config, token: decrypt(config.token) };
		} catch {
			return config;
		}
	}
	return config;
}
