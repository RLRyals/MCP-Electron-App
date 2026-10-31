/**
 * Restarting the MCP stack (`docker compose down` + `up`) kills the container
 * that Claude Code's stdio MCP entries `docker exec` into, and a stdio
 * transport cannot resume. Those sessions stay disconnected until the user
 * reconnects by hand (mea-af7).
 */
export const MCP_RECONNECT_NOTICE =
  'Claude Code sessions using the docker-exec stdio MCP entries (e.g. kanban, npe-unified) ' +
  'lost their connection when the containers restarted. In each open session run /mcp ' +
  'and reconnect those servers (or start a new session).';
