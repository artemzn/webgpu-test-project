/**
 * История операций для Undo/Redo системы
 */

export interface Operation {
  id: string;
  type: 'insert_row' | 'delete_row' | 'insert_column' | 'delete_column' | 'set_cell' | 'clear_cell';
  timestamp: number;
  data: any;
  description: string;
}

export interface InsertRowOperation extends Operation {
  type: 'insert_row';
  data: {
    atRow: number;
    affectedCells: Array<{ row: number; col: number; value: any }>;
  };
}

export interface DeleteRowOperation extends Operation {
  type: 'delete_row';
  data: {
    atRow: number;
    deletedCells: Array<{ row: number; col: number; value: any }>;
  };
}

export interface InsertColumnOperation extends Operation {
  type: 'insert_column';
  data: {
    atCol: number;
    affectedCells: Array<{ row: number; col: number; value: any }>;
  };
}

export interface DeleteColumnOperation extends Operation {
  type: 'delete_column';
  data: {
    atCol: number;
    deletedCells: Array<{ row: number; col: number; value: any }>;
  };
}

export interface SetCellOperation extends Operation {
  type: 'set_cell';
  data: {
    row: number;
    col: number;
    oldValue: any;
    newValue: any;
  };
}

export interface ClearCellOperation extends Operation {
  type: 'clear_cell';
  data: {
    row: number;
    col: number;
    oldValue: any;
  };
}

export type AnyOperation =
  | InsertRowOperation
  | DeleteRowOperation
  | InsertColumnOperation
  | DeleteColumnOperation
  | SetCellOperation
  | ClearCellOperation;

export class OperationHistory {
  private history: AnyOperation[] = [];
  private currentIndex: number = -1;
  private maxHistorySize: number = 100; // Максимум 100 операций

  constructor(maxHistorySize: number = 100) {
    this.maxHistorySize = maxHistorySize;
    console.log(`📚 OperationHistory инициализирован с максимальным размером: ${maxHistorySize}`);
  }

  /**
   * Добавление операции в историю
   */
  addOperation(operation: Omit<AnyOperation, 'id' | 'timestamp'>): void {
    const fullOperation = {
      ...operation,
      id: this.generateOperationId(),
      timestamp: Date.now(),
    } as AnyOperation;

    // Удаляем все операции после текущего индекса (если есть)
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // Добавляем новую операцию
    this.history.push(fullOperation);
    this.currentIndex = this.history.length - 1;

    // Ограничиваем размер истории
    this.limitHistorySize();

    console.log(`📝 Операция добавлена: ${fullOperation.type} - ${fullOperation.description}`);
  }

  /**
   * Отмена последней операции
   */
  undo(): AnyOperation | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.history.length) {
      console.log('⚠️ Нет операций для отмены');
      return null;
    }

    const operation = this.history[this.currentIndex];
    if (!operation) {
      console.log('⚠️ Операция не найдена');
      return null;
    }

    this.currentIndex--;

    console.log(`↶ Отмена операции: ${operation.type} - ${operation.description}`);
    return operation;
  }

  /**
   * Повтор отмененной операции
   */
  redo(): AnyOperation | null {
    if (this.currentIndex >= this.history.length - 1) {
      console.log('⚠️ Нет операций для повтора');
      return null;
    }

    this.currentIndex++;
    const operation = this.history[this.currentIndex];
    if (!operation) {
      console.log('⚠️ Операция не найдена');
      return null;
    }

    console.log(`↷ Повтор операции: ${operation.type} - ${operation.description}`);
    return operation;
  }

  /**
   * Проверка возможности отмены
   */
  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  /**
   * Проверка возможности повтора
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Получение текущего состояния истории
   */
  getState(): {
    canUndo: boolean;
    canRedo: boolean;
    currentIndex: number;
    totalOperations: number;
    lastOperation: AnyOperation | null;
  } {
    const lastOperation = this.currentIndex >= 0 ? this.history[this.currentIndex] || null : null;
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      currentIndex: this.currentIndex,
      totalOperations: this.history.length,
      lastOperation: lastOperation,
    };
  }

  /**
   * Очистка истории
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
    console.log('🗑️ История операций очищена');
  }

  /**
   * Получение статистики
   */
  getStats(): {
    totalOperations: number;
    currentIndex: number;
    memoryUsage: string;
    operationsByType: Record<string, number>;
  } {
    const operationsByType: Record<string, number> = {};

    for (const operation of this.history) {
      operationsByType[operation.type] = (operationsByType[operation.type] || 0) + 1;
    }

    // Примерная оценка использования памяти
    const memoryUsage = JSON.stringify(this.history).length;
    const memoryUsageKB = (memoryUsage / 1024).toFixed(2);

    return {
      totalOperations: this.history.length,
      currentIndex: this.currentIndex,
      memoryUsage: `${memoryUsageKB} KB`,
      operationsByType,
    };
  }

  /**
   * Генерация уникального ID для операции
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Ограничение размера истории
   */
  private limitHistorySize(): void {
    if (this.history.length > this.maxHistorySize) {
      const removedCount = this.history.length - this.maxHistorySize;
      this.history = this.history.slice(removedCount);
      this.currentIndex = this.history.length - 1;

      console.log(`📚 История ограничена: удалено ${removedCount} старых операций`);
    }
  }

  /**
   * Экспорт истории в JSON
   */
  exportToJSON(): string {
    return JSON.stringify(
      {
        history: this.history,
        currentIndex: this.currentIndex,
        maxHistorySize: this.maxHistorySize,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
  }

  /**
   * Импорт истории из JSON
   */
  importFromJSON(json: string): void {
    try {
      const data = JSON.parse(json);

      if (data.history && Array.isArray(data.history)) {
        this.history = data.history;
        this.currentIndex = data.currentIndex || -1;
        this.maxHistorySize = data.maxHistorySize || 100;

        console.log(`📚 История импортирована: ${this.history.length} операций`);
      } else {
        throw new Error('Неверный формат данных истории');
      }
    } catch (error) {
      console.error('❌ Ошибка импорта истории:', error);
      throw new Error('Не удалось импортировать историю операций');
    }
  }
}
