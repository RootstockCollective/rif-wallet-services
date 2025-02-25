export {}
declare global {
  interface Storage {
    setItem(key: string, value: string): void;
    getItem(key: string): string | null;
    removeItem(key: string): void;
    clear(): void;
    length: number;
    key(index: number): string | null;
  }
}
