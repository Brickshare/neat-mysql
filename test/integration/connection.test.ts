import { execute, query, queryOne, queryOneRequired, queryRequired, transaction } from '@src/connection';
import { insertSampleEntry, migrateDatabase } from '@test/util';

beforeEach(async () => {
  await migrateDatabase();
});

const sampleEntry = { id: 1, text: '' };

describe('query', () => {
  it(`should execute a query on the database`, async () => {
    const result = await query(`SELECT * FROM a`);
    expect(result).toEqual([]);
  });

  it(`should throw error if not used for querying`, async () => {
    await expect(query(`DELETE FROM a`)).rejects.toThrowError();
  });

  it(`should throw error for invalid SQL`, async () => {
    await expect(execute(`SELECT`)).rejects.toThrowError();
  });

  it(`should return array of objects from the database`, async () => {
    await insertSampleEntry();
    const result = await query(`SELECT * FROM a`);
    expect(result).toEqual([sampleEntry]);
  });
});

describe('queryRequired', () => {
  it(`should throw error if nothing is found`, async () => {
    await expect(queryRequired(`SELECT * FROM a`)).rejects.toThrowError();
  });

  it(`should return array of objects from the database`, async () => {
    await insertSampleEntry();
    const result = await queryRequired(`SELECT * FROM a`);
    expect(result).toEqual([sampleEntry]);
  });
});

describe('queryOne', () => {
  it(`should execute a query on the database`, async () => {
    const result = await queryOne(`SELECT * FROM a`);
    expect(result).toEqual(null);
  });

  it(`should return object from the database`, async () => {
    await insertSampleEntry();
    const result = await queryOne(`SELECT * FROM a`);
    expect(result).toEqual(sampleEntry);
  });
});

describe('queryOneRequired', () => {
  it(`should throw error if nothing is found`, async () => {
    await expect(queryOneRequired(`SELECT * FROM a`)).rejects.toThrowError();
  });

  it(`should return object from the database`, async () => {
    await insertSampleEntry();
    const result = await queryOneRequired(`SELECT * FROM a`);
    expect(result).toEqual(sampleEntry);
  });
});

describe('execute', () => {
  it(`should execute command`, async () => {
    await insertSampleEntry();
    await execute(`DELETE FROM a`);
    expect((await query(`SELECT * FROM a`)).length).toBe(0);
  });

  it(`should throw error for invalid SQL`, async () => {
    await expect(execute(`DELETE`)).rejects.toThrowError();
  });

  it(`should throw error if used for querying`, async () => {
    await expect(execute(`SELECT * FROM a`)).rejects.toThrowError();
  });
});

describe('transaction', () => {
  it(`should execute commands in a transaction`, async () => {
    await transaction(async conn => {
      await insertSampleEntry(conn);
      await conn.execute(`DELETE FROM a`);
    });
    expect(await query(`SELECT * FROM a`)).toEqual([]);
  });

  it(`should roll back if an error occurs`, async () => {
    await insertSampleEntry();
    try {
      await transaction(async conn => {
        await conn.execute(`DELETE FROM a`);
        throw Error();
      });
    } catch (error) {}
    expect(await query(`SELECT * FROM a`)).toEqual([sampleEntry]);
  });

  it(`should concatenate multiple transactions in succession`, async () => {
    await transaction(async conn1 => {
      await insertSampleEntry(conn1);
      await conn1.execute(`DELETE FROM a`);
      await transaction(async conn2 => {
        await insertSampleEntry(conn2);
      }, conn1);
    });
    expect(await query(`SELECT * FROM a`)).toEqual([{ ...sampleEntry, id: 2 }]);
  });
});
