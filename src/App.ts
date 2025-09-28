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
      this.gridRenderer.render(cells, viewport, selectedCellData);
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
                const [row, col] = key.split(',').map(Number);
                this.sparseMatrix!.setCell(row, col, value as string);
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

  private undo(): void {
    console.log('↶ Отмена операции');
  }

  private redo(): void {
    console.log('↷ Повтор операции');
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
    if (contextMenu) {
      contextMenu.style.display = 'block';
      contextMenu.style.left = `${event.clientX}px`;
      contextMenu.style.top = `${event.clientY}px`;
    }
  }

  /**
   * Скрыть контекстное меню
   */
  private hideContextMenu(): void {
    const contextMenu = document.getElementById('context-menu');
    if (contextMenu) {
      contextMenu.style.display = 'none';
    }
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
    console.log('➕ Вставка строки (заглушка)');
    // TODO: Реализовать в следующем спринте
  }

  /**
   * Вставка столбца
   */
  private insertColumn(): void {
    console.log('➕ Вставка столбца (заглушка)');
    // TODO: Реализовать в следующем спринте
  }

  /**
   * Удаление строки
   */
  private deleteRow(): void {
    console.log('🗑️ Удаление строки (заглушка)');
    // TODO: Реализовать в следующем спринте
  }

  /**
   * Удаление столбца
   */
  private deleteColumn(): void {
    console.log('🗑️ Удаление столбца (заглушка)');
    // TODO: Реализовать в следующем спринте
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
   * Рендеринг выделения ячейки
   */
  private async renderCellSelection(cell: { row: number; col: number }): Promise<void> {
    if (!this.gridRenderer) return;

    try {
      // Создаем объект ячейки для рендеринга с абсолютными координатами
      const viewport = this.virtualGrid!.getViewport();
      const selectedCell = {
        row: cell.row,
        col: cell.col,
        value: null,
        // Абсолютные экранные координаты БЕЗ вычитания viewport offset
        screenX: (cell.col - viewport.startCol) * this.config.cellWidth,
        screenY: (cell.row - viewport.startRow) * this.config.cellHeight,
        width: this.config.cellWidth,
        height: this.config.cellHeight,
      };

      await this.gridRenderer.renderSelection(selectedCell);
      console.log(`🎯 Выделена ячейка ${cell.row},${cell.col}`);
    } catch (error) {
      console.error('❌ Ошибка рендеринга выделения:', error);
    }
  }
}
