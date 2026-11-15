// Loads the manifold-3d geometry kernel (WebAssembly) from web/vendor/manifold.
const VENDOR = new URL('../vendor/manifold/', import.meta.url);

export async function loadKernel() {
  const [mod, wasm] = await Promise.all([
    import(new URL('manifold.js', VENDOR).href),
    fetch(new URL('manifold.wasm', VENDOR)).then((res) => {
      if (!res.ok) throw new Error(`manifold.wasm: HTTP ${res.status}`);
      return res.arrayBuffer();
    }),
  ]);
  const kernel = await mod.default({ wasmBinary: new Uint8Array(wasm) });
  kernel.setup();
  return kernel;
}
