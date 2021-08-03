# neat-mysql

A library to query and manipulate MySQL in a neat way.

## Installation

### Add package

```
npm i neat-mysql
```

`neat-mysql` has typescript typings out of the box.

### Environment

The following env variables can be used to modify global behaviour:

```
NEAT_MYSQL_LOG_LEVEL // (default=INFO) controls logging output
NEAT_MYSQL_NULL_TO_UNDEFINED // (default=false) returns 'undefined' instead of 'null' from queries
```

## Usage

```
const dbConfig = {
  host: "localhost",
  port: 3306,
  database: "database",
  user: "root",
  password: "root"
};
const connector = connectToDatabase(dbConfig);
```

### Query

```
import { query } from 'neat-mysql';

interface Person {
  id: number;
  name: string;
}

...

async function findPerson(id: number): Promise<Person | undefined> {
  const person = await queryOne<Person>([`
    SELECT id, name FROM people WHERE id = ?
  `, [id]], await connector)
  return person;
}

async function findPeople(): Promise<Person[]> {
  const people = await query<Person>(`SELECT id, name FROM people`, await connector)
  return people;
}

```

### Execute

All executions return `ResultSetHeader` from `mysql2`, which is implemented by `neat-mysql`.

```
import { execute } from 'neat-mysql';

...

async function deletePerson(id: number) {
  const result = await execute([`
    DELETE FROM people WHERE id = ?
  `, [id]], await connector)
  return result;
}

```

### Transaction

```
import { transaction, Connection } from 'neat-mysql';

...

async function doLotsOfStuff(): Promise<Person[]> {
  return transaction((connection) => {
    await connection.execute([`
      DELETE FROM people WHERE id = ?
    `, [id]])

    const people = await connection.query<Person>([`SELECT id, name FROM people`])
    return people;
  }, await connector)
}

```

You can concatenate the connection of `transaction` with regular queries and executions by passing it as the second parameter:

```
// this version is equivalent to the above one
async function doLotsOfStuff(): Promise<Person[]> {
  return transaction((connection) => {
    await execute([`
      DELETE FROM people WHERE id = ?
    `, [id]], connection)

    const people = await query<Person>([`SELECT id, name FROM people`], connection)
    return people;
  }, await connector)
}

...

// this execution can be done on its own or inside a transaction if a connection is passed
async function deletePerson(id: number, connection?: Connection) {
  const result = await execute([`
    DELETE FROM people WHERE id = ?
  `, [id]], connection)
  return result;
}

```
