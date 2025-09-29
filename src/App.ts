/**
 * Основной класс приложения WebGPU Excel
 */

import type { AppConfig, InitializationResult } from './types/index.js';
import { WebGPUDeviceManager } from './rendering/webgpu-setup/DeviceManager.js';
import { RenderManager } from './rendering/webgpu-setup/RenderManager.js';
import { GridRenderer } from './rendering/GridRenderer.js';
import { HeaderRenderer } from './rendering/HeaderRenderer.js';
import { TextRenderer } from './rendering/TextRenderer.js';
import { VirtualGrid } from './core/virtual-grid/VirtualGrid.js';
import { SparseMatrix } from './core/sparse-matrix/SparseMatrix.js';
import { OperationHistory, type AnyOperation } from './core/operation-history/OperationHistory.js';
import { FormulaManager, type CellValue } from './core/formulas/FormulaManager.js';

export class App {
  private config: AppConfig;
  private canvas: HTMLCanvasElement;
  private webgpuManager: WebGPUDeviceManager | null = null;
  private renderManager: RenderManager | null = null;
  private gridRenderer: GridRenderer | null = null;
  private headerRenderer: HeaderRenderer | null = null;
  private textRenderer: TextRenderer | null = null;
  private virtualGrid: VirtualGrid | null = null;
  private sparseMatrix: SparseMatrix | null = null;
  private operationHistory: OperationHistory | null = null;
  private formulaManager: FormulaManager | null = null;
  private isInitialized = false;

  // Координаты для контекстного меню
  private contextMenuCell: { row: number; col: number } | null = null;

  // FPS tracking
  private frameCount = 0;
  private fps = 0;
  private lastFpsUpdate = 0;
  private needsRender = true;

  constructor(config: AppConfig) {
    this.config = config;
    this.canvas = this.getCanvas();
  }

  /**
   * Инициализация приложения
   */
  async initialize(): Promise<void> {
    try {
      // 0. Настраиваем размер canvas
      this.setupCanvas();

      // 1. Проверяем поддержку WebGPU
      if (this.config.enableWebGPU) {
        await this.initializeWebGPU();
      }

      // 2. Инициализируем виртуальную сетку
      this.initializeVirtualGrid();

      // 3. Инициализируем разреженную матрицу
      this.initializeSparseMatrix();

      // 4. Настраиваем обработчики событий
      this.setupEventHandlers();

      // 5. Запускаем рендеринг
      this.startRendering();

      this.isInitialized = true;
      this.lastFpsUpdate = performance.now();

      // Инициализируем отображение FPS
      this.updateFPSDisplay();

      console.log('✅ Приложение успешно инициализировано');
    } catch (error) {
      console.error('❌ Ошибка инициализации приложения:', error);
      throw error;
    }
  }

  /**
   * Инициализация WebGPU
   */
  private async initializeWebGPU(): Promise<void> {
    console.log('🔧 Инициализация WebGPU...');

    this.webgpuManager = new WebGPUDeviceManager();
    const result: InitializationResult = await this.webgpuManager.initialize(this.canvas);

    if (!result.success || !result.config) {
      throw new Error(`WebGPU инициализация не удалась: ${result.error}`);
    }

    // Создаем менеджер рендеринга
    this.renderManager = new RenderManager(
      result.config,
      this.canvas,
      this.config.cellWidth,
      this.config.cellHeight
    );
    await this.renderManager.initialize();

    // Создаем GridRenderer для оптимизированного рендеринга сетки
    this.gridRenderer = new GridRenderer(
      result.config,
      this.canvas,
      this.config.cellWidth,
      this.config.cellHeight
    );
    await this.gridRenderer.initialize();

    // Создаем HeaderRenderer для заголовков столбцов и строк
    const headersCanvas = document.getElementById('headers-canvas') as HTMLCanvasElement;
    if (headersCanvas) {
      this.headerRenderer = new HeaderRenderer(
        headersCanvas,
        this.config.cellWidth,
        this.config.cellHeight
      );
      console.log('✅ HeaderRenderer инициализирован');
    } else {
      console.warn('⚠️ headers-canvas не найден, заголовки будут отключены');
    }

    // Создаем TextRenderer для текста в ячейках
    const textCanvas = document.getElementById('text-canvas') as HTMLCanvasElement;
    if (textCanvas) {
      this.textRenderer = new TextRenderer(
        textCanvas,
        this.config.cellWidth,
        this.config.cellHeight
      );
      console.log('✅ TextRenderer инициализирован');
    } else {
      console.warn('⚠️ text-canvas не найден, текст будет отключен');
    }

    console.log('✅ WebGPU, рендер-пайплайн и GridRenderer успешно инициализированы');
  }

  /**
   * Инициализация виртуальной сетки
   */
  private initializeVirtualGrid(): void {
    console.log('🔧 Инициализация виртуальной сетки...');

    this.virtualGrid = new VirtualGrid(
      this.canvas.width,
      this.canvas.height,
      this.config.cellWidth,
      this.config.cellHeight,
      this.config.maxRows,
      this.config.maxCols
    );

    console.log('✅ Виртуальная сетка инициализирована');
  }

  /**
   * Инициализация разреженной матрицы
   */
  private initializeSparseMatrix(): void {
    console.log('🔧 Инициализация разреженной матрицы...');

    this.sparseMatrix = new SparseMatrix();

    console.log('✅ Разреженная матрица инициализирована');

    // Инициализируем историю операций
    this.operationHistory = new OperationHistory(100);
    console.log('✅ История операций инициализирована');

    // Инициализируем менеджер формул
    this.formulaManager = new FormulaManager({
      getCellValue: (row: number, col: number) => this.getCellValue(row, col),
      getCellRange: (startRow: number, startCol: number, endRow: number, endCol: number) =>
        this.getCellRange(startRow, startCol, endRow, endCol),
    });

    // Устанавливаем callback для обновления формул в SparseMatrix
    this.formulaManager.setUpdateFormulaCallback((row: number, col: number, formula: string) => {
      this.sparseMatrix?.setCell(row, col, formula);
    });

    console.log('✅ Менеджер формул инициализирован');

    // Устанавливаем провайдер значений в VirtualGrid для формул
    if (this.virtualGrid) {
      this.virtualGrid.setCellValueProvider((row: number, col: number) => {
        const cellValue = this.getCellValue(row, col);
        return cellValue.value; // Возвращаем только значение, не тип
      });
    }

    // ДОБАВЛЯЕМ ТЕСТОВЫЕ ДАННЫЕ для демонстрации текста
    this.addTestData();
  }

