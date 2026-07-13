#!/usr/bin/env bash
# Generates the release-info Pages site into _site/ from site/ templates,
# pulling release notes and the component version matrix live from GitHub.
#
# Dependency-free by design: only tools already present on GitHub-hosted
# ubuntu-latest runners (git, gh, jq, awk, sed) are used -- no npm packages,
# no build framework. Safe to run locally too (requires `gh auth login` and
# a git checkout with tags fetched).
#
# Usage: REPO=owner/name scripts/pages/generate.sh

set -euo pipefail

REPO="${REPO:-RLRyals/MCP-Electron-App}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/_site}"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

echo "Generating release-info site for $REPO into $OUT_DIR"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
cp -r "$ROOT_DIR/site/." "$OUT_DIR/"

# --- Fetch all releases (newest first, as returned by the API) ------------
gh api "repos/$REPO/releases" --paginate --jq '.[]' > "$WORK_DIR/releases.ndjson" || true

if [ ! -s "$WORK_DIR/releases.ndjson" ]; then
  echo "No releases found for $REPO yet; leaving placeholder content in place."
  exit 0
fi

jq -s '.' "$WORK_DIR/releases.ndjson" > "$WORK_DIR/releases.json"

# --- Landing page: current version banner ----------------------------------
CURRENT_VERSION=$(jq -r '.[0].tag_name // "unknown"' "$WORK_DIR/releases.json")
CURRENT_PUBLISHED=$(jq -r '.[0].published_at // "unknown"' "$WORK_DIR/releases.json")
sed -i \
  -e "s|<!--CURRENT_VERSION-->|${CURRENT_VERSION}|" \
  -e "s|<!--CURRENT_PUBLISHED-->|${CURRENT_PUBLISHED}|" \
  "$OUT_DIR/index.html"

# --- Release notes fragment -------------------------------------------------
jq -r '
  .[] |
  "<section class=\"release\">\n" +
  "<h3><a href=\"" + .html_url + "\">" + ((.name // .tag_name) | @html) + "</a> " +
  "<span class=\"tag\">" + (.tag_name | @html) + "</span></h3>\n" +
  "<p class=\"meta\">Published " + (.published_at // "unknown") +
  (if .prerelease then " &middot; pre-release" else "" end) + "</p>\n" +
  "<div class=\"release-body\">" +
  (((.body // "_No release notes provided._") | @html) | gsub("\r\n"; "\n") | gsub("\n"; "<br>\n")) +
  "</div>\n</section>"
' "$WORK_DIR/releases.json" > "$WORK_DIR/releases-fragment.html"

awk -v fragfile="$WORK_DIR/releases-fragment.html" '
  BEGIN {
    while ((getline line < fragfile) > 0) frag = frag line "\n"
  }
  /<!-- GENERATED:RELEASES:START -->/ { print; printf "%s", frag; skip = 1; next }
  /<!-- GENERATED:RELEASES:END -->/ { skip = 0 }
  skip != 1 { print }
' "$OUT_DIR/release-notes.html" > "$WORK_DIR/release-notes.html.tmp"
mv "$WORK_DIR/release-notes.html.tmp" "$OUT_DIR/release-notes.html"

# --- Component version matrix ----------------------------------------------
# For each released tag, read package.json + docker-compose.yml as they
# existed at that tag so the matrix reflects what actually shipped.
{
  echo "<table>"
  echo "<thead><tr><th>App version</th><th>Released</th><th>postgres image</th><th>pgbouncer image</th><th>mcp-connector base image</th></tr></thead>"
  echo "<tbody>"

  jq -r '.[].tag_name' "$WORK_DIR/releases.json" | tr -d '\r' | while IFS= read -r tag; do
    [ -z "$tag" ] && continue

    published=$(jq -r --arg t "$tag" '.[] | select(.tag_name == $t) | .published_at // "unknown"' "$WORK_DIR/releases.json")
    app_version=$(git -C "$ROOT_DIR" show "$tag:package.json" 2>/dev/null | jq -r '.version // "unknown"' || echo "unknown")
    compose=$(git -C "$ROOT_DIR" show "$tag:docker-compose.yml" 2>/dev/null || echo "")

    pg_image=$(printf '%s\n' "$compose" | grep -B1 'container_name: fictionlab-postgres' | grep 'image:' | awk '{print $2}')
    pgb_image=$(printf '%s\n' "$compose" | grep -B1 'container_name: fictionlab-pgbouncer' | grep 'image:' | awk '{print $2}')
    conn_image=$(printf '%s\n' "$compose" | grep -B1 'container_name: fictionlab-mcp-connector' | grep 'image:' | awk '{print $2}')

    printf '<tr><td><a href="https://github.com/%s/releases/tag/%s">%s</a></td><td>%s</td><td><code>%s</code></td><td><code>%s</code></td><td><code>%s</code></td></tr>\n' \
      "$REPO" "$tag" "$tag" "$published" \
      "${pg_image:-n/a}" "${pgb_image:-n/a}" "${conn_image:-n/a}"
  done

  echo "</tbody></table>"
} > "$WORK_DIR/matrix-fragment.html"

awk -v fragfile="$WORK_DIR/matrix-fragment.html" '
  BEGIN {
    while ((getline line < fragfile) > 0) frag = frag line "\n"
  }
  /<!-- GENERATED:MATRIX:START -->/ { print; printf "%s", frag; skip = 1; next }
  /<!-- GENERATED:MATRIX:END -->/ { skip = 0 }
  skip != 1 { print }
' "$OUT_DIR/components.html" > "$WORK_DIR/components.html.tmp"
mv "$WORK_DIR/components.html.tmp" "$OUT_DIR/components.html"

echo "Done. Site generated at $OUT_DIR"
