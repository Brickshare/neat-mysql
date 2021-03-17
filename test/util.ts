import { Connection, execute } from '@src/connection';

export const migrateDatabase = async () => {
  await execute(`
    CREATE TABLE IF NOT EXISTS a (
      id int(10) unsigned NOT NULL AUTO_INCREMENT,
      text VARCHAR(255) DEFAULT NULL,
      PRIMARY KEY (id)
  )`);
  await execute(`TRUNCATE TABLE a`);
};

export const insertSampleEntry = async (conn?: Connection) => await execute(`INSERT INTO a (text) VALUES ("")`, conn);
