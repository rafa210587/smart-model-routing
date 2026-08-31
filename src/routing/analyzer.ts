import { extractTaskFeatures, type TaskFeatures } from "./taskFeatures.js";
export type TaskProfile = TaskFeatures;
export interface TaskAnalyzer { analyze(prompt: string): TaskProfile; }
export class DefaultTaskAnalyzer implements TaskAnalyzer { analyze(prompt: string): TaskProfile { return extractTaskFeatures(prompt); } }
