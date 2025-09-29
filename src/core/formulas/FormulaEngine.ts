/**
 * Движок вычисления формул
 */

import {
  FormulaAST,
  FormulaNode,
  CellReference,
  CellRange,
  FunctionCall,
  BinaryOperation,
  UnaryOperation,
} from './FormulaAST.js';

export interface CellValue {
  value: any;
  type: 'number' | 'string' | 'error' | 'empty';
}

export interface FormulaContext {
  getCellValue: (row: number, col: number) => CellValue;
  getCellRange: (startRow: number, startCol: number, endRow: number, endCol: number) => CellValue[];
}

export class FormulaEngine {
  private context: FormulaContext;

  constructor(context: FormulaContext) {
    this.context = context;
  }

  /**
   * Вычисление формулы
   */
  evaluate(ast: FormulaAST): CellValue {
    try {
      console.log(`🧮 Вычисление формулы: ${ast.originalFormula}`);
      const result = this.evaluateNode(ast.root);
      console.log(`✅ Результат: ${result.value} (${result.type})`);
      return result;
    } catch (error) {
      console.error(`❌ Ошибка вычисления формулы: ${error}`);
      return {
        value: `#ERROR: ${error}`,
        type: 'error',
      };
    }
  }

  /**
   * Вычисление узла AST
   */
  private evaluateNode(node: FormulaNode): CellValue {
    switch (node.type) {
      case 'number':
        return {
          value: node.value,
          type: 'number',
        };

      case 'string':
        return {
          value: node.value,
          type: 'string',
        };

      case 'cell':
        return this.evaluateCellReference(node);

      case 'range':
        return this.evaluateCellRange(node);

      case 'function':
        return this.evaluateFunction(node);

      case 'binary':
        return this.evaluateBinaryOperation(node);

      case 'unary':
        return this.evaluateUnaryOperation(node);

      default:
        throw new Error(`Неизвестный тип узла: ${(node as any).type}`);
    }
  }

  /**
   * Вычисление ссылки на ячейку
   */
  private evaluateCellReference(cell: CellReference): CellValue {
    return this.context.getCellValue(cell.row, cell.col);
  }

  /**
   * Вычисление диапазона ячеек
   */
  private evaluateCellRange(range: CellRange): CellValue {
    const values = this.context.getCellRange(
      range.startRow,
      range.startCol,
      range.endRow,
      range.endCol
    );

    // Для диапазонов возвращаем массив значений
    return {
      value: values,
      type: 'number', // Упрощение - считаем диапазон числовым
    };
  }

  /**
   * Вычисление функции
   */
  private evaluateFunction(func: FunctionCall): CellValue {
    const args = func.args.map(arg => this.evaluateNode(arg));

    switch (func.name) {
      case 'SUM':
        return this.evaluateSum(args);
      case 'MIN':
        return this.evaluateMin(args);
      case 'MAX':
        return this.evaluateMax(args);
      case 'AVERAGE':
        return this.evaluateAverage(args);
      case 'COUNT':
        return this.evaluateCount(args);
      default:
        throw new Error(`Неизвестная функция: ${func.name}`);
    }
  }

  /**
   * Функция SUM
   */
  private evaluateSum(args: CellValue[]): CellValue {
    let sum = 0;
    let hasNumbers = false;

    for (const arg of args) {
      if (arg.type === 'number' && !Array.isArray(arg.value)) {
        // Обычное число
        sum += arg.value;
        hasNumbers = true;
      } else if (arg.type === 'empty') {
        // Пустые ячейки игнорируем
        continue;
      } else if (Array.isArray(arg.value)) {
        // Диапазон ячеек (может быть type='number' с массивом в value)
        for (const cellValue of arg.value) {
          if (cellValue.type === 'number') {
            sum += cellValue.value;
            hasNumbers = true;
          }
        }
      }
    }
    return {
      value: hasNumbers ? sum : 0,
      type: 'number',
    };
  }

  /**
   * Функция MIN
   */
  private evaluateMin(args: CellValue[]): CellValue {
    let min: number | null = null;

    for (const arg of args) {
      if (arg.type === 'number' && !Array.isArray(arg.value)) {
        // Обычное число
        if (min === null || arg.value < min) {
          min = arg.value;
        }
      } else if (Array.isArray(arg.value)) {
        for (const cellValue of arg.value) {
          if (cellValue.type === 'number') {
            if (min === null || cellValue.value < min) {
              min = cellValue.value;
            }
          }
        }
      }
    }
    if (min === null) {
      return {
        value: 0,
        type: 'number',
      };
    }

    return {
      value: min,
      type: 'number',
    };
  }

