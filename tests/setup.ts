/**
 * Настройка для тестов
 */

import { beforeAll, afterAll } from 'vitest';

// Мокаем WebGPU API для тестов
beforeAll(() => {
  // Создаем мок для navigator.gpu
  if (!navigator.gpu) {
    (navigator as any).gpu = {
      requestAdapter: async () => ({
        requestDevice: async () => ({
          createBuffer: () => ({}),
          createTexture: () => ({}),
          createShaderModule: () => ({}),
          createBindGroupLayout: () => ({}),
          createBindGroup: () => ({}),
          createPipelineLayout: () => ({}),
          createRenderPipeline: () => ({}),
          createComputePipeline: () => ({}),
          createCommandEncoder: () => ({
            beginRenderPass: () => ({
              setPipeline: () => {},
              setBindGroup: () => {},
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
});

afterAll(() => {
  // Очистка после тестов
  if (navigator.gpu) {
    delete (navigator as any).gpu;
  }
});
