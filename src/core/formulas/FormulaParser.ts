/**
 * Парсер формул Excel
 */

import {
  FormulaAST,
  FormulaNode,
  CellReference,
  NumberLiteral,
  StringLiteral,
  FunctionCall,
  BinaryOperation,
  UnaryOperation,
  FormulaUtils,
} from './FormulaAST.js';

export interface ParseError {
  message: string;
  position: number;
  expected?: string;
}

export class FormulaParser {
  private input: string = '';
  private position: number = 0;
  private length: number = 0;

  /**
   * Парсинг формулы
   */
  parse(formula: string): FormulaAST {
    if (!formula.startsWith('=')) {
      throw new Error('Формула должна начинаться с =');
    }

    this.input = formula.substring(1); // Убираем =
    this.position = 0;
    this.length = this.input.length;

    console.log(`🔍 Парсинг формулы: ${formula}`);

    try {
      const root = this.parseExpression();

      // Проверяем, что весь ввод был обработан
      if (this.position < this.length) {
        throw this.createError(`Неожиданный символ: ${this.currentChar()}`);
      }

      const ast: FormulaAST = {
        root,
        originalFormula: formula,
      };

      console.log(`✅ Формула успешно распарсена`);
      return ast;
    } catch (error) {
      console.error(`❌ Ошибка парсинга формулы: ${error}`);
      throw error;
    }
  }

  /**
   * Парсинг выражения (самый низкий приоритет)
   */
  private parseExpression(): FormulaNode {
    return this.parseRange();
  }

  /**
   * Парсинг диапазонов (A1:B2)
   */
  private parseRange(): FormulaNode {
    let left = this.parseComparison();

    // Проверяем, является ли это диапазоном
    if (this.match([':'])) {
      const right = this.parseComparison();

      // Если оба операнда - ссылки на ячейки, создаем диапазон
      if (left.type === 'cell' && right.type === 'cell') {
        return {
          type: 'range',
          startRow: left.row,
          startCol: left.col,
          endRow: right.row,
          endCol: right.col,
          absoluteStartRow: left.absoluteRow || false,
          absoluteStartCol: left.absoluteCol || false,
          absoluteEndRow: right.absoluteRow || false,
          absoluteEndCol: right.absoluteCol || false,
        };
      } else {
        throw this.createError('Диапазон может содержать только ссылки на ячейки');
      }
    }

    return left;
  }

