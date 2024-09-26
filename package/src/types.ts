export type Awaitable<T> = T | Promise<T>;

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
	display?: "auto" | "block" | "swap" | "fallback" | "optional";
	weight?: string | number | [number, number];
	stretch?: string;
	style?: string;
	unicodeRange?: string[];
	featureSettings?: string;
	variationSettings?: string;
}

export interface NormalizedFontFaceData extends Omit<FontFaceData, "src"> {
	src: Array<LocalFontSource | RemoteFontSource>;
}

export interface ResolveFontFacesOptions {
	weights: number[];
	styles: Array<"normal" | "italic" | "oblique">;
	// TODO: improve support and support unicode range
	subsets: string[];
	// fallbacks: string[];
}

export interface FontProvider {
	name: string;
	setup?: () => Awaitable<void>;
	resolveFontFaces: (
		fontFamily: string,
		options: ResolveFontFacesOptions,
	) => Awaitable<{
		fonts: FontFaceData[];
	}>;
}

export interface IntegrationOptions {
	families: Array<FontFamily>;
	// defaults?: Partial<{
	// 	preload: boolean;
	// 	weights: Array<string | number>;
	// 	styles: ResolveFontFacesOptions["styles"];
	// 	subsets: ResolveFontFacesOptions["subsets"];
	// 	fallbacks?: Partial<Record<GenericCSSFamily, string[]>>;
	// }>;
	providers: Array<FontProvider>;
}

export type FontFamily = {
	name: string;
	// display?: "auto" | "block" | "swap" | "fallback" | "optional";
	// stretch?: string;
	// unicodeRange?: string | string[];
	// featureSettings?: string;
	// variationSettings?: string;
} & ResolveFontFacesOptions & {
		provider: string;
	};
