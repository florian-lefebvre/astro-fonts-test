import type { AstroIntegration } from "astro";
import { addVirtualImports } from "astro-integration-kit";
import type { FontFaceData, IntegrationOptions } from "./types.js";
import { generateFontFace } from "./css.ts";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deterministicString, shorthash } from "./hash.ts";

const DEFAULT_VALUES = {
	weights: [400],
	styles: ["normal", "italic"] as const,
	subsets: [
		"cyrillic-ext",
		"cyrillic",
		"greek-ext",
		"greek",
		"vietnamese",
		"latin-ext",
		"latin",
	],
	fallbacks: {
		serif: ["Times New Roman"],
		"sans-serif": ["Arial"],
		monospace: ["Courier New"],
		cursive: [],
		fantasy: [],
		"system-ui": [
			"BlinkMacSystemFont",
			"Segoe UI",
			"Roboto",
			"Helvetica Neue",
			"Arial",
		],
		"ui-serif": ["Times New Roman"],
		"ui-sans-serif": ["Arial"],
		"ui-monospace": ["Courier New"],
		"ui-rounded": [],
		emoji: [],
		math: [],
		fangsong: [],
	},
};

export const integration = (options: IntegrationOptions): AstroIntegration => {
	let hashes: Array<string>;

	return {
		name: "package-name",
		hooks: {
			"astro:config:setup": async (params) => {
				// Preload providers
				for (const provider of options.providers) {
					await provider.setup?.();
				}

				let css = "";
				for (const family of options.families) {
					// TODO: handle local images
					if (!("provider" in family)) {
						continue;
					}
					const provider = options.providers.find(
						(p) => p.name === family.provider,
					);
					if (!provider) {
						throw new Error(`No matching provider for "${family.provider}"`);
					}
					const fontFacesOptions = {
						weights: [...DEFAULT_VALUES.weights, ...(family.weights ?? [])],
						styles: [...DEFAULT_VALUES.styles, ...(family.styles ?? [])],
						subsets: [...DEFAULT_VALUES.subsets, ...(family.subsets ?? [])],
						fallbacks: [
							// TODO: handle
							// ...DEFAULT_VALUES.fallbacks,
							...(family.fallbacks ?? []),
						],
					};
					const hash = shorthash(
						deterministicString([
							provider.name,
							family.name,
							JSON.stringify(fontFacesOptions),
						]),
					);
					const metaUrl = new URL(
						`./fonts/meta/${hash}.json`,
						params.config.cacheDir,
					);
					let result: {
						fonts: FontFaceData[];
						fallbacks?: string[];
					};
					if (fs.existsSync(metaUrl)) {
						result = JSON.parse(fs.readFileSync(metaUrl, "utf-8"));
					} else {
						result = await provider.resolveFontFaces(
							family.name,
							fontFacesOptions,
						);
						fs.mkdirSync(path.dirname(fileURLToPath(metaUrl)), {
							recursive: true,
						});
						fs.writeFileSync(metaUrl, JSON.stringify(result, null, 2), "utf-8");
					}

					for (const font of result.fonts) {
						const allUrls: Array<string> = (() => {
							if (Array.isArray(font.src)) {
								return font.src.flatMap((src) => {
									if (typeof src === "string") {
										return [src];
									}
									if ("name" in src) {
										return [];
									}
									return [src.url];
								});
							}
							if (typeof font.src === "string") {
								return [font.src];
							}
							if ("name" in font.src) {
								return [];
							}
							return [font.src.url];
						})();
						for (const originalURL of allUrls) {
							const dataUrl = new URL(
								`./fonts/data/${shorthash(deterministicString([originalURL]))}.${path.extname(originalURL)}`,
								params.config.cacheDir,
							);
							if (!fs.existsSync(dataUrl)) {
								fs.mkdirSync(path.dirname(fileURLToPath(dataUrl)), {
									recursive: true,
								});
								fs.writeFileSync(
									dataUrl,
									Buffer.from(
										await fetch(originalURL).then((res) => res.arrayBuffer()),
									),
								);
							}
						}
						// console.log(font.src);
						css += `${generateFontFace(family.name, font)}\n`;
					}
					// console.log(css);
				}
				addVirtualImports(params, {
					name: "package-name",
					imports: [
						{
							id: "virtual:package-name.css",
							content: css,
							context: "server",
						},
					],
				});
			},
			"astro:server:setup": (params) => {
				const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;
				params.server.middlewares.use("/_fonts", async (req, res, next) => {
					if (!req.url) {
						return next();
					}
					const filename = req.url.slice(1);
					const hash = hashes.find((hash) => hash === filename);
					if (!hash) {
						return next();
					}
					const key = `data:fonts:${filename}`;
					let storageRes = await storage.getItemRaw(key);
					if (!storageRes) {
						storageRes = await fetch(hash)
							.then((r) => r.arrayBuffer())
							.then((r) => Buffer.from(r));
						await storage.setItemRaw(key, storageRes);
					}
					res.setHeader("Cache-Control", `max-age=${ONE_YEAR_IN_SECONDS}`);
					res.end(storageRes);
				});
			},
		},
	};
};

/*
register providers
register font families
download font file to cachedir
generate css => pass to virtual module
optional preload
fallback

<Fonts preload="roboto" />
<Fonts preload={["roboto"]} />

*/