  /**
   * Добавление тестовых данных для демонстрации
   */
  private addTestData(): void {
    if (!this.sparseMatrix) return;

    console.log('📝 Добавление тестовых данных...');

    // Заголовки и примеры данных
    this.sparseMatrix.setCell(0, 0, 'Имя');
    this.sparseMatrix.setCell(0, 1, 'Возраст');
    this.sparseMatrix.setCell(0, 2, 'Город');
    this.sparseMatrix.setCell(0, 3, 'Зарплата');

    // Тестовые строки
    this.sparseMatrix.setCell(1, 0, 'Иван Петров');
    this.sparseMatrix.setCell(1, 1, '25');
    this.sparseMatrix.setCell(1, 2, 'Москва');
    this.sparseMatrix.setCell(1, 3, '50000');

    this.sparseMatrix.setCell(2, 0, 'Анна Сидорова');
    this.sparseMatrix.setCell(2, 1, '30');
    this.sparseMatrix.setCell(2, 2, 'СПб');
    this.sparseMatrix.setCell(2, 3, '60000');

    this.sparseMatrix.setCell(3, 0, 'Петр Иванов');
    this.sparseMatrix.setCell(3, 1, '28');
    this.sparseMatrix.setCell(3, 2, 'Казань');
    this.sparseMatrix.setCell(3, 3, '45000');

    // Формулы для демонстрации
    this.sparseMatrix.setCell(5, 0, 'Итого:');
    this.sparseMatrix.setCell(5, 3, '=SUM(D2:D4)');

    // Добавляем формулу MIN
    this.sparseMatrix.setCell(6, 3, '=MIN(D2:D4)');
    console.log('📊 Добавлена формула: =MIN(D2:D4)');

    // Добавляем формулу MAX
    this.sparseMatrix.setCell(7, 3, '=MAX(D2:D4)');
    console.log('📊 Добавлена формула: =MAX(D2:D4)');

    // Добавляем формулу AVERAGE
    this.sparseMatrix.setCell(8, 3, '=AVERAGE(D2:D4)');
    console.log('📊 Добавлена формула: =AVERAGE(D2:D4)');

    // Добавляем простую арифметику
    this.sparseMatrix.setCell(9, 3, '=D2+D3');
    console.log('📊 Добавлена формула: =D2+D3');

    // Длинный текст для тестирования обрезки
    this.sparseMatrix.setCell(7, 0, 'Очень длинный текст который не поместится в ячейку');
    this.sparseMatrix.setCell(7, 1, 'Короткий');

    console.log('✅ Тестовые данные добавлены');
  }

  /**
   * Генерация тестовых данных 1000x1000 для проверки производительности
   */
  private generateTestData1000x1000(): void {
    if (!this.sparseMatrix) return;

    console.log('🧪 Генерация тестовых данных 1000x1000...');

    const startTime = performance.now();
    let cellsGenerated = 0;

    // Показываем прогресс
    const statusText = document.getElementById('status-text');
    if (statusText) {
      statusText.textContent = 'Генерация данных...';
    }

    // Генерируем данные батчами для не блокировки UI
    const batchSize = 1000;
    let currentRow = 0;
    let currentCol = 0;

    const generateBatch = () => {
      for (let i = 0; i < batchSize && currentRow < 1000; i++) {
        // Заголовки столбцов
        if (currentRow === 0) {
          this.sparseMatrix!.setCell(0, currentCol, `Col${currentCol}`);
        } else {
          // Генерируем разные типы данных
          let value;
          switch (currentCol % 5) {
            case 0:
              value = `Строка ${currentRow}-${currentCol}`;
              break;
            case 1:
              value = Math.floor(Math.random() * 10000);
              break;
            case 2:
              value = (Math.random() * 100).toFixed(2);
              break;
            case 3:
              value =
                Math.random() > 0.7
                  ? `Длинный текст в ячейке ${currentRow},${currentCol}`
                  : `Текст ${currentRow}`;
              break;
            case 4:
              value = Math.random() > 0.5 ? 'Да' : 'Нет';
              break;
          }
          this.sparseMatrix!.setCell(currentRow, currentCol, value);
        }

        cellsGenerated++;
        currentCol++;

        if (currentCol >= 1000) {
          currentCol = 0;
          currentRow++;
        }
      }

      // Обновляем прогресс
      const progress = Math.round((currentRow / 1000) * 100);
      if (statusText) {
        statusText.textContent = `Генерация: ${progress}% (${cellsGenerated} ячеек)`;
      }

      // Продолжаем генерацию или завершаем
      if (currentRow < 1000) {
        setTimeout(generateBatch, 10); // Небольшая задержка для UI
      } else {
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);

        console.log(
          `✅ Тестовые данные 1000x1000 сгенерированы: ${cellsGenerated} ячеек за ${duration}мс`
        );

        if (statusText) {
          statusText.textContent = `Готов (${cellsGenerated} ячеек, ${duration}мс)`;
        }

        // Принудительно перерисовываем
        this.needsRender = true;
        this.render();
      }
    };

