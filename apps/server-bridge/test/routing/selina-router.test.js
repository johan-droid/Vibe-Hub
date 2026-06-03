import { describe, expect, it } from 'vitest';
import { chooseModeFromTask } from '../../orchestrator/routing/selina-router.js';

describe('selina-router', () => {
  describe('chooseModeFromTask', () => {
    it('maps fix this bug to coding', () => {
      expect(chooseModeFromTask('please fix this bug in auth')).toBe('coding');
      expect(chooseModeFromTask('write test for component')).toBe('coding');
    });

    it('maps architecture analysis to reasoning', () => {
      expect(chooseModeFromTask('provide deep analysis of security')).toBe('reasoning');
      expect(chooseModeFromTask('threat model this design')).toBe('reasoning');
    });

    it('maps JSON to json_strict', () => {
      expect(chooseModeFromTask('return JSON for tool args')).toBe('json_strict');
    });

    it('maps smoke test to smoke_test', () => {
      expect(chooseModeFromTask('smoke test models')).toBe('smoke_test');
      expect(chooseModeFromTask('check model availability')).toBe('smoke_test');
    });

    it('maps normal text to fast', () => {
      expect(chooseModeFromTask('hello how are you')).toBe('fast');
      expect(chooseModeFromTask('')).toBe('fast');
      expect(chooseModeFromTask(null)).toBe('fast');
    });
  });
});
