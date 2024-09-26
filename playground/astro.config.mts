import tailwind from "@astrojs/tailwind";
import { createResolver } from "astro-integration-kit";
import { hmrIntegration } from "astro-integration-kit/dev";
import { defineConfig } from "astro/config";

const { default: packageName, googleProvider } = await import("package-name");

// https://astro.build/config
export default defineConfig({
	integrations: [
		tailwind(),
		packageName({
			providers: [googleProvider()],
			families: [
				{
					name: "DM Sans",
					provider: "google",
					weights: [400, 500],
					styles: ["normal"],
					subsets: ["latin"],
				},
			],
		}),
		hmrIntegration({
			directory: createResolver(import.meta.url).resolve("../package/dist"),
		}),
	],
});
