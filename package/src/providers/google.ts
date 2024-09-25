import { extractFontFaceData } from "../css.ts";
import type { FontProvider } from "../types.js";

export const googleProvider = (): FontProvider => {
	// TODO: cache in dev
	let fonts: Array<{
		family: string;
		axes: Array<{ tag: string; min: number; max: number }>;
		fonts: Array<number>;
	}> = [];
	const styleMap = {
		italic: "1",
		oblique: "1",
		normal: "0",
	};
	const userAgents = {
		woff2:
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
		ttf: "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.54.16 (KHTML, like Gecko) Version/5.1.4 Safari/534.54.16",
		// eot: 'Mozilla/5.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0)',
		// woff: 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0',
		// svg: 'Mozilla/4.0 (iPad; CPU OS 4_0_1 like Mac OS X) AppleWebKit/534.46 (KHTML, like Gecko) Version/4.1 Mobile/9A405 Safari/7534.48.3',
	};

	return {
		name: "google",
		setup: async () => {
			fonts = (
				await fetch("https://fonts.google.com/metadata/fonts").then((res) =>
					res.json(),
				)
			).familyMetadataList;
		},
		// TODO: cache
		resolveFontFaces: async (family, variants) => {
			const font = fonts.find((f) => f.family === family);
			if (!font) {
				throw new Error("not a google font family");
			}
			const styles = [
				...new Set(variants.styles.map((i) => styleMap[i])),
			].sort();

			const variableWeight = font.axes.find((a) => a.tag === "wght");
			const weights = variableWeight
				? [`${variableWeight.min}..${variableWeight.max}`]
				: variants.weights.filter((weight) => weight in font.fonts);

			if (weights.length === 0 || styles.length === 0)
				return {
					fonts: [],
				};

			const resolvedVariants = weights
				.flatMap((w) => [...styles].map((s) => `${s},${w}`))
				.sort();

			let css = "";

			for (const extension in userAgents) {
				css += await fetch(
					`https://fonts.googleapis.com/css2?family=${encodeURIComponent(`${family}:ital,wght@${resolvedVariants.join(";")}`)}`,
					{
						headers: {
							"user-agent": userAgents[extension as keyof typeof userAgents],
						},
					},
				).then((res) => res.text());
			}

			return {
				fonts: extractFontFaceData(css),
			};
		},
	};
};
