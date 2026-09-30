// @system codegen
// @status generated
// @edit change the suite in the owned-suites band, then re-run codegen. Hand-edits are overwritten.
//
// This suite's assertions are OWNED by the codegen band: the band module
// carries them verbatim, this file is the emission, and hand edits here are
// overwritten on the next run. The rationale each assertion carries moved
// with it into the band.

import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import projected from "./function-contract-rows.json";

// THE EXECUTING HALF of the @teamscala/encryption function_call contract.
// Every case is the registry row projected into ./function-contract-rows.json
// by codegen_output/test-vector-rows-bun-foundation-encryption — this band
// carries the decoder and the runner, never a case. Regenerating the rows
// (a test_vector row edit) reaches this suite with no file rewritten by hand.
//
// VOCABULARY NOTE, deliberate divergence from ts_function_contract_runner.pkl:
// those rows are TS-authored and compare `expect` raw; these rows are
// Rust-authored, so strings/maps travel wrapped ({"$str"}, {"$map"}) and a
// JSON null is Rust None. One decoder therefore runs on BOTH sides — args and
// expect — so {"$str":"x"} and null arrive as the subject's own "x" and
// absence (undefined, which is what unsealSecretValue returns), and the two
// sides can never disagree about what the row meant.
//
// ISOLATION: rows that declare an env block re-run THIS FILE in a fresh
// process (runIsolated). constants.ts reads getEncryptionConfig()
// .encryptionKeyHex FIRST and falls back to process.env.ENCRYPTION_KEY, so a
// configure() from a sibling suite sharing this process would silently
// shadow the row's declared key and assert with the wrong one — measured
// from the key-resolution chain, not assumed. Rows without env never read the
// key (shape classification, plaintext passthrough, empty-is-absent) and run
// in the parent.

const ROWS = (projected.rows ?? projected) as Vector[];

// This file, and the one row a child process is selecting. Absent in the
// parent run: every row executes there, and a row with env forks.
const SELF = import.meta.path;
const SELECTED = process.env.SCALA_CONTRACT_ROW;

if (!Array.isArray(ROWS)) {
	throw new Error(
		"./function-contract-rows.json must project an array of rows — the runner executes registry rows, never a hand-written case list",
	);
}

const PKG = "@teamscala/encryption";

// import.meta.dir is this FILE's directory — row modules are repo-relative,
// so the package root is the nearest enclosing directory carrying a
// package.json, walked up.
const ROOT = (() => {
	let dir = import.meta.dir;
	for (let depth = 0; depth < 8; depth++) {
		if (existsSync(join(dir, "package.json"))) return dir;
		dir = join(dir, "..");
	}
	throw new Error("no package.json above " + import.meta.dir + " — a contract suite renders inside a package");
})();

type Vector = Record<string, any> & { suite_type: string; slug: string };

// The ONE decoder, shared by args and expect. The closed marker vocabulary:
//   null at any position      -> undefined (Rust None: absence, not a value)
//   {"$str": "<s>"}           -> "<s>"
//   {"$map": {entries, ty}}   -> an object built from [key, value] pairs
//                                (ty is the Rust type name — metadata about
//                                the value, not part of it)
//   {"$error": {...}}         -> a constructed Error (archetype arm)
//   {"$fn": {...}}            -> a thunk returning/raising a value (archetype)
//   arrays and plain objects  -> walked, so a marker nested at any member
//                                position is the same encoding one level down
// A marker this runner does not understand, or a marker sharing an object
// with plain keys, is REFUSED by name: silently passing it through would
// hand the subject an object where the row declared a value.
async function decodeValue(value: unknown): Promise<unknown> {
	if (value === null || value === undefined) return undefined;
	if (Array.isArray(value)) return Promise.all(value.map(decodeValue));
	if (typeof value === "object") {
		const record = value as Record<string, unknown>;
		const keys = Object.keys(record);
		const markers = keys.filter((key) => key.startsWith("$"));
		if (markers.length > 0) {
			if (keys.length !== 1) {
				throw new Error("a marker object carries exactly one key, got " + JSON.stringify(keys));
			}
			const marker = markers[0];
			if (marker === "$str") {
				const inner = record.$str;
				if (typeof inner !== "string") throw new Error("$str takes a string, got " + typeof inner);
				return inner;
			}
			if (marker === "$map") {
				const spec = record.$map as { entries?: unknown; ty?: unknown } | null;
				if (spec === null || typeof spec !== "object" || !Array.isArray(spec.entries)) {
					throw new Error('$map declares { entries: [key, value][], ty } — got ' + JSON.stringify(spec));
				}
				const out: Record<string, unknown> = {};
				for (const entry of spec.entries as unknown[]) {
					if (!Array.isArray(entry) || entry.length !== 2) {
						throw new Error("$map entries are [key, value] pairs, got " + JSON.stringify(entry));
					}
					out[String(entry[0])] = await decodeValue(entry[1]);
				}
				return out;
			}
			if (marker === "$error") {
				const spec = record.$error as { class: string; module?: string; args?: unknown[] };
				const ctor = spec.module
					? ((await import(spec.module)) as Record<string, any>)[spec.class]
					: (globalThis as Record<string, any>)[spec.class];
				if (typeof ctor !== "function") throw new Error("unconstructible error class: " + spec.class);
				return new ctor(...((await Promise.all((spec.args ?? []).map(decodeValue))) as unknown[]));
			}
			if (marker === "$fn") {
				const spec = record.$fn as { returns?: unknown; throws?: unknown };
				if (spec.returns !== undefined) return () => spec.returns;
				if (spec.throws !== undefined) {
					const raised = await decodeValue(spec.throws);
					return () => {
						throw raised;
					};
				}
				throw new Error("$fn declares neither returns nor throws — a function whose behaviour is undeclared is a case the runner cannot run");
			}
			throw new Error("marker " + marker + " is not declared — a marker this runner does not understand is data the subject would receive as an object");
		}
		const walked: Record<string, unknown> = {};
		for (const [key, inner] of Object.entries(record)) {
			walked[key] = await decodeValue(inner);
		}
		return walked;
	}
	return value;
}

