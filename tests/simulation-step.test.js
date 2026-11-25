import { describe, expect, it } from 'vitest';
import { CellWaveSimulator } from '../src/cellwave-simulator.js';

function zero(sim) {
    for (let y = 0; y < sim.gridSize; y++) {
        for (let x = 0; x < sim.gridSize; x++) {
            sim.velocity.velX[y][x] = 0;
            sim.velocity.velY[y][x] = 0;
        }
    }
}

function makeSim(gridSize, { hex = false, advection = 0, diffusion = 0 } = {}) {
    const sim = new CellWaveSimulator(40, 2);
    sim.setGridSize(gridSize);
    sim.setGridType(hex);
    sim.advection = advection;
    sim.diffusion = diffusion;
    sim.noiseLayers = [];
    sim.currents = [];
    sim.emitters = [];
    sim.occluders = [];
    zero(sim);
    return sim;
}

function expectFinite(sim) {
    for (let y = 0; y < sim.gridSize; y++) {
        for (let x = 0; x < sim.gridSize; x++) {
            expect(Number.isFinite(sim.velocity.velX[y][x])).toBe(true);
            expect(Number.isFinite(sim.velocity.velY[y][x])).toBe(true);
        }
    }
}

describe('simulation step', () => {
    it('keeps the matrix shape and a quiet field quiet', () => {
        const sim = makeSim(12);
        sim.updateFlow();

        expect(sim.velocity.velX).toHaveLength(12);
        expect(sim.velocity.velX[0]).toHaveLength(12);
        expect(sim.velocity.velY).toHaveLength(12);
        expect(sim.velocity.velX[6][6]).toBe(0);
        expect(sim.velocity.velY[6][6]).toBe(0);
        expect(sim.noiseTime).toBeCloseTo(sim.timeStep);
    });

    it('advects velocity one cell downstream on a square grid', () => {
        const sim = makeSim(8, { advection: 1 });
        for (let y = 0; y < sim.gridSize; y++) {
            for (let x = 0; x < sim.gridSize; x++) {
                sim.velocity.velX[y][x] = 1;
                sim.velocity.velY[y][x] = 0;
            }
            sim.velocity.velX[y][2] = 4;
        }

        sim.updateFlow();

        expect(sim.velocity.velX[4][3]).toBeCloseTo(4);
        expect(sim.velocity.velX[4][2]).toBeCloseTo(1);
        expect(sim.velocity.velY[4][3]).toBeCloseTo(0);
    });

    it('spreads a spike to square-grid neighbors and clears the source when advection is off', () => {
        const sim = makeSim(10, { diffusion: 0.5 });
        sim.velocity.velX[4][4] = 8;
        expect(sim.getNeighbors(4, 4)).toHaveLength(8);

        sim.updateFlow();

        // Eight neighbors, one of them holding 8: average 1, times diffusion 0.5.
        expect(sim.velocity.velX[4][5]).toBeCloseTo(0.5);
        expect(sim.velocity.velX[5][5]).toBeCloseTo(0.5);
        expect(sim.velocity.velX[4][4]).toBeCloseTo(0);
    });

    it('applies the hexagonal laplacian to an interior cell', () => {
        const sim = makeSim(8, { hex: true, diffusion: 0.2 });
        sim.velocity.velX[3][3] = 3;
        const neighbors = sim.getNeighbors(3, 3);
        expect(neighbors).toHaveLength(6);

        sim.updateFlow();

        const weight = (2 / 3) / (sim.cellSize * sim.cellSize);
        const expected = (0 - neighbors.length * 3) * weight * sim.diffusion;
        expect(sim.velocity.velX[3][3]).toBeCloseTo(expected);
        expect(sim.velocity.velX[3][3]).toBeLessThan(0);
    });

    it('zeros every cell inside an occluder', () => {
        const sim = makeSim(10, { advection: 1 });
        for (let y = 0; y < sim.gridSize; y++) {
            for (let x = 0; x < sim.gridSize; x++) {
                sim.velocity.velX[y][x] = 5;
            }
        }
        sim.addOccluder({ type: 'rect', x0: 2, y0: 2, x1: 4, y1: 4 });

        sim.updateFlow();

        expect(sim.velocity.velX[3][3]).toBe(0);
        expect(sim.velocity.velY[3][3]).toBe(0);
        expect(sim.velocity.velX[8][8]).toBeCloseTo(5);
    });

    it('pushes velocity along an emitter and leaves cells outside the cone alone', () => {
        const sim = makeSim(10);
        sim.addEmitter({
            x: 2,
            y: 2,
            angle: 0,
            strength: 2,
            length: 4,
            spread: 1.5,
            taper: 1,
            speed: 1,
            curve: 0,
        });

        sim.updateFlow();

        expect(sim.velocity.velX[2][2]).toBeCloseTo(2);
        expect(sim.velocity.velX[2][4]).toBeCloseTo(1);
        expect(sim.velocity.velY[2][4]).toBeCloseTo(0);
        expect(sim.velocity.velX[2][0]).toBe(0);
        expect(sim.velocity.velX[4][4]).toBe(0);
    });

    it('pushes velocity along a current segment', () => {
        const sim = makeSim(10);
        sim.addCurrent({
            start: { x: 1, y: 3 },
            end: { x: 6, y: 3 },
            strength: 2,
            width: 1,
            taper: 0,
            speed: 1,
            curve: 0,
        });

        sim.updateFlow();

        expect(sim.velocity.velX[3][3]).toBeCloseTo(2);
        expect(sim.velocity.velY[3][3]).toBeCloseTo(0);
        expect(sim.velocity.velX[0][0]).toBe(0);
    });

    it('advances a wave layer with timeStep and ignores a disabled layer', () => {
        const build = (enabled) => {
            const sim = makeSim(8);
            sim.timeStep = 0.2;
            sim.addNoiseLayer({
                scale: 8,
                strength: 1,
                speed: 1,
                enabled,
                pattern: 'wave',
                angle: 0,
            });
            return sim;
        };

        const first = build(true);
        const second = build(true);
        first.updateFlow();
        second.updateFlow();
        expect(first.velocity.velX[2][3]).toBeCloseTo(second.velocity.velX[2][3]);
        expect(first.velocity.velX[2][3]).not.toBe(0);

        const seen = first.velocity.velX[2][3];
        first.updateFlow();
        expect(first.velocity.velX[2][3]).not.toBeCloseTo(seen);
        expect(first.noiseTime).toBeCloseTo(0.4);

        const quiet = build(false);
        quiet.updateFlow();
        expect(quiet.velocity.velX[2][3]).toBe(0);
    });

    it('stays finite for mixed forces on both grid types, including the boundary', () => {
        for (const hex of [false, true]) {
            const sim = makeSim(12, { hex, advection: 0.8, diffusion: 0.05 });
            sim.velocity.velX[0][0] = 100;
            sim.velocity.velY[0][0] = -80;
            sim.addNoiseLayer({
                scale: 6,
                strength: 0.8,
                speed: 1.2,
                enabled: true,
                pattern: 'simplex',
            });
            sim.addEmitter({
                x: 3,
                y: 3,
                angle: 40,
                strength: 1.5,
                length: 6,
                spread: 2,
                taper: 1.2,
                speed: 1,
                curve: 0,
            });
            sim.addCurrent({
                start: { x: 1, y: 1 },
                end: { x: 10, y: 8 },
                strength: 1,
                width: 1.5,
                taper: 1,
                speed: 1,
                curve: 0,
            });
            sim.addOccluder({ type: 'rect', x0: 5, y0: 5, x1: 7, y1: 7 });

            expect(() => {
                for (let i = 0; i < 12; i++) sim.updateFlow();
            }).not.toThrow();

            expectFinite(sim);
            expect(sim.velocity.velX[6][6]).toBe(0);
            expect(sim.velocity.velY[6][6]).toBe(0);
        }
    });

    it('paints one step of the field without throwing', () => {
        const sim = makeSim(6, { advection: 1, diffusion: 0.04 });
        sim.velocity.velX[1][1] = 2;
        sim.addOccluder({ type: 'rect', x0: 0, y0: 0, x1: 1, y1: 1 });
        sim.updateFlow();
        expect(() => sim.drawFlow()).not.toThrow();
        expect(sim.velocity.velX[0][0]).toBe(0);
    });

    it('resizes both velocity planes when the grid changes', () => {
        const sim = makeSim(6);
        sim.setGridSize(15);

        expect(sim.getGridSize()).toBe(15);
        expect(sim.velocity.velX).toHaveLength(15);
        expect(sim.velocity.velY[14]).toHaveLength(15);
        expect(sim.cellSize).toBeCloseTo(sim.planeSize / 15);
    });
});
