// Global type declarations for the Chrome extension

interface EthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

interface Window {
  ethereum: EthereumProvider;
  __polyoxSwitchResult: { success?: boolean; error?: string } | null;
  __polyoxSignResult: { signature?: string; error?: string } | null;
}
