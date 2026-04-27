/**
 * @typedef {'anomaly' | 'correlation'} ScoutPinKind
 * @typedef {{
 *   id: string;
 *   kind: ScoutPinKind;
 *   rowIndex: number;
 *   position: [number, number, number];
 *   anomaly_score: number;
 *   headline: string;
 *   explanation: string;
 *   columns_involved: string[];
 *   suggested_action: string;
 *   confidence: number;
 * }} ScoutPin
 */

/**
 * @typedef {{
 *   id: string;
 *   label: string;
 *   offset: [number, number, number];
 *   rows: Record<string, unknown>[];
 *   columns: string[];
 *   detectedTypes: Record<string, 'numeric' | 'categorical' | 'datetime'>;
 *   axisMapping: { x: string; y: string; z: string };
 *   chartType: 'scatter3d' | 'surface' | 'mesh3d' | 'bar3d' | 'globe' | 'graph3d';
 *   collapsed: boolean;
 * }} SubScene
 */

export {}
