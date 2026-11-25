import { describe, expect, it } from 'vitest';
import {
    PerformanceGovernor,
    nextPerformanceAdjustment,
    performancePreset,
    recommendPerformanceProfile,
} from '../src/performance.js';

describe('performance fallback', () => {
    it('starts on the full grid when the device gives no slow signals', () => {
        const profile = recommendPerformanceProfile({ hardwareConcurrency: 8 });
        expect(profile.tier).toBe('quality');
        expect(profile.gridSize).toBe(130);
        expect(profile.density).toBe(2);
    });

    it('starts lighter for few cores, low memory, data saver, or a small display', () => {
        expect(recommendPerformanceProfile({ hardwareConcurrency: 2 }).tier).toBe('performance');
        expect(recommendPerformanceProfile({ hardwareConcurrency: 2 }).gridSize).toBe(60);

        const memory = recommendPerformanceProfile({ hardwareConcurrency: 8, deviceMemory: 2 });
        expect(memory.tier).toBe('performance');
        expect(memory.reason).toContain('2 GB memory');

        expect(recommendPerformanceProfile({ hardwareConcurrency: 8, reducedMotion: true }).tier).toBe('performance');
        expect(recommendPerformanceProfile({ hardwareConcurrency: 8, saveData: true }).tier).toBe('performance');
        expect(recommendPerformanceProfile({ hardwareConcurrency: 8, narrowViewport: true }).tier).toBe('quality');
        expect(recommendPerformanceProfile({ hardwareConcurrency: 4, narrowViewport: true }).tier).toBe('performance');
    });

    it('steps density down, then the grid, then the frame stride', () => {
        const density = nextPerformanceAdjustment({ density: 4, gridSize: 130, frameStride: 1 });
        expect(density).toMatchObject({ density: 2, gridSize: 130, frameStride: 1, changed: true });

        const grid = nextPerformanceAdjustment({ density: 2, gridSize: 130, frameStride: 1 });
        expect(grid.changed).toBe(true);
        expect(grid.gridSize).toBeLessThan(130);
        expect(grid.gridSize).toBeGreaterThanOrEqual(50);

        const stride = nextPerformanceAdjustment({ density: 2, gridSize: 50, frameStride: 1 });
        expect(stride.frameStride).toBe(2);

        const done = nextPerformanceAdjustment({ density: 2, gridSize: 50, frameStride: 3 });
        expect(done.changed).toBe(false);
    });

    it('caps a manual low-power preset', () => {
        expect(performancePreset(130)).toEqual({ gridSize: 70, density: 2, frameStride: 1 });
        expect(performancePreset(60).gridSize).toBe(60);
    });

    it('asks for a reduction only after sustained slow frames', () => {
        const governor = new PerformanceGovernor();
        for (let i = 0; i < 80; i++) {
            expect(governor.noteFrame(8)).toBeNull();
        }
        expect(governor.noteFrame(80)).toBeNull();

        const slow = new PerformanceGovernor();
        let asked = 0;
        for (let i = 0; i < 200 && asked === 0; i++) {
            if (slow.noteFrame(40) === 'reduce') asked += 1;
        }
        expect(asked).toBe(1);
        expect(slow.reductions).toBe(1);
    });

    it('does not step down in quality mode', () => {
        const governor = new PerformanceGovernor();
        governor.setMode('quality');
        for (let i = 0; i < 120; i++) {
            expect(governor.noteFrame(100)).toBeNull();
        }
        expect(governor.reductions).toBe(0);
    });
});
