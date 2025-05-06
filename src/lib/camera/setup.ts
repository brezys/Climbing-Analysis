// Camera setup and management utilities

export interface CameraSettings {
  width: number;
  height: number;
  frameRate: { ideal: number; min: number };
}

/**
 * Get a list of available cameras
 */
export const getAvailableCameras = async (): Promise<MediaDeviceInfo[]> => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((device) => device.kind === 'videoinput');
    return videoDevices;
  } catch (error) {
    console.error('Error enumerating devices:', error);
    return [];
  }
};

/**
 * Set up camera with specified settings
 */
export const setupCamera = async (
  deviceId: string | null | undefined,
  settings: CameraSettings
): Promise<MediaStream | null> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        width: settings.width,
        height: settings.height,
        frameRate: settings.frameRate
      }
    });
    
    return stream;
  } catch (error) {
    console.error('Error accessing camera:', error);
    return null;
  }
};

/**
 * Clean up media stream tracks
 */
export const cleanupCamera = (stream: MediaStream | null): void => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
};

/**
 * Record video from a stream
 */
export interface RecordingHandlers {
  onDataAvailable: (data: Blob) => void;
  onStop: () => void;
}

export const createMediaRecorder = (
  stream: MediaStream,
  handlers: RecordingHandlers
): MediaRecorder | null => {
  try {
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm',
    });
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        handlers.onDataAvailable(event.data);
      }
    };
    
    mediaRecorder.onstop = handlers.onStop;
    
    return mediaRecorder;
  } catch (error) {
    console.error('Error creating media recorder:', error);
    return null;
  }
};

/**
 * Get default camera settings based on performance level
 */
export const getDefaultCameraSettings = (
  performanceLevel: 'low' | 'medium' | 'high' = 'medium'
): CameraSettings => {
  switch (performanceLevel) {
    case 'low':
      return {
        width: 320,
        height: 240,
        frameRate: { ideal: 30, min: 15 }
      };
    case 'high':
      return {
        width: 640,
        height: 480,
        frameRate: { ideal: 60, min: 30 }
      };
    case 'medium':
    default:
      return {
        width: 480,
        height: 360,
        frameRate: { ideal: 30, min: 30 }
      };
  }
}; 