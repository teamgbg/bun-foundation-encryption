/**
 * @system core-encryption
 * @status handwritten
 * @edit edit directly
 *
 * Prisma extension for transparent field encryption across all services.
 * Intercepts create/update ops on ENCRYPTED_FIELDS and decrypts reads.
 * Uses node:crypto synchronously — always available in Bun runtime.
 */

import { createCache } from "@teamscala/cache/create-cache";
import { decrypt } from "./crypto/decrypt.ts";
import { encrypt } from "./crypto/encrypt.ts";
import { isEncrypted } from "./crypto/is-encrypted.ts";

// Lazy import — avoids loading core-registry at module init time for microservices
// that pass an explicit fieldsMap.
const encryptedFieldsCache = createCache<Record<string, string[]>>(
	"encryption:encrypted-fields",
	{ ttlMs: Number.POSITIVE_INFINITY, maxSize: 1 },
);
async function getEncryptedFieldsLazy(): Promise<Record<string, string[]>> {
	const hit = encryptedFieldsCache.get("default");
	if (hit) return hit;
	const { getEncryptedFieldsFromRegistry } = await import("./fields");
	const fields = await getEncryptedFieldsFromRegistry();
	encryptedFieldsCache.set("default", fields);
	return fields;
}

/** Operations that write data and need encryption */
const WRITE_OPS = new Set([
	"create",
	"update",
	"upsert",
	"createMany",
	"updateMany",
]);

/** Operations that return only a count (no field data to decrypt) */
const COUNT_ONLY_OPS = new Set([
	"createMany",
	"updateMany",
	"deleteMany",
	"count",
]);

interface MutableRecord {
	[key: string]: unknown;
}

interface PrismaExtensionOperationArgs {
	model: string;
	operation: string;
	args: {
		create?: Record<string, unknown> | null;
		update?: Record<string, unknown> | null;
		data?: Record<string, unknown> | Record<string, unknown>[] | null;
	};
	query: (args: unknown) => Promise<unknown>;
}

function encryptValue(v: unknown): unknown {
	if (typeof v !== "string" || !v) return v;
	if (isEncrypted(v)) return v;
	return encrypt(v);
}

function decryptValue(v: unknown): unknown {
	if (typeof v !== "string" || !v) return v;
	if (!isEncrypted(v)) return v;
	try {
		return decrypt(v);
	} catch {
		return v;
	}
}

function encryptDataFields(
	data: Record<string, unknown> | Record<string, unknown>[] | undefined | null,
	fields: string[],
): void {
	if (!data || typeof data !== "object") return;
	if (Array.isArray(data)) return;
	for (const f of fields) {
		if (f in data && data[f] !== undefined) data[f] = encryptValue(data[f]);
	}
}

function decryptResult(result: unknown, fields: string[]): void {
	if (result == null) return;
	const items = Array.isArray(result) ? result : [result];
	for (const item of items) {
		if (item && typeof item === "object") {
			const mutableItem = item as MutableRecord;
			for (const f of fields) {
				if (f in mutableItem && mutableItem[f] !== undefined) {
					mutableItem[f] = decryptValue(mutableItem[f]);
				}
			}
		}
	}
}

export function createEncryptionExtension(
	fieldsMap?: Record<string, string[]>,
) {
	const resolveFields = fieldsMap
		? async (model: string) => fieldsMap[model]
		: async (model: string) => (await getEncryptedFieldsLazy())[model];

	return {
		name: "field-encryption" as const,
		query: {
			$allModels: {
				async $allOperations({
					model,
					operation,
					args,
					query,
				}: PrismaExtensionOperationArgs) {
					const fields = await resolveFields(model);
					if (!fields) return query(args);

					if (WRITE_OPS.has(operation)) {
						if (operation === "upsert") {
							encryptDataFields(args.create, fields);
							encryptDataFields(args.update, fields);
						} else if (operation === "createMany" && Array.isArray(args.data)) {
							for (const item of args.data) encryptDataFields(item, fields);
						} else {
							encryptDataFields(args.data, fields);
						}
					}

					const result = await query(args);

					if (!COUNT_ONLY_OPS.has(operation) && result != null) {
						decryptResult(result, fields);
					}

					return result;
				},
			},
		},
	};
}
