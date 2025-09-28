/**
 * Виртуализированная сетка для отображения больших таблиц
 */

import type { Cell, Viewport, CellPosition } from '@/types';

export class VirtualGrid {
  private canvasWidth: number;
  private canvasHeight: number;
  private cellWidth: number;
  private cellHeight: number;
  private maxRows: number;
  private maxCols: number;
  private viewport: Viewport;
  private activeCell: CellPosition | null = null;
  private scrollX = 0;
  private scrollY = 0;

  // Кеш для оптимизации
  private cachedCells: Cell[] | null = null;
  private cachedViewport: Viewport | null = null;

  constructor(
    canvasWidth: number,
    canvasHeight: number,
    cellWidth: number,
    cellHeight: number,
    maxRows: number,
    maxCols: number
  ) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    this.maxRows = maxRows;
    this.maxCols = maxCols;

    // Инициализируем viewport
    this.viewport = {
      startRow: 0,
      endRow: Math.ceil(canvasHeight / cellHeight),
      startCol: 0,
      endCol: Math.ceil(canvasWidth / cellWidth),
    };

    console.log('📊 Виртуальная сетка инициализирована:', {
      canvasSize: `${canvasWidth}x${canvasHeight}`,
      cellSize: `${cellWidth}x${cellHeight}`,
      maxSize: `${maxRows}x${maxCols}`,
      viewport: this.viewport,
    });
  }

  /**
   * Получение видимых ячеек
   */
  getVisibleCells(): Cell[] {
    // Проверяем кеш
    if (
      this.cachedCells &&
      this.cachedViewport &&
      this.viewportsEqual(this.cachedViewport, this.viewport)
    ) {
      return this.cachedCells;
    }

    const cells: Cell[] = [];

    for (let row = this.viewport.startRow; row < this.viewport.endRow; row++) {
      for (let col = this.viewport.startCol; col < this.viewport.endCol; col++) {
        const cell: Cell = {
          row,
          col,
          value: null,
          screenX: (col - this.viewport.startCol) * this.cellWidth - this.scrollX,
          screenY: (row - this.viewport.startRow) * this.cellHeight - this.scrollY,
          width: this.cellWidth,
          height: this.cellHeight,
        };

        cells.push(cell);
      }
    }

    // Сохраняем в кеш
    this.cachedCells = cells;
    this.cachedViewport = { ...this.viewport };

    return cells;
  }

  /**
   * Сравнение viewport для кеширования
   */
  private viewportsEqual(v1: Viewport, v2: Viewport): boolean {
    return (
      v1.startRow === v2.startRow &&
      v1.startCol === v2.startCol &&
      v1.endRow === v2.endRow &&
      v1.endCol === v2.endCol
    );
  }

  /**
   * Установка viewport напрямую
   */
  setViewport(startRow: number, startCol: number, endRow: number, endCol: number): void {
    this.viewport.startRow = Math.max(0, Math.min(startRow, this.maxRows - 1));
    this.viewport.startCol = Math.max(0, Math.min(startCol, this.maxCols - 1));
    this.viewport.endRow = Math.max(this.viewport.startRow + 1, Math.min(endRow, this.maxRows));
    this.viewport.endCol = Math.max(this.viewport.startCol + 1, Math.min(endCol, this.maxCols));

    // Инвалидируем кеш при изменении viewport
    this.cachedCells = null;
    this.cachedViewport = null;
  }

  /**
   * Прокрутка к указанной ячейке
   */
  scrollTo(row: number, col: number): void {
    // Ограничиваем координаты
    row = Math.max(0, Math.min(row, this.maxRows - 1));
    col = Math.max(0, Math.min(col, this.maxCols - 1));

    // Обновляем viewport
    this.viewport.startRow = Math.max(0, row - Math.floor(this.getVisibleRows() / 2));
    this.viewport.startCol = Math.max(0, col - Math.floor(this.getVisibleCols() / 2));

    this.updateViewportBounds();

    console.log(`📊 Прокрутка к ячейке ${row},${col}`);
  }

  /**
   * Прокрутка вверх
   */
  scrollUp(): void {
    if (this.viewport.startRow > 0) {
      this.viewport.startRow = Math.max(0, this.viewport.startRow - 1);
      this.updateViewportBounds();
    }
  }

  /**
   * Прокрутка вниз
   */
  scrollDown(): void {
    if (this.viewport.endRow < this.maxRows) {
      this.viewport.startRow = Math.min(
        this.maxRows - this.getVisibleRows(),
        this.viewport.startRow + 1
      );
      this.updateViewportBounds();
    }
  }

  /**
   * Прокрутка влево
   */
  scrollLeft(): void {
    if (this.viewport.startCol > 0) {
      this.viewport.startCol = Math.max(0, this.viewport.startCol - 1);
      this.updateViewportBounds();
    }
  }

  /**
   * Прокрутка вправо
   */
  scrollRight(): void {
    if (this.viewport.endCol < this.maxCols) {
      this.viewport.startCol = Math.min(
        this.maxCols - this.getVisibleCols(),
        this.viewport.startCol + 1
      );
      this.updateViewportBounds();
    }
  }

  /**
   * Получение ячейки по позиции на экране
   */
  getCellAtPosition(x: number, y: number): CellPosition | null {
    const col = Math.floor(x / this.cellWidth) + this.viewport.startCol;
    const row = Math.floor(y / this.cellHeight) + this.viewport.startRow;

    if (row >= 0 && row < this.maxRows && col >= 0 && col < this.maxCols) {
      return { row, col };
    }

    return null;
  }

  /**
   * Установка активной ячейки
   */
  setActiveCell(position: CellPosition): void {
    this.activeCell = position;

    // Прокручиваем к активной ячейке, если она не видна
    if (!this.isCellVisible(position)) {
      this.scrollTo(position.row, position.col);
    }
  }

  /**
   * Получение активной ячейки
   */
  getActiveCell(): CellPosition | null {
    return this.activeCell;
  }

  /**
   * Проверка видимости ячейки
   */
  isCellVisible(position: CellPosition): boolean {
    return (
      position.row >= this.viewport.startRow &&
      position.row < this.viewport.endRow &&
      position.col >= this.viewport.startCol &&
      position.col < this.viewport.endCol
    );
  }

  /**
   * Получение текущего viewport
   */
  getViewport(): Viewport {
    return { ...this.viewport };
  }

  /**
   * Обновление размеров canvas
   */
  updateCanvasSize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.updateViewportBounds();
  }

  /**
   * Получение количества видимых строк
   */
  private getVisibleRows(): number {
    return Math.ceil(this.canvasHeight / this.cellHeight);
  }

  /**
   * Получение количества видимых столбцов
   */
  private getVisibleCols(): number {
    return Math.ceil(this.canvasWidth / this.cellWidth);
  }

  /**
   * Обновление границ viewport
   */
  private updateViewportBounds(): void {
    const visibleRows = this.getVisibleRows();
    const visibleCols = this.getVisibleCols();

    this.viewport.endRow = Math.min(this.maxRows, this.viewport.startRow + visibleRows);
    this.viewport.endCol = Math.min(this.maxCols, this.viewport.startCol + visibleCols);

    // Инвалидируем кеш при изменении viewport
    this.cachedCells = null;
    this.cachedViewport = null;
  }

  /**
   * Получение максимального количества строк
   */
  getMaxRows(): number {
    return this.maxRows;
  }

  /**
   * Получение максимального количества столбцов
   */
  getMaxCols(): number {
    return this.maxCols;
  }

  /**
   * Получение размера ячейки
   */
  getCellSize(): { width: number; height: number } {
    return {
      width: this.cellWidth,
      height: this.cellHeight,
    };
  }

  /**
   * Установка размера ячейки
   */
  setCellSize(width: number, height: number): void {
    this.cellWidth = width;
    this.cellHeight = height;
    this.updateViewportBounds();
  }

  /**
   * Получение статистики
   */
  getStats(): {
    totalCells: number;
    visibleCells: number;
    viewport: Viewport;
    scrollPosition: { x: number; y: number };
  } {
    return {
      totalCells: this.maxRows * this.maxCols,
      visibleCells:
        (this.viewport.endRow - this.viewport.startRow) *
        (this.viewport.endCol - this.viewport.startCol),
      viewport: { ...this.viewport },
      scrollPosition: { x: this.scrollX, y: this.scrollY },
    };
  }
}
