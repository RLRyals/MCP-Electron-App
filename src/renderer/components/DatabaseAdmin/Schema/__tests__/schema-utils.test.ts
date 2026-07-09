/**
 * Tests for schema-utils (Issue #129: Database Schema Explorer UI).
 *
 * parseQualifiedTableName is the single source of truth the whole Schema
 * Explorer family uses to decide which Postgres schema a table belongs to.
 * It must never assume "public" except as the documented fallback for a
 * bare (unqualified) name -- see the DB facts in the issue: the live
 * database has real tables living outside "public" (e.g. "fictionlab").
 */

import { parseQualifiedTableName } from '../schema-utils';

describe('parseQualifiedTableName', () => {
  it('splits a schema-qualified name into schema and short name', () => {
    expect(parseQualifiedTableName('fictionlab.workflow_definitions')).toEqual({
      dbSchema: 'fictionlab',
      shortName: 'workflow_definitions',
    });
  });

  it('defaults a bare (unqualified) name to the public schema', () => {
    expect(parseQualifiedTableName('authors')).toEqual({
      dbSchema: 'public',
      shortName: 'authors',
    });
  });

  it('only splits on the first dot (table names never contain dots)', () => {
    expect(parseQualifiedTableName('fictionlab.workflow_definitions')).toEqual({
      dbSchema: 'fictionlab',
      shortName: 'workflow_definitions',
    });
  });

  it('handles an empty string without throwing', () => {
    expect(parseQualifiedTableName('')).toEqual({ dbSchema: 'public', shortName: '' });
  });
});
