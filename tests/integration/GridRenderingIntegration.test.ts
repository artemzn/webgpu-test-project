/**
 * Интеграционные тесты для системы рендеринга сетки
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { App } from '../../src/App.js';
import { VirtualGrid } from '../../src/core/virtual-grid/VirtualGrid.js';
import { SparseMatrix } from '../../src/core/sparse-matrix/SparseMatrix.js';

// Мокаем WebGPU для интеграционных тестов
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

describe('Grid Rendering Integration Tests', () => {
  let app: App;
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
    // Создаем новое приложение для каждого теста
    const config = {
      enableWebGPU: true,
      cellWidth: 100,
      cellHeight: 30,
      maxRows: 1000,
      maxCols: 1000,
    };

    app = new App(config);

    // Мокаем WebGPU инициализацию
    (app as any).webgpuManager = {
      initialize: async () => ({
        success: true,
        config: mockWebGPUConfig,
      }),
    };

    await app.initialize();
  });

  describe('Полная интеграция рендеринга', () => {
    it('должен инициализировать все компоненты', () => {
      expect(app).toBeDefined();
      // Проверяем, что все компоненты инициализированы
      expect((app as any).virtualGrid).toBeDefined();
      expect((app as any).sparseMatrix).toBeDefined();
    });

    it('должен рендерить сетку с данными', async () => {
      // Добавляем данные в SparseMatrix
      const sparseMatrix = (app as any).sparseMatrix as SparseMatrix;
      sparseMatrix.setCell(0, 0, 'Test Data');
      sparseMatrix.setCell(1, 1, 'Another Cell');
      sparseMatrix.setCell(5, 10, 'Formula =SUM(A1:B2)');

      // Обновляем отображение
      (app as any).updateDisplay();

      // Проверяем, что рендеринг прошел без ошибок
      expect(() => {
        (app as any).render();
      }).not.toThrow();
    });

    it('должен обрабатывать прокрутку', () => {
      const virtualGrid = (app as any).virtualGrid as VirtualGrid;

      // Выполняем различные операции прокрутки
      virtualGrid.scrollDown();
      virtualGrid.scrollRight();
      virtualGrid.scrollTo(100, 100);

      // Проверяем, что рендеринг работает после прокрутки
      expect(() => {
        (app as any).render();
      }).not.toThrow();
    });
  });

  describe('Производительность интеграции', () => {
    it('должен эффективно рендерить большие сетки', () => {
      const startTime = performance.now();

      // Создаем большую сетку с данными
      const sparseMatrix = (app as any).sparseMatrix as SparseMatrix;
      const virtualGrid = (app as any).virtualGrid as VirtualGrid;

      // Заполняем 1000 ячеек
      for (let i = 0; i < 1000; i++) {
        sparseMatrix.setCell(i, i, `Cell ${i}`);
      }

      // Устанавливаем большой viewport
      virtualGrid.setViewport(0, 0, 100, 100);

      // Рендерим
      (app as any).render();

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      console.log(`Large grid rendering: ${renderTime.toFixed(2)}ms`);
      expect(renderTime).toBeLessThan(100); // Меньше 100ms
    });

    it('должен эффективно обрабатывать множественные обновления', () => {
      const iterations = 50;
      const startTime = performance.now();

      const sparseMatrix = (app as any).sparseMatrix as SparseMatrix;
      const virtualGrid = (app as any).virtualGrid as VirtualGrid;

      for (let i = 0; i < iterations; i++) {
        // Изменяем данные
        sparseMatrix.setCell(i, i, `Updated ${i}`);

        // Изменяем viewport
        virtualGrid.setViewport(i, i, i + 20, i + 20);

        // Рендерим
        (app as any).render();
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      console.log(`Multiple updates (${iterations}): ${totalTime.toFixed(2)}ms`);
      console.log(`Average time per update: ${avgTime.toFixed(4)}ms`);

      expect(avgTime).toBeLessThan(5); // Меньше 5ms на обновление
    });
  });

  describe('Взаимодействие с пользователем', () => {
    it('должен обрабатывать клики по ячейкам', () => {
      const virtualGrid = (app as any).virtualGrid as VirtualGrid;

      // Имитируем клик
      const clickEvent = new MouseEvent('click', {
        clientX: 500,
        clientY: 300,
      });

      // Устанавливаем позицию относительно canvas
      Object.defineProperty(clickEvent, 'clientX', { value: 500 });
      Object.defineProperty(clickEvent, 'clientY', { value: 300 });

      // Мокаем getBoundingClientRect
      canvas.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        right: 1920,
        bottom: 1080,
        width: 1920,
        height: 1080,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      expect(() => {
        (app as any).handleCanvasClick(clickEvent);
      }).not.toThrow();
    });

    it('должен обрабатывать прокрутку колесом мыши', () => {
      const virtualGrid = (app as any).virtualGrid as VirtualGrid;
      const initialViewport = virtualGrid.getViewport();

      // Имитируем прокрутку вниз
      const wheelEventDown = new WheelEvent('wheel', {
        deltaY: 100,
      });

      (app as any).handleCanvasWheel(wheelEventDown);

      // Проверяем, что viewport изменился
      const newViewport = virtualGrid.getViewport();
      expect(newViewport.startRow).toBeGreaterThan(initialViewport.startRow);

      // Имитируем прокрутку вверх
      const wheelEventUp = new WheelEvent('wheel', {
        deltaY: -100,
      });

      (app as any).handleCanvasWheel(wheelEventUp);
    });
  });

  describe('Обработка формул', () => {
    it('должен обрабатывать ввод формул', () => {
      const sparseMatrix = (app as any).sparseMatrix as SparseMatrix;
      const virtualGrid = (app as any).virtualGrid as VirtualGrid;

      // Устанавливаем активную ячейку
      virtualGrid.setActiveCell({ row: 0, col: 0 });

      // Обрабатываем формулу
      (app as any).handleFormulaSubmit('=SUM(A1:B2)');

      // Проверяем, что формула сохранилась
      const cellValue = sparseMatrix.getCell(0, 0);
      expect(cellValue).toBe('=SUM(A1:B2)');
    });

    it('должен обновлять отображение после ввода формулы', () => {
      const virtualGrid = (app as any).virtualGrid as VirtualGrid;

      // Устанавливаем активную ячейку
      virtualGrid.setActiveCell({ row: 5, col: 10 });

      // Обрабатываем формулу
      (app as any).handleFormulaSubmit('Test Formula');

      // Проверяем, что рендеринг обновился
      expect(() => {
        (app as any).render();
      }).not.toThrow();
    });
  });

  describe('Обработка ошибок', () => {
    it('должен обрабатывать ошибки рендеринга gracefully', () => {
      // Создаем некорректное состояние
      (app as any).virtualGrid = null;

      expect(() => {
        (app as any).render();
      }).not.toThrow();
    });

    it('должен обрабатывать ошибки WebGPU', async () => {
      // Создаем приложение с отключенным WebGPU
      const config = {
        enableWebGPU: false,
        cellWidth: 100,
        cellHeight: 30,
        maxRows: 1000,
        maxCols: 1000,
      };

      const appWithoutWebGPU = new App(config);
      await appWithoutWebGPU.initialize();

      // Проверяем, что рендеринг работает через Canvas 2D
      expect(() => {
        (appWithoutWebGPU as any).render();
      }).not.toThrow();
    });
  });

  describe('Стабильность системы', () => {
    it('должен работать стабильно при длительной работе', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        // Выполняем различные операции
        const sparseMatrix = (app as any).sparseMatrix as SparseMatrix;
        const virtualGrid = (app as any).virtualGrid as VirtualGrid;

        sparseMatrix.setCell(i % 100, i % 100, `Stability test ${i}`);
        virtualGrid.setViewport(i % 50, i % 50, (i % 50) + 10, (i % 50) + 10);
        (app as any).render();

        // Каждые 100 итераций проверяем, что система работает
        if (i % 100 === 0) {
          expect((app as any).isInitialized).toBe(true);
        }
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      console.log(`Stability test (${iterations} iterations): ${totalTime.toFixed(2)}ms`);
      console.log(`Average time per iteration: ${avgTime.toFixed(4)}ms`);

      expect(avgTime).toBeLessThan(1); // Меньше 1ms на итерацию
    });
  });
});
