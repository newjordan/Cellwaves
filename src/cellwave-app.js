import { CellWaveSimulator } from './cellwave-simulator.js';
import {
    PerformanceGovernor,
    nextPerformanceAdjustment,
    performancePreset,
    readDeviceSignals,
    recommendPerformanceProfile,
} from './performance.js';

class CellWaveApp {
    constructor() {
        this.simulator = null;
        this.canvas = null;
        this.ctx = null;
        this.isRunning = false;
        this.animationId = null;

        this.isMouseDown = false;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.forceStrength = 0.8;

        this.forceCounter = 0;
        this.activeForcesMap = new Map();

        this.performanceMetrics = {
            updateTime: 0,
            renderTime: 0,
            frameCount: 0,
            avgUpdateTime: 0,
            avgRenderTime: 0
        };

        this.autoEvolve = true;
        this.evolveTime = 0;
        this.evolveSpeed = 0.0005;

        this.frameStride = 1;
        this.frameIndex = 0;
        this.governor = new PerformanceGovernor();
        this.startupProfile = null;

        this.init();
    }

    async init() {
        try {
            this.canvas = document.getElementById('canvas');
            this.ctx = this.canvas.getContext('2d', { alpha: false }) || this.canvas.getContext('2d');

            this.applyStartupProfile();

            const density = parseInt(document.getElementById('density').value, 10);
            this.simulator = new CellWaveSimulator(130, density);

            this.addDemoContent();
            this.setupEventListeners();
            this.setupPointerInteraction();
            this.setupVisibilityPause();
            this.start();
            this.updateStats();
            this.log('CellWave simulation initialized successfully!');
        } catch (error) {
            this.log('Error initializing simulation: ' + error.message);
            console.error('Initialization error:', error);
        }
    }

    applyStartupProfile() {
        const profile = recommendPerformanceProfile(readDeviceSignals());
        this.startupProfile = profile;
        if (profile.tier === 'performance') {
            document.getElementById('gridSize').value = String(profile.gridSize);
            document.getElementById('density').value = String(profile.density);
            this.setPerformanceNote(profile.reason);
            return;
        }
        this.setPerformanceNote('Auto watches frame time and steps the simulation down if this device falls behind.');
    }

    addDemoContent() {
        const noiseLayer = {
            scale: 20,
            strength: 0.6,
            speed: 0.6,
            enabled: true,
            pattern: 'simplex'
        };
        this.simulator.addNoiseLayer(noiseLayer);
        this.trackForce('noise', noiseLayer, 'Simplex Base');

        const detailLayer = {
            scale: 35,
            strength: 0.7,
            speed: 0.5,
            enabled: true,
            pattern: 'simplex'
        };
        this.simulator.addNoiseLayer(detailLayer);
        this.trackForce('noise', detailLayer, 'Simplex Detail');

        const waveLayer1 = {
            scale: 28,
            strength: 0.5,
            speed: 0.8,
            enabled: true,
            pattern: 'wave',
            angle: 135
        };
        this.simulator.addNoiseLayer(waveLayer1);
        this.trackForce('noise', waveLayer1, 'Wave Flow 1');

        const waveLayer2 = {
            scale: 25,
            strength: 0.4,
            speed: 0.7,
            enabled: true,
            pattern: 'wave',
            angle: 60
        };
        this.simulator.addNoiseLayer(waveLayer2);
        this.trackForce('noise', waveLayer2, 'Wave Flow 2');
    }

    setupEventListeners() {
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearAll());

        document.getElementById('addCurrentBtn').addEventListener('click', () => this.addRandomCurrent());
        document.getElementById('addEmitterBtn').addEventListener('click', () => this.addRandomEmitter());
        document.getElementById('addOccluderBtn').addEventListener('click', () => this.addRandomOccluder());
        document.getElementById('addNoiseBtn').addEventListener('click', () => this.addNoiseLayer());
        document.getElementById('clearNoiseBtn').addEventListener('click', () => this.clearNoiseLayers());

        document.getElementById('gridType').addEventListener('change', (event) => {
            const useHex = event.target.value === 'hexagonal';
            this.simulator.setGridType(useHex);
            this.log(`Switched to ${useHex ? 'hexagonal' : 'square'} grid system`);
            this.updateStats();
        });

