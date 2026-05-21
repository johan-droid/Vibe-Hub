import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LandingPage from './LandingPage';

const navigateSpy = vi.fn();

let mockState = { user: null };
let mockSignals = {
  health: { ready: true },
  diagnostics: { ready: true, mode: 'local_docker_only' },
  skills: { graph: [{ domain: 'code' }, { domain: 'debug' }] },
  profile: { authenticated: false, user: null },
  loading: false,
  error: '',
  lastSyncedAt: new Date('2026-05-17T12:00:00Z'),
  refresh: vi.fn(),
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

vi.mock('../store/useStore', () => ({
  useStore: (selector) => selector(mockState),
}));

vi.mock('../hooks/useBackendSignals', () => ({
  flattenSkillGraph: (graph) => {
    if (Array.isArray(graph)) return graph;
    if (graph && typeof graph === 'object') return Object.values(graph);
    return [];
  },
  useBackendSignals: () => mockSignals,
}));

describe('LandingPage', () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    mockState = { user: null };
    mockSignals = {
      health: { ready: true },
      diagnostics: { ready: true, mode: 'local_docker_only' },
      skills: { graph: [{ domain: 'code' }, { domain: 'debug' }] },
      profile: { authenticated: false, user: null },
      loading: false,
      error: '',
      lastSyncedAt: new Date('2026-05-17T12:00:00Z'),
      refresh: vi.fn(),
    };
  });

  it('routes unauthenticated primary CTA to login', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByRole('button', { name: /start workspace/i })[0]);

    expect(navigateSpy).toHaveBeenCalledWith('/login');
    expect(screen.getAllByText(/backend ready/i).length).toBeGreaterThan(0);
  });

  it('routes authenticated primary CTA to dashboard', () => {
    mockState = { user: { id: 'user-1' } };
    mockSignals.profile = { authenticated: true, user: { id: 'user-1' } };

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByRole('button', { name: /open workspace/i })[0]);

    expect(navigateSpy).toHaveBeenCalledWith('/dashboard');
    expect(screen.getAllByText(/local docker only/i).length).toBeGreaterThan(0);
  });
});
