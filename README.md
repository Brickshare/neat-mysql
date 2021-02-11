# neat-mysql

A library to query and manipulate MySQL in a neat way.

## Installation

### Add package

```
npm i neat-mysql
```

`neat-mysql` has typescript typings out of the box.

### Environment

`neat-mysql` requires the following environment variables to work. Not providing these results in an exception at runtime (example values inserted).

```
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=database
DB_USERNAME=root
DB_PASSWORD=verysecretpassword
```

You can optionally provide the following variables to connect through an SSH tunnel (example values inserted):

```
SSH_HOST={some ip}
SSH_PORT=22
SSH_USER=user
SSH_PASSWORD=password
```

Logging level is controlled with an environment variable as well:

```
LOG_LEVEL=info // default
```

## Usage

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
  `, [id]])
  return person;
}

async function findPeople(): Promise<Person[]> {
  const people = await query<Person>([`SELECT id, name FROM people`])
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
  `, [id]])
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
  })
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
  })
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
