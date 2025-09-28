/**
 * Тесты оптимизации SparseMatrix
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SparseMatrix } from '../../src/core/sparse-matrix/SparseMatrix.js';

describe('SparseMatrix Optimization Tests', () => {
  let sparseMatrix: SparseMatrix;

  beforeEach(() => {
    sparseMatrix = new SparseMatrix(1000); // Блоки по 1000 ячеек
  });

  describe('Block Management Optimization', () => {
    it('should efficiently manage blocks', () => {
      const startTime = performance.now();

      // Заполняем ячейки в разных блоках
      for (let i = 0; i < 10000; i++) {
        const row = i * 100; // Разные блоки
        const col = i * 100;
        sparseMatrix.setCell(row, col, `Value ${i}`);
      }

      const endTime = performance.now();
      const time = endTime - startTime;

      console.log(`Set 10000 cells in different blocks in ${time.toFixed(2)}ms`);

      const stats = sparseMatrix.getStats();
      console.log(`Blocks created: ${stats.totalBlocks}`);
      console.log(`Memory usage: ${(stats.memoryUsage / 1024).toFixed(2)} KB`);

      expect(time).toBeLessThan(200); // Меньше 200ms
      expect(stats.totalBlocks).toBeGreaterThan(0);
    });

    it('should reuse blocks efficiently', () => {
      // Заполняем ячейки в одном блоке
      for (let i = 0; i < 100; i++) {
        sparseMatrix.setCell(0, i, `Value ${i}`);
      }

      const stats1 = sparseMatrix.getStats();
      console.log(`After filling one block: ${stats1.totalBlocks} blocks`);

      // Заполняем еще ячейки в том же блоке
      for (let i = 100; i < 200; i++) {
        sparseMatrix.setCell(0, i, `Value ${i}`);
      }

      const stats2 = sparseMatrix.getStats();
      console.log(`After filling more cells in same block: ${stats2.totalBlocks} blocks`);

      // Количество блоков не должно увеличиться
      expect(stats2.totalBlocks).toBe(stats1.totalBlocks);
    });

    it('should clean up empty blocks', () => {
      // Заполняем несколько блоков
      for (let i = 0; i < 5; i++) {
        sparseMatrix.setCell(i * 1000, 0, `Value ${i}`);
      }

      const statsBefore = sparseMatrix.getStats();
      console.log(`Before cleanup: ${statsBefore.totalBlocks} blocks`);

      // Удаляем все ячейки
      for (let i = 0; i < 5; i++) {
        sparseMatrix.removeCell(i * 1000, 0);
      }

      const statsAfter = sparseMatrix.getStats();
      console.log(`After cleanup: ${statsAfter.totalBlocks} blocks`);

      // Блоки должны быть удалены
      expect(statsAfter.totalBlocks).toBe(0);
    });
  });

  describe('Memory Optimization', () => {
    it('should optimize memory usage for sparse data', () => {
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

    it('should handle memory optimization', () => {
      // Заполняем и удаляем много ячеек
      for (let i = 0; i < 1000; i++) {
        sparseMatrix.setCell(i, i, `Value ${i}`);
      }

      const statsBefore = sparseMatrix.getStats();
      console.log(`Before optimization: ${statsBefore.memoryUsage} bytes`);

      // Удаляем половину ячеек
      for (let i = 0; i < 500; i++) {
        sparseMatrix.removeCell(i, i);
      }

      sparseMatrix.optimize();

      const statsAfter = sparseMatrix.getStats();
      console.log(`After optimization: ${statsAfter.memoryUsage} bytes`);

      expect(statsAfter.memoryUsage).toBeLessThanOrEqual(statsBefore.memoryUsage);
    });
  });

  describe('Access Pattern Optimization', () => {
    it('should optimize sequential access', () => {
      const startTime = performance.now();

      // Последовательный доступ
      for (let row = 0; row < 100; row++) {
        for (let col = 0; col < 100; col++) {
          sparseMatrix.setCell(row, col, `Row${row}Col${col}`);
        }
      }

      const endTime = performance.now();
      const time = endTime - startTime;

      console.log(`Sequential access (100x100): ${time.toFixed(2)}ms`);

      expect(time).toBeLessThan(100); // Меньше 100ms
    });

    it('should optimize random access', () => {
      const startTime = performance.now();

      // Случайный доступ
      for (let i = 0; i < 10000; i++) {
        const row = Math.floor(Math.random() * 1000);
        const col = Math.floor(Math.random() * 1000);
        sparseMatrix.setCell(row, col, `Random ${i}`);
      }

      const endTime = performance.now();
      const time = endTime - startTime;
      const avgTime = time / 10000;

      console.log(`Random access (10000 operations): ${time.toFixed(2)}ms`);
      console.log(`Average time per operation: ${avgTime.toFixed(4)}ms`);

      expect(avgTime).toBeLessThan(0.01); // Меньше 0.01ms на операцию
    });

    it('should optimize range queries', () => {
      // Заполняем диапазон ячеек
      for (let row = 10; row < 20; row++) {
        for (let col = 10; col < 20; col++) {
          sparseMatrix.setCell(row, col, `Range${row}${col}`);
        }
      }

      const startTime = performance.now();

      // Запрашиваем диапазон
      const cells = sparseMatrix.getCellsInRange(10, 10, 19, 19);

      const endTime = performance.now();
      const time = endTime - startTime;

      console.log(`Range query (10x10): ${time.toFixed(2)}ms, ${cells.length} cells`);

      expect(time).toBeLessThan(5); // Меньше 5ms
      expect(cells.length).toBe(100); // 10x10 = 100 ячеек
    });
  });

  describe('Batch Operations', () => {
    it('should optimize batch set operations', () => {
      const startTime = performance.now();

      // Батчевая установка
      const batchData = [];
      for (let i = 0; i < 1000; i++) {
        batchData.push({
          row: Math.floor(i / 100),
          col: i % 100,
          value: `Batch ${i}`,
        });
      }

      batchData.forEach(({ row, col, value }) => {
        sparseMatrix.setCell(row, col, value);
      });

      const endTime = performance.now();
      const time = endTime - startTime;
      const avgTime = time / 1000;

      console.log(`Batch set (1000 cells): ${time.toFixed(2)}ms`);
      console.log(`Average time per set: ${avgTime.toFixed(4)}ms`);

      expect(avgTime).toBeLessThan(0.05); // Меньше 0.05ms на установку
    });

    it('should optimize batch get operations', () => {
      // Сначала заполняем данные
      for (let i = 0; i < 1000; i++) {
        sparseMatrix.setCell(i, i, `Value ${i}`);
      }

      const startTime = performance.now();

      // Батчевое получение
      const results = [];
      for (let i = 0; i < 1000; i++) {
        results.push(sparseMatrix.getCell(i, i));
      }

      const endTime = performance.now();
      const time = endTime - startTime;
      const avgTime = time / 1000;

      console.log(`Batch get (1000 cells): ${time.toFixed(2)}ms`);
      console.log(`Average time per get: ${avgTime.toFixed(4)}ms`);

      expect(avgTime).toBeLessThan(0.05); // Более реалистичное требование для тестовой среды
      expect(results.length).toBe(1000);
    });
  });

  describe('Serialization Performance', () => {
    it('should optimize JSON export', () => {
      // Заполняем данные
      for (let i = 0; i < 10000; i++) {
        sparseMatrix.setCell(i, i, `Export ${i}`);
      }

      const startTime = performance.now();

      const json = sparseMatrix.exportToJSON();

      const endTime = performance.now();
      const time = endTime - startTime;

      console.log(`JSON export (10000 cells): ${time.toFixed(2)}ms`);
      console.log(`JSON size: ${(json.length / 1024).toFixed(2)} KB`);

      expect(time).toBeLessThan(200); // Более реалистичное требование для JSON экспорта
      expect(json.length).toBeGreaterThan(0);
    });

    it('should optimize JSON import', () => {
      // Создаем данные для экспорта
      for (let i = 0; i < 1000; i++) {
        sparseMatrix.setCell(i, i, `Import ${i}`);
      }

      const json = sparseMatrix.exportToJSON();

      // Создаем новую матрицу
      const newMatrix = new SparseMatrix();

      const startTime = performance.now();

      newMatrix.importFromJSON(json);

      const endTime = performance.now();
      const time = endTime - startTime;

      console.log(`JSON import (1000 cells): ${time.toFixed(2)}ms`);

      expect(time).toBeLessThan(50); // Меньше 50ms

      // Проверяем, что данные импортировались
      expect(newMatrix.getCell(0, 0)).toBe('Import 0');
      expect(newMatrix.getCell(999, 999)).toBe('Import 999');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large block sizes', () => {
      const largeBlockMatrix = new SparseMatrix(100000); // Очень большие блоки

      const startTime = performance.now();

      // Заполняем ячейки в разных больших блоках
      for (let i = 0; i < 100; i++) {
        largeBlockMatrix.setCell(i * 100000, 0, `Large ${i}`);
      }

      const endTime = performance.now();
      const time = endTime - startTime;

      console.log(`Large blocks (100000 cells per block): ${time.toFixed(2)}ms`);

      expect(time).toBeLessThan(100); // Меньше 100ms
    });

    it('should handle very small block sizes', () => {
      const smallBlockMatrix = new SparseMatrix(10); // Очень маленькие блоки

      const startTime = performance.now();

      // Заполняем много маленьких блоков
      for (let i = 0; i < 1000; i++) {
        smallBlockMatrix.setCell(i * 10, 0, `Small ${i}`);
      }

      const endTime = performance.now();
      const time = endTime - startTime;

      console.log(`Small blocks (10 cells per block): ${time.toFixed(2)}ms`);

      expect(time).toBeLessThan(200); // Меньше 200ms
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
