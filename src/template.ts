'use strict';
import { createListOfSqlParams } from '@src/util';
import { Query } from './types';
import zip from 'lodash.zip';

const getUniqueValues = (array: any[]) => (Array.isArray(array) ? [...new Set(array)] : array);

const argumentToParameters = (arg: any): string => {
  if (!arg) {
    return '';
  }
  if (Array.isArray(arg)) {
    return `(${createListOfSqlParams(arg.length)})`;
  }
  if (typeof arg === 'object') {
    return '?';
  }
  return '?';
};

class SQLStatement {
  private statement: string = '';
  private arguments: any[] = [];

  constructor(strings: string[], args: any[]) {
    this.arguments = args
      .map(getUniqueValues)
      .reduce((acc, arg) => [...acc, ...(arg instanceof SQLStatement ? arg.values : [arg])], [])
      .flat()
      .map(value => String(value));
    const combined = zip(strings, args);
    this.statement = combined.reduce((statement: string, [s, a]: any) => {
      return `${statement}${s}${a instanceof SQLStatement ? a.statement : argumentToParameters(a)}`;
    }, '');
  }

  public asTuple(): Query {
    return [this.statement, this.arguments];
  }

  public get sql() {
    return this.statement;
  }
  public get values() {
    return this.arguments;
  }
  public set values(value: any) {
    this.arguments = value;
  }
}

const SQL = (template: TemplateStringsArray, ...args: any[]): SQLStatement => {
  return new SQLStatement(Array.from(template), args);
};
export default SQL;
