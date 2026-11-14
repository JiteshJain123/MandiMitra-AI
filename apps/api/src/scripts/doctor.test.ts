import { describe, expect, it } from 'vitest';
import { classifyMongoError, describeUri } from './doctor.js';

describe('doctor helpers', () => {
  it('describes a URI without exposing credentials', () => {
    const d = describeUri('mongodb+srv://someuser:S3cretPass@cluster0.abcde.mongodb.net/mandimitra?retryWrites=true&w=majority');
    expect(d).toEqual({ scheme: 'mongodb+srv', hasCredentials: true, database: 'mandimitra', passwordNeedsEncoding: false });
    expect(JSON.stringify(d)).not.toMatch(/someuser|S3cretPass|cluster0/);
  });

  it('flags a missing database name and an unencoded password', () => {
    expect(describeUri('mongodb+srv://u:p@host.mongodb.net/?retryWrites=true').database).toBeNull();
    expect(describeUri('mongodb+srv://u:p@host.mongodb.net').database).toBeNull();
    expect(describeUri('mongodb+srv://u:p@ss@host.mongodb.net/db').passwordNeedsEncoding).toBe(true);
    expect(describeUri('mongodb+srv://u:p%40ss@host.mongodb.net/db').passwordNeedsEncoding).toBe(false);
    expect(describeUri('postgres://x').scheme).toBe('invalid');
  });

  it('classifies connection errors without echoing the URI', () => {
    expect(classifyMongoError({ name: 'MongoServerError', message: 'bad auth : authentication failed', code: 8000 })).toMatch(/^AUTH_FAILED/);
    expect(classifyMongoError({ name: 'Error', message: 'querySrv ENOTFOUND _mongodb._tcp.cluster0.x.mongodb.net' })).toMatch(/^DNS_FAILED/);
    expect(classifyMongoError({ name: 'MongooseServerSelectionError', message: 'Could not connect to any servers in your MongoDB Atlas cluster' })).toMatch(/^UNREACHABLE/);
    const other = classifyMongoError({ name: 'WeirdError', message: 'mongodb+srv://u:secret@h/db exploded' });
    expect(other).toBe('OTHER: WeirdError');
  });
});
