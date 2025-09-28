/**
 * Менеджер WebGPU устройства
 */

import type { WebGPUConfig, InitializationResult } from '../../types/index.js';

export class WebGPUDeviceManager {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private adapter: GPUAdapter | null = null;
  private format: GPUTextureFormat | null = null;

  /**
   * Инициализация WebGPU
   */
  async initialize(canvas: HTMLCanvasElement): Promise<InitializationResult> {
    try {
      console.log('🔧 Проверка поддержки WebGPU...');

      // Проверяем поддержку WebGPU
      if (!this.isWebGPUSupported()) {
        return {
          success: false,
          error: 'WebGPU не поддерживается в этом браузере',
        };
      }

      // Получаем адаптер
      console.log('🔧 Получение GPU адаптера...');
      this.adapter = await this.requestGPUAdapter();
      if (!this.adapter) {
        return {
          success: false,
          error: 'Не удалось получить GPU адаптер',
        };
      }

      // Создаем устройство
      console.log('🔧 Создание GPU устройства...');
      this.device = await this.createDevice();
      if (!this.device) {
        return {
          success: false,
          error: 'Не удалось создать GPU устройство',
        };
      }

      // Получаем формат
      console.log('🔧 Получение формата canvas...');
      this.format = navigator.gpu.getPreferredCanvasFormat();

      // Настраиваем контекст canvas
      console.log('🔧 Настройка canvas контекста...');
      this.context = await this.setupCanvasContext(canvas);
      if (!this.context) {
        return {
          success: false,
          error: 'Не удалось настроить canvas контекст',
        };
      }

      const config: WebGPUConfig = {
        device: this.device,
        context: this.context,
        adapter: this.adapter,
        format: this.format,
      };

      console.log('✅ WebGPU успешно инициализирован');

      return {
        success: true,
        config,
      };
    } catch (error) {
      console.error('❌ Ошибка инициализации WebGPU:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      };
    }
  }

  /**
   * Проверка поддержки WebGPU
   */
  private isWebGPUSupported(): boolean {
    return 'gpu' in navigator;
  }

  /**
   * Получение GPU адаптера
   */
  private async requestGPUAdapter(): Promise<GPUAdapter | null> {
    try {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance',
      });

      if (!adapter) {
        throw new Error('Адаптер не найден');
      }

      console.log('✅ GPU адаптер получен:', adapter);
      return adapter;
    } catch (error) {
      console.error('❌ Ошибка получения адаптера:', error);
      return null;
    }
  }

  /**
   * Создание GPU устройства
   */
  private async createDevice(): Promise<GPUDevice | null> {
    try {
      if (!this.adapter) {
        throw new Error('Адаптер не инициализирован');
      }

      const device = await this.adapter.requestDevice({
        requiredFeatures: [],
        requiredLimits: {
          maxStorageBufferBindingSize: 134217728, // 128MB
          maxBufferSize: 268435456, // 256MB
        },
      });

      // Обработка ошибок устройства
      device.addEventListener('uncapturederror', (event: GPUUncapturedErrorEvent) => {
        console.error('WebGPU ошибка:', event.error);
      });

      console.log('✅ GPU устройство создано:', device);
      return device;
    } catch (error) {
      console.error('❌ Ошибка создания устройства:', error);
      return null;
    }
  }

  /**
   * Настройка контекста canvas
   */
  private async setupCanvasContext(canvas: HTMLCanvasElement): Promise<GPUCanvasContext | null> {
    try {
      const context = canvas.getContext('webgpu') as unknown as GPUCanvasContext;
      if (!context) {
        throw new Error('Не удалось получить WebGPU контекст');
      }

      if (!this.device || !this.format) {
        throw new Error('Устройство или формат не инициализированы');
      }

      context.configure({
        device: this.device,
        format: this.format,
        alphaMode: 'premultiplied',
      });

      console.log('✅ Canvas контекст настроен');
      return context;
    } catch (error) {
      console.error('❌ Ошибка настройки контекста:', error);
      return null;
    }
  }

  /**
   * Получение устройства
   */
  getDevice(): GPUDevice | null {
    return this.device;
  }

  /**
   * Получение контекста
   */
  getContext(): GPUCanvasContext | null {
    return this.context;
  }

  /**
   * Получение адаптера
   */
  getAdapter(): GPUAdapter | null {
    return this.adapter;
  }

  /**
   * Получение формата
   */
  getFormat(): GPUTextureFormat | null {
    return this.format;
  }

  /**
   * Освобождение ресурсов
   */
  dispose(): void {
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }

    this.context = null;
    this.adapter = null;
    this.format = null;

    console.log('🧹 WebGPU ресурсы освобождены');
  }
}
