/**
 * Shared helpers for the Schema Explorer component family.
 * Kept in their own module (rather than living on SchemaExplorer.ts) so
 * TableDetails/RelationshipDiagram can use them without a circular import.
 */

/**
 * Split a (possibly) schema-qualified table name into its schema and short name.
 *
 * The MCP database-admin server's db_list_tables only qualifies tables that
 * live outside the "public" schema (e.g. "fictionlab.workflow_definitions");
 * bare names (e.g. "authors") are always "public". A bare name therefore
 * defaults to "public" here -- but that is reading the backend's own
 * convention, not assuming every table is public.
 */
export function parseQualifiedTableName(qualifiedName: string): { dbSchema: string; shortName: string } {
  const dotIndex = qualifiedName.indexOf('.');
  if (dotIndex === -1) {
    return { dbSchema: 'public', shortName: qualifiedName };
  }
  return { dbSchema: qualifiedName.substring(0, dotIndex), shortName: qualifiedName.substring(dotIndex + 1) };
}
