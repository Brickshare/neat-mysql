import { formatSQL, asQuery } from '@src/util';

const insertString = 'INSERT INTO a (id) VALUES (?)';
const queryString = 'SELECT * FROM a';
describe('formatSQL', () => {
  it(`should return escaped SQL statement`, () => {
    expect(formatSQL(insertString, ['b'])).toBe(`INSERT INTO a (id) VALUES ('b')`);
    expect(formatSQL(queryString)).toBe(queryString);
  });
});

describe('asQuery', () => {
  it(`should format string as query tuple`, () => {
    expect(asQuery(insertString)).toEqual([insertString]);
  });

  it(`should format query object as query tuple`, () => {
    expect(asQuery({ sql: insertString, values: ['b'] })).toEqual([insertString, ['b']]);
  });

  it(`should return query tuple as is`, () => {
    expect(asQuery([insertString, ['b']])).toEqual([insertString, ['b']]);
  });
});
