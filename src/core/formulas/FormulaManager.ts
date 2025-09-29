/**
 * Менеджер формул - интеграция парсера, движка и обработки сдвигов
 */

import { FormulaParser } from './FormulaParser.js';
import { FormulaEngine, FormulaContext, CellValue } from './FormulaEngine.js';
import { FormulaAST, FormulaNode, FormulaUtils } from './FormulaAST.js';

export type { CellValue } from './FormulaEngine.js';

export interface FormulaInfo {
  ast: FormulaAST;
  dependencies: Set<string>; // Ссылки на ячейки в формате "row:col"
  dependents: Set<string>; // Ячейки, которые зависят от этой
}

export class FormulaManager {
  private parser: FormulaParser;
  private engine: FormulaEngine;
  private formulas: Map<string, FormulaInfo> = new Map(); // "row:col" -> FormulaInfo
  private updateFormulaCallback?: (row: number, col: number, formula: string) => void;

  constructor(context: FormulaContext) {
    this.parser = new FormulaParser();
    this.engine = new FormulaEngine(context);
    console.log('📊 FormulaManager инициализирован');
  }

  /**
   * Установка callback для обновления формулы в SparseMatrix
   */
  setUpdateFormulaCallback(callback: (row: number, col: number, formula: string) => void): void {
    this.updateFormulaCallback = callback;
  }

  /**
   * Установка формулы в ячейку
   */
  setFormula(row: number, col: number, formula: string): void {
    const cellKey = `${row}:${col}`;

    try {
      // Парсим формулу
      const ast = this.parser.parse(formula);

      // Находим зависимости
      const dependencies = this.extractDependencies(ast.root);

      // Удаляем старые зависимости
      this.removeDependencies(cellKey);

      // Сохраняем формулу
      this.formulas.set(cellKey, {
        ast,
        dependencies,
        dependents: new Set(),
      });

      // Добавляем новые зависимости
      this.addDependencies(cellKey, dependencies);

      console.log(`📝 Формула установлена в ячейку ${row},${col}: ${formula}`);
      console.log(`🔗 Зависимости: ${Array.from(dependencies).join(', ')}`);
    } catch (error) {
      console.error(`❌ Ошибка установки формулы: ${error}`);
      throw error;
    }
  }

  /**
   * Получение формулы из ячейки
   */
  getFormula(row: number, col: number): string | null {
    const cellKey = `${row}:${col}`;
    const formulaInfo = this.formulas.get(cellKey);
    return formulaInfo ? formulaInfo.ast.originalFormula : null;
  }

  /**
   * Удаление формулы из ячейки
   */
  removeFormula(row: number, col: number): void {
    const cellKey = `${row}:${col}`;
    this.removeDependencies(cellKey);
    this.formulas.delete(cellKey);
    console.log(`🗑️ Формула удалена из ячейки ${row},${col}`);
  }

  /**
   * Вычисление формулы в ячейке
   */
  evaluateFormula(row: number, col: number): CellValue {
    const cellKey = `${row}:${col}`;
    const formulaInfo = this.formulas.get(cellKey);

    if (!formulaInfo) {
      return { value: null, type: 'empty' };
    }

    try {
      return this.engine.evaluate(formulaInfo.ast);
    } catch (error) {
      console.error(`❌ Ошибка вычисления формулы в ${row},${col}: ${error}`);
      return { value: `#ERROR: ${error}`, type: 'error' };
    }
  }

  /**
   * Обработка сдвига при операциях со строками/столбцами
   */
  handleRowInsertion(atRow: number): void {
    console.log(`📊 Обработка вставки строки на позиции ${atRow}`);
    console.log(`📊 Текущие формулы:`, Array.from(this.formulas.keys()));

    const newFormulas = new Map<string, FormulaInfo>();

    for (const [cellKey, formulaInfo] of this.formulas) {
      const [rowStr, colStr] = cellKey.split(':');
      const row = parseInt(rowStr || '0', 10);
      const col = parseInt(colStr || '0', 10);

      let newRow = row;
      let newCol = col;

      // Сдвигаем ячейки ниже точки вставки
      if (row >= atRow) {
        newRow = row + 1;
      }

      console.log(`📊 Формула ${cellKey} -> ${newRow}:${newCol} (сдвиг строки)`);

      // Сдвигаем ссылки в формуле
      console.log(`📊 Сдвигаем формулу ${cellKey}: ${JSON.stringify(formulaInfo.ast.root)}`);
      const shiftedAST = this.shiftFormulaAST(
        formulaInfo.ast,
        0,
        0,
        atRow,
        undefined,
        undefined,
        undefined
      );
      console.log(`📊 Результат сдвига: ${JSON.stringify(shiftedAST.root)}`);

      const newCellKey = `${newRow}:${newCol}`;

      // Обновляем исходную строку формулы в SparseMatrix
      const newFormulaString = this.formatFormula(shiftedAST.root);
      console.log(`🔧 Обновляем формулу: ${cellKey} -> ${newCellKey}: ${newFormulaString}`);

      // Вызываем callback для обновления формулы в SparseMatrix
      if (this.updateFormulaCallback) {
        this.updateFormulaCallback(newRow, newCol, `=${newFormulaString}`);
      }

      newFormulas.set(newCellKey, {
        ast: shiftedAST,
        dependencies: this.extractDependencies(shiftedAST.root),
        dependents: new Set(),
      });
    }

    // Обновляем карту формул
    this.formulas = newFormulas;
    this.rebuildDependencies();

    console.log(`✅ Обработана вставка строки: ${this.formulas.size} формул обновлено`);

    // Принудительно пересчитываем все формулы
    this.recalculateAllFormulas();
  }

