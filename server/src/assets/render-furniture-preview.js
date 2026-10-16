import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const threeDirectory = path.resolve(currentDirectory, "..", "..", "node_modules", "three");
const previewSize = 512;

const rendererHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }
      body { background: #f4f3f0; }
      canvas { display: block; width: 100%; height: 100%; }
    </style>
    <script type="importmap">
      { "imports": { "three": "/three/build/three.module.js" } }
    </script>
  </head>
  <body>
    <script type="module">
      import * as THREE from "three";
      import { GLTFLoader } from "/three/examples/jsm/loaders/GLTFLoader.js";

      window.renderFurnitureGLB = async () => {
        const response = await fetch("/model.glb");
        if (!response.ok) throw new Error("Unable to read the uploaded GLB.");
        const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), "/");

        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#f4f3f0");
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
        renderer.setPixelRatio(1);
        renderer.setSize(${previewSize}, ${previewSize});
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        document.body.appendChild(renderer.domElement);

        const modelRoot = new THREE.Group();
        modelRoot.add(gltf.scene);
        scene.add(modelRoot);
        modelRoot.updateWorldMatrix(true, true);
        const bounds = new THREE.Box3().setFromObject(modelRoot);
        if (bounds.isEmpty()) throw new Error("The GLB contains no renderable geometry.");

        const center = bounds.getCenter(new THREE.Vector3());
        modelRoot.position.sub(center);
        modelRoot.updateWorldMatrix(true, true);
        const sphere = bounds.getBoundingSphere(new THREE.Sphere());
        if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) {
          throw new Error("The GLB has invalid model dimensions.");
        }

        scene.add(new THREE.HemisphereLight(0xffffff, 0x77716a, 2.1));
        const keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
        keyLight.position.set(4, 7, 6);
        scene.add(keyLight);
        const fillLight = new THREE.DirectionalLight(0xffffff, 1.5);
        fillLight.position.set(-5, 3, -4);
        scene.add(fillLight);

        const camera = new THREE.PerspectiveCamera(35, 1, 0.01, Math.max(1000, sphere.radius * 100));
        const viewDirection = new THREE.Vector3(1.35, 1.05, 1.6).normalize();
        const distance = sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.28;
        camera.position.copy(viewDirection.multiplyScalar(distance));
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
        const png = renderer.domElement.toDataURL("image/png");

        modelRoot.traverse((object) => {
          if (!object.isMesh) return;
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            for (const value of Object.values(material)) {
              if (value?.isTexture) value.dispose();
            }
            material?.dispose();
          }
        });
        renderer.dispose();
        renderer.forceContextLoss();
        return png;
      };
    </script>
  </body>
</html>`;

async function startRendererServer() {
  let currentModel = null;

  const server = createServer(async (request, response) => {
    const requestPath = new URL(request.url ?? "/", "http://127.0.0.1").pathname;

    if (requestPath === "/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(rendererHtml);
      return;
    }

    if (requestPath === "/model.glb" && currentModel) {
      response.writeHead(200, {
        "content-type": "model/gltf-binary",
        "content-length": currentModel.length,
      });
      response.end(currentModel);
      return;
    }

    if (requestPath.startsWith("/three/")) {
      const assetPath = path.resolve(threeDirectory, `.${requestPath.slice(6)}`);
      if (!assetPath.startsWith(`${threeDirectory}${path.sep}`)) {
        response.writeHead(400).end();
        return;
      }

      try {
        const contents = await readFile(assetPath);
        response.writeHead(200, {
          "content-type": "text/javascript; charset=utf-8",
          "content-length": contents.length,
        });
        response.end(contents);
      } catch (error) {
        console.error("Failed to serve Three.js renderer module:", error);
        response.writeHead(404).end();
      }
      return;
    }

    response.writeHead(404).end();
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  return {
    server,
    setModel(buffer) {
      currentModel = buffer;
    },
    url: `http://127.0.0.1:${server.address().port}/`,
  };
}

export async function createFurniturePreviewRenderer() {
  const localServer = await startRendererServer();
  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--enable-webgl",
        "--enable-unsafe-swiftshader",
      ],
    });
  } catch (error) {
    await new Promise((resolve) => localServer.server.close(resolve));
    throw new Error(
      `Unable to start Chromium for GLB preview rendering. Install it with "npx playwright install chromium". ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return {
    async render(glbBuffer) {
      const page = await browser.newPage({
        viewport: { width: previewSize, height: previewSize },
        deviceScaleFactor: 1,
      });
      let pageError = null;
      page.on("pageerror", (error) => {
        pageError = error.message;
      });
      page.setDefaultTimeout(120_000);
      localServer.setModel(glbBuffer);

      try {
        await page.goto(localServer.url, { waitUntil: "networkidle" });
        await page.waitForFunction(
          () => typeof window.renderFurnitureGLB === "function"
        );
        const dataUrl = await page.evaluate(() => window.renderFurnitureGLB());
        const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
        if (!match) {
          throw new Error("The GLB renderer did not return a PNG image.");
        }
        return Buffer.from(match[1], "base64");
      } catch (error) {
        throw new Error(
          `Failed to render furniture GLB: ${pageError || (error instanceof Error ? error.message : String(error))}`
        );
      } finally {
        await page.close();
        localServer.setModel(null);
      }
    },
    async close() {
      await browser.close();
      await new Promise((resolve, reject) => {
        localServer.server.close((error) => error ? reject(error) : resolve());
      });
    },
  };
}
