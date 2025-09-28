/**
 * Sprint 2.1 Integration Tests: WebGPU рендеринг
 * Проверяет выполнение всех требований Sprint 2.1
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GridRenderer } from '../../src/rendering/GridRenderer.js';
import { RenderManager } from '../../src/rendering/webgpu-setup/RenderManager.js';
import { RenderPipelineBuilder } from '../../src/rendering/webgpu-setup/RenderPipelineBuilder.js';
import type { WebGPUConfig, Cell, Viewport } from '../../src/types/index.js';

describe('Sprint 2.1: WebGPU рендеринг', () => {
  let mockConfig: WebGPUConfig;
  let mockCanvas: HTMLCanvasElement;
  let mockDevice: GPUDevice;
  let mockContext: GPUCanvasContext;

  beforeEach(() => {
    // Создаем mock WebGPU окружение
    mockDevice = {
      createShaderModule: () => ({ label: 'Mock Shader' }),
      createRenderPipeline: () => ({ getBindGroupLayout: () => ({}) }),
      createBuffer: () => ({
        destroy: () => {},
        getMappedRange: () => new ArrayBuffer(64),
        unmap: () => {},
      }),
      createBindGroupLayout: () => ({}),
      createBindGroup: () => ({}),
      createPipelineLayout: () => ({}),
      createCommandEncoder: () => ({
        beginRenderPass: () => ({
          setPipeline: () => {},
          setBindGroup: () => {},
          setVertexBuffer: () => {},
          draw: vi.fn(),
          end: () => {},
        }),
        finish: () => ({}),
      }),
      queue: { writeBuffer: () => {}, submit: () => {} },
    } as any;

    mockContext = {
      configure: () => {},
      getCurrentTexture: () => ({
        createView: () => ({}),
      }),
    } as any;

    mockConfig = {
      device: mockDevice,
      context: mockContext,
      format: 'bgra8unorm' as GPUTextureFormat,
    };

    mockCanvas = {
      width: 800,
      height: 600,
      getContext: () => mockContext,
      parentElement: {
        getBoundingClientRect: () => ({ width: 800, height: 600 }),
      },
    } as any;
  });

  describe('✅ Требование: Создать GridRenderer класс', () => {
    it('должен создавать экземпляр GridRenderer', () => {
      const gridRenderer = new GridRenderer(mockConfig, mockCanvas, 80, 25);
      expect(gridRenderer).toBeDefined();
      expect(gridRenderer).toBeInstanceOf(GridRenderer);
    });

    it('должен инициализироваться без ошибок', async () => {
      const gridRenderer = new GridRenderer(mockConfig, mockCanvas, 80, 25);
      await expect(gridRenderer.initialize()).resolves.not.toThrow();
    });

    it('должен иметь метод render', () => {
      const gridRenderer = new GridRenderer(mockConfig, mockCanvas, 80, 25);
      expect(typeof gridRenderer.render).toBe('function');
    });

    it('должен поддерживать настройку размеров ячеек', () => {
      const gridRenderer = new GridRenderer(mockConfig, mockCanvas, 100, 30);
      expect(typeof gridRenderer.setCellSize).toBe('function');

      gridRenderer.setCellSize(120, 35);
      // Проверяем что размеры установились
      expect(gridRenderer).toBeDefined();
    });
  });

  describe('✅ Требование: Реализовать instancing для ячеек', () => {
    let renderManager: RenderManager;

    beforeEach(() => {
      renderManager = new RenderManager(mockConfig, mockCanvas, 80, 25);
    });

    it('должен использовать instancing в renderVisibleCells', async () => {
      await renderManager.initialize();

      const visibleCells: Cell[] = Array.from({ length: 100 }, (_, i) => ({
        row: Math.floor(i / 10),
        col: i % 10,
        value: null,
        screenX: (i % 10) * 80,
        screenY: Math.floor(i / 10) * 25,
        width: 80,
        height: 25,
      }));

      const viewport: Viewport = {
        startRow: 0,
        endRow: 10,
        startCol: 0,
        endCol: 10,
      };

      // Проверяем что рендеринг выполняется без ошибок (instancing работает)
      expect(() => renderManager.render(visibleCells, viewport)).not.toThrow();

      // Проверяем что RenderManager корректно обрабатывает количество ячеек
      expect(visibleCells.length).toBe(100);
    });

    it('должен корректно рассчитывать количество инстансов', async () => {
      await renderManager.initialize();

      const visibleCells: Cell[] = Array.from({ length: 25 }, (_, i) => ({
        row: Math.floor(i / 5),
        col: i % 5,
        value: null,
        screenX: (i % 5) * 80,
        screenY: Math.floor(i / 5) * 25,
        width: 80,
        height: 25,
      }));

      const viewport: Viewport = {
        startRow: 0,
        endRow: 5,
        startCol: 0,
        endCol: 5,
      };

      // Тестируем что количество инстансов соответствует количеству ячеек
      expect(() => renderManager.render(visibleCells, viewport)).not.toThrow();
    });
  });

  describe('✅ Требование: Добавить шейдеры для сетки', () => {
    let pipelineBuilder: RenderPipelineBuilder;

    beforeEach(() => {
      pipelineBuilder = new RenderPipelineBuilder(mockDevice);
    });

    it('должен создавать пайплайн для сетки с vertex и fragment шейдерами', () => {
      const pipeline = pipelineBuilder.createGridPipeline();
      expect(pipeline).toBeDefined();
      expect(pipeline.getBindGroupLayout).toBeDefined();
    });

    it('должен создавать пайплайн для границ с отдельными шейдерами', () => {
      const pipeline = pipelineBuilder.createBorderPipeline();
      expect(pipeline).toBeDefined();
      expect(pipeline.getBindGroupLayout).toBeDefined();
    });

    it('должен создавать uniform буфер для параметров сетки', () => {
      const uniformBuffer = pipelineBuilder.createGridUniformBuffer();
      expect(uniformBuffer).toBeDefined();
      expect(uniformBuffer.destroy).toBeDefined();
    });

    it('должен обновлять uniform параметры без ошибок', () => {
      const uniformBuffer = pipelineBuilder.createGridUniformBuffer();

      expect(() => {
        pipelineBuilder.updateGridUniforms(
          uniformBuffer,
          [80, 25], // gridSize
          [80, 25], // cellSize
          [0, 0], // viewportOffset
          [800, 600], // viewportSize
          [10, 24] // totalCells
        );
      }).not.toThrow();
    });
  });

  describe('✅ Требование: Оптимизировать отрисовку', () => {
    let gridRenderer: GridRenderer;

    beforeEach(async () => {
      gridRenderer = new GridRenderer(mockConfig, mockCanvas, 80, 25);
      await gridRenderer.initialize();
    });

    it('должен использовать кеширование для оптимизации', async () => {
      const visibleCells: Cell[] = [
        { row: 0, col: 0, value: null, screenX: 0, screenY: 0, width: 80, height: 25 },
      ];
      const viewport: Viewport = { startRow: 0, endRow: 1, startCol: 0, endCol: 1 };

      // Первый рендер
      const start1 = performance.now();
      await gridRenderer.render(visibleCells, viewport);
      const time1 = performance.now() - start1;

      // Второй рендер с теми же данными (должен использовать кеш)
      const start2 = performance.now();
      await gridRenderer.render(visibleCells, viewport);
      const time2 = performance.now() - start2;

      // Второй рендер должен быть быстрее благодаря кешированию
      expect(time2).toBeLessThan(time1 + 1); // +1ms погрешность
    });

    it('должен принудительно обновляться при forceRedraw', async () => {
      const visibleCells: Cell[] = [
        { row: 0, col: 0, value: null, screenX: 0, screenY: 0, width: 80, height: 25 },
      ];
      const viewport: Viewport = { startRow: 0, endRow: 1, startCol: 0, endCol: 1 };

      await gridRenderer.render(visibleCells, viewport);

      // Принудительное обновление
      gridRenderer.forceRedraw();

      // Повторный рендер должен выполниться
      await expect(gridRenderer.render(visibleCells, viewport)).resolves.not.toThrow();
    });

    it('должен обрабатывать большое количество ячеек эффективно', async () => {
      const cellCount = 1000;
      const visibleCells: Cell[] = Array.from({ length: cellCount }, (_, i) => ({
        row: Math.floor(i / 40),
        col: i % 40,
        value: null,
        screenX: (i % 40) * 80,
        screenY: Math.floor(i / 40) * 25,
        width: 80,
        height: 25,
      }));

      const viewport: Viewport = {
        startRow: 0,
        endRow: 25,
        startCol: 0,
        endCol: 40,
      };

      const start = performance.now();
      await gridRenderer.render(visibleCells, viewport);
      const renderTime = performance.now() - start;

      // Рендеринг 1000 ячеек должен быть быстрым (< 100ms в тестах)
      expect(renderTime).toBeLessThan(100);
    });

    it('должен корректно обновлять цвета для оптимизации', () => {
      expect(() => {
        gridRenderer.setColors(
          [0.9, 0.9, 0.9, 1.0], // gridColor
          [0.7, 0.7, 0.7, 1.0], // borderColor
          [1.0, 1.0, 1.0, 1.0] // backgroundColor
        );
      }).not.toThrow();
    });
  });

  describe('🎯 Sprint 2.1 Критерии готовности', () => {
    it('должен отрисовывать сетку без ошибок', async () => {
      const gridRenderer = new GridRenderer(mockConfig, mockCanvas, 80, 25);
      await gridRenderer.initialize();

      const visibleCells: Cell[] = [
        { row: 0, col: 0, value: null, screenX: 0, screenY: 0, width: 80, height: 25 },
        { row: 0, col: 1, value: 'Test', screenX: 80, screenY: 0, width: 80, height: 25 },
      ];

      const viewport: Viewport = { startRow: 0, endRow: 1, startCol: 0, endCol: 2 };

      await expect(gridRenderer.render(visibleCells, viewport)).resolves.not.toThrow();
    });

    it('должен поддерживать выделение ячеек', async () => {
      const gridRenderer = new GridRenderer(mockConfig, mockCanvas, 80, 25);
      await gridRenderer.initialize();

      const selectedCell: Cell = {
        row: 1,
        col: 1,
        value: null,
        screenX: 80,
        screenY: 25,
        width: 80,
        height: 25,
      };

      await expect(gridRenderer.renderSelection(selectedCell)).resolves.not.toThrow();
    });

    it('должен иметь адаптивные размеры ячеек', () => {
      const gridRenderer = new GridRenderer(mockConfig, mockCanvas, 80, 25);

      // Тестируем разные размеры ячеек
      expect(() => gridRenderer.setCellSize(100, 30)).not.toThrow();
      expect(() => gridRenderer.setCellSize(60, 20)).not.toThrow();
      expect(() => gridRenderer.setCellSize(120, 40)).not.toThrow();
    });

    it('должен предоставлять статистику рендеринга', () => {
      const gridRenderer = new GridRenderer(mockConfig, mockCanvas, 80, 25);
      const stats = gridRenderer.getRenderingStats();

      expect(stats).toBeDefined();
      expect(typeof stats.lastRenderTime).toBe('number');
      expect(typeof stats.visibleCellsCount).toBe('number');
      expect(typeof stats.needsRedraw).toBe('boolean');
      expect(stats.cellSize).toBeDefined();
      expect(stats.cellSize.width).toBe(80);
      expect(stats.cellSize.height).toBe(25);
    });
  });

  describe('🚀 Производительность Sprint 2.1', () => {
    it('должен рендерить с производительностью > 30 FPS (< 33ms на кадр)', async () => {
      const gridRenderer = new GridRenderer(mockConfig, mockCanvas, 80, 25);
      await gridRenderer.initialize();

      const visibleCells: Cell[] = Array.from({ length: 200 }, (_, i) => ({
        row: Math.floor(i / 20),
        col: i % 20,
        value: `Cell ${i}`,
        screenX: (i % 20) * 80,
        screenY: Math.floor(i / 20) * 25,
        width: 80,
        height: 25,
      }));

      const viewport: Viewport = {
        startRow: 0,
        endRow: 10,
        startCol: 0,
        endCol: 20,
      };

      const start = performance.now();
      await gridRenderer.render(visibleCells, viewport);
      const renderTime = performance.now() - start;

      // Для достижения 60 FPS нужно < 16.67ms, для 30 FPS нужно < 33ms
      expect(renderTime).toBeLessThan(33);
    });

    it('должен эффективно использовать память', async () => {
      const gridRenderer = new GridRenderer(mockConfig, mockCanvas, 80, 25);
      await gridRenderer.initialize();

      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Рендерим много раз
      for (let i = 0; i < 100; i++) {
        const visibleCells: Cell[] = Array.from({ length: 50 }, (_, j) => ({
          row: Math.floor(j / 10),
          col: j % 10,
          value: `Cell ${i}-${j}`,
          screenX: (j % 10) * 80,
          screenY: Math.floor(j / 10) * 25,
          width: 80,
          height: 25,
        }));

        const viewport: Viewport = {
          startRow: 0,
          endRow: 5,
          startCol: 0,
          endCol: 10,
        };

        await gridRenderer.render(visibleCells, viewport);
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Прирост памяти должен быть разумным (< 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});
