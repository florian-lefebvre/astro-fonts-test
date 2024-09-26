import { glob } from "tinyglobby";
import type { FontFaceData, FontProvider, FontSource } from "../types.js";
import { fileURLToPath, pathToFileURL } from "node:url";
import { basename, extname } from "node:path";

interface Options {
	directories: Array<string>;
}

export const localProvider = ({ directories }: Options): FontProvider => {
	let fontPaths: Array<string>;

	return {
		name: "local",
		setup: async (config) => {
			fontPaths = await Promise.all(
				directories.map((directory) =>
					glob(["**/*.{ttf,woff,woff2,eot,otf}"], {
						absolute: true,
						cwd: fileURLToPath(new URL(directory, config.root)),
					}),
				),
			).then((r) => r.flat().map((p) => pathToFileURL(p).href));
		},
		resolveFontFaces: async (fontFamily, options) => {
			const fonts: FontFaceData[] = [];

			for (const weight of options.weights) {
				for (const style of options.styles) {
					const src: Array<FontSource> = fontPaths
						.filter((p) => basename(p, extname(p)).includes(fontFamily))
						.map((url) => ({
							url,
							format: extname(url).slice(1),
						}));
					if (src.length > 0) {
						fonts.push({
							src,
							weight,
							style,
						});
					}
				}
			}

			return {
				fonts,
			};
		},
	};
};
