type Encoding = 'binary' | 'base64' | 'ascii' | 'utf8' | 'utf-8' | 'utf16le' | 'ucs2' | 'ucs-2' | 'latin1' | 'hex';
export type BufferOptions = {
  encoding?: Encoding;
  specific?: Record<string, Encoding>;
};

export const formatBuffer = (key: string, value: any, options: BufferOptions = {}) => {
  if (!Buffer.isBuffer(value)) {
    return value;
  }

  const { encoding = 'binary', specific = {} } = options;
  return value.toString(specific[key] || encoding);
};

export const stringifyBufferValue = <T>(entity: T, options: BufferOptions = {}) =>
  Object.entries(entity || {}).reduce((acc, [key, value]) => {
    const formatted = formatBuffer(key, value, options);
    return { ...acc, [key]: formatted };
  }, {} as T);

export const stringifyBufferValues = <T>(entities: T[], options: BufferOptions = {}) =>
  entities.map(entity => stringifyBufferValue(entity, options));