  /**
   * Обработка удаления строки
   */
  handleRowDeletion(atRow: number): void {
    console.log(`📊 Обработка удаления строки на позиции ${atRow}`);

    const newFormulas = new Map<string, FormulaInfo>();

    for (const [cellKey, formulaInfo] of this.formulas) {
      const [rowStr, colStr] = cellKey.split(':');
      const row = parseInt(rowStr || '0', 10);
      const col = parseInt(colStr || '0', 10);

      // Удаляем формулу из удаляемой строки
      if (row === atRow) {
        continue;
      }

      let newRow = row;
      let newCol = col;

      // Сдвигаем ячейки выше точки удаления
      if (row > atRow) {
        newRow = row - 1;
      }

      // Сдвигаем ссылки в формуле
      const shiftedAST = this.shiftFormulaAST(
        formulaInfo.ast,
        0,
        0,
        undefined,
        undefined,
        atRow,
        undefined
      );

      const newCellKey = `${newRow}:${newCol}`;

      // Обновляем исходную строку формулы в SparseMatrix
      const newFormulaString = this.formatFormula(shiftedAST.root);
      console.log(`🔧 Обновляем формулу: ${cellKey} -> ${newCellKey}: ${newFormulaString}`);

      // Вызываем callback для обновления формулы в SparseMatrix
      if (this.updateFormulaCallback) {
        this.updateFormulaCallback(newRow, newCol, `=${newFormulaString}`);
      }

      newFormulas.set(newCellKey, {
        ast: shiftedAST,
        dependencies: this.extractDependencies(shiftedAST.root),
        dependents: new Set(),
      });
    }

    // Обновляем карту формул
    this.formulas = newFormulas;
    this.rebuildDependencies();

    console.log(`✅ Обработано удаление строки: ${this.formulas.size} формул обновлено`);

    // Принудительно пересчитываем все формулы
    this.recalculateAllFormulas();
  }

  /**
   * Обработка вставки столбца
   */
  handleColumnInsertion(atCol: number): void {
    console.log(`📊 Обработка вставки столбца на позиции ${atCol}`);
    console.log(`📊 Текущие формулы:`, Array.from(this.formulas.keys()));

    const newFormulas = new Map<string, FormulaInfo>();

    for (const [cellKey, formulaInfo] of this.formulas) {
      console.log(`🔧 Обрабатываем формулу: ${cellKey}`);
      const [rowStr, colStr] = cellKey.split(':');
      const row = parseInt(rowStr || '0', 10);
      const col = parseInt(colStr || '0', 10);

      let newRow = row;
      let newCol = col;

      // Сдвигаем ячейки правее точки вставки
      if (col >= atCol) {
        newCol = col + 1;
        console.log(`🔧 Сдвигаем столбец: ${col} -> ${newCol}`);
      }

      // Сдвигаем ссылки в формуле
      console.log(`📊 Сдвигаем формулу ${cellKey}: ${JSON.stringify(formulaInfo.ast.root)}`);
      const shiftedAST = this.shiftFormulaAST(
        formulaInfo.ast,
        0,
        0,
        undefined,
        atCol,
        undefined,
        undefined
      );
      console.log(`📊 Результат сдвига: ${JSON.stringify(shiftedAST.root)}`);

      const newCellKey = `${newRow}:${newCol}`;

      // Обновляем исходную строку формулы в SparseMatrix
      const newFormulaString = this.formatFormula(shiftedAST.root);
      console.log(`🔧 Обновляем формулу: ${cellKey} -> ${newCellKey}: ${newFormulaString}`);

      // Вызываем callback для обновления формулы в SparseMatrix
      if (this.updateFormulaCallback) {
        this.updateFormulaCallback(newRow, newCol, `=${newFormulaString}`);
      }

      newFormulas.set(newCellKey, {
        ast: shiftedAST,
        dependencies: this.extractDependencies(shiftedAST.root),
        dependents: new Set(),
      });
    }

    // Обновляем карту формул
    this.formulas = newFormulas;
    this.rebuildDependencies();

    console.log(`✅ Обработана вставка столбца: ${this.formulas.size} формул обновлено`);

    // Принудительно пересчитываем все формулы
    this.recalculateAllFormulas();
  }