        document.getElementById('performanceMode').addEventListener('change', (event) => {
            const mode = event.target.value;
            this.governor.setMode(mode);
            if (mode === 'performance') {
                this.applyPerformancePreset();
                return;
            }
            if (mode === 'quality') {
                this.setPerformanceNote('Quality mode holds the current grid. Auto will not step it down.');
            } else {
                this.setPerformanceNote('Auto watches frame time and steps the simulation down if this device falls behind.');
            }
            this.updateStats();
        });

        this.bindSlider('gridSize', (value) => {
            const size = parseInt(value, 10);
            this.simulator.setGridSize(size);
            this.syncDensityLimit(size);
            this.updateLayerList();
            this.updateStats();
            if (size > 200) {
                this.log(`Large grid (${size}×${size}) - performance may be impacted`);
            }
        });

        this.bindSlider('density', (value) => {
            this.simulator.setDensity(parseInt(value, 10));
            this.updateStats();
        });

        this.bindSlider('advection', (value) => {
            this.simulator.advection = parseFloat(value);
        });

        this.bindSlider('diffusion', (value) => {
            this.simulator.diffusion = parseFloat(value);
        });

        this.bindSlider('visScale', (value) => {
            this.simulator.visScale = parseFloat(value);
        });

        this.bindSlider('timeStep', (value) => {
            this.simulator.timeStep = parseFloat(value);
        }, (value) => Number(value).toFixed(3));

        this.bindSlider('evolveSpeed', (value) => {
            this.evolveSpeed = parseFloat(value);
        }, (value) => Number(value).toFixed(4));

        this.bindSlider('quadLOD', (value) => {
            this.simulator.setOccluderLOD(parseInt(value, 10));
        });

        this.bindSlider('forceStrength', (value) => {
            this.forceStrength = parseFloat(value);
        });

        this.bindSlider('noiseScale');
        this.bindSlider('noiseStrength');
        this.bindSlider('noiseSpeed');

