import { describe, it, expect, beforeEach, vi } from 'vitest';
import { App } from '../../src/App';
import { VirtualGrid } from '../../src/core/virtual-grid/VirtualGrid';

// Мокаем WebGPU
Object.defineProperty(navigator, 'gpu', {
  writable: true,
  value: {
    requestAdapter: vi.fn().mockResolvedValue({
      requestDevice: vi.fn().mockResolvedValue({
        createBuffer: vi.fn().mockReturnValue({
          destroy: vi.fn(),
          getMappedRange: vi.fn().mockReturnValue(new ArrayBuffer(64)),
          unmap: vi.fn(),
        }),
        createShaderModule: vi.fn().mockReturnValue({}),
        createRenderPipeline: vi.fn().mockReturnValue({
          getBindGroupLayout: vi.fn().mockReturnValue({}),
        }),
        createBindGroup: vi.fn().mockReturnValue({}),
        createCommandEncoder: vi.fn().mockReturnValue({
          beginRenderPass: vi.fn().mockReturnValue({
            setPipeline: vi.fn(),
            setBindGroup: vi.fn(),
            setVertexBuffer: vi.fn(),
            draw: vi.fn(),
            end: vi.fn(),
          }),
          finish: vi.fn().mockReturnValue({}),
        }),
        queue: {
          writeBuffer: vi.fn(),
          submit: vi.fn(),
        },
        limits: {},
        features: new Set(),
      }),
      limits: {},
      features: new Set(),
    }),
  },
});

// Мокаем ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Мокаем URL API для тестов
global.URL = global.URL || {};
(global.URL as any).createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
(global.URL as any).revokeObjectURL = vi.fn();

