import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "wxt"

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
  autoIcons: {
    baseIconPath: "assets/logo.png",
    developmentIndicator: false,
  },
  manifest: {
    name: "Tabby",
    description: "Save your tabs into collections. Open source, local first, no account.",
    permissions: ["tabs", "tabGroups", "storage", "unlimitedStorage", "favicon"],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
})
