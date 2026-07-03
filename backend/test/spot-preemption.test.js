import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spotManager, SpotPreemptionError } from '../orchestrator/spot-manager.js';
import fetch from 'node-fetch';

vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

describe('SpotPreemptionManager', () => {
  let mockWorker1;
  let mockWorker2;

  beforeEach(() => {
    vi.useFakeTimers();
    spotManager.preempting = false;
    process.env.SELINA_INSTANCE_TYPE = 'spot';
    
    // Mock workers
    mockWorker1 = {
      name: 'worker-interactive',
      pause: vi.fn().mockResolvedValue(undefined),
    };
    mockWorker2 = {
      name: 'worker-background',
      pause: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    spotManager.reset();
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete process.env.SELINA_INSTANCE_TYPE;
  });

  it('should skip listener registration if instance type is not spot', () => {
    process.env.SELINA_INSTANCE_TYPE = 'on-demand';
    const initSpy = vi.spyOn(spotManager, 'startMetadataPolling');
    
    spotManager.initialize([mockWorker1]);
    
    expect(initSpy).not.toHaveBeenCalled();
  });

  it('should poll metadata and trigger cooperative pause if spot termination time is set', async () => {
    // Mock fetch to return AWS metadata spot termination warning
    fetch.mockResolvedValueOnce({
      status: 200,
      text: async () => '2026-05-17T12:00:00Z',
    });

    spotManager.initialize([mockWorker1, mockWorker2]);
    
    // Advance timers to trigger the first poll interval (10 seconds)
    await vi.advanceTimersByTimeAsync(10000);

    expect(fetch).toHaveBeenCalled();
    expect(spotManager.isPreempting()).toBe(true);
    
    // Check that workers were paused cooperatively
    expect(mockWorker1.pause).toHaveBeenCalledWith(true);
    expect(mockWorker2.pause).toHaveBeenCalledWith(true);
  });

  it('should throw SpotPreemptionError on cooperative worker checking if preemption is active', () => {
    spotManager.initialize([mockWorker1]);
    
    // Check preemption (false initially)
    expect(() => spotManager.checkPreemption()).not.toThrow();

    // Manually force preemption
    spotManager.preempting = true;

    // Check preemption (should throw now)
    expect(() => spotManager.checkPreemption()).toThrow(SpotPreemptionError);
  });
});
