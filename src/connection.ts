import { QueryArg, Query } from '@src/types';
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
import bluebird from 'bluebird';
import { formatSQL } from './util';
import config from 'config';

type QueryObject = { sql: string; values: QueryArg[] };
const asQuery = (query: Query | QueryObject | string): [string] | [string, QueryArg[]] => {
  if (typeof query === 'string') {
    return [query];
  }
  return Array.isArray(query) ? (query as Query) : [query.sql, query.values];
};

const dbConfig = config.get<PoolOptions>('dbConfig');
type SSHConfig = { host: string; port: number; username: string; password: string };
const sshConfig = config.has('sshConfig') ? config.get<SSHConfig>('sshConfig') : null;

const poolOptions: PoolOptions = {
  ...dbConfig,
  waitForConnections: true,
  maxPreparedStatements: 20,
  queueLimit: 0,
  stringifyObjects: false
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
  pool.on('enqueue', () => logger.warning('MySQL - Waiting for available connection slot'));
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
 * Use query when doing SELECT. The expected result will be an array of T (default RowDataPacket)
 * @param query
 * @param connection
 */
export const query = async <T extends { [key: string]: any } = RowDataPacket>(
  query: Query | QueryObject | string,
  conn?: Connection
): Promise<T[] | []> => (await getConnection(conn)).query(query);

export const queryOne = async <T extends { [key: string]: any } = RowDataPacket>(
  query: Query | QueryObject | string,
  conn?: Connection
): Promise<T | undefined> => {
  const [entity] = await (await getConnection(conn)).query<T>(query);
  return entity as T | undefined;
};

export const queryMany = async <T = RowDataPacket>(
  queries: (Query | QueryObject | string)[],
  conn?: Connection
): Promise<T[][] | [][]> => (await getConnection(conn)).queryMany<T>(queries);

/**
 * Use execute when doing INSERT, UPDATE, DELETE or SET. The expected result will be a ResultSetHeader
 * @param query
 * @param connection
 */
export const execute = async (query: Query | QueryObject | string, conn?: Connection): Promise<ResultSetHeader> =>
  (await getConnection(conn)).execute(query);

export const executeMany = async (
  queries: (Query | QueryObject | string)[],
  conn?: Connection
): Promise<ResultSetHeader[]> => (await getConnection(conn)).executeMany(queries);

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
  public async query<T = RowDataPacket>(query: Query | QueryObject | string): Promise<T[] | []> {
    const [statement, args = []] = asQuery(query);
    this.logSQL(statement, args);
    const response = await this.exec(statement, args);
    if (!Array.isArray(response)) {
      throw Error(
        'Return type error. query() should only be used for SELECT. For INSERT, UPDATE, DELETE and SET use execute()'
      );
    }
    return response as T[] | [];
  }

  public async queryOne<T = RowDataPacket>(query: Query | QueryObject | string): Promise<T | undefined> {
    const [result] = await this.query(query);
    return result as T | undefined;
  }

  public async queryMany<T = RowDataPacket>(queries: (Query | QueryObject | string)[]): Promise<T[][]> {
    return await bluebird.map(queries, query => this.query<T>(query), { concurrency: 50 });
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

  public async executeMany(queries: (Query | QueryObject | string)[]): Promise<ResultSetHeader[]> {
    return await bluebird.map(queries, query => this.execute(query), { concurrency: 50 });
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
