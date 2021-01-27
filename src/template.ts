'use strict';
import { createListOfSqlParams } from '@src/util';
import { Query } from './types';
import zip from 'lodash.zip';

const getUniqueValues = (array: any[]) => (Array.isArray(array) ? [...new Set(array)] : array);

const argumentToParameters = (arg: any): string => {
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
      .flat();
    const combined = zip(strings, args).flat();
    this.statement = combined.reduce((statement: string, arg: any, index: number) => {
      if (!arg) {
        return statement;
      }
      if (arg instanceof SQLStatement) {
        return `${statement}${arg.statement}`;
      }
      return `${statement}${index % 2 === 0 ? arg : argumentToParameters(arg)}`;
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
