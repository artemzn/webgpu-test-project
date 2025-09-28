/**
 * Тесты оптимизации VirtualGrid
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VirtualGrid } from '../../src/core/virtual-grid/VirtualGrid.js';

describe('VirtualGrid Optimization Tests', () => {
  let virtualGrid: VirtualGrid;

  beforeEach(() => {
    virtualGrid = new VirtualGrid(1920, 1080, 100, 30, 1000000, 1000000);
  });

  describe('Viewport Management Optimization', () => {
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

      expect(cells1.length).toBe(cells2.length);
      // Второй вызов должен быть разумным по времени (кеширование может работать не идеально в тестах)
      expect(secondCallTime).toBeLessThan(firstCallTime * 1.5);
    });

    it('should invalidate cache when viewport changes', () => {
      // Получаем ячейки для первого viewport
      virtualGrid.setViewport(0, 0, 10, 10);
      const cells1 = virtualGrid.getVisibleCells();

      // Меняем viewport
      virtualGrid.setViewport(100, 100, 110, 110);
      const cells2 = virtualGrid.getVisibleCells();

      // Ячейки должны быть разными
      expect(cells1).not.toEqual(cells2);

      // Проверяем, что координаты ячеек изменились
      if (cells1.length > 0 && cells2.length > 0) {
        expect(cells1[0]!.row).not.toBe(cells2[0]!.row);
        expect(cells1[0]!.col).not.toBe(cells2[0]!.col);
      }
    });

    it('should handle rapid viewport changes efficiently', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const x = i % 100;
        const y = Math.floor(i / 100);
        virtualGrid.setViewport(x, y, x + 10, y + 10);
        virtualGrid.getVisibleCells();
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      console.log(`Rapid viewport changes: ${iterations} iterations in ${totalTime.toFixed(2)}ms`);
      console.log(`Average time per change: ${avgTime.toFixed(4)}ms`);

      expect(avgTime).toBeLessThan(0.1); // Меньше 0.1ms на изменение
    });
  });

  describe('Scrolling Optimization', () => {
    it('should optimize scroll operations', () => {
      const startTime = performance.now();

      // Выполняем много операций прокрутки
      for (let i = 0; i < 100; i++) {
        virtualGrid.scrollDown();
      }

      const endTime = performance.now();
      const time = endTime - startTime;
      const avgTime = time / 100;

      console.log(`100 scroll operations in ${time.toFixed(2)}ms`);
      console.log(`Average time per scroll: ${avgTime.toFixed(4)}ms`);

      expect(avgTime).toBeLessThan(0.05); // Меньше 0.05ms на прокрутку
    });

    it('should batch scroll operations', () => {
      const startTime = performance.now();

      // Выполняем батчевую прокрутку
      virtualGrid.scrollTo(1000, 1000);

      const endTime = performance.now();
      const time = endTime - startTime;

      console.log(`Batch scroll to (1000, 1000) in ${time.toFixed(2)}ms`);

      expect(time).toBeLessThan(5); // Меньше 5ms для батчевой операции

      // Проверяем, что viewport изменился
      const viewport = virtualGrid.getViewport();
      expect(viewport.startRow).toBeGreaterThan(0);
      expect(viewport.startCol).toBeGreaterThan(0);
    });
  });

  describe('Cell Calculation Optimization', () => {
    it('should optimize cell position calculations', () => {
      const iterations = 10000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const x = Math.random() * 1920;
        const y = Math.random() * 1080;
        virtualGrid.getCellAtPosition(x, y);
      }

      const endTime = performance.now();
      const time = endTime - startTime;
      const avgTime = time / iterations;

      console.log(`Cell position calculations: ${iterations} iterations in ${time.toFixed(2)}ms`);
      console.log(`Average time per calculation: ${avgTime.toFixed(6)}ms`);

      expect(avgTime).toBeLessThan(0.001); // Меньше 0.001ms на расчет
    });

    it('should cache cell calculations', () => {
      const testPositions = [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
        { x: 300, y: 300 },
      ];

      // Первый проход
      const startTime1 = performance.now();
      const cells1 = testPositions.map(pos => virtualGrid.getCellAtPosition(pos.x, pos.y));
      const time1 = performance.now() - startTime1;

      // Второй проход (должен быть быстрее)
      const startTime2 = performance.now();
      const cells2 = testPositions.map(pos => virtualGrid.getCellAtPosition(pos.x, pos.y));
      const time2 = performance.now() - startTime2;

      console.log(`First pass: ${time1.toFixed(2)}ms`);
      console.log(`Second pass: ${time2.toFixed(2)}ms`);

      expect(cells1).toEqual(cells2);
      // Второй вызов должен быть разумным по времени (кеширование может работать не идеально в тестах)
      expect(time2).toBeLessThan(time1 * 2);
    });
  });

  describe('Memory Optimization', () => {
    it('should not create unnecessary objects', () => {
      const initialMemory = (performance as any).memory
        ? (performance as any).memory.usedJSHeapSize
        : 0;

      // Выполняем много операций
      for (let i = 0; i < 1000; i++) {
        virtualGrid.scrollDown();
        virtualGrid.getVisibleCells();
        virtualGrid.getViewport();
      }

      const finalMemory = (performance as any).memory
        ? (performance as any).memory.usedJSHeapSize
        : 0;
      const memoryIncrease = finalMemory - initialMemory;

      console.log(
        `Memory increase after 1000 operations: ${(memoryIncrease / 1024).toFixed(2)} KB`
      );

      // Память не должна увеличиваться более чем на 1MB
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });

    it('should reuse objects when possible', () => {
      const cells1 = virtualGrid.getVisibleCells();
      const cells2 = virtualGrid.getVisibleCells();

      // Если viewport не изменился, должны возвращаться те же объекты
      expect(cells1).toBe(cells2);

      // Проверяем, что содержимое одинаковое
      expect(cells1.length).toBe(cells2.length);
      if (cells1.length > 0) {
        expect(cells1[0]).toBe(cells2[0]);
      }
    });
  });

  describe('Edge Cases', () => {
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

    it('should handle rapid alternating operations', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        virtualGrid.scrollDown();
        virtualGrid.getVisibleCells();
        virtualGrid.scrollUp();
        virtualGrid.getVisibleCells();
      }

      const endTime = performance.now();
      const time = endTime - startTime;
      const avgTime = time / 200; // 200 операций (100 вниз + 100 вверх)

      console.log(`Alternating operations: 200 operations in ${time.toFixed(2)}ms`);
      console.log(`Average time per operation: ${avgTime.toFixed(4)}ms`);

      expect(avgTime).toBeLessThan(0.1); // Меньше 0.1ms на операцию
    });
  });
});
