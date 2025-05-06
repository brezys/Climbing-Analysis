// Video comparison processing utilities
import '@mediapipe/pose';
declare global {
  interface Window {
    Pose: any;
  }
}
import { calculateCenterOfGravity } from '../pose-detection/calculations';

type Point = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

// Type definition for MediaPipe pose results
interface PoseResults {
  poseLandmarks: Point[];
  poseWorldLandmarks?: any;
  segmentationMask?: any;
}

// Type for MediaPipe results listener
type ResultsListener = (results: PoseResults) => void;

/**
 * Process a video to extract pose data for each frame
 */
export const processVideo = async (
  videoElement: HTMLVideoElement | string,
  options?: { width: number, height: number },
  label?: string
): Promise<{ frames: any[], centerOfGravityPath: {x: number, y: number, timestamp?: number}[] }> => {
  return new Promise<{ frames: any[], centerOfGravityPath: {x: number, y: number, timestamp?: number}[] }>((resolve) => {
    // Process either a video element or a URL
    let video: HTMLVideoElement;
    let shouldCleanupVideo = false;
    
    if (typeof videoElement === 'string') {
      // Create a temporary video element
      video = document.createElement('video');
      video.src = videoElement;
      video.muted = true;
      video.playsInline = true;
      shouldCleanupVideo = true;
    } else {
      // Use the provided video element
      video = videoElement;
    }
    
    // Track frame data
    const frames: any[] = [];
    const cogPath: {x: number, y: number, timestamp: number}[] = [];
    let frameCount = 0;
    let processedFrames = 0;
    
    // Set up a temporary pose model for processing
    const poseDetector = new window.Pose({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      }
    });
    
    poseDetector.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    
    // Process frames at regular intervals
    const onMetadataLoaded = () => {
      console.log(`Processing video${label ? ` (${label})` : ''}: ${video.videoWidth}x${video.videoHeight}, duration: ${video.duration}s`);
      
      // Calculate total frames (assuming 30fps)
      frameCount = Math.floor(video.duration * 5); // Process 5 frames per second
      const frameInterval = video.duration * 1000 / frameCount;
      
      // Setup canvas for processing
      const canvas = document.createElement('canvas');
      canvas.width = options?.width || video.videoWidth;
      canvas.height = options?.height || video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      // Process frame function
      const processFrame = async (currentTime: number) => {
        if (!ctx) return;
        
        // Seek to time and draw frame
        video.currentTime = currentTime;
        
        // Wait for seeked event
        await new Promise<void>(resolve => {
          const seekHandler = () => {
            video.removeEventListener('seeked', seekHandler);
            resolve();
          };
          video.addEventListener('seeked', seekHandler);
        });
        
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Get image data for pose detection
        const imageData = canvas.toDataURL('image/png');
        
        // Create image element for pose detection
        const img = document.createElement('img');
        img.src = imageData;
        
        // Wait for image to load
        await new Promise<void>(resolve => {
          img.onload = () => resolve();
        });
        
        // Process with pose model
        try {
          // We need to use the onResults callback - MediaPipe doesn't return results directly
          // Set up a temporary promise to get the results
          const poseResults = await new Promise<PoseResults | null>(resolve => {
            // Define our temporary callback
            const tempCallback: ResultsListener = (results: PoseResults) => {
              resolve(results);
            };
            
            // Set our temporary callback
            poseDetector.onResults(tempCallback);
            
            // Process the image
            poseDetector.send({image: img})
              .catch((err: unknown) => {
                console.error("Error in pose detection:", err);
                resolve(null);
              });
          });
          
          if (poseResults && poseResults.poseLandmarks) {
            // Store frame data
            frames.push({
              timestamp: currentTime,
              landmarks: [...poseResults.poseLandmarks]
            });
            
            // Calculate and store center of gravity
            const centerOfGravity = calculateCenterOfGravity(poseResults.poseLandmarks);
            cogPath.push({
              x: centerOfGravity.x * canvas.width,
              y: centerOfGravity.y * canvas.height,
              timestamp: currentTime
            });
          }
        } catch (err: unknown) {
          console.error('Error during video processing:', err);
          return null;
        }
        
        // Update progress
        processedFrames++;
        console.log(`Processed frame ${processedFrames}/${frameCount} (${Math.round(processedFrames/frameCount*100)}%)`);
        
        // Process next frame or finish
        if (processedFrames >= frameCount) {
          // Sort frames by timestamp to ensure order
          frames.sort((a, b) => a.timestamp - b.timestamp);
          cogPath.sort((a, b) => a.timestamp - b.timestamp);
          
          // Clean up
          if (shouldCleanupVideo && video.src) {
            URL.revokeObjectURL(video.src);
          }
          
          // Close pose detector
          poseDetector.close();
          
          // Return results
          resolve({
            frames,
            centerOfGravityPath: cogPath
          });
        } else {
          const nextTime = Math.min(video.duration, (processedFrames / frameCount) * video.duration);
          processFrame(nextTime);
        }
      };
      
      // Start processing from the beginning
      processFrame(0);
    };
    
    // Check if metadata is already loaded
    if (video.readyState >= 2) {
      onMetadataLoaded();
    } else {
      video.addEventListener('loadedmetadata', onMetadataLoaded);
      // If it's a new video element, start loading
      if (shouldCleanupVideo) {
        video.load();
      }
    }
  });
};