// Resolve the EXPORT, without calling it.
async function loadExport(modulePath: string, exportName: string): Promise<unknown> {
	const mod = (await import(join(ROOT, modulePath))) as Record<string, any>;
	if (!(exportName in mod)) throw new Error("no export " + exportName + " in " + modulePath);
	return mod[exportName];
}

async function callExport(modulePath: string, exportName: string, decodedArgs: unknown[]): Promise<unknown> {
	const fn = await loadExport(modulePath, exportName);
	if (typeof fn !== "function") throw new Error("export " + exportName + " in " + modulePath + " is not a function");
	// Decoding happened at the caller, once — decoding here again would walk
	// an already-decoded value a second time (archetype note, kept: it is the
	// same one-pass rule).
	return await fn(...decodedArgs);
}

function applyEnv(env?: Record<string, string>): () => void {
	const before: Record<string, string | undefined> = {};
	for (const [key, value] of Object.entries(env ?? {})) {
		before[key] = process.env[key];
		process.env[key] = value;
	}
	return () => {
		for (const [key, value] of Object.entries(before)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	};
}

// Expect kinds this band does not execute. Each is refused by NAME before any
// call — a structural/text/render expect compared with toEqual would fail
// with a diff that blames the row instead of the vocabulary gap.
const NON_CALL_VERBS = [
	"export_shape",
	"arg_shape",
	"has_members",
	"member_is",
	"member_equals",
	"reads_resolve",
	"contains_text",
	"absent",
	"in_order",
	"repeated",
	"render",
] as const;

function assertWellFormed(row: Vector): void {
	const bad = (msg: string): never => {
		throw new Error("row " + row.slug + " is malformed: " + msg);
	};
	if (row.suite_type !== "function_call") {
		bad("unknown suite_type " + JSON.stringify(row.suite_type) + " — this band executes function_call rows only");
	}
	if (PKG !== "*" && row.package !== PKG) bad("package " + JSON.stringify(row.package) + " — expected " + JSON.stringify(PKG));
	if (typeof row.export !== "string" || row.export.length === 0) bad("export must be a non-empty string");
	if (typeof row.module !== "string" || row.module.length === 0) bad("module must be a non-empty repo-relative path");
	if (row.args === null || row.env === null) bad("args and env must be arrays/objects, never null — null and an absent key are different states");
	if (row.args !== undefined && !Array.isArray(row.args)) bad("args must be a positional array");
	if (row.expect !== undefined && row.expect_error !== undefined) bad("declares both expect and expect_error — the arms are XOR");
	if (row.expect === undefined && row.expect_error === undefined) bad("declares neither expect nor expect_error — a row that asserts nothing asserts nothing");
	if (row.fixtures !== undefined && row.fixtures !== null) {
		bad("declares fixtures — this band stubs nothing, so fixtures would silently never apply; a stubbed row belongs to the full runner");
	}
	if (row.expect !== undefined && row.expect !== null && typeof row.expect === "object" && !Array.isArray(row.expect)) {
		for (const key of Object.keys(row.expect)) {
			if ((NON_CALL_VERBS as readonly string[]).includes(key)) {
				bad("expect declares " + key + " — this band calls the export and compares decoded values; a structural/text/render expect needs the full runner");
			}
		}
	}
}

async function expectCall(row: Vector, exportName: string, args: unknown[]): Promise<void> {
	const restore = applyEnv(row.env);
	try {
		const decodedArgs = await Promise.all(args.map(decodeValue));
		if (row.expect_error === undefined) {
			const value = await callExport(row.module, exportName, decodedArgs);
			expect(value).toEqual(await decodeValue(row.expect));
		} else {
			await expect(callExport(row.module, exportName, decodedArgs)).rejects.toThrow(row.expect_error);
		}
	} finally {
		restore();
	}
}

// Re-runs THIS FILE under `bun test` selecting only this row, in a fresh
// process: module state (configure) starts empty, so the row's own env block
// is the key the subject reads. The child's exit code is the verdict and its
// output is the evidence, so a refusal inside the child surfaces verbatim in
// the parent.
function runIsolated(row: Vector): void {
	const child = spawnSync("bun", ["test", SELF, "--test-name-pattern", row.slug], {
		cwd: ROOT,
		env: { ...process.env, SCALA_CONTRACT_ROW: row.slug },
		encoding: "utf8",
	});
	if (child.status !== 0) {
		const evidence = (child.stderr || child.stdout || "").trimEnd().split("\n").slice(-14).join("\n");
		throw new Error(`row ${row.slug} failed in its isolated run:\n${evidence}`);
	}
}

function runRow(row: Vector): Promise<void> | void {
	// Refused BY NAME before any call: the failing `it` is the row's slug.
	assertWellFormed(row);
	if (SELECTED === undefined && row.env !== undefined && row.env !== null) return runIsolated(row);
	return expectCall(row, row.export, row.args ?? []);
}

describe(PKG + " function_call contracts", () => {
	for (const row of ROWS) {
		if (SELECTED !== undefined && row.slug !== SELECTED) continue;
		it(row.slug, async () => {
			await runRow(row);
		});
	}
});
