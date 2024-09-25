import type { AstroIntegration } from "astro";
import { addVirtualImports } from "astro-integration-kit";
import type { IntegrationOptions } from "./types.js";
import { generateFontFace } from "./css.ts";

const defaultValues = {
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
				for (const provider of options.providers) {
					await provider.setup?.();
				}

				let css = "";
				for (const family of options.families) {
					const provider = options.providers.find(
						(p) => p.name === family.provider,
					);
					if (!provider) {
						throw new Error("no matching provider");
					}
					const { fonts } = await provider.resolveFontFaces(
						family.name,
						{ ...defaultValues, ...family },
					);
					console.dir(fonts, { depth: null });

					for (const font of fonts) {
						css += `${generateFontFace(family.name, font as any)}\n`;
					}
					console.log(css);
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
		},
	};
};
