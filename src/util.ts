import { Query, QueryArg, QueryObject } from './types';
import sqlstring from 'sqlstring';

export const formatSQL = (sql: string, args: QueryArg[] = []): string => sqlstring.format(sql, args);

export const asQuery = (query: Query | QueryObject | string): [string] | [string, QueryArg[]] => {
  if (typeof query === 'string') {
    return [query];
  }
  return Array.isArray(query) ? (query as Query) : [query.sql, query.values];
};
