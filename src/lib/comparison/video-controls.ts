// Video comparison playback control utilities

/**
 * Sync two video elements for playback
 */
export const syncVideos = (
  video1: HTMLVideoElement, 
  video2: HTMLVideoElement,
  onPlayToggle: (isPlaying: boolean) => void
): () => void => {
  const handleVideo1Play = () => {
    if (video2.paused) video2.play();
    onPlayToggle(true);
  };
  
  const handleVideo1Pause = () => {
    if (!video2.paused) video2.pause();
    onPlayToggle(false);
  };
  
  const handleVideo2Play = () => {
    if (video1.paused) video1.play();
    onPlayToggle(true);
  };
  
  const handleVideo2Pause = () => {
    if (!video1.paused) video1.pause();
    onPlayToggle(false);
  };
  
  // Set up event listeners
  video1.addEventListener('play', handleVideo1Play);
  video1.addEventListener('pause', handleVideo1Pause);
  video2.addEventListener('play', handleVideo2Play);
  video2.addEventListener('pause', handleVideo2Pause);
  
  // Return cleanup function
  return () => {
    video1.removeEventListener('play', handleVideo1Play);
    video1.removeEventListener('pause', handleVideo1Pause);
    video2.removeEventListener('play', handleVideo2Play);
    video2.removeEventListener('pause', handleVideo2Pause);
  };
};

/**
 * Play both videos simultaneously
 */
export const playBothVideos = (video1: HTMLVideoElement | null, video2: HTMLVideoElement | null): Promise<void> => {
  if (!video1 || !video2) {
    return Promise.reject(new Error('Video elements not available'));
  }
  
  return Promise.all([
    video1.play(),
    video2.play()
  ]).then(() => {
    // Both videos started playing successfully
  }).catch(error => {
    console.error('Error playing videos:', error);
    throw error;
  });
};

/**
 * Pause both videos
 */
export const pauseBothVideos = (video1: HTMLVideoElement | null, video2: HTMLVideoElement | null): void => {
  if (video1) video1.pause();
  if (video2) video2.pause();
};

/**
 * Set current time for both videos
 */
export const seekBothVideos = (video1: HTMLVideoElement | null, video2: HTMLVideoElement | null, time: number): void => {
  if (video1) video1.currentTime = time;
  if (video2) video2.currentTime = time;
};

/**
 * Set playback rate for both videos
 */
export const setPlaybackRateBothVideos = (video1: HTMLVideoElement | null, video2: HTMLVideoElement | null, rate: number): void => {
  if (video1) video1.playbackRate = rate;
  if (video2) video2.playbackRate = rate;
};

/**
 * Record from two cameras side by side for comparison
 */
export const recordComparisonVideos = async (
  camera1Id: string,
  camera2Id: string,
  cameraSettings: { width: number, height: number, frameRate: { ideal: number, min: number } },
  onRecordingStarted: (stream1: MediaStream, stream2: MediaStream) => void,
  onRecordingStopped: (url1: string, url2: string) => void
): Promise<() => void> => {
  try {
    // Initialize two cameras
    const stream1 = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: camera1Id },
        width: cameraSettings.width,
        height: cameraSettings.height,
        frameRate: cameraSettings.frameRate
      }
    });
    
    const stream2 = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: camera2Id },
        width: cameraSettings.width,
        height: cameraSettings.height,
        frameRate: cameraSettings.frameRate
      }
    });
    
    // Create media recorders
    const recorder1 = new MediaRecorder(stream1, { mimeType: 'video/webm' });
    const recorder2 = new MediaRecorder(stream2, { mimeType: 'video/webm' });
    
    const chunks1: Blob[] = [];
    const chunks2: Blob[] = [];
    
    // Set up event handlers
    recorder1.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks1.push(e.data);
      }
    };
    
    recorder2.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks2.push(e.data);
      }
    };
    
    let recorder1Stopped = false;
    let recorder2Stopped = false;
    
    // Create a promise that resolves when both recorders stop
    const bothRecordersStoppedPromise = new Promise<[string, string]>((resolve) => {
      recorder1.onstop = () => {
        recorder1Stopped = true;
        if (recorder1Stopped && recorder2Stopped) {
          // Both recorders stopped, create URLs
          const blob1 = new Blob(chunks1, { type: 'video/webm' });
          const blob2 = new Blob(chunks2, { type: 'video/webm' });
          
          const url1 = URL.createObjectURL(blob1);
          const url2 = URL.createObjectURL(blob2);
          
          resolve([url1, url2]);
        }
      };
      
      recorder2.onstop = () => {
        recorder2Stopped = true;
        if (recorder1Stopped && recorder2Stopped) {
          // Both recorders stopped, create URLs
          const blob1 = new Blob(chunks1, { type: 'video/webm' });
          const blob2 = new Blob(chunks2, { type: 'video/webm' });
          
          const url1 = URL.createObjectURL(blob1);
          const url2 = URL.createObjectURL(blob2);
          
          resolve([url1, url2]);
        }
      };
    });
    
    // Start recording
    recorder1.start();
    recorder2.start();
    
    // Notify that recording has started
    onRecordingStarted(stream1, stream2);
    
    // Set up callback for when both recorders stop
    bothRecordersStoppedPromise.then(([url1, url2]) => {
      onRecordingStopped(url1, url2);
    });
    
    // Return function to stop recording
    return () => {
      recorder1.stop();
      recorder2.stop();
      
      // Stop all tracks
      stream1.getTracks().forEach(track => track.stop());
      stream2.getTracks().forEach(track => track.stop());
    };
  } catch (error) {
    console.error('Error setting up comparison recording:', error);
    throw error;
  }
}; 