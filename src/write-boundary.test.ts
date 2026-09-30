// @system codegen
// @status generated
// @edit change the suite in the owned-suites band, then re-run codegen. Hand-edits are overwritten.
//
// This suite's assertions are OWNED by the codegen band: the band module
// carries them verbatim, this file is the emission, and hand edits here are
// overwritten on the next run. The rationale each assertion carries moved
// with it into the band.

import { describe, expect, test, beforeEach, mock } from "bun:test";
import { __resetCredentialFieldsCacheForTest } from "./write-boundary.ts";
import { configure } from "./configure.ts";

// A TEST CARRIES ITS OWN FIXTURE CREDENTIAL — never whatever the machine
// exports. This suite exercises the real cipher, so it needs a real key, and
// the key must be the same everywhere it runs: measured 2026-09-30, with the
// key borrowed from the developer's shell the file was green on a
// workstation and red in the compile container (5 of 12 failed, every
// encrypt() throwing "Encryption key not configured" from constants.ts) —
// ambient state is not a fixture. The bootloader's own injection path
// (configure), not the env fallback, so the suite depends on nothing outside
// its own module body; the value is inert hex ("dead" × 16 = 64 chars) and
// guards nothing but this suite's determinism.
configure({ encryptionKeyHex: "dead".repeat(16) });

const REGISTRY_MODULE = "@teamscala/db/registry/config.ts";

function mockRegistry(models: Record<string, string[]>) {
	mock.module(REGISTRY_MODULE, () => ({
		requireConfigObject: mock(() => ({ models })),
	}));
}

beforeEach(() => {
	__resetCredentialFieldsCacheForTest();
});

describe("applyCredentialWriteBoundary — encrypt-on-write (legacy shape, pre-refusal)", () => {
	test("sealed ciphertext passes through unchanged", async () => {
		mockRegistry({ user: ["fathom_api_key"] });
		const { applyCredentialWriteBoundary } = await import("./write-boundary.ts");
		const { encrypt } = await import("./crypto/encrypt.ts");
		const sealed = encrypt("pa-live-plaintext-key");
		const data = { fathom_api_key: sealed, first_name: "Joe" };
		await applyCredentialWriteBoundary(data, "user");
		expect(data.fathom_api_key).toBe(sealed);
		expect(data.first_name).toBe("Joe");
	});

	test("leaves null (clearing) and empty string untouched", async () => {
		mockRegistry({ user: ["fathom_api_key"] });
		const { applyCredentialWriteBoundary } = await import("./write-boundary.ts");
		const data: Record<string, unknown> = { fathom_api_key: null };
		await applyCredentialWriteBoundary(data, "user");
		expect(data.fathom_api_key).toBeNull();

		const empty: Record<string, unknown> = { fathom_api_key: "" };
		await applyCredentialWriteBoundary(empty, "user");
		expect(empty.fathom_api_key).toBe("");
	});

	test("no-ops for a model with no declared credential columns", async () => {
		mockRegistry({ user: ["fathom_api_key"] });
		const { applyCredentialWriteBoundary } = await import("./write-boundary.ts");
		const data = { some_column: "plain" };
		await applyCredentialWriteBoundary(data, "agreements");
		expect(data.some_column).toBe("plain");
	});

	test("no-ops for null/undefined payloads", async () => {
		mockRegistry({ user: ["fathom_api_key"] });
		const { applyCredentialWriteBoundary } = await import("./write-boundary.ts");
		await expect(applyCredentialWriteBoundary(null, "user")).resolves.toBeUndefined();
		await expect(applyCredentialWriteBoundary(undefined, "user")).resolves.toBeUndefined();
	});
});

