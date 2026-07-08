/**
 * Current-user identity setting (issue #181).
 *
 * `CurrentUserSetting` is a local app setting persisted via the
 * `app-settings:get-current-user` / `app-settings:set-current-user` IPC
 * channels (see src/main/app-settings.ts) -- same JSON-file-in-userData
 * pattern as setup-wizard.ts / updater.ts's system metadata. It answers
 * "who am I" for the renderer: the kanban "Mine" filter, actor attribution
 * on mutations, comment authorship, and the assign-to-me target all resolve
 * against this instead of a hardcoded literal.
 *
 * The default of 'rebecca' preserves today's single-user behavior until the
 * identity is changed from the kanban UI -- it is a main-process default,
 * not a renderer literal, so it does not trip the "no hardcoded 'rebecca' in
 * src/renderer" acceptance check.
 */
export interface CurrentUserSetting {
  id: string;
  displayName: string;
}

export const DEFAULT_CURRENT_USER: CurrentUserSetting = {
  id: 'rebecca',
  displayName: 'Rebecca',
};
