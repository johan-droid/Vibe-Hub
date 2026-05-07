import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const handlers = [
  http.get('*/api/auth/status', () => HttpResponse.json({
    success: true,
    authenticated: false,
    user: null,
  })),
  http.post('*/api/auth/refresh', () => HttpResponse.json({
    success: true,
    authenticated: true,
  })),
  http.get('*/api/v6/mcp/diagnostics', () => HttpResponse.json({
    success: true,
    status: 'healthy',
    toolCount: 0,
    servers: [],
    registeredTools: [],
    recentFailures: [],
  })),
  http.get('*/api/v6/runtime/diagnostics', () => HttpResponse.json({
    success: true,
    ready: true,
    mode: 'local_docker_only',
  })),
  http.get('*/api/v6/runtime/skills', () => HttpResponse.json({
    success: true,
    skills: [],
  })),
  http.get('*/api/v6/preferences', () => HttpResponse.json({
    success: true,
    data: {
      workflow: {
        experienceMode: 'professional',
        autonomyLevel: 2,
      },
    },
  })),
];

export const server = setupServer(...handlers);
