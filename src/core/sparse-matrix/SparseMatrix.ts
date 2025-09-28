/**
 * Разреженная матрица для эффективного хранения данных таблицы
 */

export class SparseMatrix {
  private blocks: Map<string, Map<string, any>> = new Map();
  private blockSize = 1000; // Размер блока
  private totalCells = 0;

  constructor(blockSize = 1000) {
    this.blockSize = blockSize;
    console.log(`📊 Разреженная матрица инициализирована с размером блока: ${blockSize}`);
  }

  /**
   * Установка значения ячейки
   */
  setCell(row: number, col: number, value: any): void {
    // Если значение пустое, удаляем ячейку
    if (value === null || value === undefined || value === '') {
      this.removeCell(row, col);
      return;
    }

    const blockKey = this.getBlockKey(row, col);
    const cellKey = this.getCellKey(row, col);

    // Создаем блок, если его нет
    if (!this.blocks.has(blockKey)) {
      this.blocks.set(blockKey, new Map());
    }

    const block = this.blocks.get(blockKey)!;
    const hadValue = block.has(cellKey);
    
    block.set(cellKey, value);
    
    // Увеличиваем счетчик только для новых ячеек
    if (!hadValue) {
      this.totalCells++;
    }
  }

  /**
   * Получение значения ячейки
   */
  getCell(row: number, col: number): any {
    const blockKey = this.getBlockKey(row, col);
    const cellKey = this.getCellKey(row, col);

    const block = this.blocks.get(blockKey);
    if (!block) {
      return null;
    }

    return block.get(cellKey) || null;
  }

  /**
   * Удаление ячейки
   */
  removeCell(row: number, col: number): void {
    const blockKey = this.getBlockKey(row, col);
    const cellKey = this.getCellKey(row, col);

    const block = this.blocks.get(blockKey);
    if (block && block.has(cellKey)) {
      block.delete(cellKey);
      this.totalCells--;

      // Удаляем пустой блок
      if (block.size === 0) {
        this.blocks.delete(blockKey);
      }
    }
  }

  /**
   * Проверка существования ячейки
   */
  hasCell(row: number, col: number): boolean {
    const blockKey = this.getBlockKey(row, col);
    const cellKey = this.getCellKey(row, col);

    const block = this.blocks.get(blockKey);
    return block ? block.has(cellKey) : false;
  }

  /**
   * Получение всех ячеек в диапазоне
   */
  getCellsInRange(startRow: number, startCol: number, endRow: number, endCol: number): Array<{row: number, col: number, value: any}> {
    const cells: Array<{row: number, col: number, value: any}> = [];

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const value = this.getCell(row, col);
        if (value !== null) {
          cells.push({ row, col, value });
        }
      }
    }

    return cells;
  }

  /**
   * Получение всех заполненных ячеек
   */
  getAllCells(): Array<{row: number, col: number, value: any}> {
    const cells: Array<{row: number, col: number, value: any}> = [];

    for (const [, block] of this.blocks) {
      for (const [cellKey, value] of block) {
        const { row, col } = this.parseCellKey(cellKey);
        cells.push({ row, col, value });
      }
    }

    return cells;
  }

  /**
   * Очистка всех данных
   */
  clear(): void {
    this.blocks.clear();
    this.totalCells = 0;
    console.log('🧹 Разреженная матрица очищена');
  }

  /**
   * Получение статистики использования памяти
   */
  getMemoryUsage(): number {
    let totalCells = 0;
    let totalBlocks = this.blocks.size;

    for (const block of this.blocks.values()) {
      totalCells += block.size;
    }

    // Примерная оценка в байтах
    // Каждая ячейка: 8 байт (указатель) + размер значения
    // Каждый блок: 8 байт (указатель) + размер Map
    const cellMemory = totalCells * 16; // Примерно 16 байт на ячейку
    const blockMemory = totalBlocks * 32; // Примерно 32 байта на блок

    return cellMemory + blockMemory;
  }

  /**
   * Получение статистики
   */
  getStats(): {
    totalCells: number;
    totalBlocks: number;
    memoryUsage: number;
    blockSize: number;
    fillRatio: number;
  } {
    const memoryUsage = this.getMemoryUsage();
    const totalBlocks = this.blocks.size;
    
    // Примерная оценка заполненности (если бы все ячейки были заполнены)
    const maxPossibleCells = 1000000 * 1000000; // 1M x 1M
    const fillRatio = this.totalCells / maxPossibleCells;

    return {
      totalCells: this.totalCells,
      totalBlocks,
      memoryUsage,
      blockSize: this.blockSize,
      fillRatio
    };
  }

  /**
   * Оптимизация памяти
   */
  optimize(): void {
    console.log('🔧 Оптимизация разреженной матрицы...');
    
    const statsBefore = this.getStats();
    
    // Удаляем пустые блоки
    for (const [blockKey, block] of this.blocks) {
      if (block.size === 0) {
        this.blocks.delete(blockKey);
      }
    }
    
    const statsAfter = this.getStats();
    
    console.log('✅ Оптимизация завершена:', {
      blocksBefore: statsBefore.totalBlocks,
      blocksAfter: statsAfter.totalBlocks,
      memoryBefore: `${(statsBefore.memoryUsage / 1024).toFixed(2)} KB`,
      memoryAfter: `${(statsAfter.memoryUsage / 1024).toFixed(2)} KB`
    });
  }

  /**
   * Получение ключа блока
   */
  private getBlockKey(row: number, col: number): string {
    const blockRow = Math.floor(row / this.blockSize);
    const blockCol = Math.floor(col / this.blockSize);
    return `${blockRow}_${blockCol}`;
  }

  /**
   * Получение ключа ячейки
   */
  private getCellKey(row: number, col: number): string {
    const localRow = row % this.blockSize;
    const localCol = col % this.blockSize;
    return `${localRow}_${localCol}`;
  }

  /**
   * Парсинг ключа ячейки
   */
  private parseCellKey(cellKey: string): { row: number, col: number } {
    const parts = cellKey.split('_');
    const localRow = Number(parts[0]) || 0;
    const localCol = Number(parts[1]) || 0;
    return { row: localRow, col: localCol };
  }

  /**
   * Экспорт данных в JSON
   */
  exportToJSON(): string {
    const data = {
      blockSize: this.blockSize,
      totalCells: this.totalCells,
      blocks: Object.fromEntries(
        Array.from(this.blocks.entries()).map(([blockKey, block]) => [
          blockKey,
          Object.fromEntries(block)
        ])
      )
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Импорт данных из JSON
   */
  importFromJSON(json: string): void {
    try {
      const data = JSON.parse(json);
      
      this.blockSize = data.blockSize || 1000;
      this.totalCells = data.totalCells || 0;
      
      this.blocks.clear();
      
      for (const [blockKey, blockData] of Object.entries(data.blocks)) {
        if (blockData && typeof blockData === 'object') {
          const block = new Map(Object.entries(blockData));
          this.blocks.set(blockKey, block);
        }
      }
      
      console.log('✅ Данные импортированы из JSON');
      
    } catch (error) {
      console.error('❌ Ошибка импорта JSON:', error);
      throw new Error('Неверный формат JSON');
    }
  }
}
