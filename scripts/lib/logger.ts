export function createLogger(label: string) {
  const start = performance.now();

  function elapsed(): string {
    return ((performance.now() - start) / 1000).toFixed(1);
  }

  return {
    info(msg: string) {
      console.log(`[${elapsed()}s] [${label}] ${msg}`);
    },
    step(msg: string) {
      console.log(`[${elapsed()}s] [${label}]   -> ${msg}`);
    },
  };
}
