declare module 'hunspell-asm/dist/esm/lib/browser/hunspell.js' {
  const runtime: (module: unknown) => unknown
  export default runtime
}
declare module 'emscripten-wasm-loader' {
  export const mountBuffer: (fs: unknown, dir: string) => (files: Uint8Array, name: string) => string
  export const getModuleLoader: <T>(
    factory: (runtime: any) => T, runtime: unknown, module?: Record<string, unknown>, options?: { timeout?: number },
  ) => () => Promise<T>
}