    generateBatch();
  }

  /**
   * Настройка обработчиков событий
   */
  private setupEventHandlers(): void {
    console.log('🔧 Настройка обработчиков событий...');

    // Обработчики панели инструментов
    this.setupToolbarHandlers();

    // Обработчики панели формул
    this.setupFormulaBarHandlers();

    // Обработчики canvas
    this.setupCanvasHandlers();

    // Обработчики клавиатуры
    this.setupKeyboardHandlers();

    console.log('✅ Обработчики событий настроены');
  }

  /**
   * Настройка обработчиков панели инструментов
   */
  private setupToolbarHandlers(): void {
    const toolbarButtons = document.querySelectorAll('.toolbar-button[data-action]');

    toolbarButtons.forEach(button => {
      button.addEventListener('click', event => {
        const action = (event.target as HTMLElement).getAttribute('data-action');
        this.handleToolbarAction(action);
      });
    });
  }

  /**
   * Настройка обработчиков панели формул
   */
  private setupFormulaBarHandlers(): void {
    const formulaInput = document.getElementById('formula-input') as HTMLInputElement;
    const enterButton = document.querySelector('[data-action="enter"]') as HTMLButtonElement;

    if (formulaInput) {
      formulaInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          this.handleFormulaSubmit(formulaInput.value);
        }
      });
    }

    if (enterButton) {
      enterButton.addEventListener('click', () => {
        if (formulaInput) {
          this.handleFormulaSubmit(formulaInput.value);
        }
      });
    }
  }

  /**
   * Настройка обработчиков canvas
   */
  private setupCanvasHandlers(): void {
    this.canvas.addEventListener('click', event => {
      this.handleCanvasClick(event);
    });

    this.canvas.addEventListener('mousemove', event => {
      this.handleCanvasMouseMove(event);
    });

    this.canvas.addEventListener('wheel', event => {
      this.handleCanvasWheel(event);
    });

    // Обработка контекстного меню
    this.canvas.addEventListener('contextmenu', event => {
      event.preventDefault();
      this.showContextMenu(event);
    });

    // Закрытие контекстного меню при клике вне его
    document.addEventListener('click', () => {
      this.hideContextMenu();
    });

    // Обработка клика по элементам контекстного меню
    this.setupContextMenuHandlers();
  }

  /**
   * Настройка обработчиков клавиатуры
   */
  private setupKeyboardHandlers(): void {
    document.addEventListener('keydown', event => {
      this.handleKeyDown(event);
    });

    // Обработка фокуса на canvas для навигации
    this.canvas.tabIndex = 0; // Делаем canvas focusable
    this.canvas.addEventListener('focus', () => {
      console.log('🎯 Canvas получил фокус');
    });
  }

  /**
   * Обработка действий панели инструментов
   */
  private handleToolbarAction(action: string | null): void {
    if (!action) return;

    console.log(`🔧 Обработка действия: ${action}`);

    switch (action) {
      case 'new':
        this.createNewSpreadsheet();
        break;
      case 'open':
        this.openSpreadsheet();
        break;
      case 'save':
        this.saveSpreadsheet();
        break;
      case 'undo':
        this.undo();
        break;
      case 'redo':
        this.redo();
        break;
      case 'copy':
        this.copy();
        break;
      case 'paste':
        this.paste();
        break;
      case 'test-1000x1000':
        this.generateTestData1000x1000();
        break;
      default:
        console.warn(`Неизвестное действие: ${action}`);
    }
  }

  /**
   * Обработка отправки формулы
   */
  private handleFormulaSubmit(formula: string): void {
    console.log(`📝 Обработка формулы: ${formula}`);

    if (this.virtualGrid && this.sparseMatrix) {
      const activeCell = this.virtualGrid.getActiveCell();
      if (activeCell) {
        this.sparseMatrix.setCell(activeCell.row, activeCell.col, formula);
        this.updateDisplay();
        this.needsRender = true; // Принудительная перерисовка
      }
    }
  }

  /**
   * Обработка клика по canvas
   */
  private handleCanvasClick(event: MouseEvent): void {
    if (!this.virtualGrid) return;

    const rect = this.canvas.getBoundingClientRect();
    let x = event.clientX - rect.left;
    let y = event.clientY - rect.top;

    // Корректируем клик с учетом отступов СЛЕВА и СВЕРХУ
    const headerWidth = 30; // Ширина номеров строк
    const headerHeight = 25; // Высота заголовков столбцов

    // Проверяем клик по областям заголовков (игнорируем)
    if (x < headerWidth || y < headerHeight) {
      console.log('🏷️ Клик по заголовкам - игнорируем');
      return;
    }

    // Корректируем координаты для основной сетки
    x -= headerWidth;
    y -= headerHeight;

    const cell = this.virtualGrid.getCellAtPosition(x, y);
    if (cell) {
      this.virtualGrid.setActiveCell(cell);
      this.updateFormulaBar(cell);
      this.updateStatusBar();

      // Помечаем, что нужна перерисовка (выделение будет отрендерено в основном render)
      this.needsRender = true;
    }
  }

  /**
   * Обработка движения мыши по canvas
   */
  private handleCanvasMouseMove(event: MouseEvent): void {
    if (!this.virtualGrid) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const cell = this.virtualGrid.getCellAtPosition(x, y);
    if (cell) {
      // Изменяем курсор на pointer при наведении на ячейку
      this.canvas.style.cursor = 'pointer';

      // Сохраняем информацию о ячейке под курсором
      (this as any).hoveredCell = cell;
    } else {
      this.canvas.style.cursor = 'default';
      (this as any).hoveredCell = null;
    }
  }

  /**
   * Обработка прокрутки колесом мыши
   */
  private handleCanvasWheel(event: WheelEvent): void {
    event.preventDefault();

    if (!this.virtualGrid) return;

    const delta = event.deltaY;
    if (delta > 0) {
      this.virtualGrid.scrollDown();
    } else {
      this.virtualGrid.scrollUp();
    }

    this.updateDisplay();
  }

  /**
   * Запуск рендеринга
   */
  private startRendering(): void {
    console.log('🎨 Запуск рендеринга...');

    const render = async (currentTime: number) => {
      this.updateFPS(currentTime);

      // Рендерим только если нужно
      if (this.needsRender) {
        await this.render();
        this.needsRender = false;
      }

      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
  }

  /**
   * Обновление FPS
   */
  private updateFPS(currentTime: number): void {
    this.frameCount++;

    if (currentTime - this.lastFpsUpdate >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = currentTime;

      // Обновляем FPS в UI
      this.updateFPSDisplay();
    }
  }

  /**
   * Рендеринг кадра
   */
  private async render(): Promise<void> {
    if (!this.isInitialized || !this.virtualGrid) return;

    // Получаем видимые ячейки
    const visibleCells = this.virtualGrid.getVisibleCells();

    // Заполняем ячейки данными из SparseMatrix
    if (this.sparseMatrix) {
      visibleCells.forEach(cell => {
        cell.value = this.sparseMatrix!.getCell(cell.row, cell.col);
      });
    }

    // Рендерим через WebGPU или Canvas 2D
    if (this.webgpuManager) {
      await this.renderWithWebGPU(visibleCells);
    } else {
      this.renderWithCanvas2D(visibleCells);
    }
  }

  /**
   * Рендеринг через WebGPU с использованием GridRenderer
   */
  private async renderWithWebGPU(cells: any[]): Promise<void> {
    if (!this.gridRenderer || !this.virtualGrid) return;

    try {
      // Получаем viewport для рендеринга
      const viewport = this.virtualGrid.getViewport();

      // Получаем активную ячейку для выделения
      const activeCell = this.virtualGrid.getActiveCell();
      let selectedCellData = null;

      if (activeCell) {
        selectedCellData = {
          row: activeCell.row,
          col: activeCell.col,
          value: null,
          screenX: (activeCell.col - viewport.startCol) * this.config.cellWidth,
          screenY: (activeCell.row - viewport.startRow) * this.config.cellHeight,
          width: this.config.cellWidth,
          height: this.config.cellHeight,
        };

        const isVisible =
          activeCell.col >= viewport.startCol &&
          activeCell.col <= viewport.endCol &&
          activeCell.row >= viewport.startRow &&
          activeCell.row <= viewport.endRow;

        console.log(
          `🎯 APP ОТЛАДКА: activeCell=${JSON.stringify(activeCell)}, viewport=${JSON.stringify(viewport)}, selectedCellData=${JSON.stringify(selectedCellData)}, ВИДИМАЯ=${isVisible}`
        );
      } else {
        console.log(`🎯 APP ОТЛАДКА: НЕТ АКТИВНОЙ ЯЧЕЙКИ!`);
      }

      // Рендерим через оптимизированный GridRenderer с выделением
      await this.gridRenderer.render(cells, viewport, selectedCellData);

      // Рендерим заголовки столбцов и строк
      if (this.headerRenderer) {
        this.headerRenderer.render(viewport);
      }

      // Рендерим текст в ячейках
      if (this.textRenderer) {
        this.textRenderer.render(cells, viewport);
      }
    } catch (error) {
      console.error('❌ Ошибка WebGPU рендеринга:', error);
      // Fallback на Canvas 2D
      this.renderWithCanvas2D(cells);
    }
  }

  /**
   * Рендеринг через Canvas 2D
   */
  private renderWithCanvas2D(cells: any[]): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    // Очищаем canvas
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Оптимизация: рендерим только видимые ячейки
    if (cells.length > 0) {
      // Устанавливаем стили один раз
      ctx.font = '12px Arial';
      ctx.textBaseline = 'top';

      // Рендерим ячейки батчами
      cells.forEach(cell => {
        this.renderCell2D(ctx, cell);
      });
    }
  }

  /**
   * Рендеринг ячейки через Canvas 2D
   */
  private renderCell2D(ctx: CanvasRenderingContext2D, cell: any): void {
    // Фон ячейки
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cell.screenX, cell.screenY, cell.width, cell.height);

    // Границы ячейки
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.strokeRect(cell.screenX, cell.screenY, cell.width, cell.height);

    // Текст ячейки (только если есть значение)
    if (cell.value && String(cell.value).trim()) {
      ctx.fillStyle = '#000000';
      ctx.fillText(String(cell.value), cell.screenX + 4, cell.screenY + 18);
    }
  }

  /**
   * Обновление отображения
   */
  private updateDisplay(): void {
    // Обновляем статус-бар
    this.updateStatusBar();

    // Помечаем, что нужна перерисовка (включая выделение)
    this.needsRender = true;
  }

  /**
   * Обновление панели формул
   */
  private updateFormulaBar(cell: any): void {
    const formulaInput = document.getElementById('formula-input') as HTMLInputElement;
    if (formulaInput && this.sparseMatrix) {
      const value = this.sparseMatrix.getCell(cell.row, cell.col);
      formulaInput.value = value || '';
    }
  }

  /**
   * Обновление статус-бара
   */
  private updateStatusBar(): void {
    const cellInfo = document.getElementById('cell-info');
    const statusText = document.getElementById('status-text');

    if (this.virtualGrid) {
      const activeCell = this.virtualGrid.getActiveCell();
      if (activeCell && cellInfo) {
        const colName = this.getColumnName(activeCell.col);
        const rowName = (activeCell.row + 1).toString();
        cellInfo.textContent = `${colName}${rowName}`;
      }
    }

    if (statusText) {
      statusText.textContent = 'Готов';
    }
  }

  /**
   * Обновление отображения FPS
   */
  private updateFPSDisplay(): void {
    const fpsElement = document.getElementById('performance-info');
    if (fpsElement) {
      fpsElement.textContent = `FPS: ${this.fps}`;
    }
  }

  /**
   * Получение имени столбца
   */
  private getColumnName(col: number): string {
    let result = '';
    while (col >= 0) {
      result = String.fromCharCode(65 + (col % 26)) + result;
      col = Math.floor(col / 26) - 1;
    }
    return result;
  }

  /**
   * Получение canvas элемента
   */
  private getCanvas(): HTMLCanvasElement {
    const canvas = document.getElementById('spreadsheet-canvas') as HTMLCanvasElement;
    if (!canvas) {
      throw new Error('Canvas элемент не найден');
    }
    return canvas;
  }

  /**
   * Настройка размера canvas
   */
  private setupCanvas(): void {
    this.updateCanvasSize(); // Сразу устанавливаем размер

    // Обработчики для полной адаптивности
    window.addEventListener('resize', () => {
      this.updateCanvasSize();
    });

    // Для мобильных - изменение ориентации
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.updateCanvasSize(), 100); // Задержка для корректного расчета
    });

    // Дополнительно - для случаев когда layout меняется
    const resizeObserver = new ResizeObserver(() => {
      this.updateCanvasSize();
    });

    const container = this.canvas.parentElement;
    if (container) {
      resizeObserver.observe(container);
    }
  }

  /**
   * Обновление размера canvas при изменении размера окна
   */
  private updateCanvasSize(): void {
    const container = this.canvas.parentElement;
    if (!container) return;

    // Принудительно обновляем layout для мобильных
    requestAnimationFrame(() => {
      const containerRect = container.getBoundingClientRect();
      let width = Math.floor(containerRect.width);
      let height = Math.floor(containerRect.height);

      // Минимальные размеры для стабильности
      width = Math.max(width, 320);
      height = Math.max(height, 200);

      // Обновляем только если размер действительно изменился
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;

        // Синхронизируем размер headers canvas
        const headersCanvas = document.getElementById('headers-canvas') as HTMLCanvasElement;
        if (headersCanvas) {
          headersCanvas.width = width;
          headersCanvas.height = height;
        }

        // Синхронизируем размер text canvas
        const textCanvas = document.getElementById('text-canvas') as HTMLCanvasElement;
        if (textCanvas) {
          textCanvas.width = width;
          textCanvas.height = height;
        }

        console.log(`📐 Canvas размер обновлен: ${width}x${height}`);

        // Обновляем виртуальную сетку
        if (this.virtualGrid) {
          this.virtualGrid.updateCanvasSize(width, height);
        }

        // Обновляем HeaderRenderer
        if (this.headerRenderer) {
          this.headerRenderer.updateCanvasSize(width, height);
        }

        // Обновляем TextRenderer
        if (this.textRenderer) {
          this.textRenderer.updateCanvasSize(width, height);
        }

        // Помечаем, что нужна перерисовка
        this.needsRender = true;
      }
    });
  }

  // Методы для обработки действий (заглушки)
  private createNewSpreadsheet(): void {
    console.log('📄 Создание новой таблицы');

    if (this.sparseMatrix && this.virtualGrid) {
      // Очищаем все данные
      this.sparseMatrix.clear();

      // Возвращаемся в начало
      this.virtualGrid.scrollToHome();
      this.virtualGrid.setActiveCell({ row: 0, col: 0 });

      // Очищаем поле формул
      const formulaInput = document.getElementById('formula-input') as HTMLInputElement;
      if (formulaInput) {
        formulaInput.value = '';
      }

      // Обновляем статус
      this.updateStatusBar();
      this.needsRender = true;

      console.log('✅ Новая таблица создана');
    }
  }

  private openSpreadsheet(): void {
    console.log('📁 Открытие таблицы');

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = event => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file && this.sparseMatrix) {
        const reader = new FileReader();
        reader.onload = e => {
          try {
            const data = JSON.parse(e.target?.result as string);

            // Очищаем текущие данные
            this.sparseMatrix!.clear();

            // Загружаем новые данные
            if (data.cells) {
              Object.entries(data.cells).forEach(([key, value]) => {
                const parts = key.split(',').map(Number);
                const row = parts[0];
                const col = parts[1];
                if (row !== undefined && col !== undefined) {
                  this.sparseMatrix!.setCell(row, col, value as string);
                }
              });
            }

            // Обновляем отображение
            this.updateDisplay();
            this.needsRender = true;

            console.log('✅ Таблица загружена');
          } catch (error) {
            console.error('❌ Ошибка загрузки файла:', error);
            alert('Ошибка при загрузке файла');
          }
        };
        reader.readAsText(file);
      }
    };

    input.click();
  }

  private saveSpreadsheet(): void {
    console.log('💾 Сохранение таблицы');

    if (this.sparseMatrix) {
      const data = {
        cells: this.sparseMatrix.getAllCells(),
        createdAt: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `spreadsheet_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();

      URL.revokeObjectURL(url);
      console.log('✅ Таблица сохранена');
    }
  }

  private copy(): void {
    console.log('📋 Копирование');

    if (this.virtualGrid && this.sparseMatrix) {
      const activeCell = this.virtualGrid.getActiveCell();
      if (activeCell) {
        const value = this.sparseMatrix.getCell(activeCell.row, activeCell.col);

        // Копируем в clipboard
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard
            .writeText(value || '')
            .then(() => {
              console.log('✅ Значение скопировано в буфер обмена');
            })
            .catch(error => {
              console.warn('⚠️ Не удалось скопировать в буфер обмена:', error);
            });
        }

        // Также сохраняем внутри приложения
        (this as any).clipboardValue = value || '';

        console.log(`✅ Скопировано: "${value}" из ячейки ${activeCell.row},${activeCell.col}`);
      }
    }
  }

  private paste(): void {
    console.log('📋 Вставка');

    if (this.virtualGrid && this.sparseMatrix) {
      const activeCell = this.virtualGrid.getActiveCell();
      if (activeCell) {
        // Пытаемся получить из системного буфера обмена
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard
            .readText()
            .then(text => {
              this.sparseMatrix!.setCell(activeCell.row, activeCell.col, text);
              this.updateDisplay();
              this.needsRender = true;
              console.log(`✅ Вставлено: "${text}" в ячейку ${activeCell.row},${activeCell.col}`);
            })
            .catch(() => {
              // Fallback на внутренний буфер
              this.pasteFromInternalClipboard(activeCell);
            });
        } else {
          // Fallback на внутренний буфер
          this.pasteFromInternalClipboard(activeCell);
        }
      }
    }
  }

  private pasteFromInternalClipboard(activeCell: { row: number; col: number }): void {
    const clipboardValue = (this as any).clipboardValue;
    if (clipboardValue !== undefined && this.sparseMatrix) {
      this.sparseMatrix.setCell(activeCell.row, activeCell.col, clipboardValue);
      this.updateDisplay();
      this.needsRender = true;
      console.log(`✅ Вставлено: "${clipboardValue}" в ячейку ${activeCell.row},${activeCell.col}`);
    }
  }

  /**
   * Настройка обработчиков контекстного меню
   */
  private setupContextMenuHandlers(): void {
    const contextMenu = document.getElementById('context-menu');
    if (contextMenu) {
      contextMenu.addEventListener('click', event => {
        event.stopPropagation();
        const target = event.target as HTMLElement;
        const action = target.getAttribute('data-action');
        if (action) {
          this.handleContextMenuAction(action);
          this.hideContextMenu();
        }
      });
    }
  }

  /**
   * Показать контекстное меню
   */
  private showContextMenu(event: MouseEvent): void {
    const contextMenu = document.getElementById('context-menu');
    if (!contextMenu || !this.virtualGrid) return;

    // Вычисляем координаты ячейки по клику
    const canvasRect = this.canvas.getBoundingClientRect();
    const clickX = event.clientX - canvasRect.left;
    const clickY = event.clientY - canvasRect.top;

    // Учитываем отступы для заголовков
    const headerWidth = 30;
    const headerHeight = 25;

    // Проверяем, что клик не по заголовкам
    if (clickX < headerWidth || clickY < headerHeight) {
      return; // Не показываем меню для заголовков
    }

    // Вычисляем координаты ячейки
    const cellX = clickX - headerWidth;
    const cellY = clickY - headerHeight;

    const viewport = this.virtualGrid.getViewport();
    const col = viewport.startCol + Math.floor(cellX / this.config.cellWidth);
    const row = viewport.startRow + Math.floor(cellY / this.config.cellHeight);

    // Сохраняем координаты ячейки для операций
    this.contextMenuCell = { row, col };

    console.log(`🎯 Контекстное меню для ячейки ${row},${col} (клик: ${clickX},${clickY})`);

    // Показываем меню
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${event.clientX}px`;
    contextMenu.style.top = `${event.clientY}px`;
  }

  /**
   * Скрыть контекстное меню
   */
  private hideContextMenu(): void {
    const contextMenu = document.getElementById('context-menu');
    if (contextMenu) {
      contextMenu.style.display = 'none';
    }
    // Очищаем сохраненные координаты
    this.contextMenuCell = null;
  }

  /**
   * Обработка действий контекстного меню
   */
  private handleContextMenuAction(action: string): void {
    console.log(`🔧 Действие контекстного меню: ${action}`);

    switch (action) {
      case 'copy':
        this.copy();
        break;
      case 'paste':
        this.paste();
        break;
      case 'insert-row':
        this.insertRow();
        break;
      case 'insert-col':
        this.insertColumn();
        break;
      case 'delete-row':
        this.deleteRow();
        break;
      case 'delete-col':
        this.deleteColumn();
        break;
      case 'clear-cell':
        this.clearCell();
        break;
      default:
        console.warn(`Неизвестное действие контекстного меню: ${action}`);
    }
  }

  /**
   * Вставка строки
   */
  private insertRow(): void {
    if (!this.sparseMatrix || !this.operationHistory) return;

    // Используем координаты из контекстного меню
    const insertAtRow = this.contextMenuCell ? this.contextMenuCell.row : 0;

    console.log(`➕ Вставка строки на позиции ${insertAtRow}`);

    // Собираем данные о затронутых ячейках для отмены
    const affectedCells: Array<{ row: number; col: number; value: any }> = [];

    // Получаем viewport для сбора данных
    if (this.virtualGrid) {
      const viewport = this.virtualGrid.getViewport();
      for (let row = insertAtRow; row < viewport.endRow; row++) {
        for (let col = viewport.startCol; col < viewport.endCol; col++) {
          const value = this.sparseMatrix.getCell(row, col);
          if (value !== null) {
            affectedCells.push({ row, col, value });
          }
        }
      }
    }

    // Вставляем строку в SparseMatrix
    this.sparseMatrix.insertRow(insertAtRow);

    // Обрабатываем формулы
    if (this.formulaManager) {
      this.formulaManager.handleRowInsertion(insertAtRow);
    }

    // Очищаем кеш VirtualGrid
    if (this.virtualGrid) {
      this.virtualGrid.clearCache();
    }

    // Сохраняем операцию в историю
    this.operationHistory.addOperation({
      type: 'insert_row',
      data: {
        atRow: insertAtRow,
        affectedCells: affectedCells,
      },
      description: `Вставка строки на позиции ${insertAtRow + 1}`,
    });

    // Принудительно перерисовываем
    this.needsRender = true;
    this.render();
  }

  /**
   * Вставка столбца
   */
  private insertColumn(): void {
    if (!this.sparseMatrix || !this.operationHistory) return;

    // Используем координаты из контекстного меню
    const insertAtCol = this.contextMenuCell ? this.contextMenuCell.col : 0;

    console.log(`➕ Вставка столбца на позиции ${insertAtCol}`);

    // Собираем данные о затронутых ячейках для отмены
    const affectedCells: Array<{ row: number; col: number; value: any }> = [];

    // Получаем viewport для сбора данных
    if (this.virtualGrid) {
      const viewport = this.virtualGrid.getViewport();
      for (let row = viewport.startRow; row < viewport.endRow; row++) {
        for (let col = insertAtCol; col < viewport.endCol; col++) {
          const value = this.sparseMatrix.getCell(row, col);
          if (value !== null) {
            affectedCells.push({ row, col, value });
          }
        }
      }
    }

    // Вставляем столбец в SparseMatrix
    this.sparseMatrix.insertColumn(insertAtCol);

    // Обрабатываем формулы
    if (this.formulaManager) {
      this.formulaManager.handleColumnInsertion(insertAtCol);
    }

    // Очищаем кеш VirtualGrid
    if (this.virtualGrid) {
      this.virtualGrid.clearCache();
    }

    // Сохраняем операцию в историю
    const columnLetter = this.indexToColumnLetter(insertAtCol);
    this.operationHistory.addOperation({
      type: 'insert_column',
      data: {
        atCol: insertAtCol,
        affectedCells: affectedCells,
      },
      description: `Вставка столбца ${columnLetter}`,
    });

    // Принудительно перерисовываем
    this.needsRender = true;
    this.render();
  }

  /**
   * Удаление строки
   */
  private deleteRow(): void {
    if (!this.sparseMatrix || !this.operationHistory) return;

    // Используем координаты из контекстного меню
    if (!this.contextMenuCell) {
      console.warn('⚠️ Нет координат для удаления строки');
      return;
    }

    const deleteAtRow = this.contextMenuCell.row;

    // Подтверждение удаления
    const confirmed = confirm(
      `Удалить строку ${deleteAtRow + 1}? Все данные в этой строке будут потеряны.`
    );
    if (!confirmed) return;

    console.log(`🗑️ Удаление строки ${deleteAtRow}`);

    // Собираем данные удаляемых ячеек для отмены
    const deletedCells: Array<{ row: number; col: number; value: any }> = [];

    // Получаем viewport для сбора данных
    if (this.virtualGrid) {
      const viewport = this.virtualGrid.getViewport();
      for (let col = viewport.startCol; col < viewport.endCol; col++) {
        const value = this.sparseMatrix.getCell(deleteAtRow, col);
        if (value !== null) {
          deletedCells.push({ row: deleteAtRow, col, value });
        }
      }
    }

    // Удаляем строку из SparseMatrix
    this.sparseMatrix.deleteRow(deleteAtRow);

    // Обрабатываем формулы
    if (this.formulaManager) {
      this.formulaManager.handleRowDeletion(deleteAtRow);
    }

    // Очищаем кеш VirtualGrid
    if (this.virtualGrid) {
      this.virtualGrid.clearCache();
    }

    // Сохраняем операцию в историю
    this.operationHistory.addOperation({
      type: 'delete_row',
      data: {
        atRow: deleteAtRow,
        deletedCells: deletedCells,
      },
      description: `Удаление строки ${deleteAtRow + 1}`,
    });

    // Принудительно перерисовываем
    this.needsRender = true;
    this.render();
  }

  /**
   * Удаление столбца
   */
  private deleteColumn(): void {
    if (!this.sparseMatrix || !this.operationHistory) return;

    // Используем координаты из контекстного меню
    if (!this.contextMenuCell) {
      console.warn('⚠️ Нет координат для удаления столбца');
      return;
    }

    const deleteAtCol = this.contextMenuCell.col;

    // Преобразуем индекс столбца в букву для пользователя
    const columnLetter = this.indexToColumnLetter(deleteAtCol);

    // Подтверждение удаления
    const confirmed = confirm(
      `Удалить столбец ${columnLetter}? Все данные в этом столбце будут потеряны.`
    );
    if (!confirmed) return;

    console.log(`🗑️ Удаление столбца ${deleteAtCol} (${columnLetter})`);

    // Собираем данные удаляемых ячеек для отмены
    const deletedCells: Array<{ row: number; col: number; value: any }> = [];

    // Получаем viewport для сбора данных
    if (this.virtualGrid) {
      const viewport = this.virtualGrid.getViewport();
      for (let row = viewport.startRow; row < viewport.endRow; row++) {
        const value = this.sparseMatrix.getCell(row, deleteAtCol);
        if (value !== null) {
          deletedCells.push({ row, col: deleteAtCol, value });
        }
      }
    }

    // Удаляем столбец из SparseMatrix
    this.sparseMatrix.deleteColumn(deleteAtCol);

    // Обрабатываем формулы
    if (this.formulaManager) {
      this.formulaManager.handleColumnDeletion(deleteAtCol);
    }

    // Очищаем кеш VirtualGrid
    if (this.virtualGrid) {
      this.virtualGrid.clearCache();
    }

    // Сохраняем операцию в историю
    this.operationHistory.addOperation({
      type: 'delete_column',
      data: {
        atCol: deleteAtCol,
        deletedCells: deletedCells,
      },
      description: `Удаление столбца ${columnLetter}`,
    });

    // Принудительно перерисовываем
    this.needsRender = true;
    this.render();
  }

  /**
   * Очистка ячейки
   */
  private clearCell(): void {
    console.log('🧹 Очистка ячейки');

    if (this.virtualGrid && this.sparseMatrix) {
      const activeCell = this.virtualGrid.getActiveCell();
      if (activeCell) {
        this.sparseMatrix.setCell(activeCell.row, activeCell.col, '');

        // Очищаем поле формул
        const formulaInput = document.getElementById('formula-input') as HTMLInputElement;
        if (formulaInput) {
          formulaInput.value = '';
        }

        this.updateDisplay();
        this.needsRender = true;
        console.log(`✅ Ячейка ${activeCell.row},${activeCell.col} очищена`);
      }
    }
  }

  /**
   * Обработка нажатий клавиш
   */
  private handleKeyDown(event: KeyboardEvent): void {
    // Игнорируем если фокус на поле ввода формул
    const formulaInput = document.getElementById('formula-input') as HTMLInputElement;
    if (document.activeElement === formulaInput) {
      return;
    }

    // Обработка Undo/Redo
    if (event.ctrlKey || event.metaKey) {
      switch (event.key.toLowerCase()) {
        case 'z':
          event.preventDefault();
          if (event.shiftKey) {
            this.redo(); // Ctrl+Shift+Z для Redo
          } else {
            this.undo(); // Ctrl+Z для Undo
          }
          return;
        case 'y':
          event.preventDefault();
          this.redo(); // Ctrl+Y для Redo
          return;
      }
    }

    if (!this.virtualGrid) return;

    const activeCell = this.virtualGrid.getActiveCell();
    if (!activeCell) return;

    let newRow = activeCell.row;
    let newCol = activeCell.col;
    let handled = false;

    switch (event.key) {
      case 'ArrowUp':
        newRow = Math.max(0, activeCell.row - 1);
        handled = true;
        break;
      case 'ArrowDown':
        newRow = activeCell.row + 1;
        handled = true;
        break;
      case 'ArrowLeft':
        newCol = Math.max(0, activeCell.col - 1);
        handled = true;
        break;
      case 'ArrowRight':
        newCol = activeCell.col + 1;
        handled = true;
        break;
      case 'Tab':
        newCol = activeCell.col + 1;
        handled = true;
        break;
      case 'Enter':
        newRow = activeCell.row + 1;
        handled = true;
        break;
      case 'Delete':
      case 'Backspace':
        this.clearCell();
        handled = true;
        break;
      case 'F2':
        // Начать редактирование ячейки
        this.startCellEditing();
        handled = true;
        break;
      default:
        // Если нажата обычная клавиша, начинаем ввод текста
        if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
          this.startCellEditing(event.key);
          handled = true;
        }
        break;
    }

    if (handled) {
      event.preventDefault();

      // Обновляем активную ячейку если координаты изменились
      if (newRow !== activeCell.row || newCol !== activeCell.col) {
        this.virtualGrid.setActiveCell({ row: newRow, col: newCol });
        this.updateFormulaBar({ row: newRow, col: newCol });
        this.updateStatusBar();
        this.needsRender = true;

        // Прокручиваем к ячейке если она вне видимости
        this.scrollToCell(newRow, newCol);
      }
    }
  }

  /**
   * Начать редактирование ячейки
   */
  private startCellEditing(initialValue?: string): void {
    const formulaInput = document.getElementById('formula-input') as HTMLInputElement;
    if (formulaInput) {
      // Если передано начальное значение, очищаем поле и вставляем его
      if (initialValue !== undefined) {
        formulaInput.value = initialValue;
      }

      // Фокусируемся на поле формул
      formulaInput.focus();
      formulaInput.select();

      console.log('✏️ Начато редактирование ячейки');
    }
  }

  /**
   * Прокрутка к указанной ячейке
   */
  private scrollToCell(row: number, col: number): void {
    if (this.virtualGrid) {
      const viewport = this.virtualGrid.getViewport();
      let needsScroll = false;

      // Проверяем нужна ли прокрутка
      if (row < viewport.startRow || row >= viewport.endRow) {
        needsScroll = true;
      }
      if (col < viewport.startCol || col >= viewport.endCol) {
        needsScroll = true;
      }

      if (needsScroll) {
        this.virtualGrid.scrollToCell(row, col);
        this.needsRender = true;
        console.log(`📊 Прокрутка к ячейке ${row},${col}`);
      }
    }
  }

  /**
   * Преобразование индекса столбца в букву (0 -> A, 1 -> B, ..., 25 -> Z, 26 -> AA)
   */
  private indexToColumnLetter(index: number): string {
    let result = '';
    while (index >= 0) {
      result = String.fromCharCode(65 + (index % 26)) + result;
      index = Math.floor(index / 26) - 1;
    }
    return result;
  }

  /**
   * Получение значения ячейки для формул
   */
  private getCellValue(row: number, col: number): CellValue {
    if (!this.sparseMatrix) {
      return { value: null, type: 'empty' };
    }

    const value = this.sparseMatrix.getCell(row, col);

    if (value === null) {
      return { value: null, type: 'empty' };
    }

    // Проверяем, является ли значение формулой
    if (typeof value === 'string' && value.startsWith('=')) {
      // Сначала устанавливаем формулу в менеджер, если её там нет
      if (this.formulaManager) {
        const existingFormula = this.formulaManager.getFormula(row, col);
        if (!existingFormula) {
          this.formulaManager.setFormula(row, col, value);
        }
        // Вычисляем формулу
        const result = this.formulaManager.evaluateFormula(row, col);
        console.log(
          `🔍 getCellValue(${row},${col}): формула ${value} -> ${JSON.stringify(result)}`
        );

        // Отладка для формул в столбце 3
        if (col === 3 && row >= 5) {
          console.log(`🔍 ОТЛАДКА ФОРМУЛЫ: ${row},${col} = ${value} -> ${JSON.stringify(result)}`);
        }

        return result;
      }
    }

    // Обычное значение
    if (typeof value === 'number') {
      const result = { value, type: 'number' as const };
      console.log(`🔍 getCellValue(${row},${col}): число ${value} -> ${JSON.stringify(result)}`);
      return result;
    } else if (typeof value === 'string') {
      // Проверяем, является ли строка числом
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && isFinite(numValue)) {
        const result = { value: numValue, type: 'number' as const };
        console.log(
          `🔍 getCellValue(${row},${col}): строка-число ${value} -> ${JSON.stringify(result)}`
        );
        return result;
      } else {
        const result = { value, type: 'string' as const };
        console.log(`🔍 getCellValue(${row},${col}): строка ${value} -> ${JSON.stringify(result)}`);
        return result;
      }
    }

    return { value: null, type: 'empty' };
  }

  /**
   * Получение диапазона ячеек для формул
   */
  private getCellRange(
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number
  ): CellValue[] {
    const values: CellValue[] = [];

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        values.push(this.getCellValue(row, col));
      }
    }

    return values;
  }

  /**
   * Отмена последней операции
   */
  private undo(): void {
    if (!this.operationHistory || !this.sparseMatrix) return;

    const operation = this.operationHistory.undo();
    if (!operation) {
      console.log('⚠️ Нет операций для отмены');
      return;
    }

    console.log(`↶ Отмена операции: ${operation.type}`);

    try {
      this.applyUndoOperation(operation);
      this.needsRender = true;
      this.render();
    } catch (error) {
      console.error('❌ Ошибка при отмене операции:', error);
    }
  }

  /**
   * Повтор отмененной операции
   */
  private redo(): void {
    if (!this.operationHistory || !this.sparseMatrix) return;

    const operation = this.operationHistory.redo();
    if (!operation) {
      console.log('⚠️ Нет операций для повтора');
      return;
    }

    console.log(`↷ Повтор операции: ${operation.type}`);

    try {
      this.applyRedoOperation(operation);
      this.needsRender = true;
      this.render();
    } catch (error) {
      console.error('❌ Ошибка при повторе операции:', error);
    }
  }

  /**
   * Применение операции отмены
   */
  private applyUndoOperation(operation: AnyOperation): void {
    switch (operation.type) {
      case 'insert_row':
        // Отмена вставки строки = удаление строки
        this.sparseMatrix!.deleteRow(operation.data.atRow);
        break;
      case 'delete_row':
        // Отмена удаления строки = восстановление данных
        this.sparseMatrix!.insertRow(operation.data.atRow);
        // Восстанавливаем данные ячеек
        for (const cell of operation.data.deletedCells) {
          this.sparseMatrix!.setCell(cell.row, cell.col, cell.value);
        }
        break;
      case 'insert_column':
        // Отмена вставки столбца = удаление столбца
        this.sparseMatrix!.deleteColumn(operation.data.atCol);
        break;
      case 'delete_column':
        // Отмена удаления столбца = восстановление данных
        this.sparseMatrix!.insertColumn(operation.data.atCol);
        // Восстанавливаем данные ячеек
        for (const cell of operation.data.deletedCells) {
          this.sparseMatrix!.setCell(cell.row, cell.col, cell.value);
        }
        break;
      case 'set_cell':
        // Отмена изменения ячейки = восстановление старого значения
        this.sparseMatrix!.setCell(operation.data.row, operation.data.col, operation.data.oldValue);
        break;
      case 'clear_cell':
        // Отмена очистки ячейки = восстановление значения
        this.sparseMatrix!.setCell(operation.data.row, operation.data.col, operation.data.oldValue);
        break;
    }

    // Очищаем кеш VirtualGrid после любой операции
    if (this.virtualGrid) {
      this.virtualGrid.clearCache();
    }
  }

  /**
   * Применение операции повтора
   */
  private applyRedoOperation(operation: AnyOperation): void {
    switch (operation.type) {
      case 'insert_row':
        // Повтор вставки строки
        this.sparseMatrix!.insertRow(operation.data.atRow);
        break;
      case 'delete_row':
        // Повтор удаления строки
        this.sparseMatrix!.deleteRow(operation.data.atRow);
        break;
      case 'insert_column':
        // Повтор вставки столбца
        this.sparseMatrix!.insertColumn(operation.data.atCol);
        break;
      case 'delete_column':
        // Повтор удаления столбца
        this.sparseMatrix!.deleteColumn(operation.data.atCol);
        break;
      case 'set_cell':
        // Повтор изменения ячейки
        this.sparseMatrix!.setCell(operation.data.row, operation.data.col, operation.data.newValue);
        break;
      case 'clear_cell':
        // Повтор очистки ячейки
        this.sparseMatrix!.removeCell(operation.data.row, operation.data.col);
        break;
    }

    // Очищаем кеш VirtualGrid после любой операции
    if (this.virtualGrid) {
      this.virtualGrid.clearCache();
    }
  }
}
