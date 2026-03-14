type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LEVELS: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 };
const envLevel = (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const shouldLog = (level: LogLevel) => LEVELS[level] <= LEVELS[envLevel];

export const error = (...args: any[]) => { if (shouldLog('error')) console.error(...args); };
export const warn = (...args: any[]) => { if (shouldLog('warn')) console.warn(...args); };
export const info = (...args: any[]) => { if (shouldLog('info')) console.log(...args); };
export const debug = (...args: any[]) => { if (shouldLog('debug')) console.debug(...args); };

export default { error, warn, info, debug };
