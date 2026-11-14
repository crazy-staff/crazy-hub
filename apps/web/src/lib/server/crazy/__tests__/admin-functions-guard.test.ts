import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Quackback's authorization matrix (policy/authz-matrix) only knows its own gates, so it lists our
 * admin server functions as ungated. They are gated by crazy-hub's permissions instead; this keeps it
 * that way: every server function in admin-functions.ts starts from one of our guards.
 */
const source = readFileSync(join(import.meta.dirname, '..', 'admin-functions.ts'), 'utf8')
const GUARDS = ['await guard(', 'getOptionalHubAccess()', 'claimOwnerForCaller()']

describe('admin server functions', () => {
  const functions = [...source.matchAll(/export const (\w+Fn) = createServerFn/g)].map((match) => ({
    name: match[1],
    body: source.slice(match.index, source.indexOf('\n})', match.index)),
  }))

  it('are found', () => {
    expect(functions.length).toBeGreaterThan(15)
  })

  it.each(functions.map((f) => [f.name, f.body]))('%s checks a crazy-hub permission', (_, body) => {
    expect(GUARDS.some((guard) => body.includes(guard))).toBe(true)
  })
})
