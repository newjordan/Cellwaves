// happy-dom does not implement a usable 2D canvas. The simulator only needs
// a context object while it builds its offscreen buffers; drawing is not
// part of the simulation-step tests.
const original = HTMLCanvasElement.prototype.getContext;

HTMLCanvasElement.prototype.getContext = function getContext(type, options) {
    let ctx = null;
    try {
        if (typeof original === 'function') ctx = original.call(this, type, options);
    } catch {
        ctx = null;
    }

    if (ctx && typeof ctx.clearRect === 'function' && typeof ctx.createImageData === 'function') {
        return ctx;
    }

    return {
        canvas: this,
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        font: '',
        textAlign: '',
        imageSmoothingEnabled: true,
        clearRect() {},
        fillRect() {},
        drawImage() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        closePath() {},
        stroke() {},
        fillText() {},
        createImageData(w, h) {
            const width = typeof w === 'number' ? w : w.width;
            const height = typeof h === 'number' ? h : w.height;
            return { width, height, data: new Uint8ClampedArray(width * height * 4) };
        },
        putImageData() {},
    };
};
