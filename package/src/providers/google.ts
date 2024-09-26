import { addLocalFallbacks, extractFontFaceData } from "../css.ts";
import type { FontProvider } from "../types.js";

const STYLE_MAP = {
	italic: "1",
	oblique: "1",
	normal: "0",
};

const USER_AGENTS = {
	woff2:
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
	ttf: "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.54.16 (KHTML, like Gecko) Version/5.1.4 Safari/534.54.16",
	// eot: 'Mozilla/5.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0)',
	// woff: 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0',
	// svg: 'Mozilla/4.0 (iPad; CPU OS 4_0_1 like Mac OS X) AppleWebKit/534.46 (KHTML, like Gecko) Version/4.1 Mobile/9A405 Safari/7534.48.3',
};

export const googleProvider = (): FontProvider => {
	let fonts: Array<{
		family: string;
		axes: Array<{ tag: string; min: number; max: number }>;
		fonts: Array<number>;
	}>;

	return {
		name: "google",
		// TODO: cache.set('fonts', fonts)
		setup: async () => {
			fonts = (
				await fetch("https://fonts.google.com/metadata/fonts").then((res) =>
					res.json(),
				)
			).familyMetadataList;
		},
		resolveFontFaces: async (fontFamily, options) => {
			const font = fonts.find((f) => f.family === fontFamily);
			if (!font) {
				throw new Error("not a google font family");
			}
			const styles = [
				...new Set(options.styles.map((i) => STYLE_MAP[i])),
			].sort();

			const variableWeight = font.axes.find((a) => a.tag === "wght");
			const weights = variableWeight
				? [`${variableWeight.min}..${variableWeight.max}`]
				: options.weights.filter((weight) => weight in font.fonts);

			if (
				weights.length === 0 ||
				styles.length === 0 ||
				options.subsets.length === 0
			) {
				return {
					fonts: [],
				};
			}

			const resolvedVariants = weights
				.flatMap((w) => [...styles].map((s) => `${s},${w}`))
				.sort();

			let css = "";

			const url = `https://fonts.googleapis.com/css2?family=${`${fontFamily}:ital,wght@${resolvedVariants.join(";")}&subset=${options.subsets.join(",")}`}`;
			for (const extension in USER_AGENTS) {
				css += await fetch(url, {
					headers: {
						"user-agent": USER_AGENTS[extension as keyof typeof USER_AGENTS],
					},
				}).then((res) => res.text());
			}

			const extracted = extractFontFaceData(css);
			const parsedFonts = addLocalFallbacks(fontFamily, extracted);

			return {
				fonts: parsedFonts,
			};
		},
	};
};