  /**
   * Парсинг сравнения (=, <, >, <=, >=, <>)
   */
  private parseComparison(): FormulaNode {
    let left = this.parseAddition();

    while (this.match(['=', '<', '>', '<=', '>=', '<>'])) {
      const operator = this.previousToken();
      const right = this.parseAddition();
      left = {
        type: 'binary',
        operator: operator as BinaryOperation['operator'],
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Парсинг сложения и вычитания
   */
  private parseAddition(): FormulaNode {
    let left = this.parseMultiplication();

    while (this.match(['+', '-'])) {
      const operator = this.previousToken();
      const right = this.parseMultiplication();
      left = {
        type: 'binary',
        operator: operator as BinaryOperation['operator'],
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Парсинг умножения и деления
   */
  private parseMultiplication(): FormulaNode {
    let left = this.parseExponentiation();

    while (this.match(['*', '/'])) {
      const operator = this.previousToken();
      const right = this.parseExponentiation();
      left = {
        type: 'binary',
        operator: operator as BinaryOperation['operator'],
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Парсинг возведения в степень
   */
  private parseExponentiation(): FormulaNode {
    let left = this.parseUnary();

    while (this.match(['^'])) {
      const operator = this.previousToken();
      const right = this.parseUnary();
      left = {
        type: 'binary',
        operator: operator as BinaryOperation['operator'],
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Парсинг унарных операций
   */
  private parseUnary(): FormulaNode {
    if (this.match(['+', '-'])) {
      const operator = this.previousToken();
      const operand = this.parseUnary();
      return {
        type: 'unary',
        operator: operator as UnaryOperation['operator'],
        operand,
      };
    }

    return this.parsePrimary();
  }

  /**
   * Парсинг первичных выражений
   */
  private parsePrimary(): FormulaNode {
    // Числа
    if (this.isDigit(this.currentChar())) {
      return this.parseNumber();
    }

    // Строки
    if (this.currentChar() === '"') {
      return this.parseString();
    }

    // Функции
    if (this.isAlpha(this.currentChar())) {
      const name = this.parseIdentifier();
      if (this.currentChar() === '(') {
        return this.parseFunction(name);
      } else {
        // Это ссылка на ячейку
        return this.parseCellReference(name);
      }
    }

    // Ссылки на ячейки (начинающиеся с $)
    if (this.currentChar() === '$') {
      this.advance();
      const name = this.parseIdentifier();
      return this.parseCellReference('$' + name);
    }

    // Скобки
    if (this.currentChar() === '(') {
      this.advance(); // Пропускаем (
      const expr = this.parseExpression();
      this.consume(')', 'Ожидается закрывающая скобка');
      return expr;
    }

    throw this.createError(`Неожиданный символ: ${this.currentChar()}`);
  }

  /**
   * Парсинг числа
   */
  private parseNumber(): NumberLiteral {
    let value = '';

    while (this.isDigit(this.currentChar()) || this.currentChar() === '.') {
      value += this.currentChar();
      this.advance();
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      throw this.createError(`Неверное число: ${value}`);
    }

    return {
      type: 'number',
      value: numValue,
    };
  }

  /**
   * Парсинг строки
   */
  private parseString(): StringLiteral {
    this.consume('"', 'Ожидается открывающая кавычка');

    let value = '';
    while (this.currentChar() !== '"' && !this.isAtEnd()) {
      if (this.currentChar() === '\\') {
        this.advance();
        if (this.isAtEnd()) {
          throw this.createError('Незавершенная escape-последовательность');
        }
        value += this.currentChar();
      } else {
        value += this.currentChar();
      }
      this.advance();
    }

    this.consume('"', 'Ожидается закрывающая кавычка');

    return {
      type: 'string',
      value,
    };
  }

  /**
   * Парсинг функции
   */
  private parseFunction(name: string): FunctionCall {
    this.consume('(', 'Ожидается открывающая скобка после имени функции');

    const args: FormulaNode[] = [];

    if (this.currentChar() !== ')') {
      do {
        args.push(this.parseExpression());
      } while (this.match([',']));
    }

    this.consume(')', 'Ожидается закрывающая скобка');

    return {
      type: 'function',
      name: name.toUpperCase(),
      args,
    };
  }

  /**
   * Парсинг ссылки на ячейку
   */
  private parseCellReference(prefix: string): CellReference {
    let ref = prefix;

    // Парсим остальную часть ссылки
    while (
      this.isAlpha(this.currentChar()) ||
      this.isDigit(this.currentChar()) ||
      this.currentChar() === '$'
    ) {
      ref += this.currentChar();
      this.advance();
    }

    try {
      return FormulaUtils.parseCellReference(ref);
    } catch (error) {
      throw this.createError(`Неверная ссылка на ячейку: ${ref}`);
    }
  }

  /**
   * Парсинг идентификатора
   */
  private parseIdentifier(): string {
    let identifier = '';

    while (this.isAlpha(this.currentChar()) || this.isDigit(this.currentChar())) {
      identifier += this.currentChar();
      this.advance();
    }

    return identifier;
  }

  /**
   * Проверка совпадения с одним из токенов
   */
  private match(tokens: string[]): boolean {
    for (const token of tokens) {
      if (this.check(token)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  /**
   * Проверка текущего символа
   */
  private check(expected: string): boolean {
    if (this.isAtEnd()) return false;
    return this.input.substring(this.position, this.position + expected.length) === expected;
  }

  /**
   * Потребление ожидаемого символа
   */
  private consume(expected: string, errorMessage: string): void {
    if (this.check(expected)) {
      this.advance();
    } else {
      throw this.createError(errorMessage);
    }
  }

  /**
   * Переход к следующему символу
   */
  private advance(): void {
    if (!this.isAtEnd()) {
      this.position++;
    }
  }

  /**
   * Получение предыдущего токена
   */
  private previousToken(): string {
    // Упрощенная реализация - возвращаем последний символ
    return this.input[this.position - 1] || '';
  }

  /**
   * Получение текущего символа
   */
  private currentChar(): string {
    if (this.isAtEnd()) return '\0';
    return this.input[this.position] || '\0';
  }

  /**
   * Проверка конца ввода
   */
  private isAtEnd(): boolean {
    return this.position >= this.length;
  }

  /**
   * Проверка, является ли символ цифрой
   */
  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  /**
   * Проверка, является ли символ буквой
   */
  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
  }

  /**
   * Создание ошибки парсинга
   */
  private createError(message: string): ParseError {
    return {
      message,
      position: this.position,
    };
  }
}
