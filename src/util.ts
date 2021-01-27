const SQL_PARAM_CHAR: string = '?';
export function createListOfSqlParams(count: number): string {
  return count < 0 ? '' : [...SQL_PARAM_CHAR.repeat(count)].join(',');
}
