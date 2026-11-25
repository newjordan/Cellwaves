/**
 * Startup tier and runtime step-down for machines that cannot hold 60fps.
 * Pure functions so the policy can be tested without a browser.
 */

export const QUALITY_GRID = 130;
export const PERFORMANCE_GRID = 60;
export const GRID_FLOOR = 50;
export const DENSITY_FLOOR = 2;
export const MAX_FRAME_STRIDE = 3;

/**
 * Read the signals this page uses to decide a starting resolution.
 * Missing APIs (deviceMemory, matchMedia) are treated as "unknown", not slow.
 */
export function readDeviceSignals(nav = globalThis.navigator, win = globalThis.window) {
    let reducedMotion = false;
    let narrowViewport = false;

    if (win && typeof win.matchMedia === 'function') {
        reducedMotion = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
        narrowViewport = win.matchMedia('(max-width: 720px)').matches;
    }

    const connection = nav && nav.connection;
    return {
        hardwareConcurrency: nav && nav.hardwareConcurrency,
        deviceMemory: nav && nav.deviceMemory,
        saveData: Boolean(connection && connection.saveData),
        reducedMotion,
        narrowViewport,
    };
}

/**
 * @param {object} signals
 * @returns {{ tier: 'quality' | 'performance', gridSize: number, density: number, reason: string }}
 */
export function recommendPerformanceProfile(signals = {}) {
    const cores = Number.isFinite(signals.hardwareConcurrency) ? signals.hardwareConcurrency : 8;
    const memory = Number.isFinite(signals.deviceMemory) ? signals.deviceMemory : null;
    const reasons = [];

    if (signals.reducedMotion) reasons.push('reduced motion');
    if (signals.saveData) reasons.push('data saver');
    if (cores <= 2) reasons.push(`${cores} CPU cores`);
    if (memory !== null && memory <= 2) reasons.push(`${memory} GB memory`);
    if (signals.narrowViewport && cores <= 4) reasons.push('small display');

    if (reasons.length === 0) {
        return {
            tier: 'quality',
            gridSize: QUALITY_GRID,
            density: DENSITY_FLOOR,
            reason: '',
        };
    }

    return {
        tier: 'performance',
        gridSize: PERFORMANCE_GRID,
        density: DENSITY_FLOOR,
        reason: `Started in a lighter mode (${reasons.join(', ')}).`,
    };
}

/**
 * Manual "Low power" preset. Caps the grid without forcing the stride fallback.
 */
export function performancePreset(currentGrid) {
    const capped = Math.min(currentGrid, 70);
    const gridSize = Math.max(40, Math.round(capped / 5) * 5);
    return { gridSize, density: DENSITY_FLOOR, frameStride: 1 };
}

/**
 * One step of the runtime fallback. Density first, then grid, then frame stride.
 * @param {{ density: number, gridSize: number, frameStride?: number }} state
 */
export function nextPerformanceAdjustment(state) {
    const density = state.density;
    const gridSize = state.gridSize;
    const frameStride = state.frameStride ?? 1;

    if (density > DENSITY_FLOOR) {
        return {
            density: DENSITY_FLOOR,
            gridSize,
            frameStride,
            changed: true,
            summary: 'Visual density was lowered to 2.',
        };
    }

    if (gridSize > GRID_FLOOR) {
        const next = Math.max(GRID_FLOOR, Math.round((gridSize * 0.6) / 10) * 10);
        if (next < gridSize) {
            return {
                density,
                gridSize: next,
                frameStride,
                changed: true,
                summary: `Grid was reduced to ${next}×${next}.`,
            };
        }
    }

    if (frameStride < MAX_FRAME_STRIDE) {
        const nextStride = frameStride + 1;
        return {
            density,
            gridSize,
            frameStride: nextStride,
            changed: true,
            summary: `Simulation now steps every ${nextStride} frames.`,
        };
    }

    return { density, gridSize, frameStride, changed: false, summary: '' };
}

/**
 * Watches frame time and asks the app to step down after a sustained miss.
 * Quality mode never steps down. A short spike does not count.
 */
export class PerformanceGovernor {
    constructor() {
        this.mode = 'auto';
        this.reductions = 0;
        this.maxReductions = 3;
        this.samples = 0;
        this.slowFrames = 0;
        this.warmup = 30;
        this.slowBudgetMs = 34;
        this.slowFramesNeeded = 24;
    }

    setMode(mode) {
        this.mode = mode;
        this.samples = 0;
        this.slowFrames = 0;
    }

    /**
     * @param {number} frameMs
     * @returns {'reduce' | null}
     */
    noteFrame(frameMs) {
        if (this.mode === 'quality') return null;
        if (this.reductions >= this.maxReductions) return null;

        this.samples += 1;
        if (this.samples <= this.warmup) return null;

        if (frameMs > this.slowBudgetMs) this.slowFrames += 1;
        else this.slowFrames = Math.max(0, this.slowFrames - 1);

        if (this.slowFrames >= this.slowFramesNeeded) {
            this.samples = 0;
            this.slowFrames = 0;
            this.reductions += 1;
            return 'reduce';
        }

        return null;
    }
}
