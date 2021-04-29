import { Query, QueryArg, QueryObject } from './types';
import sqlstring from 'sqlstring';

export const formatSQL = (sql: string, args: QueryArg[] = []): string =>
  sqlstring
    .format(sql, args)
    .split('\n')
    .filter(str => str)
    .map(str => str.trim())
    .join(' ');

export const asQuery = (query: Query | QueryObject | string): [string] | [string, QueryArg[]] => {
  if (typeof query === 'string') {
    return [query];
  }
  return Array.isArray(query) ? (query as Query) : [query.sql, query.values];
};

type Object = Record<string, any>;

export const deepConvertNullToUndefined = <T extends Object>(
  object: T | T[] | string | number | boolean | Date | null | undefined
) => {
  if (object === null) {
    return undefined;
  }

  if (Array.isArray(object)) {
    return object.map(value => (typeof value === 'object' ? deepConvertNullToUndefined(value) : value));
  }

  if (typeof object === 'object' && Object.keys(object).length) {
    return Object.entries(object).reduce(
      (acc, [key, value]) => ({
        ...acc,
        [key]: deepConvertNullToUndefined(value)
      }),
      {}
    );
  }

  return object;
};
