// Utility functions for motion tracking calculations

type Point = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

/**
 * Calculates the Euclidean distance between two points
 */
export const calculateDistance = (p1: Point, p2: Point): number => {
  return Math.sqrt(
    Math.pow(p2.x - p1.x, 2) + 
    Math.pow(p2.y - p1.y, 2) + 
    Math.pow((p2.z || 0) - (p1.z || 0), 2)
  );
};

/**
 * Calculates the direction (angle in degrees) between two points
 * Returns null if movement is negligible
 */
export const calculateDirection = (p1: Point, p2: Point, threshold: number = 0.005): number | null => {
  // Only calculate direction if movement is significant
  const distance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  if (distance < threshold) {
    return null; // Return null if movement is negligible
  }
  return Math.round(Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI));
};

/**
 * Smooths speed values to reduce jitter
 */
export const smoothSpeed = (rawSpeed: number, threshold: number, previousSpeed: number): number => {
  if (rawSpeed < threshold) {
    return 0; // If below threshold, show as 0
  }
  // Apply exponential smoothing when above threshold
  const alpha = 0.3; // Smoothing factor (0-1), lower = more smoothing
  return parseFloat((alpha * rawSpeed + (1 - alpha) * (previousSpeed || 0)).toFixed(1));
};

/**
 * Calculates movement statistics for body parts between frames
 */
export const calculateMovement = (
  currentLandmarks: Point[], 
  prevLandmarks: Point[] | null, 
  timeDiff: number, 
  previousMovementStats: any
) => {
  if (!currentLandmarks || currentLandmarks.length < 33 || !prevLandmarks || prevLandmarks.length < 33 || timeDiff <= 0) {
    return null;
  }
  
  // Skip calculations if time difference is too small (reduces jitter)
  if (timeDiff < 0.1) return null;
  
  // Landmark indices for key body parts
  const leftWrist = 15;
  const rightWrist = 16;
  const leftAnkle = 27;
  const rightAnkle = 28;
  
  // Get positions
  const leftHand = currentLandmarks[leftWrist];
  const rightHand = currentLandmarks[rightWrist];
  const leftFoot = currentLandmarks[leftAnkle];
  const rightFoot = currentLandmarks[rightAnkle];
  
  // Calculate body center as average of shoulders and hips
  const bodyCenter = {
    x: (currentLandmarks[11].x + currentLandmarks[12].x + currentLandmarks[23].x + currentLandmarks[24].x) / 4,
    y: (currentLandmarks[11].y + currentLandmarks[12].y + currentLandmarks[23].y + currentLandmarks[24].y) / 4,
    z: ((currentLandmarks[11].z || 0) + (currentLandmarks[12].z || 0) + 
        (currentLandmarks[23].z || 0) + (currentLandmarks[24].z || 0)) / 4
  };
  
  // Previous positions
  const prevLeftHand = prevLandmarks[leftWrist];
  const prevRightHand = prevLandmarks[rightWrist];
  const prevLeftFoot = prevLandmarks[leftAnkle];
  const prevRightFoot = prevLandmarks[rightAnkle];
  const prevBodyCenter = {
    x: (prevLandmarks[11].x + prevLandmarks[12].x + prevLandmarks[23].x + prevLandmarks[24].x) / 4,
    y: (prevLandmarks[11].y + prevLandmarks[12].y + prevLandmarks[23].y + prevLandmarks[24].y) / 4,
    z: ((prevLandmarks[11].z || 0) + (prevLandmarks[12].z || 0) + 
        (prevLandmarks[23].z || 0) + (prevLandmarks[24].z || 0)) / 4
  };
  
  // Calculate raw speeds
  const scale = 1000; // Scale factor for better visualization
  const leftHandSpeed = calculateDistance(prevLeftHand, leftHand) * scale / timeDiff;
  const rightHandSpeed = calculateDistance(prevRightHand, rightHand) * scale / timeDiff;
  const leftFootSpeed = calculateDistance(prevLeftFoot, leftFoot) * scale / timeDiff;
  const rightFootSpeed = calculateDistance(prevRightFoot, rightFoot) * scale / timeDiff;
  const bodyCenterSpeed = calculateDistance(prevBodyCenter, bodyCenter) * scale / timeDiff;
  
  // Calculate directions
  const leftHandDir = calculateDirection(prevLeftHand, leftHand);
  const rightHandDir = calculateDirection(prevRightHand, rightHand);
  const leftFootDir = calculateDirection(prevLeftFoot, leftFoot);
  const rightFootDir = calculateDirection(prevRightFoot, rightFoot);
  const bodyCenterDir = calculateDirection(prevBodyCenter, bodyCenter);
  
  // Much higher speed threshold to filter out noise
  const speedThreshold = 0.2;
  
  // Create an object to hold the current movement data
  const movementData = {
    leftHand: { 
      direction: leftHandDir !== null ? leftHandDir : previousMovementStats.leftHand.direction,
      speed: smoothSpeed(leftHandSpeed, speedThreshold, previousMovementStats.leftHand.speed)
    },
    rightHand: { 
      direction: rightHandDir !== null ? rightHandDir : previousMovementStats.rightHand.direction,
      speed: smoothSpeed(rightHandSpeed, speedThreshold, previousMovementStats.rightHand.speed)
    },
    leftFoot: { 
      direction: leftFootDir !== null ? leftFootDir : previousMovementStats.leftFoot.direction,
      speed: smoothSpeed(leftFootSpeed, speedThreshold, previousMovementStats.leftFoot.speed)
    },
    rightFoot: { 
      direction: rightFootDir !== null ? rightFootDir : previousMovementStats.rightFoot.direction,
      speed: smoothSpeed(rightFootSpeed, speedThreshold, previousMovementStats.rightFoot.speed)
    },
    bodyCenter: { 
      direction: bodyCenterDir !== null ? bodyCenterDir : previousMovementStats.bodyCenter.direction,
      speed: smoothSpeed(bodyCenterSpeed, speedThreshold, previousMovementStats.bodyCenter.speed)
    }
  };
  
  return movementData;
}; 