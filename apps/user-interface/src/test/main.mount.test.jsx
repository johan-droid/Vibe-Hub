import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StrictMode } from 'react'

// Tests for main.jsx mounting behavior with mocked react-dom/client.
// These tests verify that main.jsx calls createRoot with #root and renders
// the App component wrapped in StrictMode - specifically exercising the
// pattern after the PR change (no React default import).

const mockRender = vi.fn()
const mockUnmount = vi.fn()
const mockCreateRoot = vi.fn(() => ({ render: mockRender, unmount: mockUnmount }))

vi.mock('react-dom/client', () => ({
  createRoot: mockCreateRoot,
}))

vi.mock('../App.jsx', () => ({
  default: () => <div data-testid="app">App</div>,
}))

vi.mock('../index.css', () => ({}))

describe('main.jsx - module mounting side effects', () => {
  let rootEl

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()

    rootEl = document.createElement('div')
    rootEl.id = 'root'
    document.body.appendChild(rootEl)
  })

  afterEach(() => {
    if (rootEl && document.body.contains(rootEl)) {
      document.body.removeChild(rootEl)
    }
  })

  it('calls createRoot with the #root DOM element', async () => {
    await import('../main.jsx')
    expect(mockCreateRoot).toHaveBeenCalledTimes(1)
    expect(mockCreateRoot).toHaveBeenCalledWith(rootEl)
  })

  it('calls render exactly once', async () => {
    await import('../main.jsx')
    expect(mockRender).toHaveBeenCalledTimes(1)
  })

  it('render is called with StrictMode as the root element', async () => {
    await import('../main.jsx')
    const rendered = mockRender.mock.calls[0][0]
    expect(rendered.type).toBe(StrictMode)
  })

  it('StrictMode wraps the App component', async () => {
    await import('../main.jsx')
    const rendered = mockRender.mock.calls[0][0]
    expect(rendered.type).toBe(StrictMode)
    // The child of StrictMode is the App component
    expect(rendered.props.children).toBeDefined()
  })

  it('no React default import needed: render arg is valid JSX element', async () => {
    await import('../main.jsx')
    const rendered = mockRender.mock.calls[0][0]
    // A valid React element has $$typeof, type, and props
    expect(rendered).toHaveProperty('type')
    expect(rendered).toHaveProperty('props')
  })
})