import { createLogger, format, transports, config as wconfig } from 'winston';
import { severity } from 'winston-gke-formatter';
import config from 'config';

const env = config.util.getEnv('NODE_ENV');
const jsonStringifyLog = ['test', 'production'].some(e => env.includes(e));

const { combine, timestamp, printf, splat } = format;

const errorStackFormat = format(info => {
  if (info.meta && info.meta instanceof Error) {
    info.message = `${info.message} ${info.meta.stack}`;
  }
  return info;
});

const logFormat = printf(info => {
  return `${info.timestamp} | ${info.level}: ${info.message}`;
});

/**
  https://github.com/winstonjs/winston#logging-levels

  NPM Log levels    
  error: 0, 
  warn: 1, 
  info: 2, 
  http: 3,
  verbose: 4, 
  debug: 5, 
  silly: 6 

  Winston levels
  emerg: 0, 
  alert: 1, 
  crit: 2, 
  error: 3, 
  warning: 4, 
  notice: 5, 
  info: 6, 
  debug: 7

  GKE severities
  DEFAULT	(0) The log entry has no assigned severity level.
  DEBUG	(100) Debug or trace information.
  INFO	(200) Routine information, such as ongoing status or performance.
  NOTICE	(300) Normal but significant events, such as start up, shut down, or a configuration change.
  WARNING	(400) Warning events might cause problems.
  ERROR	(500) Error events are likely to cause problems.
  CRITICAL	(600) Critical events cause more severe problems or outages.
  ALERT	(700) A person must take an action immediately.
  EMERGENCY	(800) One or more systems are unusable.

  We are using winston levels
*/
const logger = createLogger({
  levels: wconfig.syslog.levels,
  format: combine(
    splat(),
    errorStackFormat(),
    timestamp(),
    logFormat,
    severity(),
    ...(jsonStringifyLog ? [format.json()] : [])
  ),
  transports: [
    new transports.Console({
      level: config.get('logLevel')
    })
  ]
});

export const httpStream = {
  write: (message: string) => {
    logger.debug(message);
  }
};

export default logger;
