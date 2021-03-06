import { QueryArg, Query, QueryObject } from '@src/types';
import { Client } from 'ssh2';
import {
  createPool,
  PoolOptions,
  Pool,
  PoolConnection,
  RowDataPacket,
  OkPacket,
  ResultSetHeader
} from 'mysql2/promise';
import logger from '@src/logger';
import { asQuery, formatSQL } from './util';
import config from 'config';
import { BufferOptions, stringifyBufferValue, stringifyBufferValues } from './buffer';

const dbConfig = config.get<PoolOptions>('dbConfig');
type SSHConfig = { host: string; port: number; username: string; password: string };
const sshConfig = config.has('sshConfig') ? config.get<SSHConfig>('sshConfig') : null;

const poolOptions: PoolOptions = {
  ...dbConfig,
  waitForConnections: true,
  maxPreparedStatements: 20,
  queueLimit: 0,
  stringifyObjects: false,
  connectionLimit: sshConfig ? 1 : undefined
};

let pool: Pool | null = null;
export const getPool = async () => {
  if (!pool) {
    pool = (await connectToPool())[0];
  }
  return pool!;
};

export const createNewPool = (stream?: any) => {
  const pool = createPool({ ...poolOptions, stream });
  pool.on('connection', connection => connection.query('SET SESSION transaction_isolation="READ-COMMITTED"'));
  pool.on('enqueue', () => logger.debug('MySQL - Waiting for available connection slot'));
  pool.on('acquire', connection => logger.debug('Connection %d acquired', connection.threadId));
  pool.on('release', connection => logger.debug('Connection %d released', connection.threadId));
  return pool;
};

export const connectToPool = async (): Promise<[Pool, Client?]> => {
  if (!sshConfig) {
    return [createNewPool()];
  }

  const sshClient = new Client();
  const localhost = '127.0.0.1';

  return new Promise((resolve, reject) => {
    sshClient
      .on('ready', async () => {
        sshClient.forwardOut(localhost, 3306, dbConfig.host!, dbConfig.port!, async (err, stream) => {
          if (err) {
            reject(err);
          }
          resolve([createNewPool(stream), sshClient]);
        });
      })
      .connect(sshConfig);
  });
};

const getConnection = async (conn?: Connection) => conn || new Connection(await getPool());

/**
 * SELECT from database. The expected result will be an array of T (default RowDataPacket)
 * @param query
 * @param connection
 */
export const query = async <T extends { [key: string]: any } = RowDataPacket>(
  query: Query | QueryObject | string,
  conn?: Connection,
  bufferOptions: BufferOptions = {}
): Promise<T[]> => (await getConnection(conn)).query(query, bufferOptions);

/**
 * SELECT from database. The expected result will be an array of T (default RowDataPacket).
 * Errors if no results are found.
 * @param query
 * @param connection
 */
export const queryRequired = async <T extends { [key: string]: any } = RowDataPacket>(
  query: Query | QueryObject | string,
  conn?: Connection,
  errorMessage?: string,
  bufferOptions: BufferOptions = {}
): Promise<[T] & T[]> => (await getConnection(conn)).queryRequired(query, errorMessage, bufferOptions);

/**
 * SELECT one entity from database. The expected result will be an array of T (default RowDataPacket).
 * @param query
 * @param connection
 */
export const queryOne = async <T extends { [key: string]: any } = RowDataPacket>(
  query: Query | QueryObject | string,
  conn?: Connection,
  bufferOptions: BufferOptions = {}
): Promise<T | null> => {
  return await (await getConnection(conn)).queryOne<T>(query, bufferOptions);
};

/**
 * SELECT one entity from database. The expected result will be an array of T (default RowDataPacket).
 * Errors if no results are found.
 * @param query
 * @param connection
 */
export const queryOneRequired = async <T extends { [key: string]: any } = RowDataPacket>(
  query: Query | QueryObject | string,
  conn?: Connection,
  errorMessage?: string,
  bufferOptions: BufferOptions = {}
): Promise<T> => {
  return (await getConnection(conn)).queryOneRequired<T>(query, errorMessage, bufferOptions);
};

/**
 * Use execute when doing INSERT, UPDATE, DELETE or SET. The expected result will be a ResultSetHeader
 * @param query
 * @param connection
 */
