/**
 * @system core-encryption
 * @status handwritten
 * @edit edit directly
 *
 * configured-primitives entry point for the encryption package.
 * The bootloader injects the encryption key at startup.
 */

export interface EncryptionConfig {
	encryptionKeyHex?: string;
	port?: number;
}

let _config: EncryptionConfig = {};

export function configure(opts: EncryptionConfig): void {
	_config = { ..._config, ...opts };
}

export function getEncryptionConfig(): EncryptionConfig {
	return _config;
}
