// @sanctioned-bootstrap-env — ENCRYPTION_KEY fallback for workers/subprocesses that boot fresh without configure() (ruled in-file; guard no-process-env-in-configured-primitives).
/**
 * @system core-encryption
 * @status handwritten
 * @edit edit directly
 *
 * AES-256-GCM constants and key resolution.
 */

import { getEncryptionConfig } from "../configure.ts";

export const ALGORITHM = "aes-256-gcm";
export const IV_LENGTH = 12;
export const AUTH_TAG_LENGTH = 16;

export function getEncryptionKey(): Buffer {
	// Primary source: the bootloader-injected key (configured-primitives). The boot pipeline's runConfigurePrimitives() resolves env/ENCRYPTION_KEY and
	// passes it to configure() on the MAIN thread.
	//
	// FALLBACK (constitutional carve-out, encryption-is-the-only-encryption): worker/subprocess contexts (e.g. @teamscala/worker-pool workers running
	// sync handlers) boot FRESH and do NOT inherit the main thread's
	// runConfigurePrimitives() configure() call — so the configured key is
	// unset there. Per the constitution, encryption reads process.env.
	// ENCRYPTION_KEY as a fallback so those contexts decrypt reliably. This is
	// the SOLE env-read exception to the bootloader-owns-env rule, carved out
	// because workers cannot run the boot pipeline's configure() phase.
	let keyHex = getEncryptionConfig().encryptionKeyHex;
	if (!keyHex) {
		keyHex = process.env.ENCRYPTION_KEY;
	}
	if (!keyHex) {
		throw new Error(
			"Encryption key not configured. The bootloader injects it via configure({ encryptionKeyHex }) on the main thread (the configurable_primitive 'encryption' row resolves env/ENCRYPTION_KEY); this fallback also reads process.env.ENCRYPTION_KEY for worker/subprocess contexts that boot fresh without configure(). If both are unset, either configure() was not called or ENCRYPTION_KEY is absent — fix the boot injection or set the env var.",
		);
	}
	if (keyHex.length !== 64) {
		throw new Error(
			`encryptionKeyHex must be a 64-character hex string (32 bytes). Got ${keyHex.length} characters.`,
		);
	}
	return Buffer.from(keyHex, "hex");
}
