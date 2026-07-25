import { vi } from 'vitest';
import '@testing-library/jest-dom';

if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
  };
}

// Stub out Worker to prevent heic2any and other web-worker libraries from crashing jsdom on import
if (typeof globalThis.Worker === 'undefined') {
  globalThis.Worker = class {
    constructor(stringUrl) {
      this.url = stringUrl;
      this.onmessage = () => {};
    }
    postMessage() {}
    terminate() {}
  };
}

// Stub out ResizeObserver as it is not implemented in jsdom
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
  };
}

if (typeof globalThis.matchMedia === 'undefined') {
  globalThis.matchMedia = vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = vi.fn(() => 'blob:test-object-url');
}
if (typeof URL.revokeObjectURL === 'undefined') {
  URL.revokeObjectURL = vi.fn();
}

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
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
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    arc: vi.fn(),
  });
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,iVBORw0KGgo=');
  HTMLCanvasElement.prototype.toBlob = vi.fn((callback, type = 'image/png') => {
    callback(new Blob(['canvas'], { type }));
  });
}