/**
 * Compare two climbing attempts and generate metrics
 */
export const compareClimbingAttempts = (
  video1Data: { frames: any[], centerOfGravityPath: {x: number, y: number}[] }, 
  video2Data: { frames: any[], centerOfGravityPath: {x: number, y: number}[] }
) => {
  // Extract relevant metrics for comparison
  const video1Frames = video1Data.frames;
  const video2Frames = video2Data.frames;
  
  // Calculate completion times
  const video1Time = video1Frames.length > 0 ? video1Frames[video1Frames.length - 1].timestamp : 0;
  const video2Time = video2Frames.length > 0 ? video2Frames[video2Frames.length - 1].timestamp : 0;
  
  // Calculate average speed of center of gravity
  const calcAvgSpeed = (cogPath: {x: number, y: number}[]) => {
    if (cogPath.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 1; i < cogPath.length; i++) {
      const dx = cogPath[i].x - cogPath[i-1].x;
      const dy = cogPath[i].y - cogPath[i-1].y;
      totalDistance += Math.sqrt(dx*dx + dy*dy);
    }
    
    return totalDistance / (cogPath.length - 1);
  };
  
  const video1Speed = calcAvgSpeed(video1Data.centerOfGravityPath);
  const video2Speed = calcAvgSpeed(video2Data.centerOfGravityPath);
  
  // Calculate path efficiency (distance traveled vs. direct distance)
  const calcEfficiency = (cogPath: {x: number, y: number}[]) => {
    if (cogPath.length < 2) return 0;
    
    // Total path distance
    let totalDistance = 0;
    for (let i = 1; i < cogPath.length; i++) {
      const dx = cogPath[i].x - cogPath[i-1].x;
      const dy = cogPath[i].y - cogPath[i-1].y;
      totalDistance += Math.sqrt(dx*dx + dy*dy);
    }
    
    // Direct distance (start to end)
    const first = cogPath[0];
    const last = cogPath[cogPath.length - 1];
    const directDistance = Math.sqrt(
      Math.pow(last.x - first.x, 2) + 
      Math.pow(last.y - first.y, 2)
    );
    
    return directDistance / totalDistance; // Higher is more efficient
  };
  
  const video1Efficiency = calcEfficiency(video1Data.centerOfGravityPath);
  const video2Efficiency = calcEfficiency(video2Data.centerOfGravityPath);
  
  // Return comparison results
  return {
    completionTime: { 
      video1: video1Time, 
      video2: video2Time,
      difference: Math.abs(video1Time - video2Time),
      fasterVideo: video1Time < video2Time ? 1 : 2
    },
    avgSpeed: {
      video1: video1Speed,
      video2: video2Speed,
      difference: Math.abs(video1Speed - video2Speed),
      fasterVideo: video1Speed > video2Speed ? 1 : 2
    },
    pathEfficiency: {
      video1: video1Efficiency,
      video2: video2Efficiency,
      difference: Math.abs(video1Efficiency - video2Efficiency),
      moreEfficientVideo: video1Efficiency > video2Efficiency ? 1 : 2
    }
  };
};

/**
 * Find the frame closest to a specific time
 */
export const getClosestFrame = (frames: any[], time: number) => {
  if (!frames || frames.length === 0) return null;
  
  return frames.reduce((prev, curr) => 
    Math.abs(curr.timestamp - time) < Math.abs(prev.timestamp - time) ? curr : prev
  );
};

/**
 * Draw center of gravity path on canvas
 */
export const drawCogPath = (
  ctx: CanvasRenderingContext2D, 
  path: {x: number, y: number}[], 
  color: string
) => {
  if (!path || path.length < 2) return;
  
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.setLineDash([5, 5]); // Dotted line
  
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i].x, path[i].y);
  }
  
  ctx.stroke();
  ctx.restore();
};

/**
 * Draw skeleton on canvas
 */
export const drawSkeleton = (
  ctx: CanvasRenderingContext2D, 
  landmarks: Point[], 
  canvasWidth: number, 
  canvasHeight: number, 
  color: string
) => {
  if (!landmarks || landmarks.length < 33) return;
  
  // Scale normalized coordinates to canvas size
  const scaledLandmarks = landmarks.map(landmark => ({
    x: landmark.x * canvasWidth,
    y: landmark.y * canvasHeight,
    z: landmark.z,
    visibility: landmark.visibility
  }));
  
  // Draw connections
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  
  // Define connections (simplified version of POSE_CONNECTIONS)
  const connections = [
    // Torso
    [11, 12], [12, 24], [24, 23], [23, 11],
    // Arms
    [11, 13], [13, 15], [12, 14], [14, 16],
    // Legs
    [23, 25], [25, 27], [24, 26], [26, 28],
    // Face
    [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8]
  ];
  
  // Draw each connection
  for (const [i, j] of connections) {
    const p1 = scaledLandmarks[i];
    const p2 = scaledLandmarks[j];
    
    // Only draw if both points are visible
    if (p1.visibility !== undefined && p2.visibility !== undefined &&
        p1.visibility > 0.5 && p2.visibility > 0.5) {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }
  
  // Draw landmarks
  ctx.fillStyle = color;
  
  for (const landmark of scaledLandmarks) {
    if (landmark.visibility !== undefined && landmark.visibility > 0.5) {
      ctx.beginPath();
      ctx.arc(landmark.x, landmark.y, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}; 