  /**
   * Обработка удаления столбца
   */
  handleColumnDeletion(atCol: number): void {
    console.log(`📊 Обработка удаления столбца на позиции ${atCol}`);

    const newFormulas = new Map<string, FormulaInfo>();

    for (const [cellKey, formulaInfo] of this.formulas) {
      const [rowStr, colStr] = cellKey.split(':');
      const row = parseInt(rowStr || '0', 10);
      const col = parseInt(colStr || '0', 10);

      // Удаляем формулу из удаляемого столбца
      if (col === atCol) {
        continue;
      }

      let newRow = row;
      let newCol = col;

      // Сдвигаем ячейки левее точки удаления
      if (col > atCol) {
        newCol = col - 1;
      }

      // Сдвигаем ссылки в формуле
      const shiftedAST = this.shiftFormulaAST(
        formulaInfo.ast,
        0,
        0,
        undefined,
        undefined,
        undefined,
        atCol
      );

      const newCellKey = `${newRow}:${newCol}`;

      // Обновляем исходную строку формулы в SparseMatrix
      const newFormulaString = this.formatFormula(shiftedAST.root);
      console.log(`🔧 Обновляем формулу: ${cellKey} -> ${newCellKey}: ${newFormulaString}`);

      // Вызываем callback для обновления формулы в SparseMatrix
      if (this.updateFormulaCallback) {
        this.updateFormulaCallback(newRow, newCol, `=${newFormulaString}`);
      }

      newFormulas.set(newCellKey, {
        ast: shiftedAST,
        dependencies: this.extractDependencies(shiftedAST.root),
        dependents: new Set(),
      });
    }

    // Обновляем карту формул
    this.formulas = newFormulas;
    this.rebuildDependencies();

    console.log(`✅ Обработано удаление столбца: ${this.formulas.size} формул обновлено`);

    // Принудительно пересчитываем все формулы
    this.recalculateAllFormulas();
  }

  /**
   * Форматирование AST в строку формулы
   */
  private formatFormula(node: FormulaNode): string {
    switch (node.type) {
      case 'number':
        return node.value.toString();
      case 'string':
        return `"${node.value}"`;
      case 'cell':
        return FormulaUtils.formatCellReference(node);
      case 'range':
        return FormulaUtils.formatCellRange(node);
      case 'function':
        const args = node.args.map(arg => this.formatFormula(arg)).join(',');
        return `${node.name.toUpperCase()}(${args})`;
      case 'binary':
        const left = this.formatFormula(node.left);
        const right = this.formatFormula(node.right);
        return `${left}${node.operator}${right}`;
      case 'unary':
        return `${node.operator}${this.formatFormula(node.operand)}`;
      default:
        return '';
    }
  }

  /**
   * Принудительное пересчитывание всех формул
   */
  private recalculateAllFormulas(): void {
    console.log(`🔄 Пересчитываем все ${this.formulas.size} формул`);

    for (const [cellKey] of this.formulas) {
      try {
        const [rowStr, colStr] = cellKey.split(':');
        const row = parseInt(rowStr || '0', 10);
        const col = parseInt(colStr || '0', 10);
        const result = this.evaluateFormula(row, col);
        console.log(`🔄 Формула ${cellKey} пересчитана: ${JSON.stringify(result)}`);
      } catch (error) {
        console.error(`❌ Ошибка пересчета формулы ${cellKey}:`, error);
      }
    }
  }

  /**
   * Извлечение зависимостей из AST
   */
  private extractDependencies(node: FormulaNode): Set<string> {
    const dependencies = new Set<string>();

    const traverse = (n: FormulaNode) => {
      switch (n.type) {
        case 'cell':
          dependencies.add(`${n.row}:${n.col}`);
          break;
        case 'range':
          // Добавляем все ячейки в диапазоне
          for (let row = n.startRow; row <= n.endRow; row++) {
            for (let col = n.startCol; col <= n.endCol; col++) {
              dependencies.add(`${row}:${col}`);
            }
          }
          break;
        case 'function':
          n.args.forEach(traverse);
          break;
        case 'binary':
          traverse(n.left);
          traverse(n.right);
          break;
        case 'unary':
          traverse(n.operand);
          break;
      }
    };

    traverse(node);
    return dependencies;
  }

