/**
 * Helper types
 */
export type Beautify<T> = { [K in keyof T]: T[K] };
type FilterKeys<T> = { [K in keyof T]: T[K][] };
export type FilterType<T, P extends keyof T, AditonalFields extends { [k: string]: any } = {}> = Partial<
  FilterKeys<Pick<NonNullable<T>, P> & AditonalFields> & { limit?: number }
>;
export type UpdateType<T, AditonalFields extends { [k: string]: any } = {}> = Beautify<
  { id: number } & Partial<Omit<T, 'created_at' | 'id'> & AditonalFields>
>;
export type InsertType<T> = Omit<T, 'id'>;
export type SumFieldType<T, K extends keyof T> = K;

/**
 * Query
 */
export type JSONPrimitive = string | number | boolean | null;
export type JSONObject = { [member: string]: JSONValue };
export type JSONArray = Array<JSONValue>;
export type JSONValue = JSONPrimitive | JSONObject | JSONArray;

export type QueryArg = JSONPrimitive | Date | Buffer | ArrayBuffer | JSONValue | QueryArg[] | undefined;

export type Query = [string] | [string, QueryArg[]];
