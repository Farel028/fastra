const isDev = __DEV__;

export const devLog = (...args: unknown[]): void => {
  if (!isDev) return;
  console.log(...args);
};

export const devWarn = (...args: unknown[]): void => {
  if (!isDev) return;
  console.warn(...args);
};

export const devError = (...args: unknown[]): void => {
  if (!isDev) return;
  console.error(...args);
};
