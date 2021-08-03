import { QueryArg, Query, QueryObject } from '@src/types';
import { Pool, PoolConnection, RowDataPacket, OkPacket, ResultSetHeader } from 'mysql2/promise';
import logger, { LogLevel } from '@src/logger';
import { asQuery, formatSQL } from './util';
import { BufferOptions, stringifyBufferValue, stringifyBufferValues } from './buffer';

export class Connection {
  conn: Pool | PoolConnection;
  public logLevel?: LogLevel;

  constructor(conn: Pool | PoolConnection, logLevel?: LogLevel) {
    this.conn = conn;
    this.logLevel = logLevel;
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
      logger(this.logLevel).error(`${err} - failing SQL: ${formatSQL(sql, args)}`);
      throw Error(err);
    }
  }

  private logSQL(sql: string, args: QueryArg[]) {
    logger(this.logLevel).debug(formatSQL(sql, args));
  }
}
