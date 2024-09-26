import type { AstroIntegration } from "astro";
import { addVirtualImports } from "astro-integration-kit";
import type { FontFaceData, IntegrationOptions } from "./types.js";
import { generateFontFace } from "./css.ts";
import { createCache } from "./cache.ts";
import { extname } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

function extractFontSrc(
	font: Pick<FontFaceData, "src">,
	generateDigest: (data: string) => string,
): Array<{ hash: string; url: string }> {
	if (typeof font.src === "string") {
		const url = font.src;
		const hash = generateDigest(url);
		font.src = `/_fonts/${hash}`;
		return [
			{
				hash,
				url,
			},
		];
	}

	if ("name" in font.src) {
		return [];
	}

	if ("url" in font.src) {
		const url = font.src.url;
		const hash = generateDigest(url);
		font.src.url = `/_fonts/${hash}`;
		return [
			{
				hash,
				url,
			},
		];
	}

	// TODO: check if it works
	return font.src.flatMap((src) => extractFontSrc({ src }, generateDigest));
}

export const integration = (options: IntegrationOptions): AstroIntegration => {
	const hashes = new Map<string, string>();
	let getFont: (hash: string, url: string) => Promise<Buffer>;

	return {
		name: "package-name",
		hooks: {
			"astro:config:setup": async (params) => {
				const { generateDigest, jsonCache, bufferCache } = await createCache(
					params.config.cacheDir,
					params.logger,
				);

				getFont = (hash, url) =>
					bufferCache(`./fonts/meta/${hash}.${extname(url)}`, async () => {
						return await fetch(url)
							.then((res) => res.arrayBuffer())
							.then((res) => Buffer.from(res));
					});

				const collectFonts = (fonts: Array<FontFaceData>) => {
					const extracted: Array<{ hash: string; url: string }> = fonts.flatMap(
						(font) => extractFontSrc(font, generateDigest),
					);
					const deduplicated = extracted.reduce(
						(acc, current) => {
							if (!acc.some((item) => item.hash === current.hash)) {
								acc.push(current);
							}
							return acc;
						},
						[] as Array<{ hash: string; url: string }>,
					);
					for (const { hash, url } of deduplicated) {
						hashes.set(hash, url);
					}
				};

				// Preload providers
				for (const provider of options.providers) {
					await provider.setup?.();
				}

				const css: Record<string, string> = {};

				for (const family of options.families) {
					// TODO: handle local images
					const provider = options.providers.find(
						(p) => p.name === family.provider,
					);
					if (!provider) {
						throw new Error(`No matching provider for "${family.provider}"`);
					}
					const fontFacesOptions = {
						weights: family.weights,
						styles: family.styles,
						subsets: family.subsets,
					};
					const result = await jsonCache(
						`./fonts/meta/${generateDigest({
							provider: provider.name,
							fontFamily: family.name,
							weights: fontFacesOptions.weights,
							styles: fontFacesOptions.styles,
							subsets: fontFacesOptions.subsets,
						} satisfies Record<
							keyof typeof fontFacesOptions | (string & {}),
							// biome-ignore lint/suspicious/noExplicitAny: <explanation>
							any
						>)}.json`,
						async () =>
							await provider.resolveFontFaces(family.name, fontFacesOptions),
					);

					collectFonts(result.fonts);

					for (const font of result.fonts) {
						css[family.name] = generateFontFace(family.name, font);
					}
					// console.log(css);
				}
				addVirtualImports(params, {
					name: "package-name",
					imports: [
						{
							id: "virtual:package-name/css",
							content: `export const css = ${JSON.stringify(css)}`,
							context: "server",
						},
					],
				});
			},
			"astro:server:setup": async (params) => {
				const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;
				params.server.middlewares.use("/_fonts", async (req, res, next) => {
					if (!req.url) {
						return next();
					}
					const hash = req.url.slice(1);
					const url = hashes.get(hash);
					if (!url) {
						return next();
					}
					const data = await getFont(hash, url);
					res.setHeader("Cache-Control", `max-age=${ONE_YEAR_IN_SECONDS}`);
					res.end(data);
				});
			},
			"astro:build:done": async (params) => {
				const fontsDir = new URL("./_fonts/", params.dir);
				await mkdir(fileURLToPath(fontsDir), { recursive: true });
				for (const [hash, url] of hashes.entries()) {
					const data = await getFont(hash, url);
					const outputUrl = new URL(`./${hash}.${extname(url)}`, fontsDir);
					await writeFile(outputUrl, data);
				}
			},
		},
	};
};