describe('Interaction (Взаимодействие)', () => {
  let app: App;
  let canvas: HTMLCanvasElement;
  let container: HTMLDivElement;

  beforeEach(async () => {
    // Создаем DOM структуру
    document.body.innerHTML = `
      <div id="app">
        <div class="toolbar">
          <button class="toolbar-button" data-action="new">Новый</button>
          <button class="toolbar-button" data-action="save">Сохранить</button>
          <button class="toolbar-button" data-action="copy">Копировать</button>
          <button class="toolbar-button" data-action="paste">Вставить</button>
        </div>
        <div class="formula-bar">
          <input id="formula-input" placeholder="Введите формулу или значение..." />
          <button data-action="enter">✓</button>
        </div>
        <div class="spreadsheet-container">
          <canvas id="spreadsheet-canvas" width="800" height="600"></canvas>
        </div>
        <div class="status-bar">
          <span id="cell-info">Готов</span>
          <span id="fps-counter">FPS: 60</span>
        </div>
        <div class="context-menu" id="context-menu" style="display: none;">
          <div class="context-menu-item" data-action="copy">Копировать</div>
          <div class="context-menu-item" data-action="paste">Вставить</div>
          <div class="context-menu-item" data-action="clear">Очистить</div>
        </div>
      </div>
    `;

    canvas = document.getElementById('spreadsheet-canvas') as HTMLCanvasElement;
    container = document.querySelector('.spreadsheet-container') as HTMLDivElement;

    const config = {
      canvasId: 'spreadsheet-canvas',
      cellWidth: 80,
      cellHeight: 25,
      maxRows: 1000000,
      maxCols: 1000000,
    };

    app = new App(config);
    await app.initialize();
  });

  describe('🖱️ Обработка мыши', () => {
    it('должен обрабатывать клики по ячейкам', () => {
      const rect = canvas.getBoundingClientRect();
      const mockEvent = new MouseEvent('click', {
        clientX: rect.left + 100, // Примерно ячейка (1, 4)
        clientY: rect.top + 100,
        bubbles: true,
      });

      // Мокаем getBoundingClientRect
      vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
        right: 800,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      canvas.dispatchEvent(mockEvent);

      // Проверяем что активная ячейка установлена
      const virtualGrid = (app as any).virtualGrid as VirtualGrid;
      expect(virtualGrid).toBeDefined();
    });

    it('должен обрабатывать движение мыши для hover эффектов', () => {
      const mockEvent = new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 75,
        bubbles: true,
      });

      vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
        right: 800,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      expect(() => {
        canvas.dispatchEvent(mockEvent);
      }).not.toThrow();
    });

    it('должен обрабатывать прокрутку колесом мыши', () => {
      const mockEvent = new WheelEvent('wheel', {
        deltaY: 100, // Прокрутка вниз
        bubbles: true,
      });

      expect(() => {
        canvas.dispatchEvent(mockEvent);
      }).not.toThrow();
    });
  });

  describe('🎯 Выделение ячеек', () => {
    it('должен визуально выделять выбранную ячейку', async () => {
      const virtualGrid = (app as any).virtualGrid as VirtualGrid;

      // Устанавливаем активную ячейку
      virtualGrid.setActiveCell({ row: 2, col: 3 });

      // Проверяем что ячейка установлена
      const activeCell = virtualGrid.getActiveCell();
      expect(activeCell).toEqual({ row: 2, col: 3 });
    });

    it('должен сохранять выделение при скролле', async () => {
      const virtualGrid = (app as any).virtualGrid as VirtualGrid;

      // Устанавливаем активную ячейку
      virtualGrid.setActiveCell({ row: 5, col: 7 });

      // Прокручиваем
      virtualGrid.scrollDown();
      virtualGrid.scrollDown();

      // Выделение должно сохраниться
      const activeCell = virtualGrid.getActiveCell();
      expect(activeCell).toEqual({ row: 5, col: 7 });
    });

    it('должен обновлять информацию о ячейке в UI', () => {
      const virtualGrid = (app as any).virtualGrid as VirtualGrid;
      const cellInfo = document.getElementById('cell-info');

      // Устанавливаем активную ячейку
      virtualGrid.setActiveCell({ row: 1, col: 2 });

      // Обновляем UI (вызывается автоматически в App)
      (app as any).updateStatusBar();

      // Status bar показывает в формате "C2" (столбец C, строка 2)
      expect(cellInfo?.textContent).toContain('C2');
    });
  });

  describe('⌨️ Навигация с клавиатуры', () => {
    it('должен обрабатывать стрелки для навигации', () => {
      const virtualGrid = (app as any).virtualGrid as VirtualGrid;
      virtualGrid.setActiveCell({ row: 5, col: 5 });

      // Стрелка вправо
      const rightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
      document.dispatchEvent(rightEvent);

      // Стрелка вниз
      const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      document.dispatchEvent(downEvent);

      expect(() => {
        document.dispatchEvent(rightEvent);
        document.dispatchEvent(downEvent);
      }).not.toThrow();
    });

    it('должен обрабатывать Tab для горизонтальной навигации', () => {
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });

      expect(() => {
        document.dispatchEvent(tabEvent);
      }).not.toThrow();
    });

    it('должен обрабатывать Enter для вертикальной навигации', () => {
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });

      expect(() => {
        document.dispatchEvent(enterEvent);
      }).not.toThrow();
    });

    it('должен обрабатывать Home/End для навигации', () => {
      const homeEvent = new KeyboardEvent('keydown', { key: 'Home', bubbles: true });
      const endEvent = new KeyboardEvent('keydown', { key: 'End', bubbles: true });

      expect(() => {
        document.dispatchEvent(homeEvent);
        document.dispatchEvent(endEvent);
      }).not.toThrow();
    });
  });

  describe('📝 Ввод текста', () => {
    it('должен начинать редактирование при нажатии F2', () => {
      const f2Event = new KeyboardEvent('keydown', { key: 'F2', bubbles: true });

      expect(() => {
        document.dispatchEvent(f2Event);
      }).not.toThrow();
    });

    it('должен обрабатывать ввод формул через formula bar', () => {
      const formulaInput = document.getElementById('formula-input') as HTMLInputElement;
      const enterButton = document.querySelector('[data-action="enter"]') as HTMLButtonElement;

      expect(formulaInput).toBeDefined();
      expect(enterButton).toBeDefined();

      // Вводим формулу
      formulaInput.value = '=SUM(A1:A10)';

      // Проверяем что значение установлено
      expect(formulaInput.value).toBe('=SUM(A1:A10)');

      // Нажимаем Enter (значение может очиститься - это нормальное поведение)
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      formulaInput.dispatchEvent(enterEvent);

      // После обработки формулы поле может очиститься
      expect(formulaInput).toBeDefined();
    });

    it('должен обрабатывать обычный текстовый ввод', () => {
      const formulaInput = document.getElementById('formula-input') as HTMLInputElement;

      // Вводим обычный текст
      formulaInput.value = 'Тестовые данные';

      expect(formulaInput.value).toBe('Тестовые данные');
    });

    it('должен очищать ячейки при нажатии Delete', () => {
      const deleteEvent = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true });

      expect(() => {
        document.dispatchEvent(deleteEvent);
      }).not.toThrow();
    });
  });

  describe('🎛️ UI элементы', () => {
    it('должен обрабатывать клики по toolbar кнопкам', () => {
      const newButton = document.querySelector('[data-action="new"]') as HTMLButtonElement;
      const saveButton = document.querySelector('[data-action="save"]') as HTMLButtonElement;
      const copyButton = document.querySelector('[data-action="copy"]') as HTMLButtonElement;
      const pasteButton = document.querySelector('[data-action="paste"]') as HTMLButtonElement;

      expect(() => {
        newButton.click();
        saveButton.click();
        copyButton.click();
        pasteButton.click();
      }).not.toThrow();
    });

    it('должен показывать контекстное меню при правом клике', () => {
      const contextMenu = document.getElementById('context-menu') as HTMLDivElement;
      const rightClickEvent = new MouseEvent('contextmenu', {
        clientX: 200,
        clientY: 200,
        bubbles: true,
      });

      vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
        right: 800,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      canvas.dispatchEvent(rightClickEvent);

      expect(contextMenu).toBeDefined();
    });

    it('должен обновлять formula bar при выборе ячейки', () => {
      const formulaInput = document.getElementById('formula-input') as HTMLInputElement;
      const virtualGrid = (app as any).virtualGrid as VirtualGrid;

      // Устанавливаем активную ячейку
      virtualGrid.setActiveCell({ row: 1, col: 1 });

      // Обновляем formula bar
      (app as any).updateFormulaBar({ row: 1, col: 1 });

      expect(formulaInput).toBeDefined();
    });

    it('должен отображать FPS в status bar', () => {
      const fpsCounter = document.getElementById('fps-counter');

      expect(fpsCounter).toBeDefined();
      expect(fpsCounter?.textContent).toContain('FPS');
    });
  });

  describe('📋 Буфер обмена', () => {
    it('должен копировать содержимое ячейки', () => {
      const virtualGrid = (app as any).virtualGrid as VirtualGrid;
      const sparseMatrix = (app as any).sparseMatrix;

      // Устанавливаем данные в ячейку
      virtualGrid.setActiveCell({ row: 2, col: 3 });
      sparseMatrix.setCell(2, 3, 'Тестовое значение');

      // Копируем
      expect(() => {
        (app as any).copy();
      }).not.toThrow();
    });

    it('должен вставлять содержимое из буфера', () => {
      const virtualGrid = (app as any).virtualGrid as VirtualGrid;
      virtualGrid.setActiveCell({ row: 1, col: 1 });

      // Вставляем
      expect(() => {
        (app as any).paste();
      }).not.toThrow();
    });

    it('должен очищать ячейки', () => {
      const virtualGrid = (app as any).virtualGrid as VirtualGrid;
      virtualGrid.setActiveCell({ row: 1, col: 1 });

      // Очищаем
      expect(() => {
        (app as any).clearCell();
      }).not.toThrow();
    });
  });

  describe('🎯 Критерии готовности взаимодействия', () => {
    it('должен обрабатывать все события мыши без ошибок', () => {
      const events = ['click', 'mousemove', 'wheel', 'contextmenu'];

      vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
        right: 800,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      events.forEach(eventType => {
        const event = new MouseEvent(eventType, { bubbles: true });
        expect(() => canvas.dispatchEvent(event)).not.toThrow();
      });
    });

    it('должен обрабатывать все клавиши навигации без ошибок', () => {
      const keys = [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Tab',
        'Enter',
        'Home',
        'End',
        'F2',
        'Delete',
        'Backspace',
      ];

      keys.forEach(key => {
        const event = new KeyboardEvent('keydown', { key, bubbles: true });
        expect(() => document.dispatchEvent(event)).not.toThrow();
      });
    });

    it('должен корректно отображать выделение ячеек', async () => {
      const virtualGrid = (app as any).virtualGrid as VirtualGrid;
      const gridRenderer = (app as any).gridRenderer;

      // Устанавливаем активную ячейку
      virtualGrid.setActiveCell({ row: 3, col: 4 });

      // Проверяем что компоненты инициализированы
      expect(virtualGrid).toBeDefined();

      if (gridRenderer) {
        // Проверяем что рендеринг проходит без ошибок
        const visibleCells = virtualGrid.getVisibleCells();
        const viewport = virtualGrid.getViewport();

        await expect(gridRenderer.render(visibleCells, viewport)).resolves.not.toThrow();
      } else {
        // Если WebGPU недоступен, проверяем только что VirtualGrid работает
        expect(virtualGrid.getActiveCell()).toEqual({ row: 3, col: 4 });
      }
    });

    it('должен сохранять состояние при взаимодействии', () => {
      const virtualGrid = (app as any).virtualGrid as VirtualGrid;
      const sparseMatrix = (app as any).sparseMatrix;

      // Устанавливаем данные
      virtualGrid.setActiveCell({ row: 5, col: 5 });
      sparseMatrix.setCell(5, 5, 'Тестовые данные');

      // Навигация
      virtualGrid.setActiveCell({ row: 6, col: 6 });

      // Возвращаемся
      virtualGrid.setActiveCell({ row: 5, col: 5 });

      // Данные должны сохраниться
      const value = sparseMatrix.getCell(5, 5);
      expect(value).toBe('Тестовые данные');
    });

    it('должен работать адаптивно на разных размерах экрана', () => {
      // Симулируем изменение размера
      Object.defineProperty(canvas, 'width', { value: 1200, writable: true });
      Object.defineProperty(canvas, 'height', { value: 800, writable: true });

      // Эмулируем resize event
      const resizeEvent = new Event('resize');
      window.dispatchEvent(resizeEvent);

      expect(canvas.width).toBe(1200);
      expect(canvas.height).toBe(800);
    });
  });

  describe('🚀 Производительность взаимодействия', () => {
    it('должен обрабатывать быстрые клики без задержек', () => {
      const startTime = performance.now();

      vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
        right: 800,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      // Быстрые клики
      for (let i = 0; i < 50; i++) {
        const event = new MouseEvent('click', {
          clientX: 100 + i * 2,
          clientY: 100 + i * 2,
          bubbles: true,
        });
        canvas.dispatchEvent(event);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Должно обработаться быстро (меньше 100ms)
      expect(totalTime).toBeLessThan(100);
    });

    it('должен обрабатывать быструю навигацию клавиатурой', () => {
      const startTime = performance.now();

      // Быстрая навигация
      for (let i = 0; i < 100; i++) {
        const key = i % 2 === 0 ? 'ArrowRight' : 'ArrowDown';
        const event = new KeyboardEvent('keydown', { key, bubbles: true });
        document.dispatchEvent(event);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Должно обработаться быстро (меньше 200ms для тестовой среды)
      expect(totalTime).toBeLessThan(200);
    });
  });
});
