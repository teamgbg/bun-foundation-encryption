/**
 * @system core-encryption
 * @status handwritten — none derivable: generator catalogue and
 *   `reference/package-catalog.md` searched; the sealed-shape predicates that
 *   exist (Rust, SQL) are unreachable from TS, and the only TS copy was a
 *   consumer's private one — the duplication this removes.
 * @edit edit directly
 * Does this value CARRY the sealed shape? Not `isEncrypted` — it answers
 * "does it decrypt", so a wrong key answers false. Vectors: the secrets doc.
 */

/** IV + auth tag + at least one ciphertext byte. Derived from the cipher's own
 * constants, never a literal, so a change to either cannot leave the threshold
 * behind. Matches `secret_token_sealed_shape`'s hardcoded 29. */
import { AUTH_TAG_LENGTH, IV_LENGTH } from "./constants.ts";

/** The supplier shape the reader must NOT touch: pure even-length lowercase
 * hex. kellnr's 48-hex credential is plaintext that happens to be
 * base64-decodable in length, not an envelope. */
const LOWERCASE_HEX = /^[0-9a-f]+$/;
/** Standard base64, optional padding. Deliberately NOT base64url: the writer
 * emits `base64`, so a base64url-looking value is plaintext by another name. */
const STANDARD_BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Whether `value` carries the platform's sealed-envelope shape.
 *
 * Pure, total, and NEVER throws: any input classifies, so a malformed value is
 * "not sealed" (plaintext by definition) rather than an error. The wall's own
 * comment makes the same call from the other side — an invalid-base64 token is
 * plaintext by definition, so the trigger fires a clean refusal instead of an
 * accidental 22P02.
 */
export function looksSealed(value: string | null | undefined): boolean {
	if (!value) return false;
	// The hex exemption runs FIRST and alone: 48 lowercase hex chars satisfy
	// every other clause, so a classifier that tested the base64 shape first
	// would need this as a carve-out rather than as a rule.
	if (value.length % 2 === 0 && LOWERCASE_HEX.test(value)) return false;
	if (!STANDARD_BASE64.test(value)) return false;
	if (value.length % 4 !== 0) return false;
	return Buffer.from(value, "base64").length >= IV_LENGTH + AUTH_TAG_LENGTH + 1;
}
