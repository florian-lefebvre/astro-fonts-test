import xxhash from "xxhash-wasm";
import { existsSync } from "node:fs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const createCache = async (cacheDir: URL) => {
	const { h64ToString } = await xxhash();

	const generateDigest = (data: Record<string, unknown> | string) => {
		const dataString = typeof data === "string" ? data : JSON.stringify(data);
		return h64ToString(dataString);
	};

	const jsonCache = async <T>(
		path: string,
		getData: () => Promise<T>,
	): Promise<T> => {
		const url = new URL(path, cacheDir);
		if (existsSync(url)) {
			return JSON.parse(await readFile(url, "utf-8"));
		}
		const data = await getData();
		await mkdir(dirname(fileURLToPath(url)), {
			recursive: true,
		});
		await writeFile(url, JSON.stringify(data, null, 2), "utf-8");
		return data;
	};

	const bufferCache = async (
		path: string,
		getData: () => Promise<Buffer>,
	): Promise<Buffer> => {
		const url = new URL(path, cacheDir);
		if (existsSync(url)) {
			return await readFile(url);
		}
		const data = await getData();
		await mkdir(dirname(fileURLToPath(url)), {
			recursive: true,
		});
		await writeFile(url, data);
		return data;
	};

	return { generateDigest, jsonCache, bufferCache };
};
