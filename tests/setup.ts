/**
 * Настройка для тестов
 */

import { beforeAll, afterAll } from 'vitest';

// Мокаем WebGPU API для тестов
beforeAll(() => {
  // Мокаем WebGPU константы
  (globalThis as any).GPUBufferUsage = {
    MAP_READ: 1,
    MAP_WRITE: 2,
    COPY_SRC: 4,
    COPY_DST: 8,
    INDEX: 16,
    VERTEX: 32,
    UNIFORM: 64,
    STORAGE: 128,
    INDIRECT: 256,
    QUERY_RESOLVE: 512,
  };

  (globalThis as any).GPUTextureUsage = {
    COPY_SRC: 1,
    COPY_DST: 2,
    TEXTURE_BINDING: 4,
    STORAGE_BINDING: 8,
    RENDER_ATTACHMENT: 16,
  };

  (globalThis as any).GPUShaderStage = {
    VERTEX: 1,
    FRAGMENT: 2,
    COMPUTE: 4,
  };

  (globalThis as any).GPUColorWrite = {
    RED: 1,
    GREEN: 2,
    BLUE: 4,
    ALPHA: 8,
    ALL: 15,
  };

  // Создаем мок для navigator.gpu
  if (!navigator.gpu) {
    (navigator as any).gpu = {
      requestAdapter: async () => ({
        requestDevice: async () => ({
          createBuffer: () => ({
            destroy: () => {},
            getMappedRange: () => new ArrayBuffer(64),
            unmap: () => {},
          }),
          createTexture: () => ({}),
          createShaderModule: () => ({}),
          createBindGroupLayout: () => ({}),
          createBindGroup: () => ({}),
          createPipelineLayout: () => ({}),
          createRenderPipeline: () => ({
            getBindGroupLayout: () => ({}),
          }),
          createComputePipeline: () => ({}),
          createCommandEncoder: () => ({
            beginRenderPass: () => ({
              setPipeline: () => {},
              setBindGroup: () => {},
              setVertexBuffer: () => {},
              draw: () => {},
              end: () => {},
            }),
            finish: () => ({}),
          }),
          createRenderBundleEncoder: () => ({}),
          createQuerySet: () => ({}),
          pushErrorScope: () => {},
          popErrorScope: async () => null,
          addEventListener: () => {},
          removeEventListener: () => {},
          destroy: () => {},
          queue: {
            submit: () => {},
            onSubmittedWorkDone: async () => {},
            writeBuffer: () => {},
            writeTexture: () => {},
            copyExternalImageToTexture: () => {},
          },
        }),
        features: {},
        limits: {},
      }),
      getPreferredCanvasFormat: () => 'bgra8unorm',
    };
  }

  // Мокаем performance.memory для тестов памяти
  if (!(performance as any).memory) {
    (performance as any).memory = {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0,
    };
  }

  // Мокаем HTMLCanvasElement.getContext для WebGPU
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (contextType: string) {
    if (contextType === 'webgpu') {
      return {
        configure: () => {},
        getCurrentTexture: () => ({
          createView: () => ({}),
        }),
      };
    }
    return originalGetContext.call(this, contextType);
  };

  // Мокаем document.getElementById для canvas
  const originalGetElementById = document.getElementById;
  document.getElementById = function (id: string) {
    if (id === 'spreadsheet-canvas') {
      const canvas = document.createElement('canvas');
      canvas.id = 'spreadsheet-canvas';
      canvas.width = 1920;
      canvas.height = 1080;
      return canvas;
    }
    return originalGetElementById.call(this, id);
  };

  // Мокаем ResizeObserver для адаптивности
  if (!(globalThis as any).ResizeObserver) {
    (globalThis as any).ResizeObserver = class ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        // Сохраняем callback для потенциального использования
      }

      observe(target: Element): void {
        // Заглушка для observe
      }

      unobserve(target: Element): void {
        // Заглушка для unobserve
      }

      disconnect(): void {
        // Заглушка для disconnect
      }
    };
  }
});

afterAll(() => {
  // Очистка после тестов
  try {
    if (navigator.gpu) {
      (navigator as any).gpu = undefined;
    }
  } catch (error) {
    // Игнорируем ошибки очистки
  }

  // Восстанавливаем оригинальный getContext
  if (HTMLCanvasElement.prototype.getContext !== HTMLCanvasElement.prototype.getContext) {
    // Восстанавливаем оригинальный метод если он был изменен
  }
});
