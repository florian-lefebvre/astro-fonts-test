/// <reference types="astro/client" />

declare module "virtual:package-name/data" {
	export const css: Record<string, string>;
	export const hashes: Record<string, { fontFamily: string; url: string; }>;
}
