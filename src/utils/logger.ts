export const logger = {
  info: (message: string, ...args: any[]) => {
    console.info(`[INFO] ${new Date().toISOString()}: ${message}`, ...args);
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, error);
  },
};
