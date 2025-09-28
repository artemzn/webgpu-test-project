/**
 * HeaderRenderer - рендеринг заголовков столбцов и строк на Canvas 2D
 */

export class HeaderRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cellWidth: number;
  private cellHeight: number;
  private headerWidth: number = 30; // Ширина заголовков строк
  private headerHeight: number; // Высота заголовков столбцов

  constructor(canvas: HTMLCanvasElement, cellWidth: number = 80, cellHeight: number = 25) {
    this.canvas = canvas;
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    this.headerHeight = cellHeight - 5; // ВЫСОТА ЗАГОЛОВКА = ВЫСОТА ЯЧЕЙКИ

    // Получаем 2D контекст
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Не удалось получить 2D контекст для заголовков');
    }
    this.ctx = ctx;

    console.log('📝 HeaderRenderer инициализирован:', {
      canvasSize: `${canvas.width}x${canvas.height}`,
      cellSize: `${cellWidth}x${cellHeight}`,
      headerSize: `${this.headerWidth}x${this.headerHeight}`,
    });
  }

  /**
   * Рендеринг заголовков столбцов и строк
   */
  render(viewport: any): void {
    // Очищаем canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const startCol = viewport.startCol || 0;
    const endCol = viewport.endCol || 24;
    const startRow = viewport.startRow || 0;
    const endRow = viewport.endRow || 32;

    console.log('📝 Рендеринг заголовков:', {
      columns: `${startCol}-${endCol}`,
      rows: `${startRow}-${endRow}`,
    });

    // Рендерим заголовки столбцов (A, B, C...)
    this.renderColumnHeaders(startCol, endCol);

    // Рендерим заголовки строк (1, 2, 3...)
    this.renderRowHeaders(startRow, endRow);

    // Рендерим угловой заголовок (левый верхний угол)
    this.renderCornerHeader();
  }

  /**
   * Рендеринг заголовков столбцов (A, B, C...)
   */
  private renderColumnHeaders(startCol: number, endCol: number): void {
    this.ctx.fillStyle = '#f0f0f0'; // Светло-серый фон
    this.ctx.strokeStyle = '#ccc'; // Серые границы
    this.ctx.lineWidth = 1;
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    for (let col = startCol; col < endCol; col++) {
      // ТОЧНОЕ СОВПАДЕНИЕ с сеткой: +30px слева
      const x = 30 + (col - startCol) * this.cellWidth;
      const y = 0;
      const width = this.cellWidth;
      const height = this.headerHeight;

      // Рисуем фон заголовка
      this.ctx.fillRect(x, y, width, height);
      this.ctx.strokeRect(x, y, width, height);

      // Рисуем букву (A, B, C...)
      const letter = this.indexToColumnLetter(col);
      this.ctx.fillStyle = '#333';
      this.ctx.fillText(letter, x + width / 2, y + height / 2);
      this.ctx.fillStyle = '#f0f0f0'; // Возвращаем цвет фона
    }
  }

  /**
   * Рендеринг заголовков строк (1, 2, 3...)
   */
  private renderRowHeaders(startRow: number, endRow: number): void {
    this.ctx.fillStyle = '#f0f0f0'; // Светло-серый фон
    this.ctx.strokeStyle = '#ccc'; // Серые границы
    this.ctx.lineWidth = 1;
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    for (let row = startRow; row < endRow; row++) {
      const x = 0;
      // ВОЗВРАЩАЕМ СМЕЩЕНИЕ: +25px сверху как у сетки
      const y = 20 + (row - startRow) * this.cellHeight;
      const width = this.headerWidth;
      // ПОДСТРАИВАЕМ ВЫСОТУ под ячейки
      const height = this.cellHeight;

      // Рисуем фон заголовка
      this.ctx.fillRect(x, y, width, height);
      this.ctx.strokeRect(x, y, width, height);

      // Рисуем номер строки (1, 2, 3...)
      const number = (row + 1).toString();
      this.ctx.fillStyle = '#333';
      this.ctx.fillText(number, x + width / 2, y + height / 2);
      this.ctx.fillStyle = '#f0f0f0'; // Возвращаем цвет фона
    }
  }

  /**
   * Рендеринг углового заголовка (левый верхний угол)
   */
  private renderCornerHeader(): void {
    this.ctx.fillStyle = '#e0e0e0'; // Чуть темнее серый
    this.ctx.strokeStyle = '#ccc';
    this.ctx.lineWidth = 1;

    const x = 0;
    const y = 0;
    const width = this.headerWidth;
    const height = this.headerHeight;

    // Рисуем фон углового заголовка
    this.ctx.fillRect(x, y, width, height);
    this.ctx.strokeRect(x, y, width, height);
  }

  /**
   * Преобразование индекса столбца в букву (0 -> A, 1 -> B, ..., 25 -> Z, 26 -> AA)
   */
  private indexToColumnLetter(index: number): string {
    let result = '';
    while (index >= 0) {
      result = String.fromCharCode(65 + (index % 26)) + result;
      index = Math.floor(index / 26) - 1;
    }
    return result;
  }

  /**
   * Обновление размеров ячеек
   */
  updateCellSize(cellWidth: number, cellHeight: number): void {
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    console.log('📝 HeaderRenderer: размеры ячеек обновлены:', `${cellWidth}x${cellHeight}`);
  }

  /**
   * Обновление размера canvas
   */
  updateCanvasSize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    console.log('📝 HeaderRenderer: размер canvas обновлен:', `${width}x${height}`);
  }

  /**
   * Получение размеров заголовков
   */
  getHeaderDimensions(): { width: number; height: number } {
    return {
      width: this.headerWidth,
      height: this.headerHeight,
    };
  }
}
