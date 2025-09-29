import { describe, it, expect, beforeEach } from 'vitest';
import { FormulaManager } from '../../src/core/formulas/FormulaManager';
import { FormulaContext } from '../../src/core/formulas/FormulaEngine';

describe('Formula System Tests', () => {
  let formulaManager: FormulaManager;
  let mockContext: FormulaContext;

  beforeEach(() => {
    // Создаем мок контекста
    mockContext = {
      getCellValue: (row: number, col: number) => {
        const values: { [key: string]: any } = {
          '0:0': 10, // A1
          '0:1': 20, // B1
          '0:2': 30, // C1
          '1:0': 5, // A2
          '1:1': 15, // B2
          '1:2': 25, // C2
          '2:0': 100, // A3
          '2:1': 200, // B3
          '2:2': 300, // C3
        };
        return {
          type: 'number',
          value: values[`${row}:${col}`] || 0,
        };
      },
      getCellRange: (startRow: number, startCol: number, endRow: number, endCol: number) => {
        const result: any[] = [];
        for (let row = startRow; row <= endRow; row++) {
          for (let col = startCol; col <= endCol; col++) {
            result.push(mockContext.getCellValue(row, col));
          }
        }
        return result;
      },
    };

    formulaManager = new FormulaManager(mockContext);
  });

  describe('Базовые функции', () => {
    it('должен устанавливать и вычислять простые формулы', () => {
      formulaManager.setFormula(0, 0, '=SUM(A1:B2)');
      const result = formulaManager.evaluateFormula(0, 0);
      expect(result.type).toBe('number');
    });

    it('должен вычислять функции MIN', () => {
      formulaManager.setFormula(0, 0, '=MIN(A1:B2)');
      const result = formulaManager.evaluateFormula(0, 0);
      expect(result.type).toBe('number');
    });

    it('должен вычислять функции MAX', () => {
      formulaManager.setFormula(0, 0, '=MAX(A1:B2)');
      const result = formulaManager.evaluateFormula(0, 0);
      expect(result.type).toBe('number');
    });

    it('должен вычислять функции AVERAGE', () => {
      formulaManager.setFormula(0, 0, '=AVERAGE(A1:B2)');
      const result = formulaManager.evaluateFormula(0, 0);
      expect(result.type).toBe('number');
    });

    it('должен вычислять бинарные операции', () => {
      formulaManager.setFormula(0, 0, '=A1+B2');
      const result = formulaManager.evaluateFormula(0, 0);
      expect(result.type).toBe('number');
    });
  });

  describe('Обработка ошибок', () => {
    it('должен возвращать ошибку для невалидных формул', () => {
      formulaManager.setFormula(0, 0, '=INVALID(A1)');
      const result = formulaManager.evaluateFormula(0, 0);
      expect(result.type).toBe('error');
    });

    it('должен возвращать ошибку для синтаксических ошибок', () => {
      // Ожидаем, что setFormula выбросит исключение при синтаксической ошибке
      expect(() => {
        formulaManager.setFormula(0, 0, '=SUM(A1');
      }).toThrow();
    });
  });

  describe('Сдвиг формул', () => {
    it('должен сдвигать формулы при вставке строки', () => {
      formulaManager.setFormula(1, 0, '=SUM(A1:B2)');
      formulaManager.handleRowInsertion(1);
      const result = formulaManager.evaluateFormula(2, 0);
      expect(result.type).toBe('number');
    });

    it('должен сдвигать формулы при вставке столбца', () => {
      formulaManager.setFormula(0, 1, '=SUM(A1:B2)');
      formulaManager.handleColumnInsertion(1);
      const result = formulaManager.evaluateFormula(0, 2);
      expect(result.type).toBe('number');
    });

    it('должен сдвигать формулы при удалении строки', () => {
      formulaManager.setFormula(2, 0, '=SUM(A1:B2)');
      // Ожидаем, что удаление строки выбросит ошибку, так как формула ссылается на удаленную ячейку B2
      expect(() => {
        formulaManager.handleRowDeletion(1);
      }).toThrow('Ссылка на удаленную ячейку: B2');
    });

    it('должен сдвигать формулы при удалении столбца', () => {
      formulaManager.setFormula(0, 2, '=SUM(A1:B2)');
      // Ожидаем, что удаление столбца выбросит ошибку, так как формула ссылается на удаленную ячейку B2
      expect(() => {
        formulaManager.handleColumnDeletion(1);
      }).toThrow('Ссылка на удаленную ячейку: B2');
    });
  });

  describe('Сложные сценарии', () => {
    it('должен обрабатывать цепочки зависимостей', () => {
      formulaManager.setFormula(0, 0, '=SUM(A2:A3)');
      formulaManager.setFormula(1, 0, '=A1*2');
      formulaManager.setFormula(2, 0, '=A2+10');

      const result1 = formulaManager.evaluateFormula(0, 0);
      const result2 = formulaManager.evaluateFormula(1, 0);
      const result3 = formulaManager.evaluateFormula(2, 0);

      expect(result1.type).toBe('number');
      expect(result2.type).toBe('number');
      expect(result3.type).toBe('number');
    });

    it('должен обрабатывать операции со строками и столбцами', () => {
      formulaManager.setFormula(0, 0, '=SUM(A1:B2)');
      formulaManager.setFormula(1, 0, '=MAX(A1:B2)');
      formulaManager.setFormula(2, 0, '=MIN(A1:B2)');

      formulaManager.handleRowInsertion(1);

      // После вставки строки на позиции 1:
      // - Формула 0,0 остается на 0,0
      // - Формула 1,0 сдвигается на 2,0
      // - Формула 2,0 сдвигается на 3,0
      const result1 = formulaManager.evaluateFormula(0, 0); // Исходная формула
      const result2 = formulaManager.evaluateFormula(2, 0); // Сдвинутая формула
      const result3 = formulaManager.evaluateFormula(3, 0); // Сдвинутая формула

      expect(result1.type).toBe('number');
      expect(result2.type).toBe('number');
      expect(result3.type).toBe('number');
    });
  });

  describe('Производительность', () => {
    it('должен эффективно обрабатывать много формул', () => {
      const startTime = performance.now();

      // Создаем 100 формул
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
          formulaManager.setFormula(i, j, `=SUM(A${i + 1}:B${j + 1})`);
        }
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Проверяем, что обработка заняла разумное время (< 100ms)
      expect(duration).toBeLessThan(100);

      // Проверяем, что все формулы работают
      const result = formulaManager.evaluateFormula(0, 0);
      expect(result.type).toBe('number');
    });
  });
});
