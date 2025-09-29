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
  private borderPipeline: GPURenderPipeline | null = null;
  private selectionPipeline: GPURenderPipeline | null = null;
  private textPipeline: GPURenderPipeline | null = null;

  private gridUniformBuffer: GPUBuffer | null = null;
  private gridBindGroup: GPUBindGroup | null = null;
  private borderBindGroup: GPUBindGroup | null = null;
  private gridVertexBuffer: GPUBuffer | null = null;

  // Буферы для выделения
  private selectionUniformBuffer: GPUBuffer | null = null;
  private selectionBindGroup: GPUBindGroup | null = null;

  // Буферы для заголовков
  private headerUniformBuffer: GPUBuffer | null = null;

  private canvas: HTMLCanvasElement;
  private cellWidth: number;
  private cellHeight: number;

  constructor(
    config: WebGPUConfig,
    canvas: HTMLCanvasElement,
    cellWidth: number = 80,
    cellHeight: number = 25
  ) {
    this.device = config.device;
    this.context = config.context;
    this.canvas = canvas;
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;

    this.pipelineBuilder = new RenderPipelineBuilder(this.device, config.format);

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
      this.borderPipeline = this.pipelineBuilder.createBorderPipeline();
      this.selectionPipeline = this.pipelineBuilder.createSelectionPipeline();
      this.textPipeline = this.pipelineBuilder.createTextPipeline();

      // Создаем uniform буферы и bind groups
      this.gridUniformBuffer = this.pipelineBuilder.createGridUniformBuffer();
      this.gridBindGroup = this.pipelineBuilder.createGridBindGroup(
        this.gridPipeline,
        this.gridUniformBuffer
      );
      this.borderBindGroup = this.pipelineBuilder.createGridBindGroup(
        this.borderPipeline,
        this.gridUniformBuffer
      );

      // Создаем буферы для выделения
      this.selectionUniformBuffer = this.pipelineBuilder.createSelectionUniformBuffer();
      this.selectionBindGroup = this.pipelineBuilder.createSelectionBindGroup(
        this.selectionPipeline,
        this.selectionUniformBuffer
      );

      // Создаем буферы для заголовков
      this.headerUniformBuffer = this.pipelineBuilder.createHeaderUniformBuffer();

      // Создаем буфер вершин для квада (0,0) до (1,1)
      const vertices = new Float32Array([
        0.0,
        0.0, // top-left
        1.0,
        0.0, // top-right
        0.0,
        1.0, // bottom-left

        0.0,
        1.0, // bottom-left
        1.0,
        0.0, // top-right
        1.0,
        1.0, // bottom-right
      ]);
      this.gridVertexBuffer = this.device.createBuffer({
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });
      new Float32Array(this.gridVertexBuffer.getMappedRange()).set(vertices);
      this.gridVertexBuffer.unmap();
      console.log('✅ Буфер вершин для квада создан');

      console.log('✅ RenderManager инициализирован');
    } catch (error) {
      console.error('❌ Ошибка инициализации RenderManager:', error);
      throw error;
    }
  }

  /**
   * Рендеринг кадра
   */
  render(visibleCells: any[], viewport: any, selectedCell?: any): void {
    if (!this.gridPipeline || !this.gridBindGroup) {
      console.warn('⚠️ Пайплайны не инициализированы');
      return;
    }

    if (!visibleCells || !viewport) {
      throw new Error('Invalid parameters: visibleCells and viewport must be provided');
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

      // 1. Рендерим фон ячеек
      renderPass.setPipeline(this.gridPipeline);
      renderPass.setBindGroup(0, this.gridBindGroup);
      if (this.gridVertexBuffer) {
        renderPass.setVertexBuffer(0, this.gridVertexBuffer);
      }
      this.renderVisibleCells(renderPass, visibleCells);

      // 2. Рендерим границы ячеек поверх фона
      if (this.borderPipeline) {
        renderPass.setPipeline(this.borderPipeline);
        renderPass.setBindGroup(0, this.borderBindGroup);
      }
      if (this.gridVertexBuffer) {
        renderPass.setVertexBuffer(0, this.gridVertexBuffer);
      }
      this.renderVisibleCells(renderPass, visibleCells);

      // 3. Рендерим выделение если есть активная ячейка (В ТОМ ЖЕ RENDER PASS!)
      if (
        selectedCell &&
        this.selectionPipeline &&
        this.selectionBindGroup &&
        this.selectionUniformBuffer
      ) {
        // Обновляем uniform буфер для выделения
        const cellPosition: [number, number] = [selectedCell.screenX, selectedCell.screenY];
        const cellSize: [number, number] = [this.cellWidth, this.cellHeight];
        const viewportSize: [number, number] = [this.canvas.width, this.canvas.height];

        console.log(`🎯 ОТЛАДКА ВЫДЕЛЕНИЯ:`, {
          cellPosition,
          cellSize,
          viewportSize,
          selectedCell: {
            screenX: selectedCell.screenX,
            screenY: selectedCell.screenY,
            row: selectedCell.row,
            col: selectedCell.col,
          },
          'КООРДИНАТЫ В NDC': {
            x: (cellPosition[0] / viewportSize[0]) * 2.0 - 1.0,
            y: 1.0 - (cellPosition[1] / viewportSize[1]) * 2.0,
          },
          'РАЗМЕР В NDC': {
            width: (cellSize[0] / viewportSize[0]) * 2.0,
            height: (cellSize[1] / viewportSize[1]) * 2.0,
          },
        });

        this.pipelineBuilder.updateSelectionUniforms(
          this.selectionUniformBuffer,
          cellPosition,
          cellSize,
          viewportSize
        );

        renderPass.setPipeline(this.selectionPipeline);
        renderPass.setBindGroup(0, this.selectionBindGroup);
        renderPass.draw(6, 1, 0, 0); // Рендерим выделение (6 вершин для одного квада)

        console.log(`🎯 Выделение отрендерено в основном render pass для позиции ${cellPosition}`);
      }

      // 4. WebGPU заголовки отключены - используем Canvas 2D заголовки
      // console.log('🎯 НАЧИНАЕМ РЕНДЕРИНГ ЗАГОЛОВКОВ!');
      // this.renderHeaders(renderPass, viewport);
      // console.log('🎯 ЗАГОЛОВКИ ОТРЕНДЕРЕНЫ!');

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

    const gridSize: [number, number] = [this.cellWidth, this.cellHeight]; // Размер ячейки из конфига
    const cellSize: [number, number] = [this.cellWidth, this.cellHeight];
    const viewportOffset: [number, number] = [
      30, // +30px отступ СЛЕВА для номеров строк
      0, // СВЕРХУ пока ничего
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
   * Рендеринг видимых ячеек с поддержкой instancing
   */
  private renderVisibleCells(renderPass: GPURenderPassEncoder, visibleCells: any[]): void {
    const cellCount = visibleCells.length;

    if (cellCount === 0) {
      return;
    }

    // Используем instancing для эффективного рендеринга множества ячеек
    // Рендерим один квад (6 вершин) для каждой ячейки
    renderPass.draw(6, cellCount, 0, 0);
  }

  /**
   * Рендеринг выделения ячейки (для совместимости с тестами)
   * @deprecated Используйте render() с параметром selectedCell
   */
  renderSelection(selectedCell: any): void {
    if (!selectedCell) return;

    // Заглушка для совместимости с тестами
    console.log(`🎯 renderSelection (deprecated): ячейка ${selectedCell.row},${selectedCell.col}`);
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
    if (this.headerUniformBuffer) {
      this.headerUniformBuffer.destroy();
      this.headerUniformBuffer = null;
    }

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
