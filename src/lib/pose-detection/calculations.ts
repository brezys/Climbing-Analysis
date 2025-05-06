// Utility functions for pose calculations

type Point = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

/**
 * Calculates the angle between three points in degrees
 */
export const calculateAngle = (p1: Point, p2: Point, p3: Point): number => {
  if (!p1 || !p2 || !p3) return 0;
  
  const a = Math.sqrt(
    Math.pow(p2.x - p3.x, 2) + Math.pow(p2.y - p3.y, 2)
  );
  const b = Math.sqrt(
    Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)
  );
  const c = Math.sqrt(
    Math.pow(p1.x - p3.x, 2) + Math.pow(p1.y - p3.y, 2)
  );
  
  // Law of cosines
  const angleRad = Math.acos((a*a + b*b - c*c) / (2 * a * b));
  return angleRad * (180 / Math.PI);
};

/**
 * Calculates limb extension as a percentage (0-100%)
 */
export const calculateExtension = (p1: Point, p2: Point, p3: Point): number => {
  if (!p1 || !p2 || !p3) return 0;
  
  const angle = calculateAngle(p1, p2, p3);
  // 180 degrees = fully extended
  return (angle / 180) * 100;
};

/**
 * Calculates various body angles from pose landmarks
 */
export const calculateBodyAngles = (landmarks: Point[]) => {
  // Skip calculation if landmarks are not available
  if (!landmarks || landmarks.length < 33) return null;
  
  // Get key landmarks
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const leftElbow = landmarks[13];
  const rightElbow = landmarks[14];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  
  // Calculate shoulder angle (angle between shoulders and horizontal)
  const shoulderAngle = Math.atan2(
    rightShoulder.y - leftShoulder.y,
    rightShoulder.x - leftShoulder.x
  ) * (180 / Math.PI);
  
  // Calculate hip angle (angle at hip joint)
  const leftHipAngle = calculateAngle(leftShoulder, leftHip, leftKnee);
  const rightHipAngle = calculateAngle(rightShoulder, rightHip, rightKnee);
  const hipAngle = (leftHipAngle + rightHipAngle) / 2;
  
  // Calculate knee angle
  const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
  const kneeAngle = (leftKneeAngle + rightKneeAngle) / 2;
  
  // Calculate lean angle (vertical alignment)
  const midShoulder = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2
  };
  const midHip = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2
  };
  const leanAngle = Math.atan2(
    midShoulder.x - midHip.x,
    midHip.y - midShoulder.y
  ) * (180 / Math.PI);
  
  // Calculate arm extension (average of both arms)
  const leftArmExtension = calculateExtension(leftShoulder, leftElbow, leftWrist);
  const rightArmExtension = calculateExtension(rightShoulder, rightElbow, rightWrist);
  const armExtension = (leftArmExtension + rightArmExtension) / 2;
  
  // Calculate center of gravity (approximation)
  const centerOfGravity = {
    x: midHip.x,
    y: (midShoulder.y * 0.4 + midHip.y * 0.6) // Weighted average
  };
  
  return {
    leanAngle: parseFloat(leanAngle.toFixed(1)),
    shoulderAngle: parseFloat(shoulderAngle.toFixed(1)),
    hipAngle: parseFloat(hipAngle.toFixed(1)),
    kneeAngle: parseFloat(kneeAngle.toFixed(1)),
    armExtension: parseFloat(armExtension.toFixed(1)),
    centerOfGravity: {
      x: parseFloat(centerOfGravity.x.toFixed(3)),
      y: parseFloat(centerOfGravity.y.toFixed(3))
    }
  };
};

/**
 * Calculates the center of gravity from pose landmarks
 */
export const calculateCenterOfGravity = (landmarks: Point[]) => {
  if (!landmarks || landmarks.length < 33) {
    return { x: 0, y: 0 };
  }
  
  // Get key landmarks
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  
  // Calculate midpoints
  const midShoulder = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2
  };
  
  const midHip = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2
  };
  
  // Center of gravity (weighted average)
  return {
    x: midHip.x,
    y: (midShoulder.y * 0.4 + midHip.y * 0.6) // Weighted average
  };
}; 