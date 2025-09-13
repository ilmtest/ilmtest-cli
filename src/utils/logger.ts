import pino from 'pino';
import pretty from 'pino-pretty';

const stream = pretty({ colorize: true, sync: true });
const logger = pino({ base: { hostname: undefined, pid: undefined }, level: process.env.LOG_LEVEL ?? 'info' }, stream);

export default logger;
