/**
 * id.js — Utility for generating unique IDs.
 *
 * Used whenever a new subject, topic, note, block, or PDF is created.
 * In production this could be replaced with crypto.randomUUID().
 */

/**
 * Generates a short random alphanumeric ID (7 chars).
 * Collision probability is negligible for local state sizes.
 *
 * @returns {string} e.g. 'k3m8xpq'
 */
export const uid = () => Math.random().toString(36).slice(2, 9)
