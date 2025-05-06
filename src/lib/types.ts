// Shared types for ClimbSight app

export type Point = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

export interface ClimberStats {
  height: string | null;
  weight: string | null;
  apeIndex: string | null;
}

export interface ClimbHold {
  x: number;
  y: number;
  color: string;
}

export interface ClimbData {
  climbName: string;
  holdColors: string[];
  detectedHolds: ClimbHold[];
  timestamp: string;
  climberStats: ClimberStats;
}

export interface PoseStats {
  leanAngle: number;
  shoulderAngle: number;
  hipAngle: number;
  kneeAngle: number;
  armExtension: number;
  centerOfGravity: {
    x: number;
    y: number;
  }
}

export interface MovementStats {
  leftHand: { direction: number; speed: number };
  rightHand: { direction: number; speed: number };
  leftFoot: { direction: number; speed: number };
  rightFoot: { direction: number; speed: number };
  bodyCenter: { direction: number; speed: number };
}

export interface CameraSettings {
  width: number;
  height: number;
  frameRate: { ideal: number; min: number };
}

export interface RecordingHandlers {
  onDataAvailable: (data: Blob) => void;
  onStop: () => void;
}

export interface PoseResults {
  poseLandmarks: Point[];
  poseWorldLandmarks?: any;
  segmentationMask?: any;
}

export type ResultsListener = (results: PoseResults) => void;

export interface VideoProcessingResult {
  frames: Array<{
    timestamp: number;
    landmarks: Point[];
  }>;
  centerOfGravityPath: Array<{
    x: number;
    y: number;
    timestamp?: number;
  }>;
}

export interface ComparisonResults {
  completionTime: {
    video1: number;
    video2: number;
    difference: number;
    fasterVideo: 1 | 2;
  };
  avgSpeed: {
    video1: number;
    video2: number;
    difference: number;
    fasterVideo: 1 | 2;
  };
  pathEfficiency: {
    video1: number;
    video2: number;
    difference: number;
    moreEfficientVideo: 1 | 2;
  };
} 