        document.getElementById('autoEvolve').addEventListener('change', (event) => {
            this.autoEvolve = event.target.checked;
            this.log(`Auto-evolve mode ${this.autoEvolve ? 'enabled' : 'disabled'}`);
        });
    }

    syncDensityLimit(size) {
        const densitySlider = document.getElementById('density');
        if (size > 100) {
            const maxDensity = Math.max(2, Math.floor(400 / size));
            if (parseInt(densitySlider.value, 10) > maxDensity) {
                densitySlider.value = String(maxDensity);
                this.simulator.setDensity(maxDensity);
                document.getElementById('densityValue').textContent = String(maxDensity);
            }
            densitySlider.max = String(maxDensity);
        } else {
            densitySlider.max = '8';
        }
    }

    bindSlider(id, callback, format) {
        const slider = document.getElementById(id);
        const valueDisplay = document.getElementById(id + 'Value');

        const updateValue = () => {
            const value = slider.value;
            if (valueDisplay) {
                valueDisplay.textContent = format ? format(value) : value;
            }
            if (callback) callback(value);
        };

        slider.addEventListener('input', updateValue);
        updateValue();
    }

    setupPointerInteraction() {
        this.canvas.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            const coords = this.getGridCoordinates(event);
            this.addCurrentAt(coords.x, coords.y);
        });

        this.canvas.addEventListener('pointerdown', (event) => {
            if (event.button === 2) return;
            try {
                this.canvas.setPointerCapture(event.pointerId);
            } catch {
                // The pointer can end before capture is requested.
            }
            this.isMouseDown = true;
            this.isDragging = false;
            const coords = this.getGridCoordinates(event);
            this.lastMouseX = coords.x;
            this.lastMouseY = coords.y;
        });

        this.canvas.addEventListener('pointerup', (event) => {
            if (!this.isMouseDown) return;
            if (!this.isDragging) {
                const coords = this.getGridCoordinates(event);
                this.addEmitterBurstAt(coords.x, coords.y);
            }
            this.isMouseDown = false;
            this.isDragging = false;
        });

        this.canvas.addEventListener('pointercancel', () => {
            this.isMouseDown = false;
            this.isDragging = false;
        });

        this.canvas.addEventListener('pointermove', (event) => {
            if (!this.isMouseDown) return;

            this.isDragging = true;
            const coords = this.getGridCoordinates(event);
            const dx = coords.x - this.lastMouseX;
            const dy = coords.y - this.lastMouseY;

            if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
                const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                const emitter = {
                    x: coords.x,
                    y: coords.y,
                    angle: angle,
                    strength: this.forceStrength * 0.5,
                    length: 3,
                    spread: 1,
                    taper: 2,
                    speed: 1,
                    curve: 0
                };

                this.simulator.addEmitter(emitter);
                setTimeout(() => {
                    this.simulator.removeEmitter(emitter);
                }, 100);
            }

            this.lastMouseX = coords.x;
            this.lastMouseY = coords.y;
        });
    }

    setupVisibilityPause() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (this.animationId !== null) {
                    cancelAnimationFrame(this.animationId);
                    this.animationId = null;
                }
                return;
            }
            if (this.isRunning && this.animationId === null) {
                this.animate();
            }
        });
    }

    getGridCoordinates(event) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = (event.clientX - rect.left) / rect.width * this.simulator.planeSize;
        const screenY = (event.clientY - rect.top) / rect.height * this.simulator.planeSize;

        if (this.simulator.useHexGrid) {
            const hexCoords = this.simulator.hexGrid.screenToHex(screenX, screenY);
            return {
                x: Math.max(0, Math.min(this.simulator.getGridSize() - 1, hexCoords.x)),
                y: Math.max(0, Math.min(this.simulator.getGridSize() - 1, hexCoords.y))
            };
        }

        const x = screenX / this.simulator.cellSize;
        const y = screenY / this.simulator.cellSize;
        return {
            x: Math.max(0, Math.min(this.simulator.getGridSize() - 1, x)),
            y: Math.max(0, Math.min(this.simulator.getGridSize() - 1, y))
        };
    }

    addEmitterBurstAt(x, y) {
        const burstCount = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < burstCount; i++) {
            const angle = (360 / burstCount) * i + Math.random() * 45;
            const emitter = {
                x: x,
                y: y,
                angle: angle,
                strength: this.forceStrength * (0.5 + Math.random() * 0.5),
                length: 2 + Math.random() * 3,
                spread: 0.8 + Math.random() * 0.4,
                taper: 1.5 + Math.random(),
                speed: 1,
                curve: 0
            };

            this.simulator.addEmitter(emitter);
            setTimeout(() => {
                this.simulator.removeEmitter(emitter);
            }, 200 + Math.random() * 300);
        }
    }

    addCurrentAt(x, y) {
        const angle = Math.random() * Math.PI * 2;
        const length = 5 + Math.random() * 10;
        const endX = x + Math.cos(angle) * length;
        const endY = y + Math.sin(angle) * length;

        const current = {
            start: { x: x, y: y },
            end: {
                x: Math.max(0, Math.min(this.simulator.getGridSize() - 1, endX)),
                y: Math.max(0, Math.min(this.simulator.getGridSize() - 1, endY))
            },
            strength: this.forceStrength * 0.8,
            width: 1.5 + Math.random(),
            taper: 1 + Math.random(),
            speed: 1.0,
            curve: 0
        };

        this.simulator.addCurrent(current);
        this.trackForce('current', current, `Stream ${this.forceCounter}`);
    }

    addRandomOccluder() {
        const gridSize = this.simulator.getGridSize();
        const size = 2 + Math.floor(Math.random() * 5);
        const x0 = Math.floor(Math.random() * (gridSize - size));
        const y0 = Math.floor(Math.random() * (gridSize - size));

        const occluder = {
            type: 'rect',
            x0: x0,
            y0: y0,
            x1: x0 + size,
            y1: y0 + size
        };

        this.simulator.addOccluder(occluder);
        this.trackForce('occluder', occluder, `Obstacle ${this.forceCounter}`);
        this.log(`Added obstacle at (${x0},${y0}) size ${size}×${size}`);
    }

    addRandomCurrent() {
        const x = Math.random() * this.simulator.getGridSize();
        const y = Math.random() * this.simulator.getGridSize();
        this.addCurrentAt(x, y);
    }

    addRandomEmitter() {
        const emitter = {
            x: Math.random() * this.simulator.getGridSize(),
            y: Math.random() * this.simulator.getGridSize(),
            angle: Math.random() * 360,
            strength: this.forceStrength,
            length: 4 + Math.random() * 6,
            spread: 1 + Math.random() * 2,
            taper: 1 + Math.random() * 2,
            speed: 1.0,
            curve: 0
        };

        this.simulator.addEmitter(emitter);
        this.trackForce('emitter', emitter, `Jet ${this.forceCounter}`);
    }

    addNoiseLayer() {
        const pattern = document.getElementById('noisePattern').value;
        const scale = parseFloat(document.getElementById('noiseScale').value);
        const strength = parseFloat(document.getElementById('noiseStrength').value);
        const speed = parseFloat(document.getElementById('noiseSpeed').value);

        const layer = {
            scale: scale,
            strength: strength,
            speed: speed,
            enabled: true,
            pattern: pattern
        };

        if (pattern === 'wave') {
            layer.angle = Math.random() * 360;
        }

        this.simulator.addNoiseLayer(layer);
        this.trackForce('noise', layer, `${pattern} layer`);
    }

    clearNoiseLayers() {
        for (const [id, force] of this.activeForcesMap) {
            if (force.type === 'noise') {
                this.simulator.removeNoiseLayer(force.object);
                this.activeForcesMap.delete(id);
            }
        }
        this.updateLayerList();
    }

    trackForce(type, object, name) {
        const id = ++this.forceCounter;
        this.activeForcesMap.set(id, { type, object, name, id });
        this.updateLayerList();
    }

    removeForce(id) {
        const force = this.activeForcesMap.get(id);
        if (!force) return;

        switch (force.type) {
            case 'current':
                this.simulator.removeCurrent(force.object);
                break;
            case 'emitter':
                this.simulator.removeEmitter(force.object);
                break;
            case 'noise':
                this.simulator.removeNoiseLayer(force.object);
                break;
            case 'occluder':
                this.simulator.removeOccluder(force.object);
                break;
        }

        this.activeForcesMap.delete(id);
        this.updateLayerList();
    }

    updateLayerList() {
        const layerList = document.getElementById('layerList');
        if (!layerList) return;

        if (this.activeForcesMap.size === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-layers';
            empty.textContent = 'No active layers';
            layerList.replaceChildren(empty);
            return;
        }

        const fragment = document.createDocumentFragment();
        for (const [, force] of this.activeForcesMap) {
            fragment.appendChild(this.createLayerItem(force));
        }
        layerList.replaceChildren(fragment);
    }

    createLayerItem(force) {
        const item = document.createElement('div');
        item.className = 'layer-item';

        const header = document.createElement('div');
        header.className = 'layer-header';

        const name = document.createElement('span');
        name.className = 'layer-name';
        name.textContent = this.layerTitle(force);
        header.appendChild(name);

        if (force.type === 'noise') {
            header.appendChild(this.createToggle(force));
        }
        header.appendChild(this.createRemoveButton(force.id));
        item.appendChild(header);

        const controls = document.createElement('div');
        controls.className = 'layer-controls';
        for (const spec of this.layerControlSpecs(force)) {
            controls.appendChild(this.buildControl(spec));
        }
        item.appendChild(controls);
        return item;
    }

    layerTitle(force) {
        if (force.type === 'current') return `🌊 ${force.name}`;
        if (force.type === 'emitter') return `💨 ${force.name}`;
        if (force.type === 'occluder') return `🚧 ${force.name}`;
        return force.name;
    }

    createToggle(force) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'toggle-switch' + (force.object.enabled ? ' active' : '');
        button.setAttribute('aria-pressed', String(Boolean(force.object.enabled)));
        button.setAttribute('aria-label', `${force.name} enabled`);
        button.addEventListener('click', () => this.toggleLayer(force.id));
        return button;
    }

    createRemoveButton(id) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'layer-remove';
        button.textContent = '✕';
        button.setAttribute('aria-label', 'Remove layer');
        button.addEventListener('click', () => this.removeForce(id));
        return button;
    }

    layerControlSpecs(force) {
        const object = force.object;
        const grid = this.simulator.getGridSize();
        const num = (value) => parseFloat(value);

        if (force.type === 'noise') {
            const specs = [
                { label: 'Scale', min: 5, max: 50, step: 1, value: object.scale, apply: (value) => this.updateLayerProperty(force.id, 'scale', value) },
                { label: 'Strength', min: 0.1, max: 2, step: 0.1, value: object.strength, apply: (value) => this.updateLayerProperty(force.id, 'strength', value) },
                { label: 'Speed', min: 0.1, max: 3, step: 0.1, value: object.speed, apply: (value) => this.updateLayerProperty(force.id, 'speed', value) },
                {
                    label: 'Pattern',
                    kind: 'select',
                    value: object.pattern || 'simplex',
                    options: [['simplex', 'Simplex'], ['wave', 'Wave']],
                    apply: (value) => this.updateLayerProperty(force.id, 'pattern', value),
                },
            ];
            if ((object.pattern || 'simplex') === 'wave') {
                specs.push({
                    label: 'Angle',
                    min: 0,
                    max: 360,
                    step: 15,
                    value: object.angle || 0,
                    format: (value) => `${value}°`,
                    apply: (value) => this.updateLayerProperty(force.id, 'angle', value),
                });
            }
            return specs;
        }

        if (force.type === 'current') {
            const axis = (coordinate) => (value) => this.updateCurrentPosition(force.id, coordinate, value);
            return [
                { label: 'Start X', min: 0, max: grid, step: 0.5, value: object.start.x, format: (value) => num(value).toFixed(1), apply: axis('startX') },
                { label: 'Start Y', min: 0, max: grid, step: 0.5, value: object.start.y, format: (value) => num(value).toFixed(1), apply: axis('startY') },
                { label: 'End X', min: 0, max: grid, step: 0.5, value: object.end.x, format: (value) => num(value).toFixed(1), apply: axis('endX') },
                { label: 'End Y', min: 0, max: grid, step: 0.5, value: object.end.y, format: (value) => num(value).toFixed(1), apply: axis('endY') },
                { label: 'Strength', min: 0.1, max: 2, step: 0.1, value: object.strength, apply: (value) => this.updateLayerProperty(force.id, 'strength', value) },
                { label: 'Width', min: 0.5, max: 5, step: 0.1, value: object.width, apply: (value) => this.updateLayerProperty(force.id, 'width', value) },
                { label: 'Taper', min: 0.5, max: 3, step: 0.1, value: object.taper, apply: (value) => this.updateLayerProperty(force.id, 'taper', value) },
                { label: 'Speed', min: 0.1, max: 2, step: 0.1, value: object.speed, apply: (value) => this.updateLayerProperty(force.id, 'speed', value) },
            ];
        }

        if (force.type === 'emitter') {
            return [
                { label: 'Position X', min: 0, max: grid, step: 0.5, value: object.x, format: (value) => num(value).toFixed(1), apply: (value) => this.updateLayerProperty(force.id, 'x', value) },
                { label: 'Position Y', min: 0, max: grid, step: 0.5, value: object.y, format: (value) => num(value).toFixed(1), apply: (value) => this.updateLayerProperty(force.id, 'y', value) },
                { label: 'Angle', min: 0, max: 360, step: 5, value: object.angle, format: (value) => `${value}°`, apply: (value) => this.updateLayerProperty(force.id, 'angle', value) },
                { label: 'Strength', min: 0.1, max: 3, step: 0.1, value: object.strength, apply: (value) => this.updateLayerProperty(force.id, 'strength', value) },
                { label: 'Length', min: 1, max: 10, step: 0.5, value: object.length, apply: (value) => this.updateLayerProperty(force.id, 'length', value) },
                { label: 'Spread', min: 0.2, max: 3, step: 0.1, value: object.spread, apply: (value) => this.updateLayerProperty(force.id, 'spread', value) },
                { label: 'Taper', min: 0.5, max: 3, step: 0.1, value: object.taper, apply: (value) => this.updateLayerProperty(force.id, 'taper', value) },
                { label: 'Speed', min: 0.1, max: 2, step: 0.1, value: object.speed, apply: (value) => this.updateLayerProperty(force.id, 'speed', value) },
            ];
        }

        if (force.type === 'occluder') {
            const width = object.x1 - object.x0;
            const height = object.y1 - object.y0;
            return [
                { label: 'Position X', min: 0, max: Math.max(0, grid - width), step: 1, value: object.x0, format: (value) => String(Math.round(num(value))), apply: (value) => this.updateOccluderPosition(force.id, 'x', value) },
                { label: 'Position Y', min: 0, max: Math.max(0, grid - height), step: 1, value: object.y0, format: (value) => String(Math.round(num(value))), apply: (value) => this.updateOccluderPosition(force.id, 'y', value) },
                { label: 'Width', min: 2, max: Math.max(2, Math.min(20, grid - object.x0)), step: 1, value: width, apply: (value) => this.updateOccluderSize(force.id, 'width', value) },
                { label: 'Height', min: 2, max: Math.max(2, Math.min(20, grid - object.y0)), step: 1, value: height, apply: (value) => this.updateOccluderSize(force.id, 'height', value) },
            ];
        }

        return [];
    }

    buildControl(spec) {
        const wrap = document.createElement('div');
        wrap.className = 'layer-control';
        const label = document.createElement('label');
        label.textContent = spec.label;
        wrap.appendChild(label);

        if (spec.kind === 'select') {
            const select = document.createElement('select');
            for (const [value, text] of spec.options) {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = text;
                if (value === spec.value) option.selected = true;
                select.appendChild(option);
            }
            select.addEventListener('change', () => spec.apply(select.value));
            wrap.appendChild(select);
            return wrap;
        }

        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(spec.min);
        input.max = String(spec.max);
        input.step = String(spec.step);
        input.value = String(spec.value);
        const value = document.createElement('div');
        value.className = 'value';
        const render = () => {
            value.textContent = spec.format ? spec.format(input.value) : input.value;
        };
        input.addEventListener('input', () => {
            spec.apply(input.value);
            render();
        });
        render();
        wrap.appendChild(input);
        wrap.appendChild(value);
        return wrap;
    }

    toggleLayer(id) {
        const force = this.activeForcesMap.get(id);
        if (!force || force.type !== 'noise') return;

        force.object.enabled = !force.object.enabled;
        this.updateLayerList();
    }

    updateLayerProperty(id, property, value) {
        const force = this.activeForcesMap.get(id);
        if (!force) return;

        if (property === 'pattern') {
            force.object.pattern = value;
            if (value === 'wave' && force.object.angle === undefined) {
                force.object.angle = Math.random() * 360;
            }
            this.updateLayerList();
            return;
        }

        force.object[property] = parseFloat(value);
    }

    updateCurrentPosition(id, coordinate, value) {
        const force = this.activeForcesMap.get(id);
        if (!force || force.type !== 'current') return;

        const val = parseFloat(value);
        if (coordinate === 'startX') force.object.start.x = val;
        else if (coordinate === 'startY') force.object.start.y = val;
        else if (coordinate === 'endX') force.object.end.x = val;
        else if (coordinate === 'endY') force.object.end.y = val;
    }

    updateOccluderPosition(id, axis, value) {
        const force = this.activeForcesMap.get(id);
        if (!force || force.type !== 'occluder') return;

        const val = Math.round(parseFloat(value));
        const width = force.object.x1 - force.object.x0;
        const height = force.object.y1 - force.object.y0;

        if (axis === 'x') {
            force.object.x0 = val;
            force.object.x1 = val + width;
        } else if (axis === 'y') {
            force.object.y0 = val;
            force.object.y1 = val + height;
        }

        this.simulator.rebuildQuadCells();
    }

    updateOccluderSize(id, dimension, value) {
        const force = this.activeForcesMap.get(id);
        if (!force || force.type !== 'occluder') return;

        const val = Math.round(parseFloat(value));
        if (dimension === 'width') {
            force.object.x1 = force.object.x0 + val;
        } else if (dimension === 'height') {
            force.object.y1 = force.object.y0 + val;
        }

        this.simulator.rebuildQuadCells();
        this.updateLayerList();
    }

    start() {
        this.isRunning = true;
        this.animate();
    }

    togglePause() {
        this.isRunning = !this.isRunning;
        const btn = document.getElementById('pauseBtn');
        btn.textContent = this.isRunning ? 'Pause' : 'Resume';

        if (this.isRunning) {
            this.animate();
        } else if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    reset() {
        this.activeForcesMap.clear();
        this.simulator.currents = [];
        this.simulator.emitters = [];
        this.simulator.noiseLayers = [];
        this.simulator.occluders = [];
        this.simulator.rebuildQuadCells();

        for (let y = 0; y < this.simulator.gridSize; y++) {
            for (let x = 0; x < this.simulator.gridSize; x++) {
                this.simulator.velocity.velX[y][x] = (Math.random() - 0.5) * 0.2;
                this.simulator.velocity.velY[y][x] = (Math.random() - 0.5) * 0.2;
            }
        }

        this.addDemoContent();
        this.updateLayerList();
        this.log('Simulation reset');
    }

    clearAll() {
        this.activeForcesMap.clear();
        this.simulator.currents = [];
        this.simulator.emitters = [];
        this.simulator.noiseLayers = [];
        this.simulator.occluders = [];
        this.simulator.rebuildQuadCells();
        this.updateLayerList();
        this.log('All forces cleared');
    }

    animate() {
        if (!this.isRunning) return;

        try {
            this.frameIndex = (this.frameIndex + 1) % 1000000;
            const stepping = this.frameIndex % this.frameStride === 0;

            if (stepping && this.autoEvolve) {
                this.evolveNoiseLayers();
            }

            let updateMs = 0;
            if (stepping) {
                const updateStart = performance.now();
                this.simulator.updateFlow();
                updateMs = performance.now() - updateStart;
            }
            this.performanceMetrics.updateTime = updateMs;

            const renderStart = performance.now();
            this.simulator.drawFlow();
            const simCanvas = this.simulator.getCanvas();
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(simCanvas, 0, 0, this.canvas.width, this.canvas.height);
            const renderMs = performance.now() - renderStart;
            this.performanceMetrics.renderTime = renderMs;

            this.performanceMetrics.frameCount++;
            if (stepping) {
                const alpha = 0.1;
                this.performanceMetrics.avgUpdateTime =
                    this.performanceMetrics.avgUpdateTime * (1 - alpha) + updateMs * alpha;
                this.performanceMetrics.avgRenderTime =
                    this.performanceMetrics.avgRenderTime * (1 - alpha) + renderMs * alpha;

                if (this.governor.noteFrame(updateMs + renderMs) === 'reduce') {
                    this.applyRuntimeFallback();
                }
            }

            if (this.performanceMetrics.frameCount % 60 === 0) {
                this.updateStats();
            }
        } catch (error) {
            console.error('Animation error:', error);
            this.isRunning = false;
        }

        if (document.hidden || !this.isRunning) {
            this.animationId = null;
            return;
        }
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    applyRuntimeFallback() {
        const adjustment = nextPerformanceAdjustment({
            density: this.simulator.density,
            gridSize: this.simulator.getGridSize(),
            frameStride: this.frameStride,
        });
        const applied = this.applyAdjustment(adjustment, 'This device is missing frames.');
        if (!applied) this.governor.reductions = this.governor.maxReductions;
    }

    applyPerformancePreset() {
        const preset = performancePreset(this.simulator.getGridSize());
        this.applyAdjustment({
            ...preset,
            changed: true,
            summary: 'Low power caps the grid and the visual density.',
        });
    }

    applyAdjustment(adjustment, reason) {
        if (!adjustment.changed) return false;

        const gridSlider = document.getElementById('gridSize');
        const densitySlider = document.getElementById('density');

        if (adjustment.gridSize !== this.simulator.getGridSize()) {
            gridSlider.value = String(adjustment.gridSize);
            document.getElementById('gridSizeValue').textContent = String(adjustment.gridSize);
            this.simulator.setGridSize(adjustment.gridSize);
            this.syncDensityLimit(adjustment.gridSize);
        }

        if (adjustment.density !== this.simulator.density) {
            densitySlider.value = String(adjustment.density);
            document.getElementById('densityValue').textContent = String(adjustment.density);
            this.simulator.setDensity(adjustment.density);
        }

        this.frameStride = adjustment.frameStride;
        const message = [reason, adjustment.summary].filter(Boolean).join(' ');
        this.setPerformanceNote(message);
        this.log(message);
        this.updateStats();
        return true;
    }

    setPerformanceNote(text) {
        const note = document.getElementById('performanceNote');
        if (note) note.textContent = text || '';
    }

    evolveNoiseLayers() {
        this.evolveTime += this.evolveSpeed;

        for (const [id, force] of this.activeForcesMap) {
            if (force.type !== 'noise' || !force.object.enabled) continue;

            const layer = force.object;
            const scaleOffset = id * 2.1;
            const strengthOffset = id * 3.7;
            const speedOffset = id * 1.9;

            const scaleWave1 = Math.sin(this.evolveTime * 0.8 + scaleOffset);
            const scaleWave2 = Math.sin(this.evolveTime * 0.3 + scaleOffset * 2.3);
            const scaleBase = 30 + 10 * scaleWave1 + 8 * scaleWave2;
            layer.scale = Math.max(10, Math.min(40, scaleBase));

            const strengthWave1 = Math.sin(this.evolveTime * 0.9 + strengthOffset);
            const strengthWave2 = Math.sin(this.evolveTime * 1.4 + strengthOffset * 1.6);
            const strengthWave3 = Math.sin(this.evolveTime * 0.5 + strengthOffset * 2.8);
            const strengthBase = 0.5 + 0.28 * strengthWave1 + 0.18 * strengthWave2 + 0.12 * strengthWave3;
            layer.strength = Math.max(0.15, Math.min(1.1, strengthBase));

            const speedWave = Math.sin(this.evolveTime * 0.25 + speedOffset);
            const speedBase = 0.7 + 0.35 * speedWave;
            layer.speed = Math.max(0.4, Math.min(1.2, speedBase));

            if (layer.pattern === 'wave' && layer.angle !== undefined) {
                layer.angle = (layer.angle + 0.02) % 360;
            }
        }

        if (this.performanceMetrics.frameCount % 30 === 0) {
            const layerList = document.getElementById('layerList');
            const active = document.activeElement;
            if (!layerList || !active || !layerList.contains(active)) {
                this.updateLayerList();
            }
        }
    }

    updateStats() {
        const stats = document.getElementById('stats');
        const currents = this.simulator.currents.length;
        const emitters = this.simulator.emitters.length;
        const noiseLayers = this.simulator.noiseLayers.length;
        const occluders = this.simulator.occluders.length;

        const gridType = this.simulator.useHexGrid ? 'Hexagonal' : 'Square';
        const totalCells = this.simulator.getGridSize() * this.simulator.getGridSize();
        const stepMs = this.performanceMetrics.avgUpdateTime + this.performanceMetrics.avgRenderTime;
        const stepRate = stepMs > 0 ? Math.round(1000 / stepMs) : 0;
        const stride = this.frameStride === 1 ? 'every frame' : `every ${this.frameStride} frames`;

        stats.innerHTML = `
            <strong>Performance:</strong><br>
            Grid: ${this.simulator.getGridSize()}×${this.simulator.getGridSize()} (${totalCells.toLocaleString()} cells)<br>
            Type: ${gridType}<br>
            Density: ${this.simulator.density}x<br>
            Mode: ${this.governor.mode}<br>
            Step: ${stride}<br>
            Step rate: ${stepRate}/s<br>
            Update: ${this.performanceMetrics.avgUpdateTime.toFixed(1)}ms<br>
            Render: ${this.performanceMetrics.avgRenderTime.toFixed(1)}ms<br>
            <br>
            <strong>Active Forces:</strong><br>
            Currents: ${currents}<br>
            Emitters: ${emitters}<br>
            Obstacles: ${occluders}<br>
            Noise Layers: ${noiseLayers}<br>
            <br>
            <strong>Physics:</strong><br>
            Advection: ${this.simulator.advection}<br>
            Diffusion: ${this.simulator.diffusion}<br>
            Visual Scale: ${this.simulator.visScale}<br>
            Time step: ${this.simulator.timeStep}
        `;
    }

    log(message) {
        console.log('🌊 CellWave:', message);
    }
}

let app;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app = new CellWaveApp();
        window.app = app;
    });
} else {
    app = new CellWaveApp();
    window.app = app;
}
