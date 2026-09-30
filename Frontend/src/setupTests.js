// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Stub getContext and scrollTo for jsdom to suppress not-implemented warnings
if (typeof window !== 'undefined') {
  if (window.HTMLCanvasElement) {
    window.HTMLCanvasElement.prototype.getContext = () => null;
  }
  window.scrollTo = jest.fn();
}

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

