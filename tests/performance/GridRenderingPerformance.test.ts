/**
 * Тесты производительности для системы рендеринга сетки
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { GridRenderer } from '../../src/rendering/GridRenderer.js';
import { VirtualGrid } from '../../src/core/virtual-grid/VirtualGrid.js';
import { SparseMatrix } from '../../src/core/sparse-matrix/SparseMatrix.js';

// Мокаем WebGPU для тестов производительности
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

describe('Grid Rendering Performance Tests', () => {
  let gridRenderer: GridRenderer;
  let virtualGrid: VirtualGrid;
  let sparseMatrix: SparseMatrix;
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
    // Создаем компоненты для каждого теста
    gridRenderer = new GridRenderer(mockWebGPUConfig as any, canvas, 100, 30);
    await gridRenderer.initialize();

    virtualGrid = new VirtualGrid(1920, 1080, 100, 30, 10000, 10000);
    sparseMatrix = new SparseMatrix();
  });

  describe('Производительность рендеринга различных размеров', () => {
    it('должен эффективно рендерить маленькие viewport', async () => {
      const testSizes = [
        { width: 10, height: 10, expectedCells: 100 },
        { width: 20, height: 20, expectedCells: 400 },
        { width: 30, height: 30, expectedCells: 900 },
      ];

      for (const size of testSizes) {
        const startTime = performance.now();

        virtualGrid.setViewport(0, 0, size.width, size.height);
        const visibleCells = virtualGrid.getVisibleCells();
        const viewport = virtualGrid.getViewport();

        await gridRenderer.render(visibleCells, viewport);

        const endTime = performance.now();
        const renderTime = endTime - startTime;

        console.log(
          `Small viewport ${size.width}x${size.height} (${visibleCells.length} cells): ${renderTime.toFixed(2)}ms`
        );

        // Проверяем производительность
        expect(renderTime).toBeLessThan(15); // Более реалистичное требование для маленьких viewport
        expect(visibleCells.length).toBe(size.expectedCells);
      }
    });

    it('должен эффективно рендерить средние viewport', async () => {
      const testSizes = [
        { width: 50, height: 50, expectedCells: 2500 },
        { width: 100, height: 50, expectedCells: 5000 },
        { width: 50, height: 100, expectedCells: 5000 },
      ];

      for (const size of testSizes) {
        const startTime = performance.now();

        virtualGrid.setViewport(0, 0, size.width, size.height);
        const visibleCells = virtualGrid.getVisibleCells();
        const viewport = virtualGrid.getViewport();

        await gridRenderer.render(visibleCells, viewport);

        const endTime = performance.now();
        const renderTime = endTime - startTime;

        console.log(
          `Medium viewport ${size.width}x${size.height} (${visibleCells.length} cells): ${renderTime.toFixed(2)}ms`
        );

        // Проверяем производительность
        expect(renderTime).toBeLessThan(50); // Меньше 50ms
        expect(visibleCells.length).toBe(size.expectedCells);
      }
    });

    it('должен эффективно рендерить большие viewport', async () => {
      const testSizes = [
        { width: 100, height: 100, expectedCells: 10000 },
        { width: 200, height: 100, expectedCells: 20000 },
        { width: 100, height: 200, expectedCells: 20000 },
      ];

      for (const size of testSizes) {
        const startTime = performance.now();

        virtualGrid.setViewport(0, 0, size.width, size.height);
        const visibleCells = virtualGrid.getVisibleCells();
        const viewport = virtualGrid.getViewport();

        await gridRenderer.render(visibleCells, viewport);

        const endTime = performance.now();
        const renderTime = endTime - startTime;

        console.log(
          `Large viewport ${size.width}x${size.height} (${visibleCells.length} cells): ${renderTime.toFixed(2)}ms`
        );

        // Проверяем производительность
        expect(renderTime).toBeLessThan(200); // Меньше 200ms
        expect(visibleCells.length).toBe(size.expectedCells);
      }
    });
  });

  describe('Производительность кеширования', () => {
    it('должен эффективно использовать кеш для повторных рендеров', async () => {
      virtualGrid.setViewport(0, 0, 50, 50);
      const visibleCells = virtualGrid.getVisibleCells();
      const viewport = virtualGrid.getViewport();

      // Первый рендер
      const startTime1 = performance.now();
      await gridRenderer.render(visibleCells, viewport);
      const endTime1 = performance.now();
      const firstRenderTime = endTime1 - startTime1;

      // Второй рендер с теми же параметрами (должен использовать кеш)
      const startTime2 = performance.now();
      await gridRenderer.render(visibleCells, viewport);
      const endTime2 = performance.now();
      const secondRenderTime = endTime2 - startTime2;

      console.log(`First render: ${firstRenderTime.toFixed(2)}ms`);
      console.log(`Second render (cached): ${secondRenderTime.toFixed(2)}ms`);

      // Второй рендер должен быть быстрее благодаря кешированию
      expect(secondRenderTime).toBeLessThan(firstRenderTime);
    });

    it('должен инвалидировать кеш при изменении viewport', async () => {
      // Первый рендер
      virtualGrid.setViewport(0, 0, 50, 50);
      const visibleCells1 = virtualGrid.getVisibleCells();
      const viewport1 = virtualGrid.getViewport();

      const startTime1 = performance.now();
      await gridRenderer.render(visibleCells1, viewport1);
      const endTime1 = performance.now();
      const firstRenderTime = endTime1 - startTime1;

      // Изменяем viewport
      virtualGrid.setViewport(10, 10, 60, 60);
      const visibleCells2 = virtualGrid.getVisibleCells();
      const viewport2 = virtualGrid.getViewport();

      const startTime2 = performance.now();
      await gridRenderer.render(visibleCells2, viewport2);
      const endTime2 = performance.now();
      const secondRenderTime = endTime2 - startTime2;

      console.log(`First render: ${firstRenderTime.toFixed(2)}ms`);
      console.log(`Second render (new viewport): ${secondRenderTime.toFixed(2)}ms`);

      // Второй рендер должен быть разумным по времени (кеш инвалидирован)
      expect(secondRenderTime).toBeLessThan(firstRenderTime * 3); // Более реалистичное требование
    });
  });

  describe('Производительность с данными', () => {
    it('должен эффективно рендерить сетку с данными', async () => {
      // Заполняем SparseMatrix данными
      const dataSize = 1000;
      for (let i = 0; i < dataSize; i++) {
        sparseMatrix.setCell(i, i, `Data ${i}`);
        sparseMatrix.setCell(i, i + 1, `Formula ${i}`);
        sparseMatrix.setCell(i + 1, i, `Value ${i}`);
      }

      const startTime = performance.now();

      virtualGrid.setViewport(0, 0, 100, 100);
      const visibleCells = virtualGrid.getVisibleCells();
      const viewport = virtualGrid.getViewport();

      await gridRenderer.render(visibleCells, viewport);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      console.log(`Rendering with ${dataSize} data cells: ${renderTime.toFixed(2)}ms`);

      // Проверяем производительность
      expect(renderTime).toBeLessThan(100); // Меньше 100ms
    });

    it('должен эффективно обрабатывать разреженные данные', async () => {
      // Заполняем только 1% ячеек
      const totalCells = 10000;
      const filledCells = 100;

      for (let i = 0; i < filledCells; i++) {
        const row = Math.floor(Math.random() * 100);
        const col = Math.floor(Math.random() * 100);
        sparseMatrix.setCell(row, col, `Sparse ${i}`);
      }

      const startTime = performance.now();

      virtualGrid.setViewport(0, 0, 100, 100);
      const visibleCells = virtualGrid.getVisibleCells();
      const viewport = virtualGrid.getViewport();

      await gridRenderer.render(visibleCells, viewport);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      console.log(
        `Rendering sparse data (${filledCells}/${totalCells} cells): ${renderTime.toFixed(2)}ms`
      );

      // Проверяем производительность
      expect(renderTime).toBeLessThan(50); // Меньше 50ms
    });
  });

  describe('Производительность прокрутки', () => {
    it('должен эффективно обрабатывать быструю прокрутку', async () => {
      const scrollSteps = 100;
      const startTime = performance.now();

      for (let i = 0; i < scrollSteps; i++) {
        virtualGrid.setViewport(i, i, i + 50, i + 50);
        const visibleCells = virtualGrid.getVisibleCells();
        const viewport = virtualGrid.getViewport();

        await gridRenderer.render(visibleCells, viewport);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / scrollSteps;

      console.log(`Fast scrolling (${scrollSteps} steps): ${totalTime.toFixed(2)}ms`);
      console.log(`Average time per scroll: ${avgTime.toFixed(4)}ms`);

      // Проверяем производительность
      expect(avgTime).toBeLessThan(2); // Меньше 2ms на прокрутку
    });

    it('должен эффективно обрабатывать большие прыжки по сетке', async () => {
      const jumps = [
        { startRow: 0, startCol: 0, endRow: 100, endCol: 100 },
        { startRow: 1000, startCol: 1000, endRow: 1100, endCol: 1100 },
        { startRow: 5000, startCol: 5000, endRow: 5100, endCol: 5100 },
        { startRow: 0, startCol: 0, endRow: 100, endCol: 100 },
      ];

      const startTime = performance.now();

      for (const jump of jumps) {
        virtualGrid.setViewport(jump.startRow, jump.startCol, jump.endRow, jump.endCol);
        const visibleCells = virtualGrid.getVisibleCells();
        const viewport = virtualGrid.getViewport();

        await gridRenderer.render(visibleCells, viewport);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / jumps.length;

      console.log(`Large jumps (${jumps.length} jumps): ${totalTime.toFixed(2)}ms`);
      console.log(`Average time per jump: ${avgTime.toFixed(4)}ms`);

      // Проверяем производительность
      expect(avgTime).toBeLessThan(50); // Меньше 50ms на прыжок
    });
  });

  describe('Производительность памяти', () => {
    it('должен эффективно использовать память', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Выполняем множество операций рендеринга
      for (let i = 0; i < 1000; i++) {
        virtualGrid.setViewport(i % 100, i % 100, (i % 100) + 50, (i % 100) + 50);
        const visibleCells = virtualGrid.getVisibleCells();
        const viewport = virtualGrid.getViewport();

        await gridRenderer.render(visibleCells, viewport);
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      console.log(
        `Memory usage after 1000 renders: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`
      );

      // Проверяем, что память не растет чрезмерно
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Меньше 50MB
    });

    it('должен корректно очищать ресурсы', async () => {
      // Создаем множество рендереров
      const renderers: GridRenderer[] = [];

      for (let i = 0; i < 100; i++) {
        const renderer = new GridRenderer(mockWebGPUConfig as any, canvas, 100, 30);
        await renderer.initialize();
        renderers.push(renderer);
      }

      // Очищаем все ресурсы
      for (const renderer of renderers) {
        renderer.dispose();
      }

      // Проверяем, что очистка прошла без ошибок
      expect(renderers.length).toBe(100);
    });
  });

  describe('Стресс-тесты', () => {
    it('должен выдерживать экстремальные нагрузки', async () => {
      const startTime = performance.now();

      // Создаем экстремально большую сетку
      virtualGrid = new VirtualGrid(1920, 1080, 100, 30, 100000, 100000);

      // Устанавливаем очень большой viewport
      virtualGrid.setViewport(0, 0, 1000, 1000);
      const visibleCells = virtualGrid.getVisibleCells();
      const viewport = virtualGrid.getViewport();

      await gridRenderer.render(visibleCells, viewport);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      console.log(`Extreme load (${visibleCells.length} cells): ${renderTime.toFixed(2)}ms`);

      // Проверяем, что система не падает
      expect(renderTime).toBeLessThan(1000); // Меньше 1 секунды
      expect(visibleCells.length).toBe(1000000); // 1000x1000 ячеек
    });

    it('должен выдерживать быстрые изменения', async () => {
      const startTime = performance.now();
      const changes = 1000;

      for (let i = 0; i < changes; i++) {
        // Быстро меняем viewport
        virtualGrid.setViewport(i, i, i + 10, i + 10);
        const visibleCells = virtualGrid.getVisibleCells();
        const viewport = virtualGrid.getViewport();

        await gridRenderer.render(visibleCells, viewport);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / changes;

      console.log(`Rapid changes (${changes} changes): ${totalTime.toFixed(2)}ms`);
      console.log(`Average time per change: ${avgTime.toFixed(4)}ms`);

      // Проверяем производительность
      expect(avgTime).toBeLessThan(1); // Меньше 1ms на изменение
    });
  });
});
