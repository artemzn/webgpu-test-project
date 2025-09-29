/**
 * AST (Abstract Syntax Tree) для формул Excel
 */

export interface CellReference {
  type: 'cell';
  row: number;
  col: number;
  absoluteRow?: boolean;
  absoluteCol?: boolean;
}

export interface CellRange {
  type: 'range';
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  absoluteStartRow?: boolean;
  absoluteStartCol?: boolean;
  absoluteEndRow?: boolean;
  absoluteEndCol?: boolean;
}

export interface NumberLiteral {
  type: 'number';
  value: number;
}

export interface StringLiteral {
  type: 'string';
  value: string;
}

export interface FunctionCall {
  type: 'function';
  name: string;
  args: FormulaNode[];
}

export interface BinaryOperation {
  type: 'binary';
  operator: '+' | '-' | '*' | '/' | '^' | '=' | '<' | '>' | '<=' | '>=' | '<>';
  left: FormulaNode;
  right: FormulaNode;
}

export interface UnaryOperation {
  type: 'unary';
  operator: '+' | '-';
  operand: FormulaNode;
}

export type FormulaNode =
  | CellReference
  | CellRange
  | NumberLiteral
  | StringLiteral
  | FunctionCall
  | BinaryOperation
  | UnaryOperation;

export interface FormulaAST {
  root: FormulaNode;
  originalFormula: string;
}

/**
 * Утилиты для работы с формулами
 */
export class FormulaUtils {
  /**
   * Преобразование индекса столбца в букву (0 -> A, 1 -> B, ..., 25 -> Z, 26 -> AA)
   */
  static indexToColumnLetter(index: number): string {
    let result = '';
    while (index >= 0) {
      result = String.fromCharCode(65 + (index % 26)) + result;
      index = Math.floor(index / 26) - 1;
    }
    return result;
  }

  /**
   * Преобразование буквы столбца в индекс (A -> 0, B -> 1, ..., Z -> 25, AA -> 26)
   */
  static columnLetterToIndex(letter: string): number {
    let result = 0;
    for (let i = 0; i < letter.length; i++) {
      result = result * 26 + (letter.charCodeAt(i) - 64);
    }
    return result - 1;
  }

  /**
   * Парсинг ссылки на ячейку (A1, $A$1, A$1, $A1)
   */
  static parseCellReference(ref: string): CellReference {
    const match = ref.match(/^(\$?)([A-Z]+)(\$?)(\d+)$/);
    if (!match) {
      throw new Error(`Неверная ссылка на ячейку: ${ref}`);
    }

    const [, dollarCol, colLetter, dollarRow, rowStr] = match;
    const col = this.columnLetterToIndex(colLetter);
    const row = parseInt(rowStr, 10) - 1; // Excel использует 1-based индексацию

    return {
      type: 'cell',
      row,
      col,
      absoluteCol: dollarCol === '$',
      absoluteRow: dollarRow === '$',
    };
  }

  /**
   * Парсинг диапазона ячеек (A1:B2, $A$1:$B$2)
   */
  static parseCellRange(range: string): CellRange {
    const [startRef, endRef] = range.split(':');
    if (!startRef || !endRef) {
      throw new Error(`Неверный диапазон ячеек: ${range}`);
    }

    const start = this.parseCellReference(startRef);
    const end = this.parseCellReference(endRef);

    return {
      type: 'range',
      startRow: start.row,
      startCol: start.col,
      endRow: end.row,
      endCol: end.col,
      absoluteStartRow: start.absoluteRow || false,
      absoluteStartCol: start.absoluteCol || false,
      absoluteEndRow: end.absoluteRow || false,
      absoluteEndCol: end.absoluteCol || false,
    };
  }

  /**
   * Форматирование ссылки на ячейку
   */
  static formatCellReference(cell: CellReference): string {
    const colLetter = this.indexToColumnLetter(cell.col);
    const rowNum = cell.row + 1;

    const colPrefix = cell.absoluteCol ? '$' : '';
    const rowPrefix = cell.absoluteRow ? '$' : '';

    return `${colPrefix}${colLetter}${rowPrefix}${rowNum}`;
  }

  /**
   * Форматирование диапазона ячеек
   */
  static formatCellRange(range: CellRange): string {
    const startRef: CellReference = {
      type: 'cell',
      row: range.startRow,
      col: range.startCol,
      absoluteRow: range.absoluteStartRow || false,
      absoluteCol: range.absoluteStartCol || false,
    };

    const endRef: CellReference = {
      type: 'cell',
      row: range.endRow,
      col: range.endCol,
      absoluteRow: range.absoluteEndRow || false,
      absoluteCol: range.absoluteEndCol || false,
    };

    return `${this.formatCellReference(startRef)}:${this.formatCellReference(endRef)}`;
  }

  /**
   * Сдвиг ссылки на ячейку при операциях со строками/столбцами
   */
  static shiftCellReference(
    cell: CellReference,
    rowOffset: number,
    colOffset: number,
    insertRow?: number,
    insertCol?: number,
    deleteRow?: number,
    deleteCol?: number
  ): CellReference {
    let newRow = cell.row;
    let newCol = cell.col;

    // Обрабатываем абсолютные ссылки
    if (!cell.absoluteRow) {
      // Обрабатываем вставку строки
      if (insertRow !== undefined && cell.row >= insertRow) {
        newRow += 1;
      }

      // Обрабатываем удаление строки
      if (deleteRow !== undefined) {
        if (newRow > deleteRow) {
          newRow -= 1;
        } else if (newRow === deleteRow) {
          // Ячейка была удалена - возвращаем ошибку
          throw new Error(`Ссылка на удаленную ячейку: ${this.formatCellReference(cell)}`);
        }
      }

      // Применяем общий сдвиг строки
      newRow += rowOffset;
    }

    if (!cell.absoluteCol) {
      // Обрабатываем вставку столбца
      if (insertCol !== undefined && cell.col >= insertCol) {
        newCol += 1;
      }

      // Обрабатываем удаление столбца
      if (deleteCol !== undefined) {
        if (newCol > deleteCol) {
          newCol -= 1;
        } else if (newCol === deleteCol) {
          // Ячейка была удалена - возвращаем ошибку
          throw new Error(`Ссылка на удаленную ячейку: ${this.formatCellReference(cell)}`);
        }
      }

      // Применяем общий сдвиг столбца
      newCol += colOffset;
    }

    return {
      ...cell,
      row: newRow,
      col: newCol,
    };
  }

  /**
   * Сдвиг диапазона ячеек
   */
  static shiftCellRange(
    range: CellRange,
    rowOffset: number,
    colOffset: number,
    insertRow?: number,
    insertCol?: number,
    deleteRow?: number,
    deleteCol?: number
  ): CellRange {
    const start = this.shiftCellReference(
      {
        type: 'cell',
        row: range.startRow,
        col: range.startCol,
        absoluteRow: range.absoluteStartRow,
        absoluteCol: range.absoluteStartCol,
      },
      rowOffset,
      colOffset,
      insertRow,
      insertCol,
      deleteRow,
      deleteCol
    );

    const end = this.shiftCellReference(
      {
        type: 'cell',
        row: range.endRow,
        col: range.endCol,
        absoluteRow: range.absoluteEndRow,
        absoluteCol: range.absoluteEndCol,
      },
      rowOffset,
      colOffset,
      insertRow,
      insertCol,
      deleteRow,
      deleteCol
    );

    return {
      ...range,
      startRow: start.row,
      startCol: start.col,
      endRow: end.row,
      endCol: end.col,
    };
  }
}