describe("applyCredentialWriteBoundary — payload shapes", () => {
	test("passes ciphertext through every item of an array", async () => {
		mockRegistry({ user: ["fathom_api_key"] });
		const { applyCredentialWriteBoundary } = await import("./write-boundary.ts");
		const { encrypt } = await import("./crypto/encrypt.ts");
		const data = [
			{ fathom_api_key: encrypt("key-one") },
			{ fathom_api_key: encrypt("key-two") },
			{ other: "plain" },
		];
		await applyCredentialWriteBoundary(data, "user");
		expect(data[2]!.other).toBe("plain");
	});

	test("passes ciphertext through create and update sub-objects of an upsert input", async () => {
		mockRegistry({ user: ["fathom_api_key"] });
		const { applyCredentialWriteBoundary } = await import("./write-boundary.ts");
		const { encrypt } = await import("./crypto/encrypt.ts");
		const input = {
			where: { id: "abc" },
			create: { fathom_api_key: encrypt("key-create") },
			update: { fathom_api_key: encrypt("key-update") },
		};
		await applyCredentialWriteBoundary(input, "user");
		expect(input.where).toEqual({ id: "abc" });
	});
});

describe("applyCredentialWriteBoundary — refusal", () => {
	test("refuses a non-string credential value (Prisma operator / object)", async () => {
		mockRegistry({ user: ["fathom_api_key"] });
		const { applyCredentialWriteBoundary } = await import("./write-boundary.ts");
		const data = { fathom_api_key: { set: "pa-live-plaintext-key" } };
		expect(applyCredentialWriteBoundary(data, "user")).rejects.toThrow(
			/Refused write to user\.fathom_api_key/,
		);
	});

	test("fails closed when the declaration cannot be read and no map is cached", async () => {
		mock.module(REGISTRY_MODULE, () => ({
			requireConfigObject: mock(() => {
				throw new Error("registry unreachable");
			}),
		}));
		const { applyCredentialWriteBoundary } = await import("./write-boundary.ts");
		const data = { fathom_api_key: "pa-live-plaintext-key" };
		expect(applyCredentialWriteBoundary(data, "user")).rejects.toThrow(
			/Refused write to user: the encrypted-fields declaration/,
		);
	});

	test("falls back to the last known map when a later read fails (declaration cached)", async () => {
		mockRegistry({ user: ["fathom_api_key"] });
		const { applyCredentialWriteBoundary } = await import("./write-boundary.ts");
		const { encrypt } = await import("./crypto/encrypt.ts");
		const warmup = { fathom_api_key: encrypt("warmup-key") };
		await applyCredentialWriteBoundary(warmup, "user");

		mock.module(REGISTRY_MODULE, () => ({
			requireConfigObject: mock(() => {
				throw new Error("registry blip");
			}),
		}));
		const data = { fathom_api_key: encrypt("fresh-key") };
		await applyCredentialWriteBoundary(data, "user");
	});
});

describe("applyCredentialWriteBoundary — refuse plaintext (ruling half b)", () => {
	test("REFUSES plaintext unconditionally — Rina's live probe shape (user, system, none)", async () => {
		mockRegistry({ user: ["fathom_api_key"] });
		const { applyCredentialWriteBoundary } = await import("./write-boundary.ts");
		for (const caller of ["0199aaaa-user", "system", undefined, null]) {
			const data = { fathom_api_key: "obviously-invalid-placeholder" };
			await expect(applyCredentialWriteBoundary(data, "user", caller)).rejects.toThrow(
				/Refused write to user\.fathom_api_key.*PLAINTEXT/s,
			);
		}
	});

	test("ciphertext passes through unchanged for any caller", async () => {
		mockRegistry({ user: ["fathom_api_key"] });
		const { applyCredentialWriteBoundary } = await import("./write-boundary.ts");
		const { encrypt } = await import("./crypto/encrypt.ts");
		const sealed = encrypt("real-key");
		for (const caller of ["0199aaaa-user", "system", undefined, null]) {
			const data = { fathom_api_key: sealed };
			await applyCredentialWriteBoundary(data, "user", caller);
			expect(data.fathom_api_key).toBe(sealed);
		}
	});

	test("null clear and absent field both bypass refusal", async () => {
		mockRegistry({ user: ["fathom_api_key"] });
		const { applyCredentialWriteBoundary } = await import("./write-boundary.ts");
		for (const val of [null, undefined]) {
			const data: Record<string, unknown> = { fathom_api_key: val };
			await expect(
				applyCredentialWriteBoundary(data, "user", "0199aaaa-user"),
			).resolves.toBeUndefined();
		}
		const omitted: Record<string, unknown> = {};
		await expect(
			applyCredentialWriteBoundary(omitted, "user", "0199aaaa-user"),
		).resolves.toBeUndefined();
	});
});
