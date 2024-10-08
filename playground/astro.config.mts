import tailwind from "@astrojs/tailwind";
import { createResolver } from "astro-integration-kit";
import { hmrIntegration } from "astro-integration-kit/dev";
import { defineConfig } from "astro/config";

const {
	default: packageName,
	googleProvider,
	localProvider,
} = await import("package-name");

// https://astro.build/config
export default defineConfig({
	integrations: [
		tailwind(),
		packageName({
			providers: [
				googleProvider(),
				localProvider({ directories: ["./src/fonts/"] }),
			],
			families: [
				{
					name: "Inter",
					provider: "google",
					weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
					styles: ["normal"],
					subsets: ["latin"],
				},
				{
					name: "Lato",
					provider: "local",
					weights: [400],
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