  /**
   * Сдвиг AST формулы
   */
  private shiftFormulaAST(
    ast: FormulaAST,
    rowOffset: number,
    colOffset: number,
    insertRow?: number,
    insertCol?: number,
    deleteRow?: number,
    deleteCol?: number
  ): FormulaAST {
    const shiftedRoot = this.shiftNode(
      ast.root,
      rowOffset,
      colOffset,
      insertRow,
      insertCol,
      deleteRow,
      deleteCol
    );

    return {
      ...ast,
      root: shiftedRoot,
    };
  }

  /**
   * Сдвиг узла AST
   */
  private shiftNode(
    node: FormulaNode,
    rowOffset: number,
    colOffset: number,
    insertRow?: number,
    insertCol?: number,
    deleteRow?: number,
    deleteCol?: number
  ): FormulaNode {
    console.log(
      `🔧 shiftNode: type=${node.type}, rowOffset=${rowOffset}, colOffset=${colOffset}, insertCol=${insertCol}`
    );

    switch (node.type) {
      case 'cell':
        const shiftedCell = FormulaUtils.shiftCellReference(
          node,
          rowOffset,
          colOffset,
          insertRow,
          insertCol,
          deleteRow,
          deleteCol
        );
        console.log(
          `🔧 shiftNode cell: ${node.row},${node.col} -> ${shiftedCell.row},${shiftedCell.col}`
        );
        return shiftedCell;

      case 'range':
        const shiftedRange = FormulaUtils.shiftCellRange(
          node,
          rowOffset,
          colOffset,
          insertRow,
          insertCol,
          deleteRow,
          deleteCol
        );
        console.log(
          `🔧 shiftNode range: ${node.startRow},${node.startCol}:${node.endRow},${node.endCol} -> ${shiftedRange.startRow},${shiftedRange.startCol}:${shiftedRange.endRow},${shiftedRange.endCol}`
        );
        return shiftedRange;

      case 'function':
        return {
          ...node,
          args: node.args.map(arg =>
            this.shiftNode(arg, rowOffset, colOffset, insertRow, insertCol, deleteRow, deleteCol)
          ),
        };

      case 'binary':
        return {
          ...node,
          left: this.shiftNode(
            node.left,
            rowOffset,
            colOffset,
            insertRow,
            insertCol,
            deleteRow,
            deleteCol
          ),
          right: this.shiftNode(
            node.right,
            rowOffset,
            colOffset,
            insertRow,
            insertCol,
            deleteRow,
            deleteCol
          ),
        };

      case 'unary':
        return {
          ...node,
          operand: this.shiftNode(
            node.operand,
            rowOffset,
            colOffset,
            insertRow,
            insertCol,
            deleteRow,
            deleteCol
          ),
        };

      default:
        return node; // Числа, строки и т.д. не сдвигаются
    }
  }

  /**
   * Добавление зависимостей
   */
  private addDependencies(cellKey: string, dependencies: Set<string>): void {
    for (const dep of dependencies) {
      const depInfo = this.formulas.get(dep);
      if (depInfo) {
        depInfo.dependents.add(cellKey);
      }
    }
  }

  /**
   * Удаление зависимостей
   */
  private removeDependencies(cellKey: string): void {
    const formulaInfo = this.formulas.get(cellKey);
    if (formulaInfo) {
      for (const dep of formulaInfo.dependencies) {
        const depInfo = this.formulas.get(dep);
        if (depInfo) {
          depInfo.dependents.delete(cellKey);
        }
      }
    }
  }

  /**
   * Перестройка всех зависимостей
   */
  private rebuildDependencies(): void {
    // Очищаем все зависимости
    for (const formulaInfo of this.formulas.values()) {
      formulaInfo.dependents.clear();
    }

    // Перестраиваем зависимости
    for (const [cellKey, formulaInfo] of this.formulas) {
      this.addDependencies(cellKey, formulaInfo.dependencies);
    }
  }

  /**
   * Получение статистики
   */
  getStats(): {
    totalFormulas: number;
    formulasByType: Record<string, number>;
    totalDependencies: number;
  } {
    const formulasByType: Record<string, number> = {};
    let totalDependencies = 0;

    for (const formulaInfo of this.formulas.values()) {
      const rootType = formulaInfo.ast.root.type;
      formulasByType[rootType] = (formulasByType[rootType] || 0) + 1;
      totalDependencies += formulaInfo.dependencies.size;
    }

    return {
      totalFormulas: this.formulas.size,
      formulasByType,
      totalDependencies,
    };
  }
}
