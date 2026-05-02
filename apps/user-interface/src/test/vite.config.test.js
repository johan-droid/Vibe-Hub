import { describe, it, expect, vi, beforeEach } from 'vitest'

// The key change in this PR: react({ jsxRuntime: 'automatic' }) -> react()
// The jsxRuntime: 'automatic' is the default, so removing it is a no-op cleanup.
// These tests verify the vite config structure after the change.

vi.mock('vite', () => ({
  defineConfig: vi.fn((config) => config),
}))

vi.mock('@vitejs/plugin-react', () => ({
  default: vi.fn((options) => ({ name: 'vite:react', _options: options ?? null })),
}))

vi.mock('vite-plugin-pwa', () => ({
  VitePWA: vi.fn((options) => ({ name: 'vite-plugin-pwa', _options: options })),
}))

describe('vite.config.js - react() plugin configuration', () => {
  let config
  let reactPlugin
  let VitePWAPlugin

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    config = (await import('../../vite.config.js')).default
    const reactMod = await import('@vitejs/plugin-react')
    const pwaMod = await import('vite-plugin-pwa')
    reactPlugin = reactMod.default
    VitePWAPlugin = pwaMod.VitePWA
  })

  it('exports a config object', () => {
    expect(config).toBeDefined()
    expect(typeof config).toBe('object')
  })

  it('includes a plugins array', () => {
    expect(Array.isArray(config.plugins)).toBe(true)
  })

  it('has exactly two plugins', () => {
    expect(config.plugins).toHaveLength(2)
  })

  it('react() is called without explicit jsxRuntime option (PR change)', () => {
    // The PR removed jsxRuntime: 'automatic' - the call is now react() with no args.
    // The mock records call arguments; verify react was called with no arguments.
    expect(reactPlugin).toHaveBeenCalledTimes(1)
    const callArgs = reactPlugin.mock.calls[0]
    // Called with no arguments: callArgs is empty array
    expect(callArgs.length).toBe(0)
  })

  it('react plugin is the first plugin in the array', () => {
    const firstPlugin = config.plugins[0]
    expect(firstPlugin.name).toBe('vite:react')
  })

  it('react plugin has no options (jsxRuntime removed)', () => {
    const firstPlugin = config.plugins[0]
    // _options is null when called with no arguments (from our mock)
    expect(firstPlugin._options).toBeNull()
  })

  it('VitePWA is configured with registerType: autoUpdate', () => {
    expect(VitePWAPlugin).toHaveBeenCalledTimes(1)
    expect(VitePWAPlugin).toHaveBeenCalledWith({ registerType: 'autoUpdate' })
  })

  it('VitePWA plugin is the second plugin in the array', () => {
    const secondPlugin = config.plugins[1]
    expect(secondPlugin.name).toBe('vite-plugin-pwa')
  })

  it('VitePWA plugin options are correct', () => {
    const secondPlugin = config.plugins[1]
    expect(secondPlugin._options).toEqual({ registerType: 'autoUpdate' })
  })
})

describe('vite.config.js - server configuration', () => {
  let config

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    config = (await import('../../vite.config.js')).default
  })

  it('has server configuration', () => {
    expect(config.server).toBeDefined()
  })

  it('configures /api proxy to localhost:3001', () => {
    expect(config.server.proxy['/api']).toBeDefined()
    expect(config.server.proxy['/api'].target).toBe('http://localhost:3001')
    expect(config.server.proxy['/api'].changeOrigin).toBe(true)
  })

  it('configures /health proxy to localhost:3001', () => {
    expect(config.server.proxy['/health']).toBeDefined()
    expect(config.server.proxy['/health'].target).toBe('http://localhost:3001')
    expect(config.server.proxy['/health'].changeOrigin).toBe(true)
  })

  it('sets Cross-Origin-Embedder-Policy header to require-corp', () => {
    expect(config.server.headers['Cross-Origin-Embedder-Policy']).toBe('require-corp')
  })

  it('sets Cross-Origin-Opener-Policy header to same-origin', () => {
    expect(config.server.headers['Cross-Origin-Opener-Policy']).toBe('same-origin')
  })

  it('has exactly two proxy entries', () => {
    const proxyKeys = Object.keys(config.server.proxy)
    expect(proxyKeys).toHaveLength(2)
    expect(proxyKeys).toContain('/api')
    expect(proxyKeys).toContain('/health')
  })

  it('has exactly two security headers', () => {
    const headerKeys = Object.keys(config.server.headers)
    expect(headerKeys).toHaveLength(2)
  })
})

describe('vite.config.js - react jsxRuntime default behavior', () => {
  // Regression tests: ensure the removed jsxRuntime option does not reappear

  it('react() is not called with jsxRuntime: automatic (option was removed in this PR)', async () => {
    vi.clearAllMocks()
    vi.resetModules()
    await import('../../vite.config.js')
    const reactMod = await import('@vitejs/plugin-react')
    const reactPlugin = reactMod.default
    const callArgs = reactPlugin.mock.calls[0]
    // Verify no argument was passed
    const firstArg = callArgs[0]
    expect(firstArg).toBeUndefined()
  })

  it('react() is not called with any options object containing jsxRuntime', async () => {
    vi.clearAllMocks()
    vi.resetModules()
    await import('../../vite.config.js')
    const reactMod = await import('@vitejs/plugin-react')
    const reactPlugin = reactMod.default
    const callArgs = reactPlugin.mock.calls[0]
    if (callArgs.length > 0 && callArgs[0] !== undefined) {
      expect(callArgs[0]).not.toHaveProperty('jsxRuntime')
    } else {
      // No args passed at all - this is the expected case
      expect(callArgs.length).toBe(0)
    }
  })
})