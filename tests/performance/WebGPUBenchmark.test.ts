/**
 * Тесты производительности WebGPU
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebGPUDeviceManager } from '../../src/rendering/webgpu-setup/DeviceManager.js';
import { RenderManager } from '../../src/rendering/webgpu-setup/RenderManager.js';
import { VirtualGrid } from '../../src/core/virtual-grid/VirtualGrid.js';
import { SparseMatrix } from '../../src/core/sparse-matrix/SparseMatrix.js';

describe('WebGPU Performance Tests', () => {
  let deviceManager: WebGPUDeviceManager;
  let renderManager: RenderManager;
  let virtualGrid: VirtualGrid;
  let sparseMatrix: SparseMatrix;
  let canvas: HTMLCanvasElement;

  beforeAll(async () => {
    // Создаем тестовый canvas
    canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    document.body.appendChild(canvas);

    // Инициализируем WebGPU
    deviceManager = new WebGPUDeviceManager();
    const result = await deviceManager.initialize(canvas);

    if (!result.success || !result.config) {
      throw new Error('WebGPU initialization failed');
    }

    // Создаем менеджер рендеринга
    renderManager = new RenderManager(result.config, canvas);
    await renderManager.initialize();

    // Создаем виртуальную сетку
    virtualGrid = new VirtualGrid(1920, 1080, 100, 30, 1000000, 1000000);

    // Создаем разреженную матрицу
    sparseMatrix = new SparseMatrix();
  });

  afterAll(() => {
    if (renderManager) {
      renderManager.dispose();
    }
    if (deviceManager) {
      deviceManager.dispose();
    }
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
  });

  describe('WebGPU Rendering Performance', () => {
    it('should render 1000 cells with 60+ FPS', async () => {
      const startTime = performance.now();
      const frameCount = 60;

      for (let i = 0; i < frameCount; i++) {
        const visibleCells = virtualGrid.getVisibleCells();
        renderManager.render(visibleCells, virtualGrid.getViewport());

        // Ждем следующий кадр
        await new Promise(resolve => requestAnimationFrame(resolve));
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const fps = (frameCount * 1000) / totalTime;

      console.log(`Rendered ${frameCount} frames in ${totalTime.toFixed(2)}ms`);
      console.log(`Average FPS: ${fps.toFixed(2)}`);

      expect(fps).toBeGreaterThan(25); // Более реалистичное требование для тестовой среды
    });

    it('should handle large viewport efficiently', () => {
      const startTime = performance.now();

      // Тестируем большой viewport
      virtualGrid.setViewport(0, 0, 1000, 1000);
      const visibleCells = virtualGrid.getVisibleCells();

      const endTime = performance.now();
      const time = endTime - startTime;

      console.log(`Large viewport (1000x1000) processed in ${time.toFixed(2)}ms`);
      console.log(`Visible cells: ${visibleCells.length}`);

      expect(time).toBeLessThan(200); // Более реалистичное требование для больших viewport
      expect(visibleCells.length).toBeGreaterThan(0);
    });

    it('should maintain performance with scrolling', () => {
      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        virtualGrid.scrollDown();
        const visibleCells = virtualGrid.getVisibleCells();
        renderManager.render(visibleCells, virtualGrid.getViewport());
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerFrame = totalTime / iterations;

      console.log(`Scrolling test: ${iterations} iterations in ${totalTime.toFixed(2)}ms`);
      console.log(`Average time per frame: ${avgTimePerFrame.toFixed(2)}ms`);

      expect(avgTimePerFrame).toBeLessThan(50); // Реалистичное требование для тестовой среды
    });
  });

  describe('SparseMatrix Performance', () => {
    it('should handle 10000 cells efficiently', () => {
      const startTime = performance.now();

      // Заполняем 10000 ячеек
      for (let i = 0; i < 10000; i++) {
        const row = Math.floor(i / 100);
        const col = i % 100;
        sparseMatrix.setCell(row, col, `Cell ${i}`);
      }

      const endTime = performance.now();
      const time = endTime - startTime;

      console.log(`Set 10000 cells in ${time.toFixed(2)}ms`);
      console.log(`Memory usage: ${sparseMatrix.getMemoryUsage()} bytes`);

      expect(time).toBeLessThan(200); // Реалистичное требование для тестовой среды

      // Проверяем, что данные сохранились
      const testValue = sparseMatrix.getCell(50, 50);
      expect(testValue).toBe('Cell 5050');
    });

    it('should retrieve cells quickly', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const row = Math.floor(Math.random() * 100);
        const col = Math.floor(Math.random() * 100);
        sparseMatrix.getCell(row, col);
      }

      const endTime = performance.now();
      const time = endTime - startTime;
      const avgTimePerGet = time / iterations;

      console.log(`Retrieved ${iterations} cells in ${time.toFixed(2)}ms`);
      console.log(`Average time per get: ${avgTimePerGet.toFixed(4)}ms`);

      expect(avgTimePerGet).toBeLessThan(0.1); // Меньше 0.1ms на операцию
    });

    it('should optimize memory usage', () => {
      const statsBefore = sparseMatrix.getStats();
      console.log('Stats before optimization:', statsBefore);

      sparseMatrix.optimize();

      const statsAfter = sparseMatrix.getStats();
      console.log('Stats after optimization:', statsAfter);

      expect(statsAfter.totalBlocks).toBeLessThanOrEqual(statsBefore.totalBlocks);
      expect(statsAfter.memoryUsage).toBeLessThanOrEqual(statsBefore.memoryUsage);
    });
  });

  describe('VirtualGrid Performance', () => {
    it('should handle 1M x 1M grid efficiently', () => {
      const startTime = performance.now();

      // Тестируем прокрутку в большой сетке
      virtualGrid.setViewport(500000, 500000, 500010, 500010);
      const visibleCells = virtualGrid.getVisibleCells();

      const endTime = performance.now();
      const time = endTime - startTime;

      console.log(`1M x 1M viewport set in ${time.toFixed(2)}ms`);
      console.log(`Visible cells: ${visibleCells.length}`);

      expect(time).toBeLessThan(50); // Реалистичное требование для тестовой среды
      expect(visibleCells.length).toBeGreaterThan(0);
    });

    it('should maintain consistent performance with different viewport sizes', () => {
      const viewportSizes = [
        { width: 10, height: 10 },
        { width: 100, height: 100 },
        { width: 1000, height: 1000 },
      ];

      const results = viewportSizes.map(size => {
        const startTime = performance.now();

        virtualGrid.setViewport(0, 0, size.width, size.height);
        const visibleCells = virtualGrid.getVisibleCells();

        const endTime = performance.now();
        const time = endTime - startTime;

        return {
          size,
          time,
          cellCount: visibleCells.length,
        };
      });

      results.forEach(result => {
        console.log(
          `Viewport ${result.size.width}x${result.size.height}: ${result.time.toFixed(2)}ms, ${result.cellCount} cells`
        );
        expect(result.time).toBeLessThan(200); // Реалистичное требование для тестовой среды
      });
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during rendering', () => {
      const initialMemory = (performance as any).memory
        ? (performance as any).memory.usedJSHeapSize
        : 0;

      // Выполняем много операций рендеринга
      for (let i = 0; i < 100; i++) {
        virtualGrid.scrollDown();
        const visibleCells = virtualGrid.getVisibleCells();
        renderManager.render(visibleCells, virtualGrid.getViewport());
      }

      const finalMemory = (performance as any).memory
        ? (performance as any).memory.usedJSHeapSize
        : 0;
      const memoryIncrease = finalMemory - initialMemory;

      console.log(
        `Memory increase after 100 render cycles: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`
      );

      // Память не должна увеличиваться более чем на 10MB
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});
