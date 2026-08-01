declare module "*.wasm" {
  const wasmBinary: Uint8Array;
  export default wasmBinary;
}
