/**
 * TextRenderer - класс для рендеринга текста в ячейках с использованием Canvas 2D
 */

import type { Cell, Viewport } from '../types/index.js';

export class TextRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cellWidth: number;
  private cellHeight: number;

  constructor(canvas: HTMLCanvasElement, cellWidth: number = 80, cellHeight: number = 25) {
    this.canvas = canvas;
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;

    // Получаем 2D контекст
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Не удалось получить 2D контекст для текста');
    }
    this.ctx = ctx;

    // Настройки текста
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';

    console.log('📝 TextRenderer инициализирован:', {
      canvasSize: `${canvas.width}x${canvas.height}`,
      cellSize: `${cellWidth}x${cellHeight}`,
    });
  }

  /**
   * Рендеринг текста для всех видимых ячеек
   */
  render(cells: Cell[], viewport: Viewport): void {
    // Очищаем canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const startCol = viewport.startCol || 0;
    const startRow = viewport.startRow || 0;

    console.log('📝 Рендеринг текста для ячеек:', {
      cellsCount: cells.length,
      viewport: `${startCol}-${viewport.endCol}, ${startRow}-${viewport.endRow}`,
    });

    // Рендерим текст для каждой ячейки с данными
    cells.forEach(cell => {
      if (cell.value && String(cell.value).trim()) {
        this.renderCellText(cell, startCol, startRow);
      }
    });
  }

  /**
   * Рендеринг текста в одной ячейке
   */
  private renderCellText(cell: Cell, startCol: number, startRow: number): void {
    // Вычисляем позицию ячейки с учетом смещений (как в сетке)
    const x = 30 + (cell.col - startCol) * this.cellWidth; // +30px слева как в сетке
    const y = 25 + (cell.row - startRow) * this.cellHeight; // +25px сверху как в сетке

    // Позиция текста внутри ячейки
    const textX = x + 4; // 4px отступ от левого края
    const textY = y + this.cellHeight / 2; // по центру по высоте

    // Настройки цвета и стиля
    this.ctx.fillStyle = '#333'; // Темно-серый текст
    this.ctx.font = '12px Arial';

    // Обрезаем текст если он слишком длинный
    const maxWidth = this.cellWidth - 8; // -8px для отступов
    const text = String(cell.value);
    const truncatedText = this.truncateText(text, maxWidth);

    // Рендерим текст
    this.ctx.fillText(truncatedText, textX, textY);

    console.log(
      `📝 Отрендерен текст "${truncatedText}" в ячейке ${cell.row},${cell.col} на позиции ${textX},${textY}`
    );
  }

  /**
   * Обрезка текста если он не помещается в ячейку
   */
  private truncateText(text: string, maxWidth: number): string {
    const metrics = this.ctx.measureText(text);
    if (metrics.width <= maxWidth) {
      return text;
    }

    // Обрезаем текст и добавляем "..."
    let truncated = text;
    while (truncated.length > 0) {
      truncated = truncated.slice(0, -1);
      const testText = truncated + '...';
      const testMetrics = this.ctx.measureText(testText);
      if (testMetrics.width <= maxWidth) {
        return testText;
      }
    }

    return '...';
  }

  /**
   * Обновление размеров canvas
   */
  updateCanvasSize(width: number, height: number): void {
    console.log(`📝 TextRenderer: обновление размера canvas ${width}x${height}`);
  }

  /**
   * Получение размеров области для текста
   */
  getTextAreaSize(): { width: number; height: number } {
    return {
      width: this.cellWidth - 8, // -8px для отступов
      height: this.cellHeight,
    };
  }
}
