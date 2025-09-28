/**
 * Тесты для RenderManager с поддержкой instancing
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { RenderManager } from '../../src/rendering/webgpu-setup/RenderManager.js';
import { VirtualGrid } from '../../src/core/virtual-grid/VirtualGrid.js';

// Мокаем WebGPU для тестов
const mockWebGPUConfig = {
  device: {
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
  },
  context: {
    getCurrentTexture: () => ({
      createView: () => ({}),
    }),
    configure: () => {},
  },
  format: 'bgra8unorm' as GPUTextureFormat,
};

describe('RenderManager Instancing Tests', () => {
  let renderManager: RenderManager;
  let virtualGrid: VirtualGrid;
  let canvas: HTMLCanvasElement;

  beforeAll(() => {
    // Создаем тестовый canvas
    canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    document.body.appendChild(canvas);
  });

  afterAll(() => {
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
  });

  beforeEach(async () => {
    // Создаем новый RenderManager для каждого теста
    renderManager = new RenderManager(mockWebGPUConfig as any, canvas);
    await renderManager.initialize();

    // Создаем виртуальную сетку
    virtualGrid = new VirtualGrid(1920, 1080, 100, 30, 1000, 1000);
  });

  describe('Instancing рендеринг', () => {
    it('должен рендерить ячейки с использованием instancing', () => {
      const visibleCells = virtualGrid.getVisibleCells();
      const viewport = virtualGrid.getViewport();

      expect(() => {
        renderManager.render(visibleCells, viewport);
      }).not.toThrow();

      console.log(`Rendered ${visibleCells.length} cells with instancing`);
    });

    it('должен эффективно обрабатывать большое количество ячеек', () => {
      const startTime = performance.now();

      // Создаем большой viewport с множеством ячеек
      virtualGrid.setViewport(0, 0, 50, 50);
      const visibleCells = virtualGrid.getVisibleCells();
      const viewport = virtualGrid.getViewport();

      renderManager.render(visibleCells, viewport);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      console.log(`Large viewport (${visibleCells.length} cells): ${renderTime.toFixed(2)}ms`);
      expect(renderTime).toBeLessThan(50); // Меньше 50ms для тестовой среды
    });

    it('должен обрабатывать пустой массив ячеек', () => {
      const emptyCells: any[] = [];
      const viewport = virtualGrid.getViewport();

      expect(() => {
        renderManager.render(emptyCells, viewport);
      }).not.toThrow();
    });
  });

  describe('Производительность instancing', () => {
    it('должен показывать улучшение производительности с instancing', () => {
      const testSizes = [
        { width: 10, height: 10, expectedCells: 100 },
        { width: 20, height: 20, expectedCells: 400 },
        { width: 30, height: 30, expectedCells: 900 },
      ];

      testSizes.forEach(size => {
        const startTime = performance.now();

        virtualGrid.setViewport(0, 0, size.width, size.height);
        const visibleCells = virtualGrid.getVisibleCells();
        const viewport = virtualGrid.getViewport();

        renderManager.render(visibleCells, viewport);

        const endTime = performance.now();
        const renderTime = endTime - startTime;

        console.log(
          `Viewport ${size.width}x${size.height} (${visibleCells.length} cells): ${renderTime.toFixed(2)}ms`
        );

        // Проверяем, что время рендеринга растет линейно, а не квадратично
        const timePerCell = renderTime / visibleCells.length;
        expect(timePerCell).toBeLessThan(0.1); // Меньше 0.1ms на ячейку
      });
    });

    it('должен эффективно обрабатывать множественные рендеры', () => {
      const iterations = 50;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        virtualGrid.setViewport(i, i, i + 10, i + 10);
        const visibleCells = virtualGrid.getVisibleCells();
        const viewport = virtualGrid.getViewport();

        renderManager.render(visibleCells, viewport);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      console.log(`Multiple renders (${iterations}): ${totalTime.toFixed(2)}ms`);
      console.log(`Average time per render: ${avgTime.toFixed(4)}ms`);

      expect(avgTime).toBeLessThan(2); // Меньше 2ms на рендер
    });
  });

  describe('Выделение ячеек', () => {
    it('должен рендерить выделение ячейки', () => {
      const selectedCell = {
        row: 5,
        col: 10,
        value: 'Test',
        screenX: 1000,
        screenY: 150,
        width: 100,
        height: 30,
      };

      expect(() => {
        renderManager.renderSelection(selectedCell);
      }).not.toThrow();
    });

    it('должен обрабатывать null выделение', () => {
      expect(() => {
        renderManager.renderSelection(null);
      }).not.toThrow();
    });
  });

  describe('Uniform буферы', () => {
    it('должен обновлять uniform буферы для разных viewport', () => {
      const viewports = [
        { startRow: 0, startCol: 0, endRow: 10, endCol: 10 },
        { startRow: 100, startCol: 100, endRow: 110, endCol: 110 },
        { startRow: 500, startCol: 500, endRow: 510, endCol: 510 },
      ];

      viewports.forEach(viewport => {
        virtualGrid.setViewport(
          viewport.startRow,
          viewport.startCol,
          viewport.endRow,
          viewport.endCol
        );
        const visibleCells = virtualGrid.getVisibleCells();
        const currentViewport = virtualGrid.getViewport();

        expect(() => {
          renderManager.render(visibleCells, currentViewport);
        }).not.toThrow();
      });
    });
  });

  describe('Обработка ошибок', () => {
    it('должен обрабатывать ошибки рендеринга', () => {
      // Передаем некорректные данные
      const invalidCells = null as any;
      const invalidViewport = null as any;

      expect(() => {
        renderManager.render(invalidCells, invalidViewport);
      }).toThrow();
    });

    it('должен обрабатывать ошибки инициализации', async () => {
      const invalidConfig = { ...mockWebGPUConfig, device: null };
      const invalidRenderManager = new RenderManager(invalidConfig as any, canvas);

      await expect(invalidRenderManager.initialize()).rejects.toThrow();
    });
  });

  describe('Статистика рендеринга', () => {
    it('должен предоставлять статистику рендеринга', () => {
      const stats = renderManager.getRenderStats();

      expect(stats).toBeDefined();
      expect(typeof stats.pipelinesCreated).toBe('number');
      expect(typeof stats.uniformBuffersCreated).toBe('number');
      expect(typeof stats.bindGroupsCreated).toBe('number');
    });
  });

  describe('Очистка ресурсов', () => {
    it('должен корректно очищать ресурсы', () => {
      expect(() => renderManager.dispose()).not.toThrow();
    });
  });

  describe('Интеграция с различными размерами', () => {
    it('должен работать с различными размерами canvas', () => {
      const canvasSizes = [
        { width: 800, height: 600 },
        { width: 1920, height: 1080 },
        { width: 2560, height: 1440 },
      ];

      canvasSizes.forEach(size => {
        canvas.width = size.width;
        canvas.height = size.height;

        virtualGrid = new VirtualGrid(size.width, size.height, 100, 30, 1000, 1000);
        const visibleCells = virtualGrid.getVisibleCells();
        const viewport = virtualGrid.getViewport();

        expect(() => {
          renderManager.render(visibleCells, viewport);
        }).not.toThrow();
      });
    });
  });
});
