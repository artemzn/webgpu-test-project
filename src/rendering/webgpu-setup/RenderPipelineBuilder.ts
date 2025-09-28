/**
 * Строитель рендер-пайплайнов для WebGPU
 */

export class RenderPipelineBuilder {
  private device: GPUDevice;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Создание пайплайна для отрисовки сетки ячеек
   */
  createGridPipeline(): GPURenderPipeline {
    console.log('🔧 Создание пайплайна для сетки...');

    const vertexShader = this.createVertexShader();
    const fragmentShader = this.createFragmentShader();

    const shaderModule = this.device.createShaderModule({
      code: `${vertexShader}\n\n${fragmentShader}`,
      label: 'Grid Pipeline Shader',
    });

    const pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format: 'bgra8unorm',
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
      },
      label: 'Grid Render Pipeline',
    });

    console.log('✅ Пайплайн для сетки создан');
    return pipeline;
  }

  /**
   * Создание вершинного шейдера с поддержкой instancing
   */
  private createVertexShader(): string {
    return `
      struct VertexOutput {
        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
        @location(1) cellCoord: vec2f,
        @location(2) cellIndex: vec2f
      };

      struct GridUniforms {
        gridSize: vec2f,
        cellSize: vec2f,
        viewportOffset: vec2f,
        viewportSize: vec2f,
        totalCells: vec2f
      }

      @group(0) @binding(0) var<uniform> gridUniforms: GridUniforms;

      @vertex
      fn vs_main(
        @builtin(vertex_index) vertexIndex: u32,
        @builtin(instance_index) instanceIndex: u32
      ) -> VertexOutput {
        var output: VertexOutput;
        
        // Создаем квад из 6 вершин (2 треугольника)
        let positions = array<vec2f, 6>(
          vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
          vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0)
        );
        
        let pos = positions[vertexIndex];
        
        // Вычисляем позицию ячейки на основе instance_index
        let cellsPerRow = u32(gridUniforms.totalCells.x);
        let cellX = instanceIndex % cellsPerRow;
        let cellY = instanceIndex / cellsPerRow;
        
        // Преобразуем в экранные координаты (пиксели)
        let worldPos = vec2f(
          f32(cellX) * gridUniforms.cellSize.x + gridUniforms.viewportOffset.x,
          f32(cellY) * gridUniforms.cellSize.y + gridUniforms.viewportOffset.y
        );

        // Масштабируем позицию вершины относительно ячейки и нормализуем в NDC
        let scaledPos = pos * gridUniforms.cellSize;
        let finalPos = worldPos + scaledPos;

        let screenPos = vec2f(
          (finalPos.x / gridUniforms.viewportSize.x) * 2.0 - 1.0,
          (finalPos.y / gridUniforms.viewportSize.y) * 2.0 - 1.0
        );

        output.position = vec4f(screenPos, 0.0, 1.0);
        output.color = vec4f(0.95, 0.95, 0.95, 1.0); // Светло-серый фон
        output.cellCoord = pos;
        output.cellIndex = vec2f(f32(cellX), f32(cellY));
        
        return output;
      }
    `;
  }

  /**
   * Создание оптимизированного фрагментного шейдера
   */
  private createFragmentShader(): string {
    return `
      @fragment
      fn fs_main(
        @location(0) color: vec4f,
        @location(1) cellCoord: vec2f,
        @location(2) cellIndex: vec2f
      ) -> @location(0) vec4f {
        
        // Только фон ячейки без границ
        let gradient = 0.98 + (cellCoord.x + cellCoord.y) * 0.01;
        return vec4f(gradient, gradient, gradient, 1.0);
      }
    `;
  }

  /**
   * Создание uniform буфера для параметров сетки
   */
  createGridUniformBuffer(): GPUBuffer {
    const buffer = this.device.createBuffer({
      size: 64, // 16 floats * 4 bytes each
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: 'Grid Uniform Buffer',
    });

    console.log('✅ Uniform буфер для сетки создан');
    return buffer;
  }

  /**
   * Создание bind group для ресурсов сетки
   */
  createGridBindGroup(pipeline: GPURenderPipeline, uniformBuffer: GPUBuffer): GPUBindGroup {
    const bindGroup = this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: uniformBuffer,
          },
        },
      ],
      label: 'Grid Bind Group',
    });

    console.log('✅ Bind group для сетки создан');
    return bindGroup;
  }

  /**
   * Обновление uniform буфера
   */
  updateGridUniforms(
    uniformBuffer: GPUBuffer,
    gridSize: [number, number],
    cellSize: [number, number],
    viewportOffset: [number, number],
    viewportSize: [number, number],
    totalCells: [number, number]
  ): void {
    // Проверяем, что все параметры являются массивами
    const safeGridSize = Array.isArray(gridSize) ? gridSize : [0, 0];
    const safeCellSize = Array.isArray(cellSize) ? cellSize : [0, 0];
    const safeViewportOffset = Array.isArray(viewportOffset) ? viewportOffset : [0, 0];
    const safeViewportSize = Array.isArray(viewportSize) ? viewportSize : [0, 0];
    const safeTotalCells = Array.isArray(totalCells) ? totalCells : [0, 0];

    const data = new Float32Array([
      ...safeGridSize, // gridSize: vec2f
      ...safeCellSize, // cellSize: vec2f
      ...safeViewportOffset, // viewportOffset: vec2f
      ...safeViewportSize, // viewportSize: vec2f
      ...safeTotalCells, // totalCells: vec2f
      0.0,
      0.0, // padding
    ]);

    this.device.queue.writeBuffer(uniformBuffer, 0, data);
  }

  /**
   * Создание пайплайна для отрисовки текста (заглушка)
   */
  createTextPipeline(): GPURenderPipeline {
    console.log('🔧 Создание пайплайна для текста...');

    // Пока что возвращаем простой пайплайн
    // В будущем здесь будет полноценный текст-рендеринг
    return this.createGridPipeline();
  }

  /**
   * Создание пайплайна для отрисовки выделения ячеек
   */
  createSelectionPipeline(): GPURenderPipeline {
    console.log('🔧 Создание пайплайна для выделения...');

    const vertexShader = `
      struct VertexOutput {
        @builtin(position) position: vec4f,
        @location(0) color: vec4f
      };

      @vertex
      fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
        var output: VertexOutput;
        
        let positions = array<vec2f, 6>(
          vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
          vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0)
        );
        
        let pos = positions[vertexIndex];
        output.position = vec4f(pos * 2.0 - 1.0, 0.0, 1.0);
        output.color = vec4f(0.0, 0.5, 1.0, 0.3); // Синее выделение
        
        return output;
      }
    `;

    const fragmentShader = `
      @fragment
      fn fs_main(@location(0) color: vec4f) -> @location(0) vec4f {
        return color;
      }
    `;

    const shaderModule = this.device.createShaderModule({
      code: `${vertexShader}\n\n${fragmentShader}`,
      label: 'Selection Pipeline Shader',
    });

    const pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format: 'bgra8unorm',
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
      },
      label: 'Selection Render Pipeline',
    });

    console.log('✅ Пайплайн для выделения создан');
    return pipeline;
  }

  /**
   * Создание пайплайна для отрисовки границ ячеек
   */
  createBorderPipeline(): GPURenderPipeline {
    console.log('🔧 Создание пайплайна для границ...');

    const vertexShader = `
      struct VertexOutput {
        @builtin(position) position: vec4f,
        @location(0) cellCoord: vec2f,
        @location(1) cellIndex: vec2f
      };

      struct GridUniforms {
        gridSize: vec2f,
        cellSize: vec2f,
        viewportOffset: vec2f,
        viewportSize: vec2f,
        totalCells: vec2f
      }

      @group(0) @binding(0) var<uniform> gridUniforms: GridUniforms;

      @vertex
      fn vs_main(
        @location(0) position: vec2f,
        @builtin(instance_index) instanceIndex: u32
      ) -> VertexOutput {
        var output: VertexOutput;

        // Вычисляем позицию ячейки на основе instance_index
        let cellsPerRow = u32(gridUniforms.totalCells.x);
        let cellX = instanceIndex % cellsPerRow;
        let cellY = instanceIndex / cellsPerRow;

        // Преобразуем в экранные координаты (пиксели)
        let worldPos = vec2f(
          f32(cellX) * gridUniforms.cellSize.x + gridUniforms.viewportOffset.x,
          f32(cellY) * gridUniforms.cellSize.y + gridUniforms.viewportOffset.y
        );

        // Масштабируем позицию вершины относительно ячейки
        let scaledPos = position * gridUniforms.cellSize;
        let finalPos = worldPos + scaledPos;

        // Преобразуем в нормализованные координаты экрана (-1 до 1)
        let screenPos = vec2f(
          (finalPos.x / gridUniforms.viewportSize.x) * 2.0 - 1.0,
          (finalPos.y / gridUniforms.viewportSize.y) * 2.0 - 1.0
        );

        output.position = vec4f(screenPos, 0.0, 1.0);
        output.cellCoord = position;
        output.cellIndex = vec2f(f32(cellX), f32(cellY));

        return output;
      }
    `;

    const fragmentShader = `
      @fragment
      fn fs_main(
        @location(0) cellCoord: vec2f,
        @location(1) cellIndex: vec2f
      ) -> @location(0) vec4f {
        
        // Рисуем границы с толщиной 1px: правые/нижние всегда,
        // верх/лево только для первой строки/колонки
        let borderPx = 1.0;
        let normalizedBorderX = borderPx / gridUniforms.cellSize.x;
        let normalizedBorderY = borderPx / gridUniforms.cellSize.y;

        let isRightBorder = cellCoord.x > 1.0 - normalizedBorderX;
        let isBottomBorder = cellCoord.y > 1.0 - normalizedBorderY;
        let isTopBorder = (cellIndex.y == 0.0) && (cellCoord.y < normalizedBorderY);
        let isLeftBorder = (cellIndex.x == 0.0) && (cellCoord.x < normalizedBorderX);

        if (isRightBorder || isBottomBorder || isTopBorder || isLeftBorder) {
          return vec4f(0.0, 0.0, 0.0, 1.0);
        }

        // Прозрачный фон для границ
        return vec4f(0.0, 0.0, 0.0, 0.0);
      }
    `;

    const shaderModule = this.device.createShaderModule({
      code: vertexShader + fragmentShader,
      label: 'Border Shader Module',
    });

    const pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 8, // 2 floats * 4 bytes
            attributes: [
              {
                format: 'float32x2',
                offset: 0,
                shaderLocation: 0,
              },
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format: 'bgra8unorm',
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
      },
      label: 'Border Render Pipeline',
    });

    console.log('✅ Пайплайн для границ создан');
    return pipeline;
  }
}
