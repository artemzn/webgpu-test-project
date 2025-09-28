/**
 * Основной класс приложения WebGPU Excel
 */

import type { AppConfig, InitializationResult } from './types/index.js';
import { WebGPUDeviceManager } from './rendering/webgpu-setup/DeviceManager.js';
import { RenderManager } from './rendering/webgpu-setup/RenderManager.js';
import { GridRenderer } from './rendering/GridRenderer.js';
import { VirtualGrid } from './core/virtual-grid/VirtualGrid.js';
import { SparseMatrix } from './core/sparse-matrix/SparseMatrix.js';

export class App {
  private config: AppConfig;
  private canvas: HTMLCanvasElement;
  private webgpuManager: WebGPUDeviceManager | null = null;
  private renderManager: RenderManager | null = null;
  private gridRenderer: GridRenderer | null = null;
  private virtualGrid: VirtualGrid | null = null;
  private sparseMatrix: SparseMatrix | null = null;
  private isInitialized = false;

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
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const cell = this.virtualGrid.getCellAtPosition(x, y);
    if (cell) {
      this.virtualGrid.setActiveCell(cell);
      this.updateFormulaBar(cell);
      this.updateCellInfo(cell);
    }
  }

  /**
   * Обработка движения мыши по canvas
   */
  private handleCanvasMouseMove(_event: MouseEvent): void {
    // Подсветка ячеек при наведении будет реализована в следующих спринтах
    console.log('🖱️ Движение мыши по canvas');
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

    const render = (currentTime: number) => {
      this.updateFPS(currentTime);

      // Рендерим только если нужно
      if (this.needsRender) {
        this.render();
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
  private render(): void {
    if (!this.isInitialized || !this.virtualGrid) return;

    // Получаем видимые ячейки
    const visibleCells = this.virtualGrid.getVisibleCells();

    // Рендерим через WebGPU или Canvas 2D
    if (this.webgpuManager) {
      this.renderWithWebGPU(visibleCells);
    } else {
      this.renderWithCanvas2D(visibleCells);
    }
  }

  /**
   * Рендеринг через WebGPU с использованием GridRenderer
   */
  private renderWithWebGPU(cells: any[]): void {
    if (!this.gridRenderer || !this.virtualGrid) return;

    try {
      // Получаем viewport для рендеринга
      const viewport = this.virtualGrid.getViewport();

      // Рендерим через оптимизированный GridRenderer
      this.gridRenderer.render(cells, viewport);
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

    // Помечаем, что нужна перерисовка
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
   * Обновление информации о ячейке
   */
  private updateCellInfo(cell: any): void {
    const cellInfo = document.getElementById('cell-info');
    if (cellInfo) {
      const colName = this.getColumnName(cell.col);
      cellInfo.textContent = `${colName}${cell.row + 1}`;
    }
  }

  /**
   * Обновление статус-бара
   */
  private updateStatusBar(): void {
    const statusText = document.getElementById('status-text');
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

        console.log(`📐 Canvas размер обновлен: ${width}x${height}`);

        // Обновляем виртуальную сетку
        if (this.virtualGrid) {
          this.virtualGrid.updateCanvasSize(width, height);
        }

        // Помечаем, что нужна перерисовка
        this.needsRender = true;
      }
    });
  }

  // Методы для обработки действий (заглушки)
  private createNewSpreadsheet(): void {
    console.log('📄 Создание новой таблицы');
  }

  private openSpreadsheet(): void {
    console.log('📁 Открытие таблицы');
  }

  private saveSpreadsheet(): void {
    console.log('💾 Сохранение таблицы');
  }

  private undo(): void {
    console.log('↶ Отмена операции');
  }

  private redo(): void {
    console.log('↷ Повтор операции');
  }

  private copy(): void {
    console.log('📋 Копирование');
  }

  private paste(): void {
    console.log('📋 Вставка');
  }
}
