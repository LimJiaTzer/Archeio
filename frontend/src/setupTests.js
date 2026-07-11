import { expect, test, describe, vi } from 'vitest';
import '@testing-library/jest-dom';

if (typeof globalThis.IntersectionObserver === 'undefined') {
  global.IntersectionObserver = class {
      constructor(callback) {}
      observe() {}
      unobserve() {}
      disconnect() {}
  };
}

// Stub out Worker to prevent heic2any and other web-worker libraries from crashing jsdom on import
if (typeof global.Worker === 'undefined') {
  global.Worker = class {
    constructor(stringUrl) {
      this.url = stringUrl;
      this.onmessage = () => {};
    }
    postMessage(msg) {}
    terminate() {}
  };
}

// Stub out ResizeObserver as it is not implemented in jsdom
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class {
    constructor(callback) {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Stub out canvas getContext to prevent jsdom warnings/crashes when canvas is invoked
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = () => ({
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })),
    putImageData: vi.fn(),
    createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    arc: vi.fn(),
  });
}

