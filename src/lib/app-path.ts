/** Next Link/router add basePath themselves; use this for fetch, assets and absolute URLs. */
export const APP_BASE_PATH = '/shop';

export function appPath(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Expected an application path');
  return path === APP_BASE_PATH || path.startsWith(APP_BASE_PATH + '/') || path.startsWith(APP_BASE_PATH + '?')
    ? path : APP_BASE_PATH + path;
}
