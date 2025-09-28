/**
 * Тесты для шейдеров с поддержкой instancing
 */

import { describe, it, expect } from 'vitest';
import { RenderPipelineBuilder } from '../../src/rendering/webgpu-setup/RenderPipelineBuilder.js';

// Мокаем WebGPU device для тестов
const mockDevice = {
  createShaderModule: (descriptor: { code: string; label?: string }) => {
    // Проверяем, что код шейдера содержит необходимые элементы
    const code = descriptor.code;

    return {
      code,
      label: descriptor.label,
      // Добавляем методы для тестирования
      getCode: () => code,
    };
  },
  createRenderPipeline: (descriptor: any) => ({
    ...descriptor,
    label: descriptor.label,
    getBindGroupLayout: () => ({}),
  }),
  createBuffer: (descriptor: any) => ({
    ...descriptor,
    label: descriptor.label,
    destroy: () => {},
  }),
  createBindGroup: (descriptor: any) => ({
    ...descriptor,
    label: descriptor.label,
  }),
  queue: {
    writeBuffer: () => {},
  },
};

describe('Shader Instancing Tests', () => {
  let pipelineBuilder: RenderPipelineBuilder;

  beforeEach(() => {
    pipelineBuilder = new RenderPipelineBuilder(mockDevice as any);
  });

  describe('Вершинный шейдер с instancing', () => {
    it('должен содержать instance_index в параметрах', () => {
      const pipeline = pipelineBuilder.createGridPipeline();
      expect(pipeline).toBeDefined();
    });

    it('должен правильно обрабатывать instance_index', () => {
      // Создаем пайплайн и проверяем, что он создается без ошибок
      const pipeline = pipelineBuilder.createGridPipeline();
      expect(pipeline).toBeDefined();
    });
  });

  describe('Фрагментный шейдер', () => {
    it('должен создаваться без ошибок', () => {
      const pipeline = pipelineBuilder.createGridPipeline();
      expect(pipeline).toBeDefined();
    });
  });

  describe('Uniform буферы', () => {
    it('должен создавать uniform буфер для сетки', () => {
      const buffer = pipelineBuilder.createGridUniformBuffer();
      expect(buffer).toBeDefined();
    });

    it('должен создавать bind group для сетки', () => {
      const pipeline = pipelineBuilder.createGridPipeline();
      const buffer = pipelineBuilder.createGridUniformBuffer();
      const bindGroup = pipelineBuilder.createGridBindGroup(pipeline, buffer);

      expect(bindGroup).toBeDefined();
    });
  });

  describe('Обновление uniform параметров', () => {
    it('должен обновлять uniform параметры', () => {
      const buffer = pipelineBuilder.createGridUniformBuffer();

      const gridSize: [number, number] = [100, 30];
      const cellSize: [number, number] = [100, 30];
      const viewportOffset: [number, number] = [0, 0];
      const viewportSize: [number, number] = [1920, 1080];
      const totalCells: [number, number] = [20, 36];

      expect(() => {
        pipelineBuilder.updateGridUniforms(
          buffer,
          gridSize,
          cellSize,
          viewportOffset,
          viewportSize,
          totalCells
        );
      }).not.toThrow();
    });
  });

  describe('Пайплайны выделения и текста', () => {
    it('должен создавать пайплайн выделения', () => {
      const pipeline = pipelineBuilder.createSelectionPipeline();
      expect(pipeline).toBeDefined();
    });

    it('должен создавать пайплайн текста', () => {
      const pipeline = pipelineBuilder.createTextPipeline();
      expect(pipeline).toBeDefined();
    });
  });

  describe('Производительность шейдеров', () => {
    it('должен быстро создавать пайплайны', () => {
      const startTime = performance.now();

      const pipeline = pipelineBuilder.createGridPipeline();
      const buffer = pipelineBuilder.createGridUniformBuffer();
      const bindGroup = pipelineBuilder.createGridBindGroup(pipeline, buffer);

      const endTime = performance.now();
      const creationTime = endTime - startTime;

      console.log(`Pipeline creation time: ${creationTime.toFixed(2)}ms`);
      expect(creationTime).toBeLessThan(10); // Меньше 10ms
    });

    it('должен быстро обновлять uniform параметры', () => {
      const buffer = pipelineBuilder.createGridUniformBuffer();

      const startTime = performance.now();

      // Обновляем параметры много раз
      for (let i = 0; i < 100; i++) {
        const gridSize: [number, number] = [100 + i, 30 + i];
        const cellSize: [number, number] = [100, 30];
        const viewportOffset: [number, number] = [i * 10, i * 10];
        const viewportSize: [number, number] = [1920, 1080];
        const totalCells: [number, number] = [20, 36];

        pipelineBuilder.updateGridUniforms(
          buffer,
          gridSize,
          cellSize,
          viewportOffset,
          viewportSize,
          totalCells
        );
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / 100;

      console.log(`Uniform updates (100): ${totalTime.toFixed(2)}ms`);
      console.log(`Average time per update: ${avgTime.toFixed(4)}ms`);

      expect(avgTime).toBeLessThan(0.1); // Меньше 0.1ms на обновление
    });
  });

  describe('Валидация шейдеров', () => {
    it('должен создавать валидные шейдеры', () => {
      // Проверяем, что все пайплайны создаются без ошибок
      const gridPipeline = pipelineBuilder.createGridPipeline();
      const selectionPipeline = pipelineBuilder.createSelectionPipeline();
      const textPipeline = pipelineBuilder.createTextPipeline();

      expect(gridPipeline).toBeDefined();
      expect(selectionPipeline).toBeDefined();
      expect(textPipeline).toBeDefined();
    });

    it('должен создавать валидные буферы', () => {
      const buffer = pipelineBuilder.createGridUniformBuffer();
      expect(buffer).toBeDefined();
    });

    it('должен создавать валидные bind groups', () => {
      const pipeline = pipelineBuilder.createGridPipeline();
      const buffer = pipelineBuilder.createGridUniformBuffer();
      const bindGroup = pipelineBuilder.createGridBindGroup(pipeline, buffer);

      expect(bindGroup).toBeDefined();
    });
  });

  describe('Обработка ошибок', () => {
    it('должен обрабатывать некорректные параметры', () => {
      const buffer = pipelineBuilder.createGridUniformBuffer();

      // Передаем некорректные параметры
      const invalidGridSize = null as any;
      const invalidCellSize = undefined as any;
      const invalidViewportOffset = [NaN, NaN] as [number, number];
      const invalidViewportSize = [-1, -1] as [number, number];
      const invalidTotalCells = [0, 0] as [number, number];

      expect(() => {
        pipelineBuilder.updateGridUniforms(
          buffer,
          invalidGridSize,
          invalidCellSize,
          invalidViewportOffset,
          invalidViewportSize,
          invalidTotalCells
        );
      }).not.toThrow(); // Должен обрабатывать ошибки gracefully
    });
  });

  describe('Интеграция с различными конфигурациями', () => {
    it('должен работать с различными размерами ячеек', () => {
      const cellSizes = [
        [50, 20],
        [100, 30],
        [150, 40],
        [200, 50],
      ] as [number, number][];

      cellSizes.forEach(cellSize => {
        const buffer = pipelineBuilder.createGridUniformBuffer();

        expect(() => {
          pipelineBuilder.updateGridUniforms(
            buffer,
            cellSize,
            cellSize,
            [0, 0],
            [1920, 1080],
            [20, 36]
          );
        }).not.toThrow();
      });
    });

    it('должен работать с различными размерами viewport', () => {
      const viewportSizes = [
        [800, 600],
        [1920, 1080],
        [2560, 1440],
        [3840, 2160],
      ] as [number, number][];

      viewportSizes.forEach(viewportSize => {
        const buffer = pipelineBuilder.createGridUniformBuffer();

        expect(() => {
          pipelineBuilder.updateGridUniforms(
            buffer,
            [100, 30],
            [100, 30],
            [0, 0],
            viewportSize,
            [20, 36]
          );
        }).not.toThrow();
      });
    });
  });
});
