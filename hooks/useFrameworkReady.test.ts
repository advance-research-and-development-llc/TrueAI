import { renderHook } from '@testing-library/react-native';
import { useFrameworkReady } from './useFrameworkReady';

// Mock window object for Node environment
global.window = global.window || ({} as any);

describe('useFrameworkReady', () => {
  beforeEach(() => {
    // Clear any previous mock
    if (global.window) {
      delete (global.window as any).frameworkReady;
    }
  });

  it('should call frameworkReady when it exists', () => {
    const mockFrameworkReady = jest.fn();
    (global.window as any).frameworkReady = mockFrameworkReady;

    renderHook(() => useFrameworkReady());

    expect(mockFrameworkReady).toHaveBeenCalled();
  });

  it('should not error when frameworkReady does not exist', () => {
    expect(() => {
      renderHook(() => useFrameworkReady());
    }).not.toThrow();
  });

  it('should call frameworkReady on every render', () => {
    const mockFrameworkReady = jest.fn();
    (global.window as any).frameworkReady = mockFrameworkReady;

    const { rerender } = renderHook(() => useFrameworkReady());

    expect(mockFrameworkReady).toHaveBeenCalledTimes(1);

    rerender({});
    expect(mockFrameworkReady).toHaveBeenCalledTimes(2);

    rerender({});
    expect(mockFrameworkReady).toHaveBeenCalledTimes(3);
  });

  it('should handle frameworkReady being added after mount', () => {
    const { rerender } = renderHook(() => useFrameworkReady());

    const mockFrameworkReady = jest.fn();
    (global.window as any).frameworkReady = mockFrameworkReady;

    rerender({});

    expect(mockFrameworkReady).toHaveBeenCalled();
  });

  it('should handle frameworkReady being removed', () => {
    const mockFrameworkReady = jest.fn();
    (global.window as any).frameworkReady = mockFrameworkReady;

    const { rerender } = renderHook(() => useFrameworkReady());

    expect(mockFrameworkReady).toHaveBeenCalledTimes(1);

    delete (global.window as any).frameworkReady;

    expect(() => {
      rerender({});
    }).not.toThrow();
  });

  it('should work with optional chaining', () => {
    // Test that undefined frameworkReady doesn't throw
    (global.window as any).frameworkReady = undefined;

    expect(() => {
      renderHook(() => useFrameworkReady());
    }).not.toThrow();
  });
});
