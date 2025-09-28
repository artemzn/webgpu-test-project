/**
 * Тесты производительности без WebGPU (для тестовой среды)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { VirtualGrid } from '../../src/core/virtual-grid/VirtualGrid.js';
import { SparseMatrix } from '../../src/core/sparse-matrix/SparseMatrix.js';

describe('Performance Benchmark Tests', () => {
  let virtualGrid: VirtualGrid;
  let sparseMatrix: SparseMatrix;

  beforeAll(() => {
    // Создаем виртуальную сетку
    virtualGrid = new VirtualGrid(1920, 1080, 100, 30, 1000000, 1000000);

    // Создаем разреженную матрицу
    sparseMatrix = new SparseMatrix();
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

      expect(time).toBeLessThan(10); // Меньше 10ms
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

        // Для больших viewport допускаем больше времени
        if (result.cellCount > 100000) {
          expect(result.time).toBeLessThan(500); // Большие viewport: меньше 500ms
        } else {
          expect(result.time).toBeLessThan(50); // Малые viewport: меньше 50ms
        }
      });
    });

    it('should handle rapid scrolling efficiently', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        virtualGrid.scrollDown();
        virtualGrid.getVisibleCells();
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerFrame = totalTime / iterations;

      console.log(`Rapid scrolling: ${iterations} iterations in ${totalTime.toFixed(2)}ms`);
      console.log(`Average time per frame: ${avgTimePerFrame.toFixed(4)}ms`);

      expect(avgTimePerFrame).toBeLessThan(0.1); // Меньше 0.1ms на кадр
    });

    it('should cache visible cells for performance', () => {
      const startTime = performance.now();

      // Первый вызов
      const cells1 = virtualGrid.getVisibleCells();
      const firstCallTime = performance.now() - startTime;

      // Второй вызов (должен быть быстрее из-за кеширования)
      const startTime2 = performance.now();
      const cells2 = virtualGrid.getVisibleCells();
      const secondCallTime = performance.now() - startTime2;

      console.log(`First call: ${firstCallTime.toFixed(2)}ms`);
      console.log(`Second call: ${secondCallTime.toFixed(2)}ms`);
      console.log(
        `Performance improvement: ${(((firstCallTime - secondCallTime) / firstCallTime) * 100).toFixed(1)}%`
      );

      expect(cells1.length).toBe(cells2.length);
      expect(secondCallTime).toBeLessThan(firstCallTime);
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

      expect(time).toBeLessThan(100); // Меньше 100ms

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

    it('should handle sparse data efficiently', () => {
      const startTime = performance.now();

      // Заполняем только 1% ячеек (очень разреженные данные)
      const totalCells = 1000000;
      const filledCells = totalCells / 100;

      for (let i = 0; i < filledCells; i++) {
        const row = Math.floor(Math.random() * 1000);
        const col = Math.floor(Math.random() * 1000);
        sparseMatrix.setCell(row, col, `Sparse ${i}`);
      }

      const endTime = performance.now();
      const time = endTime - startTime;

      const stats = sparseMatrix.getStats();
      const memoryPerCell = stats.memoryUsage / stats.totalCells;

      console.log(`Sparse data (${filledCells} cells): ${time.toFixed(2)}ms`);
      console.log(`Memory per cell: ${memoryPerCell.toFixed(2)} bytes`);
      console.log(`Fill ratio: ${(stats.fillRatio * 100).toFixed(2)}%`);

      expect(time).toBeLessThan(500); // Меньше 500ms
      expect(memoryPerCell).toBeLessThan(100); // Меньше 100 байт на ячейку
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during operations', () => {
      const initialMemory = (performance as any).memory
        ? (performance as any).memory.usedJSHeapSize
        : 0;

      // Выполняем много операций
      for (let i = 0; i < 1000; i++) {
        virtualGrid.scrollDown();
        virtualGrid.getVisibleCells();

        // Добавляем данные в SparseMatrix
        sparseMatrix.setCell(i, i, `Memory test ${i}`);
      }

      const finalMemory = (performance as any).memory
        ? (performance as any).memory.usedJSHeapSize
        : 0;
      const memoryIncrease = finalMemory - initialMemory;

      console.log(
        `Memory increase after 1000 operations: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`
      );

      // Память не должна увеличиваться более чем на 10MB
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Stress Tests', () => {
    it('should handle extreme viewport sizes', () => {
      const extremeSizes = [
        { startRow: 0, startCol: 0, endRow: 1, endCol: 1 }, // Минимальный
        { startRow: 999999, startCol: 999999, endRow: 1000000, endCol: 1000000 }, // Максимальный
        { startRow: 500000, startCol: 500000, endRow: 500001, endCol: 500001 }, // Центральный
      ];

      extremeSizes.forEach(size => {
        const startTime = performance.now();

        virtualGrid.setViewport(size.startRow, size.startCol, size.endRow, size.endCol);
        const cells = virtualGrid.getVisibleCells();

        const endTime = performance.now();
        const time = endTime - startTime;

        console.log(
          `Extreme viewport (${size.startRow},${size.startCol} to ${size.endRow},${size.endCol}): ${time.toFixed(2)}ms, ${cells.length} cells`
        );

        expect(time).toBeLessThan(10); // Меньше 10ms даже для экстремальных случаев
        expect(cells.length).toBeGreaterThan(0);
      });
    });

    it('should handle concurrent operations', () => {
      const startTime = performance.now();

      // Имитируем конкурентные операции
      const operations = [];
      for (let i = 0; i < 100; i++) {
        operations.push(() => {
          sparseMatrix.setCell(i, i, `Concurrent ${i}`);
          return sparseMatrix.getCell(i, i);
        });
      }

      // Выполняем все операции
      const results = operations.map(op => op());

      const endTime = performance.now();
      const time = endTime - startTime;

      console.log(`Concurrent operations (100): ${time.toFixed(2)}ms`);

      expect(time).toBeLessThan(50); // Меньше 50ms
      expect(results.length).toBe(100);
    });
  });
});
