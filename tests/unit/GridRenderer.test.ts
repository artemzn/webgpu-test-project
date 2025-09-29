/**
 * Тесты для GridRenderer
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { GridRenderer } from '../../src/rendering/GridRenderer.js';
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

describe('GridRenderer Tests', () => {
  let gridRenderer: GridRenderer;
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

  beforeEach(() => {
    // Создаем новый GridRenderer для каждого теста
    gridRenderer = new GridRenderer(mockWebGPUConfig as any, canvas, 100, 30);

    // Создаем виртуальную сетку
    virtualGrid = new VirtualGrid(1920, 1080, 100, 30, 1000, 1000);
  });

  describe('Инициализация', () => {
    it('должен создаваться с правильными параметрами', () => {
      expect(gridRenderer).toBeDefined();

      const stats = gridRenderer.getRenderStats();
      expect(stats.cellSize.width).toBe(100);
      expect(stats.cellSize.height).toBe(30);
      expect(stats.needsRedraw).toBe(true);
    });

    it('должен инициализироваться без ошибок', async () => {
      await expect(gridRenderer.initialize()).resolves.not.toThrow();
    });
  });

  describe('Рендеринг', () => {
    beforeEach(async () => {
      await gridRenderer.initialize();
    });

    it('должен рендерить видимые ячейки', async () => {
      const visibleCells = virtualGrid.getVisibleCells();
      const viewport = virtualGrid.getViewport();

      await expect(gridRenderer.render(visibleCells, viewport)).resolves.not.toThrow();
    });

    it('должен кешировать результаты рендеринга', async () => {
      const visibleCells = virtualGrid.getVisibleCells();
      const viewport = virtualGrid.getViewport();

      // Первый рендер
      await gridRenderer.render(visibleCells, viewport);
      const stats1 = gridRenderer.getRenderStats();

      // Второй рендер с теми же параметрами
      await gridRenderer.render(visibleCells, viewport);
      const stats2 = gridRenderer.getRenderStats();

      expect(stats1.lastViewport).toEqual(stats2.lastViewport);
      expect(stats1.visibleCellsCount).toBe(stats2.visibleCellsCount);
    });

    it('должен обновлять кеш при изменении viewport', async () => {
      const visibleCells = virtualGrid.getVisibleCells();
      const viewport1 = virtualGrid.getViewport();

      // Первый рендер
      await gridRenderer.render(visibleCells, viewport1);

      // Изменяем viewport
      virtualGrid.setViewport(10, 10, 20, 20);
      const viewport2 = virtualGrid.getViewport();
      const newVisibleCells = virtualGrid.getVisibleCells();

      // Второй рендер
      await gridRenderer.render(newVisibleCells, viewport2);
      const stats = gridRenderer.getRenderStats();

      expect(stats.lastViewport).toEqual(viewport2);
      expect(stats.visibleCellsCount).toBe(newVisibleCells.length);
    });
  });

  describe('Настройки', () => {
    beforeEach(async () => {
      await gridRenderer.initialize();
    });

    it('должен изменять размер ячеек', () => {
      gridRenderer.setCellSize(150, 40);

      const stats = gridRenderer.getRenderStats();
      expect(stats.cellSize.width).toBe(150);
      expect(stats.cellSize.height).toBe(40);
      expect(stats.needsRedraw).toBe(true);
    });

    it('должен изменять цвета', () => {
      const newGridColor: [number, number, number, number] = [0.8, 0.8, 0.8, 1.0];
      const newBorderColor: [number, number, number, number] = [0.6, 0.6, 0.6, 1.0];

      gridRenderer.setColors(newGridColor, newBorderColor);

      const stats = gridRenderer.getRenderStats();
      expect(stats.needsRedraw).toBe(true);
    });

    it('должен принудительно обновлять рендеринг', () => {
      gridRenderer.forceRedraw();

      const stats = gridRenderer.getRenderStats();
      expect(stats.needsRedraw).toBe(true);
      expect(stats.lastViewport).toBeNull();
    });
  });

  describe('Выделение ячеек', () => {
    beforeEach(async () => {
      await gridRenderer.initialize();
    });

    it('должен рендерить выделение ячейки', async () => {
      const selectedCell = {
        row: 5,
        col: 10,
        value: 'Test',
        screenX: 1000,
        screenY: 150,
        width: 100,
        height: 30,
      };

      await expect(gridRenderer.renderSelection(selectedCell)).resolves.not.toThrow();
    });

    it('должен обрабатывать null выделение', async () => {
      await expect(gridRenderer.renderSelection(null)).resolves.not.toThrow();
    });
  });

  describe('Производительность', () => {
    beforeEach(async () => {
      await gridRenderer.initialize();
    });

    it('должен эффективно рендерить большие viewport', async () => {
      const startTime = performance.now();

      // Создаем большой viewport
      virtualGrid.setViewport(0, 0, 100, 100);
      const visibleCells = virtualGrid.getVisibleCells();
      const viewport = virtualGrid.getViewport();

      await gridRenderer.render(visibleCells, viewport);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      console.log(`Большой viewport (100x100): ${renderTime.toFixed(2)}ms`);
      expect(renderTime).toBeLessThan(200); // Меньше 200ms для тестовой среды
    });

    it('должен эффективно обрабатывать множественные рендеры', async () => {
      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        virtualGrid.setViewport(i, i, i + 10, i + 10);
        const visibleCells = virtualGrid.getVisibleCells();
        const viewport = virtualGrid.getViewport();

        await gridRenderer.render(visibleCells, viewport);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      console.log(`Множественные рендеры (${iterations}): ${totalTime.toFixed(2)}ms`);
      console.log(`Среднее время на рендер: ${avgTime.toFixed(4)}ms`);

      expect(avgTime).toBeLessThan(5); // Меньше 5ms на рендер для тестовой среды
    });
  });

  describe('Очистка ресурсов', () => {
    it('должен корректно очищать ресурсы', async () => {
      await gridRenderer.initialize();

      expect(() => gridRenderer.dispose()).not.toThrow();

      // После dispose не должно быть ошибок при попытке использовать
      const stats = gridRenderer.getRenderStats();
      expect(stats.lastViewport).toBeNull();
    });
  });

  describe('Интеграция с VirtualGrid', () => {
    beforeEach(async () => {
      await gridRenderer.initialize();
    });

    it('должен корректно работать с VirtualGrid', async () => {
      // Тестируем различные операции с VirtualGrid
      virtualGrid.scrollDown();
      virtualGrid.scrollRight();
      virtualGrid.setViewport(50, 50, 100, 100);

      const visibleCells = virtualGrid.getVisibleCells();
      const viewport = virtualGrid.getViewport();

      await expect(gridRenderer.render(visibleCells, viewport)).resolves.not.toThrow();

      const stats = gridRenderer.getRenderStats();
      expect(stats.visibleCellsCount).toBe(visibleCells.length);
    });

    it('должен обрабатывать изменения размера canvas', async () => {
      // Имитируем изменение размера canvas
      canvas.width = 2560;
      canvas.height = 1440;

      virtualGrid = new VirtualGrid(2560, 1440, 100, 30, 1000, 1000);
      const visibleCells = virtualGrid.getVisibleCells();
      const viewport = virtualGrid.getViewport();

      await expect(gridRenderer.render(visibleCells, viewport)).resolves.not.toThrow();
    });
  });

  describe('Обработка ошибок', () => {
    it('должен обрабатывать ошибки инициализации', async () => {
      const invalidConfig = { ...mockWebGPUConfig, device: null };
      const invalidRenderer = new GridRenderer(invalidConfig as any, canvas, 100, 30);

      await expect(invalidRenderer.initialize()).rejects.toThrow();
    });

    it('должен обрабатывать ошибки рендеринга', async () => {
      await gridRenderer.initialize();

      // Передаем некорректные данные
      const invalidCells = null as any;
      const invalidViewport = null as any;

      await expect(gridRenderer.render(invalidCells, invalidViewport)).rejects.toThrow();
    });
  });
});
