import type { AstroIntegration } from "astro";
import { addVirtualImports } from "astro-integration-kit";
import { findAll, parse, type Declaration } from "css-tree";

type Awaitable<T> = T | Promise<T>;

export interface RemoteFontSource {
	url: string;
	originalURL?: string;
	format?: string;
	tech?: string;
}

export interface LocalFontSource {
	name: string;
}

export type FontSource = string | LocalFontSource | RemoteFontSource;

export interface FontFaceData {
	src: FontSource | Array<FontSource>;
	/**
	 * The font-display descriptor.
	 * @default 'swap'
	 */
	display?: "auto" | "block" | "swap" | "fallback" | "optional";
	/** A font-weight value. */
	weight?: string | number | [number, number];
	/** A font-stretch value. */
	stretch?: string;
	/** A font-style value. */
	style?: string;
	/** The range of Unicode code points to be used from the font. */
	unicodeRange?: string | string[];
	/** Allows control over advanced typographic features in OpenType fonts. */
	featureSettings?: string;
	/** Allows low-level control over OpenType or TrueType font variations, by specifying the four letter axis names of the features to vary, along with their variation values. */
	variationSettings?: string;
}

interface NormalizedFontFaceData
	extends Omit<FontFaceData, "src" | "unicodeRange"> {
	src: Array<LocalFontSource | RemoteFontSource>;
	unicodeRange?: string[];
}

type Provider = {
	name: string;
	setup?: () => Awaitable<void>;
	resolveFontFaces: (
		family: string,
		variants: {
			weights: string[];
			styles: Array<"normal" | "italic" | "oblique">;
			subsets: string[];
			fallbacks: string[];
		},
	) => Awaitable<NormalizedFontFaceData[]>;
};

export const googleProvider = (): Provider => {
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

			if (weights.length === 0 || styles.length === 0) return [];

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

			return extractFontFaceData(css);
		},
	};
};

const extractableKeyMap: Record<string, keyof NormalizedFontFaceData> = {
	src: "src",
	"font-display": "display",
	"font-weight": "weight",
	"font-style": "style",
	"font-feature-settings": "featureSettings",
	"font-variations-settings": "variationSettings",
	"unicode-range": "unicodeRange",
};

const weightMap: Record<string, string> = {
	100: "Thin",
	200: "ExtraLight",
	300: "Light",
	400: "Regular",
	500: "Medium",
	600: "SemiBold",
	700: "Bold",
	800: "ExtraBold",
	900: "Black",
};

const styleMap: Record<string, string> = {
	italic: "Italic",
	oblique: "Oblique",
	normal: "",
};

export function extractFontFaceData(
	css: string,
	family?: string,
): NormalizedFontFaceData[] {
	const fontFaces: NormalizedFontFaceData[] = [];

	for (const node of findAll(
		parse(css),
		(node) => node.type === "Atrule" && node.name === "font-face",
	)) {
		if (node.type !== "Atrule" || node.name !== "font-face") {
			continue;
		}

		if (family) {
			const isCorrectFontFace = node.block?.children.some((child) => {
				if (child.type !== "Declaration" || child.property !== "font-family") {
					return false;
				}

				const value = extractCSSValue(child) as string | string[];
				const slug = family.toLowerCase();
				if (typeof value === "string" && value.toLowerCase() === slug) {
					return true;
				}
				if (
					Array.isArray(value) &&
					value.length > 0 &&
					value.some((v) => v.toLowerCase() === slug)
				) {
					return true;
				}
				return false;
			});

			// Don't extract font face data from this `@font-face` rule if it doesn't match the specified family
			if (!isCorrectFontFace) {
				continue;
			}
		}

		const data: Partial<NormalizedFontFaceData> = {};
		for (const child of node.block?.children || []) {
			if (child.type === "Declaration" && child.property in extractableKeyMap) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const value = extractCSSValue(child) as any;
				// biome-ignore lint/style/noNonNullAssertion: <explanation>
				data[extractableKeyMap[child.property]!] =
					child.property === "src" && !Array.isArray(value) ? [value] : value;
			}
		}
		fontFaces.push(data as NormalizedFontFaceData);
	}

	return mergeFontSources(fontFaces);
}

