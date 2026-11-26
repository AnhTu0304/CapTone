// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import i18n, { LANG_STORAGE_KEY } from './i18n';

beforeEach(() => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(LANG_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
  if (i18n.language !== 'vi') {
    i18n.changeLanguage('vi');
  }
});

// Stub getContext and scrollTo for jsdom to suppress not-implemented warnings
if (typeof window !== 'undefined') {
  if (window.HTMLCanvasElement) {
    window.HTMLCanvasElement.prototype.getContext = () => null;
  }
  window.scrollTo = jest.fn();
  if (!window.matchMedia) {
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
  }
  if (!window.ResizeObserver) {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
}

// Mock lightweight-charts v5 ESM package for Jest / jsdom environment
const createMockChart = () => ({
  addSeries: jest.fn(() => ({
    setData: jest.fn(),
    update: jest.fn(),
    applyOptions: jest.fn(),
    createPriceLine: jest.fn(() => ({ applyOptions: jest.fn() })),
    removePriceLine: jest.fn(),
    priceScale: jest.fn(() => ({ applyOptions: jest.fn() })),
  })),
  applyOptions: jest.fn(),
  resize: jest.fn(),
  remove: jest.fn(),
  subscribeCrosshairMove: jest.fn(),
  unsubscribeCrosshairMove: jest.fn(),
  priceScale: jest.fn(() => ({ applyOptions: jest.fn() })),
  timeScale: () => ({
    fitContent: jest.fn(),
    applyOptions: jest.fn(),
    subscribeVisibleLogicalRangeChange: jest.fn(),
    unsubscribeVisibleLogicalRangeChange: jest.fn(),
  }),
});

jest.mock('lightweight-charts', () => ({
  createChart: jest.fn(createMockChart),
  AreaSeries: 'AreaSeriesDefinition',
  LineSeries: 'LineSeriesDefinition',
  HistogramSeries: 'HistogramSeriesDefinition',
  CandlestickSeries: 'CandlestickSeriesDefinition',
  BarSeries: 'BarSeriesDefinition',
  BaselineSeries: 'BaselineSeriesDefinition',
  ColorType: { Solid: 'solid', VerticalGradient: 'gradient' },
  CrosshairMode: { Normal: 0, Magnet: 1 },
  LineStyle: { Solid: 0, Dotted: 1, Dashed: 2, LargeDashed: 3, SparseDotted: 4 },
}));

beforeEach(() => {
  const lwc = require('lightweight-charts');
  if (lwc.createChart && typeof lwc.createChart.mockImplementation === 'function') {
    lwc.createChart.mockImplementation(createMockChart);
  }
});

// Mock Three.js for Jest / jsdom environment
jest.mock('three', () => {
  return {
    Scene: jest.fn().mockImplementation(() => ({
      add: jest.fn(),
      traverse: jest.fn(),
    })),
    PerspectiveCamera: jest.fn().mockImplementation(() => ({
      position: { set: jest.fn(), x: 0, y: 0, z: 0 },
      lookAt: jest.fn(),
      updateProjectionMatrix: jest.fn(),
    })),
    WebGLRenderer: jest.fn().mockImplementation(() => ({
      setSize: jest.fn(),
      setPixelRatio: jest.fn(),
      setClearColor: jest.fn(),
      render: jest.fn(),
      dispose: jest.fn(),
      domElement: global.document ? global.document.createElement('canvas') : {},
    })),
    AmbientLight: jest.fn(),
    PointLight: jest.fn().mockImplementation(() => ({
      position: { set: jest.fn() },
    })),
    GridHelper: jest.fn().mockImplementation(() => ({
      position: { set: jest.fn() },
      material: {},
    })),
    Group: jest.fn().mockImplementation(() => ({
      position: { set: jest.fn() },
      add: jest.fn(),
    })),
    Mesh: jest.fn().mockImplementation(() => ({
      scale: { set: jest.fn() },
      rotation: { x: 0, y: 0, z: 0 },
      position: { set: jest.fn() },
    })),
    Points: jest.fn().mockImplementation(() => ({
      rotation: { x: 0, y: 0, z: 0 },
    })),
    Line: jest.fn(),
    SphereGeometry: jest.fn(),
    OctahedronGeometry: jest.fn(),
    IcosahedronGeometry: jest.fn(),
    DodecahedronGeometry: jest.fn(),
    RingGeometry: jest.fn(),
    TorusGeometry: jest.fn(),
    BufferGeometry: jest.fn().mockImplementation(() => ({
      setAttribute: jest.fn(),
      setFromPoints: jest.fn().mockReturnThis(),
      attributes: {
        position: {
          setX: jest.fn(),
          setZ: jest.fn(),
          setXYZ: jest.fn(),
          needsUpdate: false,
        },
      },
    })),
    BufferAttribute: jest.fn(),
    MeshBasicMaterial: jest.fn(),
    LineBasicMaterial: jest.fn(),
    PointsMaterial: jest.fn(),
    CanvasTexture: jest.fn(),
    Vector3: jest.fn().mockImplementation((x, y, z) => ({ x, y, z })),
    CatmullRomCurve3: jest.fn().mockImplementation(() => ({
      getPoints: jest.fn().mockReturnValue([]),
      getPointAt: jest.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
    })),
    Clock: jest.fn().mockImplementation(() => ({
      getElapsedTime: jest.fn().mockReturnValue(1),
    })),
    ConeGeometry: jest.fn().mockImplementation(() => ({
      rotateX: jest.fn(),
    })),
    Shape: jest.fn().mockImplementation(() => ({
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      closePath: jest.fn(),
    })),
    ExtrudeGeometry: jest.fn(),
    ShapeGeometry: jest.fn(),
    BoxGeometry: jest.fn(),
    CylinderGeometry: jest.fn().mockImplementation(() => ({
      rotateX: jest.fn(),
    })),
    MeshStandardMaterial: jest.fn(),
    Color: jest.fn(),
    DoubleSide: 2,
    FogExp2: jest.fn(),
  };
});

