/**
 * Главный файл приложения WebGPU Excel
 */

import { App } from './App.js';
import type { AppConfig } from './types/index.js';

// Конфигурация приложения
const config: AppConfig = {
  maxRows: 1000000,
  maxCols: 1000000,
  cellWidth: 80, // Как в Excel - стандартный размер
  cellHeight: 25, // Как в Excel - стандартный размер
  enableWebGPU: true,
  enableCollaborative: false,
};

// Инициализация приложения
async function initializeApp(): Promise<void> {
  try {
    console.log('🚀 Инициализация WebGPU Excel...');

    // Показываем индикатор загрузки
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.style.display = 'block';
    }

    // Создаем экземпляр приложения
    const app = new App(config);

    // Инициализируем приложение
    await app.initialize();

    // Скрываем индикатор загрузки
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }

    console.log('✅ WebGPU Excel успешно инициализирован');
  } catch (error) {
    console.error('❌ Ошибка инициализации:', error);

    // Скрываем индикатор загрузки
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }

    // Показываем ошибку
    const errorElement = document.getElementById('error');
    const errorMessage = document.getElementById('error-message');

    if (errorElement && errorMessage) {
      errorMessage.textContent = error instanceof Error ? error.message : 'Неизвестная ошибка';
      errorElement.style.display = 'block';

      // Добавляем класс для WebGPU ошибок
      if (error instanceof Error && error.message.includes('WebGPU')) {
        errorElement.classList.add('webgpu-not-supported');
      }
    }
  }
}

// Запускаем приложение после загрузки DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// Обработка ошибок
window.addEventListener('error', event => {
  console.error('Глобальная ошибка:', event.error);
});

window.addEventListener('unhandledrejection', event => {
  console.error('Необработанное отклонение промиса:', event.reason);
});
