/**
 * @system core-encryption
 * @status handwritten
 * @edit edit directly
 *
 * Checks if a string is AES-256-GCM encrypted.
 */
import { decrypt } from "./decrypt";

export function isEncrypted(value: string): boolean {
	if (!value) return false;
	try {
		decrypt(value);
		return true;
	} catch {
		return false;
	}
}
