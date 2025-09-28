/**
 * Основные типы для WebGPU Excel
 */

// Позиция ячейки
export interface CellPosition {
  row: number;
  col: number;
}

// Размеры ячейки
export interface CellSize {
  width: number;
  height: number;
}

// Ячейка таблицы
export interface Cell {
  row: number;
  col: number;
  value: any;
  formula?: string;
  style?: CellStyle;
  screenX: number;
  screenY: number;
  width: number;
  height: number;
}

// Стиль ячейки
export interface CellStyle {
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
  borderColor?: string;
  borderWidth?: number;
}

// Видимая область
export interface Viewport {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

// Точка на экране
export interface Point {
  x: number;
  y: number;
}

// Диапазон ячеек
export interface CellRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

// Операция CRDT
export interface CRDTOperation {
  id: string;
  type: OperationType;
  position: CellPosition;
  value: any;
  timestamp: number;
  replicaId: string;
  dependencies: string[];
  metadata: OperationMetadata;
}

// Типы операций
export enum OperationType {
  SET_CELL = 'set_cell',
  INSERT_ROW = 'insert_row',
  INSERT_COLUMN = 'insert_column',
  DELETE_ROW = 'delete_row',
  DELETE_COLUMN = 'delete_column',
  SET_FORMULA = 'set_formula',
  SET_STYLE = 'set_style',
}

// Метаданные операции
export interface OperationMetadata {
  userId: string;
  sessionId: string;
  deviceId: string;
  version: string;
}

// Конфигурация WebGPU
export interface WebGPUConfig {
  device: GPUDevice;
  context: GPUCanvasContext;
  adapter: GPUAdapter;
  format: GPUTextureFormat;
}

// Результат инициализации
export interface InitializationResult {
  success: boolean;
  error?: string;
  config?: WebGPUConfig;
}

// Метрики производительности
export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage: number;
  gpuMemoryUsage: number;
}

// События
export interface SpreadsheetEvent {
  type: string;
  data: any;
  timestamp: number;
}

// Конфигурация приложения
export interface AppConfig {
  maxRows: number;
  maxCols: number;
  cellWidth: number;
  cellHeight: number;
  enableWebGPU: boolean;
  enableCollaborative: boolean;
}
