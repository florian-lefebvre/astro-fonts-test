import type { AstroIntegration } from "astro";
import { addVirtualImports } from "astro-integration-kit";
import type { IntegrationOptions } from "./types.js";
import { generateFontFace } from "./css.ts";

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
					const result = await provider.resolveFontFaces(family.name, {
						weights: [...DEFAULT_VALUES.weights, ...(family.weights ?? [])],
						styles: [...DEFAULT_VALUES.styles, ...(family.styles ?? [])],
						subsets: [...DEFAULT_VALUES.subsets, ...(family.subsets ?? [])],
						fallbacks: [
							// TODO: handle
							// ...DEFAULT_VALUES.fallbacks,
							...(family.fallbacks ?? []),
						],
					});
					console.dir(result, { depth: null });

					for (const font of result.fonts) {
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

				// TODO: injectRoute to serve fonts
				// TODO: cache fonts
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
