/**
 * Common utility function to get ALM access token from session storage
 * @returns {string|null} The access token from session storage, or null if not found
 */
export function getAlmAccessToken() {
  return sessionStorage.getItem('alm_access_token');
}