function processRawValue(value: string) {
	return value
		.split(",")
		.map((v) => v.trim().replace(/^(?<quote>['"])(.*)\k<quote>$/, "$2"));
}

function extractCSSValue(node: Declaration) {
	if (node.value.type === "Raw") {
		return processRawValue(node.value.value);
	}

	const values = [] as Array<
		string | number | RemoteFontSource | LocalFontSource
	>;
	let buffer = "";
	for (const child of node.value.children) {
		if (child.type === "Function") {
			if (child.name === "local" && child.children.first?.type === "String") {
				values.push({ name: child.children.first.value });
			}
			if (child.name === "format" && child.children.first?.type === "String") {
				(values.at(-1) as RemoteFontSource).format = child.children.first.value;
			}
			if (child.name === "tech" && child.children.first?.type === "String") {
				(values.at(-1) as RemoteFontSource).tech = child.children.first.value;
			}
		}
		if (child.type === "Url") {
			values.push({ url: child.value });
		}
		if (child.type === "Identifier") {
			buffer = buffer ? `${buffer} ${child.name}` : child.name;
		}
		if (child.type === "String") {
			values.push(child.value);
		}
		if (child.type === "Operator" && child.value === "," && buffer) {
			values.push(buffer);
			buffer = "";
		}
		if (child.type === "UnicodeRange") {
			values.push(child.value);
		}
		if (child.type === "Number") {
			values.push(Number(child.value));
		}
	}

	if (buffer) {
		values.push(buffer);
	}

	if (values.length === 1) {
		return values[0];
	}

	return values;
}

// https://developer.mozilla.org/en-US/docs/Web/CSS/font-family
/* A generic family name only */
const _genericCSSFamilies = [
	"serif",
	"sans-serif",
	"monospace",
	"cursive",
	"fantasy",
	"system-ui",
	"ui-serif",
	"ui-sans-serif",
	"ui-monospace",
	"ui-rounded",
	"emoji",
	"math",
	"fangsong",
] as const;
export type GenericCSSFamily = (typeof _genericCSSFamilies)[number];
const genericCSSFamilies = new Set(_genericCSSFamilies);

/* Global values */
const globalCSSValues = new Set([
	"inherit",
	"initial",
	"revert",
	"revert-layer",
	"unset",
]);

export function extractGeneric(node: Declaration) {
	if (node.value.type === "Raw") {
		return;
	}

	for (const child of node.value.children) {
		if (
			child.type === "Identifier" &&
			genericCSSFamilies.has(child.name as GenericCSSFamily)
		) {
			return child.name as GenericCSSFamily;
		}
	}
	return;
}

export function extractEndOfFirstChild(node: Declaration) {
	if (node.value.type === "Raw") {
		return;
	}
	for (const child of node.value.children) {
		if (child.type === "String") {
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			return child.loc!.end.offset!;
		}
		if (child.type === "Operator" && child.value === ",") {
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			return child.loc!.start.offset!;
		}
	}
	// biome-ignore lint/style/noNonNullAssertion: <explanation>
	return node.value.children.last!.loc!.end.offset!;
}

export function extractFontFamilies(node: Declaration) {
	if (node.value.type === "Raw") {
		return processRawValue(node.value.value);
	}

	const families = [] as string[];
	// Use buffer strategy to handle unquoted 'minified' font-family names
	let buffer = "";
	for (const child of node.value.children) {
		if (
			child.type === "Identifier" &&
			!genericCSSFamilies.has(child.name as GenericCSSFamily) &&
			!globalCSSValues.has(child.name)
		) {
			buffer = buffer ? `${buffer} ${child.name}` : child.name;
		}
		if (buffer && child.type === "Operator" && child.value === ",") {
			families.push(buffer.replace(/\\/g, ""));
			buffer = "";
		}
		if (buffer && child.type === "Dimension") {
			buffer = `${buffer} ${child.value}${child.unit}`.trim();
		}
		if (child.type === "String") {
			families.push(child.value);
		}
	}

	if (buffer) {
		families.push(buffer);
	}

	return families;
}

function mergeFontSources(data: NormalizedFontFaceData[]) {
	const mergedData: NormalizedFontFaceData[] = [];
	for (const face of data) {
		const keys = Object.keys(face).filter((k) => k !== "src") as Array<
			keyof typeof face
		>;
		const existing = mergedData.find(
			(f) =>
				Object.keys(f).length === keys.length + 1 &&
				keys.every((key) => f[key]?.toString() === face[key]?.toString()),
		);
		if (existing) {
			existing.src.push(...face.src);
		} else {
			mergedData.push(face);
		}
	}

	// Sort font sources by priority
	for (const face of mergedData) {
		face.src.sort((a, b) => {
			// Prioritise local fonts (with 'name' property) over remote fonts, and then formats by formatPriorityList
			const aIndex =
				"format" in a ? formatPriorityList.indexOf(a.format || "woff2") : -2;
			const bIndex =
				"format" in b ? formatPriorityList.indexOf(b.format || "woff2") : -2;
			return aIndex - bIndex;
		});
	}

	return mergedData;
}

const formatMap: Record<string, string> = {
	woff2: "woff2",
	woff: "woff",
	otf: "opentype",
	ttf: "truetype",
	eot: "embedded-opentype",
	svg: "svg",
};
export const formatPriorityList = Object.values(formatMap);

export function addLocalFallbacks(
	fontFamily: string,
	data: NormalizedFontFaceData[],
) {
	for (const face of data) {
		const style = (face.style ? styleMap[face.style] : "") ?? "";

		if (Array.isArray(face.weight)) {
			face.src.unshift({
				name: [fontFamily, "Variable", style].join(" ").trim(),
			});
		} else if (face.src[0] && !("name" in face.src[0])) {
			const weights = (Array.isArray(face.weight) ? face.weight : [face.weight])
				.map((weight) => weightMap[weight])
				.filter(Boolean);

			for (const weight of weights) {
				if (weight === "Regular") {
					face.src.unshift({ name: [fontFamily, style].join(" ").trim() });
				}
				face.src.unshift({
					name: [fontFamily, weight, style].join(" ").trim(),
				});
			}
		}
	}
	return data;
}

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

interface Options {
	providers: Array<Provider>;
	families: Array<{
		name: string;
		provider: string;
	}>;
}

export const integration = (options: Options): AstroIntegration => {
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
					const fonts = await provider.resolveFontFaces(
						family.name,
						defaultValues as any,
					);
					console.dir(fonts, { depth: null });

					for (const font of fonts) {
						css += `${generateFontFace(family.name, font)}\n`;
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

function generateFontFace(family: string, font: NormalizedFontFaceData) {
	return [
		"@font-face {",
		`  font-family: '${family}';`,
		`  src: ${renderFontSrc(font.src)};`,
		`  font-display: ${font.display || "swap"};`,
		font.unicodeRange && `  unicode-range: ${font.unicodeRange};`,
		font.weight &&
			`  font-weight: ${
				Array.isArray(font.weight) ? font.weight.join(" ") : font.weight
			};`,
		font.style && `  font-style: ${font.style};`,
		font.stretch && `  font-stretch: ${font.stretch};`,
		font.featureSettings && `  font-feature-settings: ${font.featureSettings};`,
		font.variationSettings &&
			`  font-variation-settings: ${font.variationSettings};`,
		"}",
	]
		.filter(Boolean)
		.join("\n");
}

function renderFontSrc(sources: Exclude<FontSource, string>[]) {
	return sources
		.map((src) => {
			if ("url" in src) {
				let rendered = `url("${src.url}")`;
				for (const key of ["format", "tech"] as const) {
					if (key in src) {
						rendered += ` ${key}(${src[key]})`;
					}
				}
				return rendered;
			}
			return `local("${src.name}")`;
		})
		.join(", ");
}
