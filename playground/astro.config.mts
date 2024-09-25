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
					name: "Roboto",
					provider: "google",
				},
			],
		}),
		hmrIntegration({
			directory: createResolver(import.meta.url).resolve("../package/dist"),
		}),
	],
});
