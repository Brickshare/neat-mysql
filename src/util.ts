const SQL_PARAM_CHAR: string = '?';
export function createListOfSqlParams(count: number): string {
  return count < 0 ? '' : [...SQL_PARAM_CHAR.repeat(count)].join(',');
}

export const filterAndMap = <T, S>(array: T[], filter: (e: T) => boolean, mapper: (e: T) => S) =>
  array.reduce((acc, current) => (filter(current) ? [...acc, mapper(current)] : acc), [] as S[]);
