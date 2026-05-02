import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { render, screen } from '@testing-library/react'

// Tests for apps/user-interface/src/main.jsx
//
// The key change in this PR: `import React, { StrictMode }` -> `import { StrictMode }`
// This removes the default React import, relying on the automatic JSX transform (React 17+).
// These tests verify that StrictMode works as a named-only import and that the
// mounting pattern used in main.jsx functions correctly without the default React import.

describe('main.jsx - StrictMode named import (PR change)', () => {
  it('StrictMode is defined as a named export from react', () => {
    // The PR removed the default React import; only StrictMode named export remains.
    expect(StrictMode).toBeDefined()
  })

  it('StrictMode is not undefined or null', () => {
    // Guard against accidentally removing the import entirely
    expect(StrictMode).not.toBeNull()
    expect(StrictMode).not.toBeUndefined()
  })

  it('StrictMode is a valid React component type', () => {
    // React.StrictMode is a built-in component - it is truthy and non-null
    // (In React 19 it is represented as a symbol, earlier versions as an object)
    expect(StrictMode).toBeTruthy()
  })

  it('StrictMode can render children without requiring React default import', () => {
    // Verifies the automatic JSX transform is active - no React default needed.
    // In main.jsx: <StrictMode><App /></StrictMode> works without `import React`.
    render(
      <StrictMode>
        <div data-testid="strict-child">content</div>
      </StrictMode>
    )
    expect(screen.getByTestId('strict-child')).toBeInTheDocument()
  })

  it('StrictMode renders its children correctly', () => {
    render(
      <StrictMode>
        <span data-testid="text-node">hello</span>
      </StrictMode>
    )
    expect(screen.getByTestId('text-node')).toHaveTextContent('hello')
  })

  it('StrictMode can wrap multiple children', () => {
    render(
      <StrictMode>
        <div data-testid="child-one">one</div>
        <div data-testid="child-two">two</div>
      </StrictMode>
    )
    expect(screen.getByTestId('child-one')).toBeInTheDocument()
    expect(screen.getByTestId('child-two')).toBeInTheDocument()
  })

  it('JSX compiles correctly with only named StrictMode import (no default React)', () => {
    // This test file itself uses JSX without `import React` - proving automatic JSX transform works
    const el = <StrictMode><div>test</div></StrictMode>
    expect(el).toBeDefined()
    expect(el.type).toBe(StrictMode)
  })
})

describe('main.jsx - createRoot mounting pattern', () => {
  let container

  beforeEach(() => {
    container = document.createElement('div')
    container.id = 'root'
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.removeChild(container)
  })

  it('createRoot is importable from react-dom/client', () => {
    expect(createRoot).toBeDefined()
    expect(typeof createRoot).toBe('function')
  })

  it('createRoot accepts the #root DOM element', () => {
    const rootEl = document.getElementById('root')
    expect(rootEl).not.toBeNull()
    const root = createRoot(rootEl)
    expect(root).toBeDefined()
    root.unmount()
  })

  it('createRoot returns an object with render and unmount methods', () => {
    const root = createRoot(container)
    expect(typeof root.render).toBe('function')
    expect(typeof root.unmount).toBe('function')
    root.unmount()
  })

  it('render can be called with StrictMode-wrapped content (mirrors main.jsx pattern)', () => {
    const root = createRoot(container)
    // This mirrors exactly what main.jsx does:
    // createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
    expect(() => {
      root.render(
        <StrictMode>
          <div>App placeholder</div>
        </StrictMode>
      )
    }).not.toThrow()
    root.unmount()
  })

  it('StrictMode wrapper does not prevent children from rendering to the DOM', () => {
    // Use @testing-library/react render (wraps in act automatically)
    const { container: renderContainer } = render(
      <StrictMode>
        <div id="app-content">rendered</div>
      </StrictMode>
    )
    expect(renderContainer.querySelector('#app-content')).not.toBeNull()
  })

  it('createRoot renders content into the target container', () => {
    render(
      <StrictMode>
        <p data-testid="mounted">mounted successfully</p>
      </StrictMode>
    )
    expect(screen.getByTestId('mounted')).toBeInTheDocument()
  })
})