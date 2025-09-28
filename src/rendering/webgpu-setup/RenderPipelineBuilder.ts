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
   * Создание вершинного шейдера
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
      fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
        var output: VertexOutput;
        
        // Создаем квад из 6 вершин (2 треугольника)
        let positions = array<vec2f, 6>(
          vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
          vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0)
        );
        
        let pos = positions[vertexIndex];
        
        // Вычисляем позицию ячейки
        let cellX = f32(vertexIndex / 6);
        let cellY = 0.0; // Будет вычисляться в compute shader
        
        // Преобразуем в экранные координаты
        let worldPos = vec2f(
          cellX * gridUniforms.cellSize.x + gridUniforms.viewportOffset.x,
          cellY * gridUniforms.cellSize.y + gridUniforms.viewportOffset.y
        );
        
        output.position = vec4f(worldPos, 0.0, 1.0);
        output.color = vec4f(0.95, 0.95, 0.95, 1.0); // Светло-серый фон
        output.cellCoord = pos;
        output.cellIndex = vec2f(cellX, cellY);
        
        return output;
      }
    `;
  }

  /**
   * Создание фрагментного шейдера
   */
  private createFragmentShader(): string {
    return `
      @fragment
      fn fs_main(
        @location(0) color: vec4f,
        @location(1) cellCoord: vec2f,
        @location(2) cellIndex: vec2f
      ) -> @location(0) vec4f {
        
        // Рисуем границы ячеек
        let borderWidth = 0.02;
        if (cellCoord.x < borderWidth || 
            cellCoord.x > 1.0 - borderWidth ||
            cellCoord.y < borderWidth || 
            cellCoord.y > 1.0 - borderWidth) {
          return vec4f(0.7, 0.7, 0.7, 1.0); // Темно-серые границы
        }
        
        // Основной цвет ячейки
        return color;
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
    const data = new Float32Array([
      ...gridSize, // gridSize: vec2f
      ...cellSize, // cellSize: vec2f
      ...viewportOffset, // viewportOffset: vec2f
      ...viewportSize, // viewportSize: vec2f
      ...totalCells, // totalCells: vec2f
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
}
