/**
 * GridRenderer - класс для рендеринга сетки с использованием WebGPU
 */

import type { Cell, Viewport, WebGPUConfig } from '../types/index.js';
import { RenderManager } from './webgpu-setup/RenderManager.js';

export class GridRenderer {
  private renderManager: RenderManager;

  // Параметры рендеринга
  private cellWidth: number;
  private cellHeight: number;
  private gridColor: [number, number, number, number] = [0.9, 0.9, 0.9, 1.0];
  private borderColor: [number, number, number, number] = [0.7, 0.7, 0.7, 1.0];
  private backgroundColor: [number, number, number, number] = [1.0, 1.0, 1.0, 1.0];

  // Кеш для оптимизации
  private lastViewport: Viewport | null = null;
  private lastVisibleCells: Cell[] | null = null;
  private needsRedraw = true;

  constructor(
    config: WebGPUConfig,
    canvas: HTMLCanvasElement,
    cellWidth: number,
    cellHeight: number
  ) {
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;

    this.renderManager = new RenderManager(config, canvas);

    console.log('🎨 GridRenderer инициализирован:', {
      cellSize: `${cellWidth}x${cellHeight}`,
      canvasSize: `${canvas.width}x${canvas.height}`,
    });
  }

  /**
   * Инициализация рендерера
   */
  async initialize(): Promise<void> {
    try {
      console.log('🎨 Инициализация GridRenderer...');

      await this.renderManager.initialize();

      console.log('✅ GridRenderer готов к работе');
    } catch (error) {
      console.error('❌ Ошибка инициализации GridRenderer:', error);
      throw error;
    }
  }

  /**
   * Рендеринг сетки
   */
  async render(visibleCells: Cell[], viewport: Viewport): Promise<void> {
    try {
      // Проверяем, нужно ли перерисовывать
      if (!this.needsRedraw && this.viewportUnchanged(viewport)) {
        return;
      }

      // Обновляем кеш
      this.lastViewport = { ...viewport };
      this.lastVisibleCells = [...visibleCells];
      this.needsRedraw = false;

      // Рендерим через RenderManager
      await this.renderManager.render(visibleCells, viewport);
    } catch (error) {
      console.error('❌ Ошибка рендеринга сетки:', error);
      throw error;
    }
  }

  /**
   * Рендеринг выделения ячейки
   */
  async renderSelection(selectedCell: Cell | null): Promise<void> {
    if (!selectedCell) return;

    try {
      await this.renderManager.renderSelection(selectedCell);
    } catch (error) {
      console.error('❌ Ошибка рендеринга выделения:', error);
    }
  }

  /**
   * Установка размеров ячеек
   */
  setCellSize(width: number, height: number): void {
    this.cellWidth = width;
    this.cellHeight = height;
    this.needsRedraw = true;

    console.log(`🎨 Размер ячеек изменен: ${width}x${height}`);
  }

  /**
   * Установка цветов
   */
  setColors(
    gridColor?: [number, number, number, number],
    borderColor?: [number, number, number, number],
    backgroundColor?: [number, number, number, number]
  ): void {
    if (gridColor) {
      this.gridColor = gridColor;
    }
    if (borderColor) {
      this.borderColor = borderColor;
    }
    if (backgroundColor) {
      this.backgroundColor = backgroundColor;
    }

    this.needsRedraw = true;

    console.log('🎨 Цвета обновлены:', {
      grid: this.gridColor,
      border: this.borderColor,
      background: this.backgroundColor,
    });
  }

  /**
   * Принудительное обновление рендеринга
   */
  forceRedraw(): void {
    this.needsRedraw = true;
    this.lastViewport = null;
    this.lastVisibleCells = null;
  }

  /**
   * Получение статистики рендеринга
   */
  getRenderStats(): {
    lastViewport: Viewport | null;
    visibleCellsCount: number;
    needsRedraw: boolean;
    cellSize: { width: number; height: number };
  } {
    return {
      lastViewport: this.lastViewport,
      visibleCellsCount: this.lastVisibleCells?.length || 0,
      needsRedraw: this.needsRedraw,
      cellSize: { width: this.cellWidth, height: this.cellHeight },
    };
  }

  /**
   * Проверка изменения viewport
   */
  private viewportUnchanged(viewport: Viewport): boolean {
    if (!this.lastViewport) return false;

    return (
      this.lastViewport.startRow === viewport.startRow &&
      this.lastViewport.startCol === viewport.startCol &&
      this.lastViewport.endRow === viewport.endRow &&
      this.lastViewport.endCol === viewport.endCol
    );
  }

  /**
   * Очистка ресурсов
   */
  dispose(): void {
    console.log('🧹 Очистка GridRenderer...');

    this.renderManager.dispose();
    this.lastViewport = null;
    this.lastVisibleCells = null;

    console.log('✅ GridRenderer очищен');
  }
}
