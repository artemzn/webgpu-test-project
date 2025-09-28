/**
 * Менеджер рендеринга WebGPU
 */

import type { WebGPUConfig } from '../../types/index.js';
import { RenderPipelineBuilder } from './RenderPipelineBuilder.js';

export class RenderManager {
  private device: GPUDevice;
  private context: GPUCanvasContext;

  private pipelineBuilder: RenderPipelineBuilder;
  private gridPipeline: GPURenderPipeline | null = null;
  private selectionPipeline: GPURenderPipeline | null = null;
  private textPipeline: GPURenderPipeline | null = null;

  private gridUniformBuffer: GPUBuffer | null = null;
  private gridBindGroup: GPUBindGroup | null = null;

  private canvas: HTMLCanvasElement;

  constructor(config: WebGPUConfig, canvas: HTMLCanvasElement) {
    this.device = config.device;
    this.context = config.context;
    this.canvas = canvas;

    this.pipelineBuilder = new RenderPipelineBuilder(this.device);

    console.log('🔧 Инициализация RenderManager...');
  }

  /**
   * Инициализация рендер-пайплайнов
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔧 Создание рендер-пайплайнов...');

      // Создаем пайплайны
      this.gridPipeline = this.pipelineBuilder.createGridPipeline();
      this.selectionPipeline = this.pipelineBuilder.createSelectionPipeline();
      this.textPipeline = this.pipelineBuilder.createTextPipeline();

      // Создаем uniform буферы и bind groups
      this.gridUniformBuffer = this.pipelineBuilder.createGridUniformBuffer();
      this.gridBindGroup = this.pipelineBuilder.createGridBindGroup(
        this.gridPipeline,
        this.gridUniformBuffer
      );

      console.log('✅ RenderManager инициализирован');
    } catch (error) {
      console.error('❌ Ошибка инициализации RenderManager:', error);
      throw error;
    }
  }

  /**
   * Рендеринг кадра
   */
  render(visibleCells: any[], viewport: any): void {
    if (!this.gridPipeline || !this.gridBindGroup) {
      console.warn('⚠️ Пайплайны не инициализированы');
      return;
    }

    try {
      // Начинаем рендер-пасс
      const commandEncoder = this.device.createCommandEncoder();
      const textureView = this.context.getCurrentTexture().createView();

      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: textureView,
            clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });

      // Обновляем uniform буфер
      this.updateGridUniforms(viewport);

      // Устанавливаем пайплайн и bind group
      renderPass.setPipeline(this.gridPipeline);
      renderPass.setBindGroup(0, this.gridBindGroup);

      // Рендерим видимые ячейки
      this.renderVisibleCells(renderPass, visibleCells);

      // Завершаем рендер-пасс
      renderPass.end();

      // Отправляем команды на GPU
      this.device.queue.submit([commandEncoder.finish()]);
    } catch (error) {
      console.error('❌ Ошибка рендеринга:', error);
    }
  }

  /**
   * Обновление uniform параметров сетки
   */
  private updateGridUniforms(viewport: any): void {
    if (!this.gridUniformBuffer) return;

    const gridSize: [number, number] = [100, 30]; // Размер ячейки
    const cellSize: [number, number] = [100, 30];
    const viewportOffset: [number, number] = [
      viewport.startCol * cellSize[0],
      viewport.startRow * cellSize[1],
    ];
    const viewportSize: [number, number] = [this.canvas.width, this.canvas.height];
    const totalCells: [number, number] = [
      viewport.endCol - viewport.startCol,
      viewport.endRow - viewport.startRow,
    ];

    this.pipelineBuilder.updateGridUniforms(
      this.gridUniformBuffer,
      gridSize,
      cellSize,
      viewportOffset,
      viewportSize,
      totalCells
    );
  }

  /**
   * Рендеринг видимых ячеек
   */
  private renderVisibleCells(renderPass: GPURenderPassEncoder, visibleCells: any[]): void {
    // Пока что рендерим простую сетку
    // В будущем здесь будет рендеринг конкретных ячеек

    const cellCount = visibleCells.length || 100; // Минимум 100 ячеек для демо

    // Рендерим по 6 вершин на ячейку (2 треугольника)
    renderPass.draw(cellCount * 6, 1, 0, 0);
  }

  /**
   * Рендеринг выделения ячейки
   */
  renderSelection(_selectedCell: any): void {
    if (!this.selectionPipeline) return;

    try {
      const commandEncoder = this.device.createCommandEncoder();
      const textureView = this.context.getCurrentTexture().createView();

      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: textureView,
            loadOp: 'load', // Не очищаем, рисуем поверх
            storeOp: 'store',
          },
        ],
      });

      renderPass.setPipeline(this.selectionPipeline);

      // Рендерим выделение (6 вершин для одного квада)
      renderPass.draw(6, 1, 0, 0);

      renderPass.end();
      this.device.queue.submit([commandEncoder.finish()]);
    } catch (error) {
      console.error('❌ Ошибка рендеринга выделения:', error);
    }
  }

  /**
   * Рендеринг текста в ячейке
   */
  renderCellText(cell: any, text: string): void {
    if (!this.textPipeline) return;

    // Пока что заглушка
    // В будущем здесь будет рендеринг текста через WebGPU
    console.log(`📝 Рендеринг текста "${text}" в ячейке ${cell.row},${cell.col}`);
  }

  /**
   * Очистка ресурсов
   */
  dispose(): void {
    if (this.gridUniformBuffer) {
      this.gridUniformBuffer.destroy();
      this.gridUniformBuffer = null;
    }

    this.gridPipeline = null;
    this.selectionPipeline = null;
    this.textPipeline = null;
    this.gridBindGroup = null;

    console.log('🧹 RenderManager ресурсы освобождены');
  }

  /**
   * Получение статистики рендеринга
   */
  getRenderStats(): {
    pipelinesCreated: number;
    uniformBuffersCreated: number;
    bindGroupsCreated: number;
  } {
    return {
      pipelinesCreated: [this.gridPipeline, this.selectionPipeline, this.textPipeline].filter(
        Boolean
      ).length,
      uniformBuffersCreated: this.gridUniformBuffer ? 1 : 0,
      bindGroupsCreated: this.gridBindGroup ? 1 : 0,
    };
  }
}
