import { QueryArg } from './types';
import sqlstring from 'sqlstring';

export const formatSQL = (sql: string, args: QueryArg[] = []): string => sqlstring.format(sql, args);