  /**
   * Функция MAX
   */
  private evaluateMax(args: CellValue[]): CellValue {
    let max: number | null = null;

    for (const arg of args) {
      if (arg.type === 'number' && !Array.isArray(arg.value)) {
        // Обычное число
        if (max === null || arg.value > max) {
          max = arg.value;
        }
      } else if (Array.isArray(arg.value)) {
        for (const cellValue of arg.value) {
          if (cellValue.type === 'number') {
            if (max === null || cellValue.value > max) {
              max = cellValue.value;
            }
          }
        }
      }
    }
    if (max === null) {
      return {
        value: 0,
        type: 'number',
      };
    }

    return {
      value: max,
      type: 'number',
    };
  }

  /**
   * Функция AVERAGE
   */
  private evaluateAverage(args: CellValue[]): CellValue {
    let sum = 0;
    let count = 0;

    for (const arg of args) {
      if (arg.type === 'number' && !Array.isArray(arg.value)) {
        // Обычное число
        sum += arg.value;
        count++;
      } else if (Array.isArray(arg.value)) {
        for (const cellValue of arg.value) {
          if (cellValue.type === 'number') {
            sum += cellValue.value;
            count++;
          }
        }
      }
    }
    if (count === 0) {
      return {
        value: 0,
        type: 'number',
      };
    }

    return {
      value: sum / count,
      type: 'number',
    };
  }

  /**
   * Функция COUNT
   */
  private evaluateCount(args: CellValue[]): CellValue {
    let count = 0;

    for (const arg of args) {
      if (arg.type === 'number' || arg.type === 'string') {
        count++;
      } else if (Array.isArray(arg.value)) {
        for (const cellValue of arg.value) {
          if (cellValue.type === 'number' || cellValue.type === 'string') {
            count++;
          }
        }
      }
    }

    return {
      value: count,
      type: 'number',
    };
  }

  /**
   * Вычисление бинарной операции
   */
  private evaluateBinaryOperation(op: BinaryOperation): CellValue {
    const left = this.evaluateNode(op.left);
    const right = this.evaluateNode(op.right);

    // Преобразуем в числа для арифметических операций
    const leftNum = this.toNumber(left);
    const rightNum = this.toNumber(right);

    switch (op.operator) {
      case '+':
        return { value: leftNum + rightNum, type: 'number' };
      case '-':
        return { value: leftNum - rightNum, type: 'number' };
      case '*':
        return { value: leftNum * rightNum, type: 'number' };
      case '/':
        if (rightNum === 0) {
          return { value: '#DIV/0!', type: 'error' };
        }
        return { value: leftNum / rightNum, type: 'number' };
      case '^':
        return { value: Math.pow(leftNum, rightNum), type: 'number' };
      case '=':
        return { value: leftNum === rightNum, type: 'number' };
      case '<':
        return { value: leftNum < rightNum, type: 'number' };
      case '>':
        return { value: leftNum > rightNum, type: 'number' };
      case '<=':
        return { value: leftNum <= rightNum, type: 'number' };
      case '>=':
        return { value: leftNum >= rightNum, type: 'number' };
      case '<>':
        return { value: leftNum !== rightNum, type: 'number' };
      default:
        throw new Error(`Неизвестный оператор: ${op.operator}`);
    }
  }

  /**
   * Вычисление унарной операции
   */
  private evaluateUnaryOperation(op: UnaryOperation): CellValue {
    const operand = this.evaluateNode(op.operand);
    const num = this.toNumber(operand);

    switch (op.operator) {
      case '+':
        return { value: +num, type: 'number' };
      case '-':
        return { value: -num, type: 'number' };
      default:
        throw new Error(`Неизвестный унарный оператор: ${op.operator}`);
    }
  }

  /**
   * Преобразование значения в число
   */
  private toNumber(value: CellValue): number {
    if (value.type === 'number') {
      return value.value;
    }
    if (value.type === 'string') {
      const parsed = parseFloat(value.value);
      return isNaN(parsed) ? 0 : parsed;
    }
    if (value.type === 'empty') {
      return 0;
    }
    if (value.type === 'error') {
      return 0;
    }
    return 0;
  }
}