export const execute = async (query: Query | QueryObject | string, conn?: Connection): Promise<ResultSetHeader> =>
  (await getConnection(conn)).execute(query);

/**
 * Starts or continues a transaction. Automatically rolls back changes if an error occurs.
 * @param func method to run during transaction
 * @param transActionConnection active transaction connection to use
 */
export const transaction = async <T>(
  func: (conn: Connection) => Promise<T>,
  transActionConnection?: Connection
): Promise<T> => {
  if (transActionConnection) {
    return func(transActionConnection);
  }
  const conn = await (await getPool()).getConnection();
  await conn.beginTransaction();
  try {
    const funcReturn = await func(new Connection(conn));
    await conn.commit();
    return funcReturn;
  } catch (err) {
    logger.error(err);
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

export class Connection {
  conn: Pool | PoolConnection;

  constructor(conn: Pool | PoolConnection) {
    this.conn = conn;
  }

  /**
   * Use query when doing SELECT. The expected result will be an array of RowDataPacket
   * @param query
   */
  public async query<T = RowDataPacket>(
    query: Query | QueryObject | string,
    bufferOptions: BufferOptions = {}
  ): Promise<T[]> {
    const [statement, args = []] = asQuery(query);
    this.logSQL(statement, args);
    const response = await this.exec(statement, args);
    if (!Array.isArray(response)) {
      throw Error(
        'Return type error. query() should only be used for SELECT. For INSERT, UPDATE, DELETE and SET use execute()'
      );
    }
    return stringifyBufferValues(response as T[], bufferOptions);
  }

  public async queryRequired<T = RowDataPacket>(
    query: Query | QueryObject | string,
    errorMessage?: string,
    bufferOptions: BufferOptions = {}
  ): Promise<[T] & T[]> {
    const result = await this.query(query, bufferOptions);
    if (!result?.length) {
      throw Error(errorMessage ?? `no results found for query ${JSON.stringify(asQuery(query))}`);
    }
    return stringifyBufferValues(result) as [T] & T[];
  }

  public async queryOne<T = RowDataPacket>(
    query: Query | QueryObject | string,
    bufferOptions: BufferOptions = {}
  ): Promise<T | null> {
    const [result] = await this.query(query);
    return result ? stringifyBufferValue(result as T, bufferOptions) : null;
  }

  public async queryOneRequired<T = RowDataPacket>(
    query: Query | QueryObject | string,
    errorMessage?: string,
    bufferOptions: BufferOptions = {}
  ): Promise<T> {
    const result = await this.queryOne(query, bufferOptions);
    if (!result) {
      throw Error(errorMessage ?? `no results found for query ${JSON.stringify(asQuery(query))}`);
    }
    return stringifyBufferValue(result as T);
  }

  /**
   * Use execute when doing INSERT, UPDATE or DELETE. The expected result will be a ResultSetHeader
   * @param query
   */
  public async execute(query: Query | QueryObject | string): Promise<ResultSetHeader> {
    const [statement, args = []] = asQuery(query);
    this.logSQL(statement, args);
    const response = await this.exec(statement, args);
    if (Array.isArray(response)) {
      throw Error(
        'Return type error. execute() should only be used for INSERT, UPDATE, DELETE and SET. For SELECT use query()'
      );
    }
    return response as ResultSetHeader;
  }

  /**
   *  Implementation of the mysql2 execute function conserving the return types.
   *
   *  Return definition
   *
   *  SELECT -> [result, columnDefinitions] result = Array
   *
   *  INSERT / UPDATE / DELETE -> [result] result = ResultSetHeader
   *
   * @param sql
   * @param args
   */
  public async exec(
    sql: string,
    args: QueryArg[]
  ): Promise<RowDataPacket[] | RowDataPacket[][] | OkPacket | OkPacket[] | ResultSetHeader> {
    try {
      const [response] = await this.conn.execute(sql, args);
      return response;
    } catch (err) {
      logger.error(`${err} - failing SQL: ${formatSQL(sql, args)}`);
      throw Error(err);
    }
  }

  private logSQL(sql: string, args: QueryArg[]) {
    logger.debug(formatSQL(sql, args));
  }
}
