import { createListOfSqlParams } from '@src/util';
import 'jest';

describe('createListOfSqlParams', () => {
  it(`should return a number of '?' characters`, () => {
    expect(createListOfSqlParams(5)).toBe('?,?,?,?,?');
  });
});
