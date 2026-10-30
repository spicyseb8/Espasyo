import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const previewDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: previewDirectory,
  server: {
    fs: {
      allow: [path.resolve(previewDirectory, "../..")],
    },
  },
});
