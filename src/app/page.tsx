'use client';

import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarSeparator, SidebarGroup, SidebarGroupLabel, SidebarInput } from '@/components/ui/sidebar';
import {Card, CardHeader, CardTitle, CardDescription, CardContent} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {useState, useRef, useEffect, Fragment, useMemo} from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import QRCodeStyling from 'qr-code-styling';
import {toast} from '@/hooks/use-toast';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
// Import MediaPipe scripts properly
// import '@mediapipe/pose';
// import '@mediapipe/drawing_utils';
// import '@mediapipe/camera_utils';
// Declare the types for the global objects
declare global {
  interface Window {
    Pose: any;
    Camera: any;
    poseDetection: any;
  }
}
import { analyzeClimbingData, type ClimbAnalysisResponse } from '@/lib/gemini-api';
import { AnalysisResults } from '@/components/analysis-results';
import { QRScanner } from '@/components/qr-scanner';
import { SimpleQRScanner } from '@/components/simple-qr-scanner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

// Import our extracted utility functions
import { 
  calculateAngle, 
  calculateExtension, 
  calculateBodyAngles, 
  calculateCenterOfGravity 
} from '@/lib/pose-detection/calculations';
import { 
  calculateDistance, 
  calculateDirection, 
  smoothSpeed, 
  calculateMovement 
} from '@/lib/motion-tracking/calculations';
import { 
  processVideo,
  compareClimbingAttempts,
  getClosestFrame,
  drawCogPath,
  drawSkeleton
} from '@/lib/comparison/video-processor';
import { 
  syncVideos, 
  playBothVideos as playBothVideosUtil, 
  pauseBothVideos as pauseBothVideosUtil,
  recordComparisonVideos
} from '@/lib/comparison/video-controls';
import { 
  generateQRCode, 
  parseQRCodeData 
} from '@/lib/qr-code/generator';
import { 
  detectHolds, 
  isColorMatch, 
  getAnnotatedImage 
} from '@/lib/holds/detector';
import {
  getAvailableCameras,
  setupCamera,
  cleanupCamera,
  createMediaRecorder,
  getDefaultCameraSettings
} from '@/lib/camera/setup';

// Import shared types
import {
  Point,
  ClimberStats,
  ClimbHold,
  ClimbData,
  PoseStats,
  MovementStats,
  CameraSettings,
  RecordingHandlers,
  VideoProcessingResult,
  ComparisonResults
} from '@/lib/types';

// Define the POSE_CONNECTIONS constant manually as it's not exported
const POSE_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10],
  [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20], [11, 23],
  [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28], [27, 29],
  [28, 30], [29, 31], [30, 32], [27, 31], [28, 32]
];

const styles = {
  container: {
    margin: '0 auto',
    width: '80%',
  },
  input: {
    width: '100%',
    padding: '10px',
    marginBottom: '20px',
    border: '1px solid #ccc',
    borderRadius: '5px',
  },
  button: {
    background: '#4CAF50',
    color: 'white',
    padding: '10px 15px',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  video: {
    width: '100%',
    height: 'auto',
    borderRadius: '5px',
    maxHeight: '480px',
    minHeight: '360px',
    backgroundColor: 'black',
    objectFit: 'contain' as const,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  qrCodeContainer: {
    marginTop: '20px',
  },
};

const ClimbSightApp = () => {
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [apeIndex, setApeIndex] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [holdColors, setHoldColors] = useState<string[]>([]);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [humanDetected, setHumanDetected] = useState(false);
  const [bodyPositionData, setBodyPositionData] = useState<any>(null);
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const [qrCodeImageUrl, setQrCodeImageUrl] = useState<string | null>(null);
  const [climbName, setClimbName] = useState('');
  const PoseRef = useRef<any>(null);
  
  // Add state for mediapipe loaded status
  const [mediapipeLoaded, setMediapipeLoaded] = useState(false);
  
  // New state variables for toggling camera and AI
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isAIEnabled, setIsAIEnabled] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  // Add state for analysis results
  const [analysisResults, setAnalysisResults] = useState<ClimbAnalysisResponse | null>(null);

  // Add new state for hold detection
  const [detectedHolds, setDetectedHolds] = useState<{x: number, y: number, color: string}[]>([]);
  const [isDetectingHolds, setIsDetectingHolds] = useState(false);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);

  // Add new state for loading climbs from QR codes
  const [loadedClimb, setLoadedClimb] = useState<any>(null);
  const [showClimbDetails, setShowClimbDetails] = useState(false);

  // Add state for camera session key
  const [cameraSessionKey, setCameraSessionKey] = useState(0);

  // Add camera instance reference
  const cameraInstanceRef = useRef<any>(null);

  // Add state for active tab
  const [activeTab, setActiveTab] = useState<'biometrics' | 'climb-definition' | 'session-recording' | 'analysis'>('biometrics');
  
  // Add state for advice panel
  const [showAdvicePanel, setShowAdvicePanel] = useState(false);
  const [adviceContent, setAdviceContent] = useState<string | null>(null);

  // Add state for comparison videos
  const [compareVideo1, setCompareVideo1] = useState<string | null>(null);
  const [compareVideo2, setCompareVideo2] = useState<string | null>(null);

  // Frame rate monitoring
  const [fps, setFps] = useState(0);
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const lastProcessedTimeRef = useRef(0);
  const skipFramesRef = useRef(0);
  
  // Body statistics for display
  const [poseStats, setPoseStats] = useState({
    leanAngle: 0,
    shoulderAngle: 0,
    hipAngle: 0,
    kneeAngle: 0,
    armExtension: 0,
    centerOfGravity: { x: 0, y: 0 }
  });

  // Movement tracking statistics
  const [movementStats, setMovementStats] = useState({
    leftHand: { direction: 0, speed: 0.0 },
    rightHand: { direction: 0, speed: 0.0 },
    leftFoot: { direction: 0, speed: 0.0 },
    rightFoot: { direction: 0, speed: 0.0 },
    bodyCenter: { direction: 0, speed: 0.0 }
  });
  
  // Store previous frame landmarks for movement calculation
  const prevLandmarksRef = useRef<any[]>([]);
  const lastUpdateTimeRef = useRef<number>(0);

  // Optimized camera settings
  const cameraSettings = useMemo(() => ({
    width: 480, // Reduced from 640
    height: 360, // Reduced from 480
    frameRate: { ideal: 60, min: 30 } // Request higher frame rate
  }), []);

  // Add state for comparison recording
  const [isRecordingComparison, setIsRecordingComparison] = useState(false);
  const [comparisonCameras, setComparisonCameras] = useState<{
    camera1: string | null;
    camera2: string | null;
  }>({ camera1: null, camera2: null });
  const comparisonRecorderRef = useRef<(() => void) | null>(null);
  const comparisonPreviewRef1 = useRef<HTMLVideoElement>(null);
  const comparisonPreviewRef2 = useRef<HTMLVideoElement>(null);

  // Add state for current recording mode
  const [recordingMode, setRecordingMode] = useState<'none' | 'first' | 'second'>('none');
  const singleCameraRecorderRef = useRef<MediaRecorder | null>(null);

  // Add state for comparison results
  const [comparisonResults, setComparisonResults] = useState<any>(null);
  const [showComparisonResults, setShowComparisonResults] = useState(false);

  // Add new refs for the canvas overlays
  const comparisonCanvasRef1 = useRef<HTMLCanvasElement>(null);
  const comparisonCanvasRef2 = useRef<HTMLCanvasElement>(null);
  
  // Add state to store pose data for videos
  const [video1PoseData, setVideo1PoseData] = useState<any>(null);
  const [video2PoseData, setVideo2PoseData] = useState<any>(null);

  // Add missing refs for high-performance skeleton rendering
  const video1FrameMapRef = useRef<Map<number, any>>(new Map());
  const video2FrameMapRef = useRef<Map<number, any>>(new Map());
  const lastRenderTimeRef = useRef<number>(0);
  const animationFrameIdRef = useRef<number>(0);

  // Load MediaPipe libraries dynamically
  useEffect(() => {
    const loadMediaPipeLibraries = async () => {
      try {
        console.log('Loading MediaPipe libraries...');
        
        // Helper function to load a script
        const loadScript = (src: string): Promise<void> => {
          return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
          });
        };
        
        // Load the MediaPipe libraries in order
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js');
        
        console.log('MediaPipe libraries loaded successfully', window.Pose, window.Camera);
        setMediapipeLoaded(true);
      } catch (error) {
        console.error('Error loading MediaPipe libraries:', error);
        toast({
          variant: 'destructive',
          title: 'Library Loading Failed',
          description: 'Failed to load required libraries. Please refresh the page and try again.',
        });
      }
    };
    
    loadMediaPipeLibraries();
  }, []);

  // Add effect to initialize camera when needed
  useEffect(() => {
    // Check if camera permissions are already granted
    navigator.mediaDevices.enumerateDevices()
      .then(devices => {
        const videoDevices = devices.filter(device => device.kind === 'videoinput' && device.deviceId && device.deviceId.trim() !== '');
        if (videoDevices.length > 0) {
          console.log("Available video devices:", videoDevices);
          setAvailableCameras(videoDevices);
          
          // If no camera is selected yet, use the first one
          if (!selectedCamera) {
            setSelectedCamera(videoDevices[0].deviceId);
          }
        }
      })
      .catch(err => {
        console.error("Error checking camera permissions:", err);
      });
    
    // Cleanup on unmount
    return () => {
      if (stream) {
        cleanupCamera(stream);
      }
    };
  }, []);

  // Add a useEffect to handle the video element when it's created
  useEffect(() => {
    if (isCameraOn && videoRef.current) {
      // Make sure the video element is visible
      videoRef.current.style.display = 'block';
      
      // If we already have a stream, reconnect it to the video element
      if (stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => {
          console.error('Error playing video on reconnect:', e);
        });
      }
    }
  }, [isCameraOn, cameraSessionKey]);

  // Handle QR code generation using our utility
  const generateQRCode = async () => {
    if (!climbName) {
      toast({
        variant: 'destructive',
        title: 'Climb Name Required',
        description: 'Please enter a name for the climb to generate a QR code.',
      });
      return;
    }

    try {
      const climberStats = {
        height: height || null,
        weight: weight || null,
        apeIndex: apeIndex || null
      };
      
      const qrCodeImageUrl = await generateQR(climbName, holdColors, detectedHolds, climberStats, image);
      setQrCodeImageUrl(qrCodeImageUrl);
      
      toast({
        title: 'QR Code Generated',
        description: `QR code for "${climbName}" contains ${detectedHolds.length} holds information.`,
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast({
        variant: 'destructive',
        title: 'QR Code Generation Failed',
        description: 'There was an error generating the QR code. Please try again.',
      });
    }
  };

  // Handle hold detection using our utility function
  const detectHolds = async () => {
    if (!image || holdColors.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Missing Data',
        description: 'Please upload an image and select at least one hold color.',
      });
      return;
    }
    
    setIsDetectingHolds(true);
    
    try {
      const holds = await detectClimbHolds(image, holdColors);
      setDetectedHolds(holds);
      
      toast({
        title: 'Holds Detected',
        description: `Found ${holds.length} potential holds matching the selected colors.`,
      });
    } catch (error) {
      console.error('Error detecting holds:', error);
      toast({
        variant: 'destructive',
        title: 'Hold Detection Failed',
        description: 'Failed to detect holds in the image. Please try again.',
      });
    } finally {
      setIsDetectingHolds(false);
    }
  };

  // Handle comparison recording start
  const startComparisonRecording = async () => {
    if (!comparisonCameras.camera1 || !comparisonCameras.camera2) {
      toast({
        variant: 'destructive',
        title: 'Camera Selection Required',
        description: 'Please select two different cameras for recording comparisons.',
      });
      return;
    }
    
    // Use medium quality settings for better performance
    const cameraSettings = getDefaultCameraSettings('medium');
    
    try {
      setIsRecordingComparison(true);
      
      // Start recording from both cameras
      const stopRecording = await recordComparisonVideos(
        comparisonCameras.camera1,
        comparisonCameras.camera2,
        cameraSettings,
        (stream1, stream2) => {
          // Set up preview for the recording streams
          if (comparisonPreviewRef1.current) {
            comparisonPreviewRef1.current.srcObject = stream1;
            comparisonPreviewRef1.current.play();
          }
          
          if (comparisonPreviewRef2.current) {
            comparisonPreviewRef2.current.srcObject = stream2;
            comparisonPreviewRef2.current.play();
          }
        },
        (url1, url2) => {
          // Recording finished, set the video URLs
          setCompareVideo1(url1);
          setCompareVideo2(url2);
          
          // Clear preview
          if (comparisonPreviewRef1.current) {
            comparisonPreviewRef1.current.srcObject = null;
          }
          
          if (comparisonPreviewRef2.current) {
            comparisonPreviewRef2.current.srcObject = null;
          }
          
          // Reset state
          setIsRecordingComparison(false);
          comparisonRecorderRef.current = null;
          
          toast({
            title: 'Recording Complete',
            description: 'Both climbing attempts have been recorded and are ready for comparison.',
          });
        }
      );
      
      // Store the stop function for later use
      comparisonRecorderRef.current = stopRecording;
      
      toast({
        title: 'Recording Started',
        description: 'Recording from both cameras. Click "Stop Recording" when finished.',
      });
    } catch (error) {
      console.error('Error starting comparison recording:', error);
      setIsRecordingComparison(false);
      
      toast({
        variant: 'destructive',
        title: 'Recording Failed',
        description: 'Failed to start recording. Please check camera permissions and try again.',
      });
    }
  };
  
  // Handle comparison recording stop
  const stopComparisonRecording = () => {
    if (comparisonRecorderRef.current) {
      comparisonRecorderRef.current();
      // The callback passed to recordComparisonVideos will handle the rest
    }
  };

  // Generate QR code with climb data
  const generateQR = async (
    climbName: string, 
    holdColors: string[], 
    detectedHolds: ClimbHold[], 
    climberStats: ClimberStats, 
    image?: string | null
  ): Promise<string> => {
    try {
      // Using the imported utility function but with proper type handling
      const qrCode = generateQRCode();
      
      // Build QR data manually as fallback since the import is having issues
      const qrData = {
        climbName,
        holdColors,
        detectedHolds,
        climberStats,
        timestamp: new Date().toISOString()
      };
      
      // Convert to JSON string
      const jsonData = JSON.stringify(qrData);
      
      // Create a QR code using an available library
      const qrCodeStyled = new QRCodeStyling({
        width: 300,
        height: 300,
        data: jsonData,
        dotsOptions: {
          color: "#000",
          type: "square"
        },
        cornersSquareOptions: {
          color: "#000",
          type: "square",
        },
        cornersDotOptions: {
          color: "#000",
        },
        backgroundOptions: {
          color: "#fff",
        }
      });
      
      // Convert to data URL
      return new Promise((resolve) => {
        qrCodeStyled.getRawData("png").then((blob) => {
          if (!blob) {
            resolve('');
            return;
          }
          
          // Handle different blob types - convert to standard Blob if needed
          const standardBlob = blob instanceof Blob ? blob : new Blob([blob as unknown as ArrayBuffer], { type: 'image/png' });
          
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
            } else {
              resolve('');
            }
          };
          reader.readAsDataURL(standardBlob);
        });
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      return '';
    }
  };

  // Detect climbing holds in an image
  const detectClimbHolds = async (image: string, holdColors: string[]): Promise<ClimbHold[]> => {
    try {
      // Using the imported utility function but with proper type handling
      detectHolds();
      
      // Since the import is having issues, implement a simple placeholder
      // This would simulate finding random holds for demo purposes
      const placeholderHolds: ClimbHold[] = [];
      
      // Create some random holds based on the colors
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        const img = new Image();
        img.src = image;
        
        await new Promise<void>((resolve) => {
          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            resolve();
          };
        });
        
        // Create random holds for each color
        for (const color of holdColors) {
          const numHolds = Math.floor(Math.random() * 5) + 2; // 2-7 holds per color
          
          for (let i = 0; i < numHolds; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            
            placeholderHolds.push({
              x,
              y,
              color
            });
          }
        }
      }
      
      return placeholderHolds;
    } catch (error) {
      console.error('Error detecting holds:', error);
      return [];
    }
  };

  // Handle QR code scan result
  const handleQRScan = (data: any) => {
    if (!data) return;

    try {
      const parsedData = parseQRCodeData(data);
      if (parsedData) {
        setLoadedClimb(parsedData);
        setShowClimbDetails(true);
        setClimbName(parsedData.climbName);
        setHoldColors(parsedData.holdColors);
        setDetectedHolds(parsedData.detectedHolds);
        
        // Set climber stats if available
        if (parsedData.climberStats) {
          if (parsedData.climberStats.height) setHeight(parsedData.climberStats.height);
          if (parsedData.climberStats.weight) setWeight(parsedData.climberStats.weight);
          if (parsedData.climberStats.apeIndex) setApeIndex(parsedData.climberStats.apeIndex);
        }
        
        toast({
          title: 'Climb Loaded',
          description: `Loaded climb: ${parsedData.climbName}`,
        });
      }
    } catch (error) {
      console.error('Error processing QR scan:', error);
      toast({
        variant: 'destructive',
        title: 'Invalid QR Code',
        description: 'The scanned QR code does not contain valid climb data.',
      });
    }
  };

  // Toggle holding color selection
  const toggleHoldColor = (color: string) => {
    setHoldColors(prev => 
      prev.includes(color) 
        ? prev.filter(c => c !== color) 
        : [...prev, color]
    );
  };

  // Handle image upload for climb definition
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImage(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle video upload for comparison
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>, videoNum: 1 | 2) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const videoUrl = URL.createObjectURL(file);
    
    if (videoNum === 1) {
      setCompareVideo1(videoUrl);
    } else {
      setCompareVideo2(videoUrl);
    }
    
    toast({
      title: 'Video Uploaded',
      description: `Video ${videoNum} uploaded successfully.`,
    });
  };

  // Handle camera selection change
  const handleCameraChange = (deviceId: string) => {
    setSelectedCamera(deviceId);
    
    // Restart camera with new device ID
    if (isCameraOn) {
      cleanupCamera(stream);
      setCameraSessionKey(prev => prev + 1);
    }
  };

  // Toggle camera on/off
  const toggleCamera = async () => {
    if (isCameraOn) {
      // Turn off camera
      cleanupCamera(stream);
      setIsCameraOn(false);
      setIsAIEnabled(false);
      setHumanDetected(false);
    } else {
      try {
        // Get available cameras
        const cameras = await getAvailableCameras();
        setAvailableCameras(cameras);
        
        console.log("Available cameras:", cameras);
        
        // Select the first camera if none is selected
        if (!selectedCamera && cameras.length > 0) {
          setSelectedCamera(cameras[0].deviceId);
        }
        
        // Setup camera with selected device ID or first available camera
        const deviceId = selectedCamera || (cameras.length > 0 ? cameras[0].deviceId : null);
        if (!deviceId) {
          throw new Error('No camera available');
        }
        
        console.log("Using camera with deviceId:", deviceId);
        
        // Force camera to use a direct getUserMedia call if needed
        if (!videoRef.current) {
          console.error("Video element not found!");
          throw new Error('Video element not available');
        }
        
        try {
          const constraints = {
            video: {
              deviceId: { exact: deviceId },
              width: { ideal: cameraSettings.width },
              height: { ideal: cameraSettings.height },
              frameRate: cameraSettings.frameRate
            }
          };
          
          console.log("Requesting camera with constraints:", constraints);
          
          // Direct getUserMedia call
          const videoStream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log("Camera stream acquired successfully via getUserMedia");
          
          // Set stream state
          setStream(videoStream);
          
          // Set up video element with the stream
          videoRef.current.srcObject = videoStream;
          videoRef.current.style.display = 'block'; // Ensure video is visible
          
          // Force re-render with different key to ensure video element is refreshed
          setCameraSessionKey(prev => prev + 1);
          
          // Make sure video element is visible
          if (videoRef.current.parentElement) {
            videoRef.current.parentElement.style.visibility = 'visible';
          }
          
          // Explicitly play the video
          try {
            await videoRef.current.play();
            console.log("Video playback started successfully");
          } catch (e) {
            console.error('Error playing video:', e);
            throw new Error('Failed to play video stream');
          }
          
          // Update state
          setIsCameraOn(true);
          setHasCameraPermission(true);
          
          // Set canvas dimensions to match video (after video has loaded)
          if (canvasRef.current) {
            videoRef.current.onloadedmetadata = () => {
              if (canvasRef.current && videoRef.current) {
                console.log(`Setting canvas dimensions from loadedmetadata: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
                canvasRef.current.width = videoRef.current.videoWidth || 640;
                canvasRef.current.height = videoRef.current.videoHeight || 480;
              }
            };
          }
        } catch (error) {
          console.error("Error with getUserMedia:", error);
          // Try the setupCamera utility as fallback
          const videoStream = await setupCamera(deviceId, cameraSettings);
          if (!videoStream) {
            throw new Error('Failed to access camera with either method');
          }
          setStream(videoStream);
          
          if (videoRef.current) {
            videoRef.current.srcObject = videoStream;
            videoRef.current.style.display = 'block';
            await videoRef.current.play();
            setIsCameraOn(true);
            setHasCameraPermission(true);
          }
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Failed',
          description: 'Failed to access the camera. Please check your permissions.',
        });
      }
    }
  };

  // Toggle AI detection on/off
  const toggleAI = async () => {
    if (isAIEnabled) {
      // Turn off AI
      setIsAIEnabled(false);
      setHumanDetected(false);
      
      // Clear pose detector
      if (PoseRef.current) {
        PoseRef.current.close();
        PoseRef.current = null;
      }
    } else {
      // Turn on AI if camera is on
      if (isCameraOn) {
        setIsAIEnabled(true);
        
        // Check if MediaPipe is loaded
        if (!mediapipeLoaded || !window.Pose) {
          console.error('MediaPipe libraries not loaded');
          toast({
            variant: 'destructive',
            title: 'AI Analysis Failed',
            description: 'Required libraries are not loaded. Please refresh the page and try again.',
          });
          setIsAIEnabled(false);
          return;
        }
        
        // Initialize pose detection
        try {
          console.log('Initializing Pose detection', window.Pose);
          
          // Use the global Pose constructor
          const pose = new window.Pose({
            locateFile: (file: string) => {
              return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
            }
          });
          
          pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
          });
          
          pose.onResults((results: any) => {
            if (!results || !results.poseLandmarks) return;
            
            // Update FPS calculation
            const now = performance.now();
            frameCountRef.current++;
            
            if (now - lastFrameTimeRef.current >= 1000) {
              setFps(Math.round(frameCountRef.current / ((now - lastFrameTimeRef.current) / 1000)));
              frameCountRef.current = 0;
              lastFrameTimeRef.current = now;
            }
            
            // Check if human is detected
            setHumanDetected(results.poseLandmarks.length > 0);
            
            // Store pose data for recording and analysis
            setBodyPositionData(results);
            
            // Calculate pose statistics
            if (results.poseLandmarks.length > 0) {
              // Calculate body angles
              const angles = calculateBodyAngles(results.poseLandmarks);
              
              // Get landmark references for arm extension
              const leftShoulder = results.poseLandmarks[11];
              const rightShoulder = results.poseLandmarks[12];
              const leftElbow = results.poseLandmarks[13];
              const rightElbow = results.poseLandmarks[14];
              const leftWrist = results.poseLandmarks[15];
              const rightWrist = results.poseLandmarks[16];
              
              // Calculate arm extension (average of both arms)
              const leftArmExtension = calculateExtension(leftShoulder, leftElbow, leftWrist);
              const rightArmExtension = calculateExtension(rightShoulder, rightElbow, rightWrist);
              const armExtension = (leftArmExtension + rightArmExtension) / 2;
              
              // Calculate center of gravity
              const cog = calculateCenterOfGravity(results.poseLandmarks);
              
              // Update pose stats
              setPoseStats({
                leanAngle: angles ? Math.round(angles.leanAngle) : 0,
                shoulderAngle: angles ? Math.round(angles.shoulderAngle) : 0,
                hipAngle: angles ? Math.round(angles.hipAngle) : 0,
                kneeAngle: angles ? Math.round(angles.kneeAngle) : 0,
                armExtension: Math.round(armExtension * 100) / 100,
                centerOfGravity: cog
              });
              
              // Calculate movement statistics
              if (prevLandmarksRef.current.length > 0 && now - lastUpdateTimeRef.current > 50) {
                const movementStatsRef = {
                  leftHand: { direction: 0, speed: 0 },
                  rightHand: { direction: 0, speed: 0 },
                  leftFoot: { direction: 0, speed: 0 },
                  rightFoot: { direction: 0, speed: 0 },
                  bodyCenter: { direction: 0, speed: 0 }
                };
                
                const movement = calculateMovement(
                  results.poseLandmarks,
                  prevLandmarksRef.current, 
                  now - lastUpdateTimeRef.current,
                  movementStatsRef
                );
                
                // Update movement stats with smoothing
                if (movement) {
                  setMovementStats(prev => ({
                    leftHand: {
                      direction: movement.leftHand.direction,
                      speed: smoothSpeed(prev.leftHand.speed, 0.2, movement.leftHand.speed)
                    },
                    rightHand: {
                      direction: movement.rightHand.direction,
                      speed: smoothSpeed(prev.rightHand.speed, 0.2, movement.rightHand.speed)
                    },
                    leftFoot: {
                      direction: movement.leftFoot.direction,
                      speed: smoothSpeed(prev.leftFoot.speed, 0.2, movement.leftFoot.speed)
                    },
                    rightFoot: {
                      direction: movement.rightFoot.direction,
                      speed: smoothSpeed(prev.rightFoot.speed, 0.2, movement.rightFoot.speed)
                    },
                    bodyCenter: {
                      direction: movement.bodyCenter.direction,
                      speed: smoothSpeed(prev.bodyCenter.speed, 0.2, movement.bodyCenter.speed)
                    }
                  }));
                }
                
                lastUpdateTimeRef.current = now;
              }
              
              // Store current landmarks for next frame comparison
              prevLandmarksRef.current = [...results.poseLandmarks];
            }
            
            // Draw pose on canvas
            if (canvasRef.current) {
              const ctx = canvasRef.current.getContext('2d');
              if (ctx) {
                // Clear canvas
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                
                // Draw skeleton - adjust params to match expected signature
                if (canvasRef.current) {
                  drawSkeleton(
                    ctx, 
                    results.poseLandmarks, 
                    canvasRef.current.width, 
                    canvasRef.current.height, 
                    '#00ff00'
                  );
                }
              }
            }
          });
          
          PoseRef.current = pose;
          
          // Initialize camera with the selected camera or the default one
          const cameraId = selectedCamera || availableCameras[0]?.deviceId;
          if (cameraId && videoRef.current) {
            console.log('Initializing Camera', window.Camera);
            
            const camera = new window.Camera(videoRef.current, {
              onFrame: async () => {
                if (videoRef.current && PoseRef.current) {
                  if (skipFramesRef.current > 0) {
                    skipFramesRef.current--;
                    return;
                  }
                  
                  const now = performance.now();
                  if (now - lastProcessedTimeRef.current < 25) { // Limit to ~40fps max
                    skipFramesRef.current = 1; // Skip next frame if processing too fast
                    return;
                  }
                  
                  try {
                    await PoseRef.current.send({image: videoRef.current});
                    lastProcessedTimeRef.current = now;
                  } catch (err) {
                    console.error('Error in pose processing:', err);
                  }
                }
              },
              width: cameraSettings.width,
              height: cameraSettings.height,
              facingMode: 'user'
            });
            
            try {
              await camera.start();
              cameraInstanceRef.current = camera;
            } catch (err) {
              console.error('Error starting camera:', err);
              toast({
                variant: 'destructive',
                title: 'Camera Start Failed',
                description: 'Failed to start camera for pose detection.',
              });
              setIsAIEnabled(false);
            }
          }
        } catch (error) {
          console.error('Error initializing pose detection:', error);
          toast({
            variant: 'destructive',
            title: 'AI Detection Failed',
            description: 'Failed to initialize pose detection. Please try again.',
          });
          setIsAIEnabled(false);
        }
      } else {
        // ... existing code to handle camera not being on ...
      }
    }
  };

  // Start recording climbing session
  const handleStartRecording = () => {
    if (!isCameraOn || !videoRef.current || !hasCameraPermission) {
      toast({
        variant: 'destructive',
        title: 'Camera Required',
        description: 'Please enable the camera before recording.',
      });
      return;
    }
    
    try {
      // Initialize MediaRecorder
      const stream = videoRef.current.srcObject as MediaStream;
      if (!stream) {
        throw new Error('No video stream available');
      }
      
      // Create media recorder with stream
      const recorder = createMediaRecorder(stream, {
        onDataAvailable: (data) => {
          setRecording(prev => [...prev, data]);
        },
        onStop: () => {
          // Combine recorded chunks into a single blob
          const recordedBlob = new Blob(recording, { type: 'video/webm' });
          
          // Create URL for the recorded video
          const videoUrl = URL.createObjectURL(recordedBlob);
          
          // Use the recorded video
          toast({
            title: 'Recording Complete',
            description: 'Your climbing session has been recorded.',
          });
        }
      });
      
      // Start recording
      if (recorder) {
        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        setRecording([]);
        
        toast({
          title: 'Recording Started',
          description: 'Recording your climbing session. Click "Stop Recording" when finished.',
        });
      } else {
        throw new Error('Failed to create media recorder');
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        variant: 'destructive',
        title: 'Recording Failed',
        description: 'Failed to start recording. Please try again.',
      });
    }
  };

  // Stop recording climbing session
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Analyze climbing using Gemini API
  const analyzeClimbing = async () => {
    if (!bodyPositionData || !isAIEnabled) {
      toast({
        variant: 'destructive',
        title: 'No Data Available',
        description: 'Enable AI analysis and ensure a person is detected before analyzing.',
      });
      return;
    }
    
    try {
      // Use pose and movement stats for analysis
      const analysisData = {
        poseStats,
        movementStats,
        bodyPositionData,
        climberStats: {
          height: height || 'unknown',
          weight: weight || 'unknown',
          apeIndex: apeIndex || 'unknown'
        }
      };
      
      // Call Gemini API to analyze the climbing data
      const results = await analyzeClimbingData(analysisData);
      
      // Update results state
      setAnalysisResults(results);
      
      // Show advice panel with results
      setAdviceContent(results.analysis);
      setShowAdvicePanel(true);
      
      // Scroll to analysis section
      scrollToSection('analysis');
      
      toast({
        title: 'Analysis Complete',
        description: 'Your climbing analysis is ready.',
      });
    } catch (error) {
      console.error('Error analyzing climbing:', error);
      toast({
        variant: 'destructive',
        title: 'Analysis Failed',
        description: 'Failed to analyze climbing data. Please try again.',
      });
    }
  };

  // Play both comparison videos with pose skeletons
  const playBothVideos = () => {
    const video1Element = document.getElementById('compare-video-1') as HTMLVideoElement;
    const video2Element = document.getElementById('compare-video-2') as HTMLVideoElement;
    
    if (video1Element && video2Element) {
      // Set up canvas contexts for drawing skeletons
      const setupSkeletonOverlays = () => {
        if (comparisonCanvasRef1.current && comparisonCanvasRef2.current) {
          // Initialize canvas sizes - use device pixel ratio for higher resolution
          const pixelRatio = window.devicePixelRatio || 1;
          
          // Set size for video 1 canvas
          comparisonCanvasRef1.current.width = (video1Element.videoWidth || video1Element.clientWidth) * pixelRatio;
          comparisonCanvasRef1.current.height = (video1Element.videoHeight || video1Element.clientHeight) * pixelRatio;
          comparisonCanvasRef1.current.style.width = `${video1Element.clientWidth}px`;
          comparisonCanvasRef1.current.style.height = `${video1Element.clientHeight}px`;
          
          // Set size for video 2 canvas
          comparisonCanvasRef2.current.width = (video2Element.videoWidth || video2Element.clientWidth) * pixelRatio;
          comparisonCanvasRef2.current.height = (video2Element.videoHeight || video2Element.clientHeight) * pixelRatio;
          comparisonCanvasRef2.current.style.width = `${video2Element.clientWidth}px`;
          comparisonCanvasRef2.current.style.height = `${video2Element.clientHeight}px`;
          
          // Get and configure canvas contexts
          const ctx1 = comparisonCanvasRef1.current.getContext('2d');
          const ctx2 = comparisonCanvasRef2.current.getContext('2d');
          
          if (ctx1 && ctx2) {
            // Scale contexts to account for device pixel ratio
            ctx1.scale(pixelRatio, pixelRatio);
            ctx2.scale(pixelRatio, pixelRatio);
            
            // Set rendering quality options
            ctx1.imageSmoothingEnabled = true;
            ctx1.imageSmoothingQuality = 'high';
            ctx1.lineWidth = 3;
            
            ctx2.imageSmoothingEnabled = true;
            ctx2.imageSmoothingQuality = 'high';
            ctx2.lineWidth = 3;
          }
        }
      };
      
      // Pre-process frames for faster lookup
      const preprocessPoseFrames = () => {
        if (!video1PoseData || !video2PoseData) return;
        
        // Create lookup maps indexed by timestamp (rounded to milliseconds)
        const frameMap1 = new Map();
        const frameMap2 = new Map();
        
        // Set up frame maps for fast lookup
        video1PoseData.frames.forEach((frame: any) => {
          const timeKey = Math.round(frame.timestamp * 1000);
          frameMap1.set(timeKey, frame);
        });
        
        video2PoseData.frames.forEach((frame: any) => {
          const timeKey = Math.round(frame.timestamp * 1000);
          frameMap2.set(timeKey, frame);
        });
        
        // Store in refs for quick access
        video1FrameMapRef.current = frameMap1;
        video2FrameMapRef.current = frameMap2;
      };
      
      // Get frame with interpolation for smoother animation
      const getInterpolatedFrame = (
        frameMap: Map<number, any>, 
        timestamp: number, 
        prevTimestamp: number, 
        nextTimestamp: number
      ) => {
        // Get the bounding frames
        const prevFrame = frameMap.get(prevTimestamp);
        const nextFrame = frameMap.get(nextTimestamp);
        
        if (!prevFrame || !nextFrame) return null;
        
        // Calculate interpolation factor (0 to 1)
        const timeRange = nextTimestamp - prevTimestamp;
        const current = Math.round(timestamp * 1000) - prevTimestamp;
        const factor = timeRange > 0 ? current / timeRange : 0;
        
        // Interpolate landmarks
        const interpolatedLandmarks = prevFrame.landmarks.map((prevLandmark: any, i: number) => {
          const nextLandmark = nextFrame.landmarks[i];
          
          // If either landmark is missing, use the available one
          if (!prevLandmark.visibility || prevLandmark.visibility < 0.5) return nextLandmark;
          if (!nextLandmark.visibility || nextLandmark.visibility < 0.5) return prevLandmark;
          
          // Linear interpolation between landmarks
          return {
            x: prevLandmark.x + (nextLandmark.x - prevLandmark.x) * factor,
            y: prevLandmark.y + (nextLandmark.y - prevLandmark.y) * factor,
            z: prevLandmark.z + (nextLandmark.z - prevLandmark.z) * factor,
            visibility: prevLandmark.visibility + (nextLandmark.visibility - prevLandmark.visibility) * factor
          };
        });
        
        return {
          timestamp,
          landmarks: interpolatedLandmarks
        };
      };
      
      // Get closest frame with interpolation
      const getInterpolatedPoseFrame = (frameMap: Map<number, any>, time: number) => {
        if (!frameMap || frameMap.size === 0) return null;
        
        const timeMs = Math.round(time * 1000);
        
        // Check if we have exact frame
        if (frameMap.has(timeMs)) {
          return frameMap.get(timeMs);
        }
        
        // Find closest frames before and after
        let prevTime = 0;
        let nextTime = Infinity;
        
        // Use Array.from() to convert Map keys to array for iteration
        Array.from(frameMap.keys()).forEach(timestamp => {
          if (timestamp <= timeMs && timestamp > prevTime) {
            prevTime = timestamp;
          }
          if (timestamp >= timeMs && timestamp < nextTime) {
            nextTime = timestamp;
          }
        });
        
        // If we're at the boundaries, use closest frame
        if (prevTime === 0) {
          const firstKey = Array.from(frameMap.keys())[0];
          return firstKey !== undefined ? frameMap.get(firstKey) : null;
        }
        
        if (nextTime === Infinity) {
          const keys = Array.from(frameMap.keys());
          const lastKey = keys[keys.length - 1];
          return lastKey !== undefined ? frameMap.get(lastKey) : null;
        }
        
        // Interpolate between frames
        return getInterpolatedFrame(frameMap, time, prevTime, nextTime);
      };
      
      // Draw skeletons during playback with high performance rendering
      const drawSkeletonsOnFrames = () => {
        const timestamp = performance.now();
        const deltaTime = timestamp - lastRenderTimeRef.current;
        
        // Limit updates to maintain high performance but with smooth rendering
        // Only update if deltaTime exceeds target frame time (60fps = ~16.7ms)
        if (deltaTime >= 16) {
          // Get current video times
          const currentTime1 = video1Element.currentTime;
          const currentTime2 = video2Element.currentTime;
          
          // Find pose data for current timestamps with interpolation
          if (video1FrameMapRef.current && video1FrameMapRef.current.size > 0) {
            const frame1 = getInterpolatedPoseFrame(video1FrameMapRef.current, currentTime1);
            
            if (frame1 && comparisonCanvasRef1.current) {
              const ctx1 = comparisonCanvasRef1.current.getContext('2d');
              if (ctx1) {
                // Clear with minimal area - just where the skeleton is
                ctx1.clearRect(0, 0, ctx1.canvas.width / window.devicePixelRatio, ctx1.canvas.height / window.devicePixelRatio);
                
                // Draw with enhanced quality
                drawSkeleton(
                  ctx1, 
                  frame1.landmarks, 
                  ctx1.canvas.width / window.devicePixelRatio, 
                  ctx1.canvas.height / window.devicePixelRatio, 
                  '#00ff00'  // Green for video 1
                );
              }
            }
          }
          
          if (video2FrameMapRef.current && video2FrameMapRef.current.size > 0) {
            const frame2 = getInterpolatedPoseFrame(video2FrameMapRef.current, currentTime2);
            
            if (frame2 && comparisonCanvasRef2.current) {
              const ctx2 = comparisonCanvasRef2.current.getContext('2d');
              if (ctx2) {
                // Clear with minimal area - just where the skeleton is
                ctx2.clearRect(0, 0, ctx2.canvas.width / window.devicePixelRatio, ctx2.canvas.height / window.devicePixelRatio);
                
                // Draw with enhanced quality
                drawSkeleton(
                  ctx2, 
                  frame2.landmarks, 
                  ctx2.canvas.width / window.devicePixelRatio, 
                  ctx2.canvas.height / window.devicePixelRatio, 
                  '#800080'  // Purple for video 2
                );
              }
            }
          }
          
          // Update last render time
          lastRenderTimeRef.current = timestamp;
        }
        
        // Continue animation loop
        animationFrameIdRef.current = requestAnimationFrame(drawSkeletonsOnFrames);
      };
      
      // Initialize skeleton drawing
      setupSkeletonOverlays();
      preprocessPoseFrames();
      
      // Cancel any existing animation frame
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      
      // Start high-performance animation frame loop
      lastRenderTimeRef.current = performance.now();
      animationFrameIdRef.current = requestAnimationFrame(drawSkeletonsOnFrames);
      
      // Start playing both videos
      playBothVideosUtil(video1Element, video2Element);
    }
  };

  // Pause both comparison videos
  const pauseBothVideos = () => {
    const video1Element = document.getElementById('compare-video-1') as HTMLVideoElement;
    const video2Element = document.getElementById('compare-video-2') as HTMLVideoElement;
    
    if (video1Element && video2Element) {
      pauseBothVideosUtil(video1Element, video2Element);
    }
  };

  // Scroll to a section
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setActiveTab(id as any);
  };

  // Record first comparison video
  const recordFirstVideo = async () => {
    if (!selectedCamera) {
      toast({
        variant: 'destructive',
        title: 'Camera Required',
        description: 'Please select a camera first.',
      });
      return;
    }

    try {
      // Clean up any existing streams
      if (stream) {
        cleanupCamera(stream);
      }

      // Get camera stream
      const cameraSettings = getDefaultCameraSettings('medium');
      const videoStream = await setupCamera(selectedCamera, cameraSettings);
      
      if (!videoStream) {
        throw new Error('Failed to access camera');
      }
      
      setStream(videoStream);
      
      // Show preview
      if (comparisonPreviewRef1.current) {
        comparisonPreviewRef1.current.srcObject = videoStream;
        comparisonPreviewRef1.current.play();
      }
      
      // Create recorder
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(videoStream, { mimeType: 'video/webm' });
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        // Create video from chunks
        const blob = new Blob(chunks, { type: 'video/webm' });
        const videoUrl = URL.createObjectURL(blob);
        
        // Set as first comparison video
        setCompareVideo1(videoUrl);
        
        // Clean up
        if (comparisonPreviewRef1.current) {
          comparisonPreviewRef1.current.srcObject = null;
        }
        
        cleanupCamera(videoStream);
        setStream(null);
        setRecordingMode('none');
        
        toast({
          title: 'First Video Recorded',
          description: 'First comparison video recorded successfully. You can now record the second video.',
        });
      };
      
      // Start recording
      recorder.start();
      singleCameraRecorderRef.current = recorder;
      setRecordingMode('first');
      
      toast({
        title: 'Recording First Video',
        description: 'Recording first comparison video. Click "Stop Recording" when finished.',
      });
    } catch (error) {
      console.error('Error recording first video:', error);
      setRecordingMode('none');
      
      toast({
        variant: 'destructive',
        title: 'Recording Failed',
        description: 'Failed to start recording. Please check camera permissions and try again.',
      });
    }
  };
  
  // Record second comparison video
  const recordSecondVideo = async () => {
    if (!selectedCamera) {
      toast({
        variant: 'destructive',
        title: 'Camera Required',
        description: 'Please select a camera first.',
      });
      return;
    }

    try {
      // Clean up any existing streams
      if (stream) {
        cleanupCamera(stream);
      }

      // Get camera stream
      const cameraSettings = getDefaultCameraSettings('medium');
      const videoStream = await setupCamera(selectedCamera, cameraSettings);
      
      if (!videoStream) {
        throw new Error('Failed to access camera');
      }
      
      setStream(videoStream);
      
      // Show preview
      if (comparisonPreviewRef2.current) {
        comparisonPreviewRef2.current.srcObject = videoStream;
        comparisonPreviewRef2.current.play();
      }
      
      // Create recorder
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(videoStream, { mimeType: 'video/webm' });
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        // Create video from chunks
        const blob = new Blob(chunks, { type: 'video/webm' });
        const videoUrl = URL.createObjectURL(blob);
        
        // Set as second comparison video
        setCompareVideo2(videoUrl);
        
        // Clean up
        if (comparisonPreviewRef2.current) {
          comparisonPreviewRef2.current.srcObject = null;
        }
        
        cleanupCamera(videoStream);
        setStream(null);
        setRecordingMode('none');
        
        toast({
          title: 'Second Video Recorded',
          description: 'Second comparison video recorded successfully. You can now compare the videos.',
        });
        
        // Scroll to comparison section
        scrollToSection('compare');
      };
      
      // Start recording
      recorder.start();
      singleCameraRecorderRef.current = recorder;
      setRecordingMode('second');
      
      toast({
        title: 'Recording Second Video',
        description: 'Recording second comparison video. Click "Stop Recording" when finished.',
      });
    } catch (error) {
      console.error('Error recording second video:', error);
      setRecordingMode('none');
      
      toast({
        variant: 'destructive',
        title: 'Recording Failed',
        description: 'Failed to start recording. Please check camera permissions and try again.',
      });
    }
  };
  
  // Stop current recording
  const stopCurrentRecording = () => {
    if (singleCameraRecorderRef.current) {
      singleCameraRecorderRef.current.stop();
      singleCameraRecorderRef.current = null;
    }
  };

  // Compare both climbing recordings
  const compareClimbingRecordings = async () => {
    if (!compareVideo1 || !compareVideo2) {
      toast({
        variant: 'destructive',
        title: 'Videos Required',
        description: 'Please record or upload both climbing videos first.',
      });
      return;
    }
    
    toast({
      title: 'Starting Analysis',
      description: 'Preparing for detailed pose detection...',
      duration: 3000,
    });
    
    try {
      const video1Element = document.getElementById('compare-video-1') as HTMLVideoElement;
      const video2Element = document.getElementById('compare-video-2') as HTMLVideoElement;
      
      if (!video1Element || !video2Element) {
        throw new Error('Video elements not found');
      }
      
      // Create a loading toast that we'll update with progress
      const loadingToastId = toast({
        title: 'Processing Videos',
        description: 'Phase 1/4: Analyzing video frames (0%)',
        duration: 120000, // 2 minutes - longer timeout for thorough processing
      });
      
      // Create consolidated options object with ultra-high quality settings
      const videoOptions = {
        width: 1920, // Full HD for maximum detail
        height: 1080,
        frameRate: 60,
        modelOptions: {
          modelComplexity: 2,  // Highest quality model
          smoothLandmarks: true,
          enableSmoothing: true,
          minPoseConfidence: 0.75, // Higher confidence threshold
          minTrackingConfidence: 0.75,
          sampleRate: 60,
          // Allow more processing time for better results
          detectionTimeoutMs: 20000 // 20 seconds per detection if needed
        }
      };
      
      // Set up progress tracking
      let currentPhase = 1;
      let phaseProgress = 0;
      
      const updateProgress = (phase: number, progress: number, message?: string) => {
        currentPhase = phase;
        phaseProgress = progress;
        toast({
          id: loadingToastId,
          title: 'Processing Videos',
          description: `Phase ${phase}/4: ${message || 'Processing...'} (${Math.round(progress)}%)`,
          duration: 120000,
        });
      };
      
      // Process videos with progress updates
      updateProgress(1, 0, 'Initializing pose detection model');
      
      // First video processing with progress tracking
      const processWithProgress = async (video: HTMLVideoElement, label: string, phaseNum: number) => {
        return new Promise<any>((resolve, reject) => {
          const startTime = performance.now();
          let lastUpdateTime = startTime;
          
          const onProgress = (progress: number) => {
            const currentTime = performance.now();
            // Only update UI every 1 second to avoid excessive re-renders
            if (currentTime - lastUpdateTime > 1000) {
              updateProgress(phaseNum, progress, `Analyzing ${label} frames`);
              lastUpdateTime = currentTime;
            }
          };
          
          processVideo(
            video, 
            videoOptions,
            label,
            undefined,
            onProgress
          ).then(resolve).catch(reject);
        });
      };
      
      // Process both videos with progress tracking
      updateProgress(2, 0, 'Starting second video analysis');
      const video1Data = await processWithProgress(video1Element, 'Video 1', 1);
      updateProgress(2, 0, 'Starting second video analysis');
      const video2Data = await processWithProgress(video2Element, 'Video 2', 2);
      
      // Perform enhanced post-processing with progress updates
      updateProgress(3, 0, 'Applying anatomical constraints and smoothing');
      
      // Apply deep post-processing to improve skeleton alignment and stability
      const enhancePoseData = (poseData: any, progressCallback: (progress: number) => void) => {
        if (!poseData || !poseData.frames || poseData.frames.length === 0) return poseData;
        
        const totalFrames = poseData.frames.length;
        let processedFrames = 0;
        
        // Enhanced processing settings for higher quality
        const smoothingWindowSize = 7; // Larger window for smoother results
        
        // Define body part connections for anatomy constraints
        const bodyConnections = [
          [11, 12], // shoulders
          [12, 24], [11, 23], // shoulders to hips
          [23, 24], // hips
          [11, 13], [13, 15], // left arm
          [12, 14], [14, 16], // right arm
          [23, 25], [25, 27], // left leg
          [24, 26], [26, 28]  // right leg
        ];
        
        // First pass: Calculate average body proportions across all high-confidence frames
        progressCallback(5); // 5% progress
        
        const highConfidenceFrames = poseData.frames.filter((frame: any) => {
          if (!frame.landmarks) return false;
          const visibleLandmarks = frame.landmarks.filter((lm: any) => lm && lm.visibility > 0.8);
          return visibleLandmarks.length > 20; // At least 20 high confidence landmarks
        });
        
        // Calculate average body proportions from high confidence frames
        const avgBodyProps: {[key: string]: number} = {};
        
        if (highConfidenceFrames.length > 0) {
          // Calculate average distance between connected landmarks
          bodyConnections.forEach(([i, j]) => {
            const connectionKey = `${i}-${j}`;
            let totalDist = 0;
            let count = 0;
            
            highConfidenceFrames.forEach((frame: any) => {
              const landmarkI = frame.landmarks[i];
              const landmarkJ = frame.landmarks[j];
              
              if (landmarkI && landmarkJ && 
                  landmarkI.visibility > 0.8 && 
                  landmarkJ.visibility > 0.8) {
                const dist = Math.sqrt(
                  Math.pow(landmarkI.x - landmarkJ.x, 2) + 
                  Math.pow(landmarkI.y - landmarkJ.y, 2)
                );
                totalDist += dist;
                count++;
              }
            });
            
            if (count > 0) {
              avgBodyProps[connectionKey] = totalDist / count;
            }
          });
        }
        
        progressCallback(10); // 10% progress
        
        // Process each frame with smoothing and anatomical constraints
        const smoothedFrames = [];
        
        for (let i = 0; i < poseData.frames.length; i++) {
          const currentFrame = poseData.frames[i];
          processedFrames++;
          
          // Update progress every few frames
          if (processedFrames % 10 === 0) {
            progressCallback(10 + Math.round((processedFrames / totalFrames) * 70));
          }
          
          if (!currentFrame.landmarks || currentFrame.landmarks.length === 0) {
            smoothedFrames.push(currentFrame);
            continue;
          }
          
          // Temporal smoothing with weighted window
          const framesToSmooth: Array<{landmarks: Array<{x: number, y: number, z: number, visibility: number}>}> = [];
          
          // Collect frames in smoothing window
          for (let j = Math.max(0, i - smoothingWindowSize); j <= Math.min(poseData.frames.length - 1, i + smoothingWindowSize); j++) {
            if (poseData.frames[j].landmarks && poseData.frames[j].landmarks.length > 0) {
              framesToSmooth.push(poseData.frames[j]);
            }
          }
          
          if (framesToSmooth.length <= 1) {
            smoothedFrames.push(currentFrame);
            continue;
          }
          
          // Apply weighted temporal filtering
          const smoothedLandmarks = currentFrame.landmarks.map((landmark: any, landmarkIndex: number) => {
            if (!landmark || !landmark.visibility || landmark.visibility < 0.2) return landmark;
            
            // Get corresponding landmarks from other frames
            const correspondingLandmarks = framesToSmooth
              .map(frame => frame.landmarks[landmarkIndex])
              .filter(lm => lm && lm.visibility && lm.visibility >= 0.2);
            
            if (correspondingLandmarks.length <= 1) return landmark;
            
            // Weighted average based on frame distance and confidence
            let totalX = 0, totalY = 0, totalZ = 0, totalVisibility = 0;
            let totalWeight = 0;
            
            correspondingLandmarks.forEach((lm, idx) => {
              // Higher weight for frames closer to current frame
              const frameDistance = Math.abs(idx - Math.floor(framesToSmooth.length / 2));
              const temporalWeight = Math.pow(0.9, frameDistance); // Exponential falloff
              
              // Combined weight based on temporal position and confidence
              const weight = temporalWeight * Math.pow(lm.visibility, 0.5);
              
              totalX += lm.x * weight;
              totalY += lm.y * weight;
              totalZ += lm.z * weight;
              totalVisibility += lm.visibility * weight;
              totalWeight += weight;
            });
            
            // Weighted average
            const avgX = totalWeight > 0 ? totalX / totalWeight : landmark.x;
            const avgY = totalWeight > 0 ? totalY / totalWeight : landmark.y;
            const avgZ = totalWeight > 0 ? totalZ / totalWeight : landmark.z;
            const avgVisibility = totalWeight > 0 ? totalVisibility / totalWeight : landmark.visibility;
            
            // Apply confidence-based smoothing strength
            const smoothingStrength = 0.3 + (0.6 * (1 - Math.min(landmark.visibility, 0.95)));
            
            // Apply smoothing
            return {
              x: landmark.x * (1 - smoothingStrength) + avgX * smoothingStrength,
              y: landmark.y * (1 - smoothingStrength) + avgY * smoothingStrength,
              z: landmark.z * (1 - smoothingStrength) + avgZ * smoothingStrength,
              visibility: Math.min(avgVisibility * 1.05, 1.0) // Slight boost to visibility
            };
          });
          
          // Calculate body center with torso weighting
          let centerX = 0, centerY = 0, totalWeight = 0;
          
          // Important landmarks for body center (torso)
          const torsoLandmarks = [11, 12, 23, 24]; 
          
          for (let idx = 0; idx < smoothedLandmarks.length; idx++) {
            const lm = smoothedLandmarks[idx];
            if (!lm || lm.visibility < 0.5) continue;
            
            // Higher weight for torso landmarks
            const weight = torsoLandmarks.includes(idx) ? 2.5 : 0.5;
            
            centerX += lm.x * weight;
            centerY += lm.y * weight;
            totalWeight += weight;
          }
          
          if (totalWeight > 0) {
            centerX /= totalWeight;
            centerY /= totalWeight;
          } else {
            centerX = 0.5;
            centerY = 0.5;
          }
          
          // Apply anatomical constraints
          const anatomyConstrainedLandmarks = [...smoothedLandmarks];
          
          // Apply known body proportions from high confidence frames
          if (Object.keys(avgBodyProps).length > 0) {
            bodyConnections.forEach(([i, j]) => {
              const landmarkI = anatomyConstrainedLandmarks[i];
              const landmarkJ = anatomyConstrainedLandmarks[j];
              const connectionKey = `${i}-${j}`;
              
              if (landmarkI && landmarkJ && 
                  landmarkI.visibility > 0.5 && 
                  landmarkJ.visibility > 0.5 && 
                  avgBodyProps[connectionKey]) {
                
                // Current distance between landmarks
                const currentDist = Math.sqrt(
                  Math.pow(landmarkI.x - landmarkJ.x, 2) + 
                  Math.pow(landmarkI.y - landmarkJ.y, 2)
                );
                
                // Expected distance based on average proportions
                const expectedDist = avgBodyProps[connectionKey];
                
                // If current distance deviates significantly from expected
                if (Math.abs(currentDist - expectedDist) > expectedDist * 0.3) {
                  // Calculate direction vector
                  const dirX = landmarkJ.x - landmarkI.x;
                  const dirY = landmarkJ.y - landmarkI.y;
                  const dirLen = Math.sqrt(dirX * dirX + dirY * dirY);
                  
                  if (dirLen > 0) {
                    const normDirX = dirX / dirLen;
                    const normDirY = dirY / dirLen;
                    
                    // Lower confidence landmark gets stronger correction
                    const iConfidence = landmarkI.visibility;
                    const jConfidence = landmarkJ.visibility;
                    
                    // Apply more correction to the lower confidence point
                    if (iConfidence < jConfidence) {
                      anatomyConstrainedLandmarks[i] = {
                        ...landmarkI,
                        x: landmarkJ.x - normDirX * expectedDist,
                        y: landmarkJ.y - normDirY * expectedDist
                      };
                    } else {
                      anatomyConstrainedLandmarks[j] = {
                        ...landmarkJ,
                        x: landmarkI.x + normDirX * expectedDist,
                        y: landmarkI.y + normDirY * expectedDist
                      };
                    }
                  }
                }
              }
            });
          }
          
          // Enforce distance from center constraints for outliers
          const finalLandmarks = anatomyConstrainedLandmarks.map((lm: any, idx: number) => {
            if (!lm || lm.visibility < 0.3) return lm;
            
            // Different max expected distances based on body part
            let maxExpectedDistance = 0.35;
            
            // Extremities can be further from center
            if ([15, 16, 17, 18, 19, 20, 27, 28, 29, 30, 31, 32].includes(idx)) {
              maxExpectedDistance = 0.5;
            }
            
            // Calculate distance from center
            const distanceFromCenter = Math.sqrt(Math.pow(lm.x - centerX, 2) + Math.pow(lm.y - centerY, 2));
            
            // Apply correction for clear outliers with low confidence
            if (distanceFromCenter > maxExpectedDistance && lm.visibility < 0.85) {
              // Correction strength based on how far and how uncertain
              const correctionFactor = Math.min(0.6, (distanceFromCenter - maxExpectedDistance) / maxExpectedDistance) * 
                                       (1 - lm.visibility * 0.8);
              
              return {
                ...lm,
                x: lm.x + (centerX - lm.x) * correctionFactor,
                y: lm.y + (centerY - lm.y) * correctionFactor,
                visibility: Math.min(lm.visibility, 0.9) // Cap visibility for corrected points
              };
            }
            
            return lm;
          });
          
          smoothedFrames.push({
            ...currentFrame,
            landmarks: finalLandmarks
          });
        }
        
        progressCallback(80); // 80% progress
        
        // Apply temporal coherence and jitter removal
        const coherentFrames = [...smoothedFrames];
        
        // Forward pass for motion constraints
        for (let i = 1; i < coherentFrames.length; i++) {
          if (i % 10 === 0) {
            progressCallback(80 + Math.round((i / coherentFrames.length) * 15));
          }
          
          const prevFrame = coherentFrames[i-1];
          const currentFrame = coherentFrames[i];
          
          if (!currentFrame.landmarks || !prevFrame.landmarks) continue;
          
          for (let j = 0; j < currentFrame.landmarks.length; j++) {
            const prevLm = prevFrame.landmarks[j];
            const currentLm = currentFrame.landmarks[j];
            
            if (!prevLm || !currentLm || prevLm.visibility < 0.3 || currentLm.visibility < 0.3) continue;
            
            // Calculate maximum allowed movement based on visibility
            const maxAllowedMovement = 0.04 * (0.5 + currentLm.visibility);
            
            // Current movement amount
            const movement = Math.sqrt(
              Math.pow(currentLm.x - prevLm.x, 2) + 
              Math.pow(currentLm.y - prevLm.y, 2)
            );
            
            // Constrain excessive movement
            if (movement > maxAllowedMovement) {
              const scale = maxAllowedMovement / movement;
              coherentFrames[i].landmarks[j] = {
                ...currentLm,
                x: prevLm.x + (currentLm.x - prevLm.x) * scale,
                y: prevLm.y + (currentLm.y - prevLm.y) * scale,
                z: prevLm.z + (currentLm.z - prevLm.z) * scale,
              };
            }
          }
        }
        
        progressCallback(95); // 95% progress
        
        // Final pass - remove transient jitter
        // Use a 3-frame median filter for jump removal
        for (let i = 1; i < coherentFrames.length - 1; i++) {
          const prevFrame = coherentFrames[i-1];
          const currentFrame = coherentFrames[i];
          const nextFrame = coherentFrames[i+1];
          
          if (!prevFrame.landmarks || !currentFrame.landmarks || !nextFrame.landmarks) continue;
          
          for (let j = 0; j < currentFrame.landmarks.length; j++) {
            const prevLm = prevFrame.landmarks[j];
            const currentLm = currentFrame.landmarks[j];
            const nextLm = nextFrame.landmarks[j];
            
            if (!prevLm || !currentLm || !nextLm || 
                prevLm.visibility < 0.5 || currentLm.visibility < 0.5 || nextLm.visibility < 0.5) continue;
            
            // Calculate distances between consecutive points
            const d1 = Math.sqrt(Math.pow(currentLm.x - prevLm.x, 2) + Math.pow(currentLm.y - prevLm.y, 2));
            const d2 = Math.sqrt(Math.pow(nextLm.x - currentLm.x, 2) + Math.pow(nextLm.y - currentLm.y, 2));
            const d3 = Math.sqrt(Math.pow(nextLm.x - prevLm.x, 2) + Math.pow(nextLm.y - prevLm.y, 2));
            
            // Check for sudden direction change (jitter)
            if (d1 + d2 > d3 * 1.8) {
              // Replace with median point
              const xs = [prevLm.x, currentLm.x, nextLm.x].sort();
              const ys = [prevLm.y, currentLm.y, nextLm.y].sort();
              const zs = [prevLm.z, currentLm.z, nextLm.z].sort();
              
              coherentFrames[i].landmarks[j] = {
                ...currentLm,
                x: xs[1], // median x
                y: ys[1], // median y
                z: zs[1]  // median z
              };
            }
          }
        }
        
        progressCallback(100); // 100% complete
        
        return {
          ...poseData,
          frames: coherentFrames
        };
      };
      
      // Process each video with progress updates for different phases
      const enhancedVideo1Data = await new Promise<any>((resolve) => {
        let lastProgress = 0;
        const onProgress = (progress: number) => {
          if (progress - lastProgress >= 5) { // Update UI every 5% to avoid excessive updates
            updateProgress(3, progress, 'Enhancing Video 1 skeleton tracking');
            lastProgress = progress;
          }
        };
        
        const enhanced = enhancePoseData(video1Data, onProgress);
        resolve(enhanced);
      });
      
      updateProgress(4, 0, 'Enhancing Video 2 skeleton tracking');
      
      const enhancedVideo2Data = await new Promise<any>((resolve) => {
        let lastProgress = 0;
        const onProgress = (progress: number) => {
          if (progress - lastProgress >= 5) {
            updateProgress(4, progress, 'Enhancing Video 2 skeleton tracking');
            lastProgress = progress;
          }
        };
        
        const enhanced = enhancePoseData(video2Data, onProgress);
        resolve(enhanced);
      });
      
      // Store enhanced pose data
      setVideo1PoseData(enhancedVideo1Data);
      setVideo2PoseData(enhancedVideo2Data);
      
      // Set up optimized frame maps for fast lookup
      const frameMap1 = new Map();
      const frameMap2 = new Map();
      
      enhancedVideo1Data.frames.forEach((frame: any) => {
        const timeKey = Math.round(frame.timestamp * 1000);
        frameMap1.set(timeKey, frame);
      });
      
      enhancedVideo2Data.frames.forEach((frame: any) => {
        const timeKey = Math.round(frame.timestamp * 1000);
        frameMap2.set(timeKey, frame);
      });
      
      video1FrameMapRef.current = frameMap1;
      video2FrameMapRef.current = frameMap2;
      
      // Compare the climbing attempts with enhanced data
      updateProgress(4, 100, 'Finalizing comparison results');
      const comparisonResults = await compareClimbingAttempts(enhancedVideo1Data, enhancedVideo2Data);
      
      // Display results
      setComparisonResults(comparisonResults);
      setShowComparisonResults(true);
      
      // Ensure the canvas elements are created and visible with high resolution
      if (comparisonCanvasRef1.current && comparisonCanvasRef2.current) {
        // Use device pixel ratio for higher resolution rendering
        const pixelRatio = window.devicePixelRatio || 1;
        
        // Force canvases to be visible
        comparisonCanvasRef1.current.style.display = 'block';
        comparisonCanvasRef2.current.style.display = 'block';
        comparisonCanvasRef1.current.style.pointerEvents = 'none';
        comparisonCanvasRef2.current.style.pointerEvents = 'none';
        
        // Set dimensions with high resolution scaling
        comparisonCanvasRef1.current.width = (video1Element.videoWidth || video1Element.clientWidth) * pixelRatio;
        comparisonCanvasRef1.current.height = (video1Element.videoHeight || video1Element.clientHeight) * pixelRatio;
        comparisonCanvasRef1.current.style.width = `${video1Element.clientWidth}px`;
        comparisonCanvasRef1.current.style.height = `${video1Element.clientHeight}px`;
        
        comparisonCanvasRef2.current.width = (video2Element.videoWidth || video2Element.clientWidth) * pixelRatio;
        comparisonCanvasRef2.current.height = (video2Element.videoHeight || video2Element.clientHeight) * pixelRatio;
        comparisonCanvasRef2.current.style.width = `${video2Element.clientWidth}px`;
        comparisonCanvasRef2.current.style.height = `${video2Element.clientHeight}px`;
        
        // Get and configure canvas contexts
        const ctx1 = comparisonCanvasRef1.current.getContext('2d', { willReadFrequently: true });
        const ctx2 = comparisonCanvasRef2.current.getContext('2d', { willReadFrequently: true });
        
        if (ctx1 && ctx2) {
          // Scale contexts to account for device pixel ratio
          ctx1.scale(pixelRatio, pixelRatio);
          ctx2.scale(pixelRatio, pixelRatio);
          
          // Set rendering quality options
          ctx1.imageSmoothingEnabled = true;
          ctx1.imageSmoothingQuality = 'high';
          ctx1.lineWidth = 5; // Thicker lines for better visibility
          
          ctx2.imageSmoothingEnabled = true;
          ctx2.imageSmoothingQuality = 'high';
          ctx2.lineWidth = 5; // Thicker lines for better visibility
        }
      }
      
      // Update UI with completion
      toast({
        id: loadingToastId,
        title: 'Processing Complete',
        description: 'Ultra high-quality pose analysis is ready for viewing.',
        duration: 5000,
      });
      
      // Also show a success toast
      toast({
        title: 'Analysis Complete',
        description: 'Ultra high-precision pose tracking is ready. The skeletons are now accurately aligned with the climbers.',
        duration: 5000,
      });
      
    } catch (error) {
      console.error('Error comparing climbing recordings:', error);
      toast({
        variant: 'destructive',
        title: 'Comparison Failed',
        description: 'Failed to compare the climbing videos. Please try again.',
      });
    }
  };

  // Define an enhanced skeleton drawing function
  const drawSkeleton = (
    ctx: CanvasRenderingContext2D,
    landmarks: any[],
    width: number,
    height: number,
    color: string
  ) => {
    if (!landmarks || landmarks.length === 0) return;
    
    // Define connections between landmarks to draw skeleton lines
    const connections = [
      // Torso
      [11, 12], // Shoulders
      [11, 23], // Left shoulder to left hip
      [12, 24], // Right shoulder to right hip
      [23, 24], // Hips
      
      // Arms
      [11, 13], // Left shoulder to left elbow
      [13, 15], // Left elbow to left wrist
      [12, 14], // Right shoulder to right elbow
      [14, 16], // Right elbow to right wrist
      
      // Legs
      [23, 25], // Left hip to left knee
      [25, 27], // Left knee to left ankle
      [24, 26], // Right hip to right knee
      [26, 28], // Right knee to right ankle
      
      // Face connections
      [0, 1], [1, 2], [2, 3], [3, 7], 
      [0, 4], [4, 5], [5, 6], [6, 8],
      [9, 10] // Eyes
    ];
    
    // Set drawing styles
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    // Draw connections to form the skeleton
    for (const [i, j] of connections) {
      const landmarkI = landmarks[i];
      const landmarkJ = landmarks[j];
      
      // Check if both landmarks exist and are visible
      if (landmarkI && landmarkJ && 
          landmarkI.visibility > 0.5 && 
          landmarkJ.visibility > 0.5) {
        
        // Convert normalized coordinates to pixel coordinates
        const x1 = landmarkI.x * width;
        const y1 = landmarkI.y * height;
        const x2 = landmarkJ.x * width;
        const y2 = landmarkJ.y * height;
        
        // Draw line
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
    
    // Draw keypoints as circles
    ctx.fillStyle = color;
    for (const landmark of landmarks) {
      // Only draw visible landmarks
      if (landmark.visibility > 0.7) {
        const x = landmark.x * width;
        const y = landmark.y * height;
        
        // Draw a filled circle
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  };

  // Ensure video elements redraw skeletons on timeupdate
  useEffect(() => {
    if (compareVideo1 && compareVideo2 && video1PoseData && video2PoseData) {
      const video1Element = document.getElementById('compare-video-1') as HTMLVideoElement;
      const video2Element = document.getElementById('compare-video-2') as HTMLVideoElement;
      
      // Set up event listeners for videos seeking
      const handleTimeUpdate1 = () => {
        if (comparisonCanvasRef1.current && video1PoseData?.frames) {
          const ctx1 = comparisonCanvasRef1.current.getContext('2d');
          const frame1 = getClosestFrame(video1PoseData.frames, video1Element.currentTime);
          
          if (ctx1 && frame1) {
            ctx1.clearRect(0, 0, comparisonCanvasRef1.current.width, comparisonCanvasRef1.current.height);
            drawSkeleton(
              ctx1, 
              frame1.landmarks, 
              comparisonCanvasRef1.current.width, 
              comparisonCanvasRef1.current.height, 
              '#00ff00'  // Green for video 1
            );
          }
        }
      };
      
      const handleTimeUpdate2 = () => {
        if (comparisonCanvasRef2.current && video2PoseData?.frames) {
          const ctx2 = comparisonCanvasRef2.current.getContext('2d');
          const frame2 = getClosestFrame(video2PoseData.frames, video2Element.currentTime);
          
          if (ctx2 && frame2) {
            ctx2.clearRect(0, 0, comparisonCanvasRef2.current.width, comparisonCanvasRef2.current.height);
            drawSkeleton(
              ctx2, 
              frame2.landmarks, 
              comparisonCanvasRef2.current.width, 
              comparisonCanvasRef2.current.height, 
              '#800080'  // Purple for video 2
            );
          }
        }
      };
      
      // Set up event listeners
      if (video1Element) {
        video1Element.addEventListener('timeupdate', handleTimeUpdate1);
        video1Element.addEventListener('seeking', handleTimeUpdate1);
      }
      
      if (video2Element) {
        video2Element.addEventListener('timeupdate', handleTimeUpdate2);
        video2Element.addEventListener('seeking', handleTimeUpdate2);
      }
      
      // Initial draw
      handleTimeUpdate1();
      handleTimeUpdate2();
      
      // Clean up
      return () => {
        if (video1Element) {
          video1Element.removeEventListener('timeupdate', handleTimeUpdate1);
          video1Element.removeEventListener('seeking', handleTimeUpdate1);
        }
        
        if (video2Element) {
          video2Element.removeEventListener('timeupdate', handleTimeUpdate2);
          video2Element.removeEventListener('seeking', handleTimeUpdate2);
        }
      };
    }
  }, [compareVideo1, compareVideo2, video1PoseData, video2PoseData]);

  // Clean up animation frames on unmount
  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, []);

  return (
    <SidebarProvider>
      
        <div className="flex h-screen">
          <Sidebar collapsible="icon">
            <SidebarHeader>
              ClimbSight
            </SidebarHeader>
            <SidebarContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => scrollToSection('biometrics')}>
                    Biometric Data Input
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => scrollToSection('climb-definition')}>
                    Climb Definition
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => scrollToSection('session-recording')}>
                    Climbing Session Recording
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => scrollToSection('compare')}>
                    Compare Climbs
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => scrollToSection('analysis')}>
                    Performance Analysis
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarContent>
          </Sidebar>
          
          <main className="flex-1 p-6 overflow-y-auto relative">
            {/* Biometric Data Input Section */}
            <section id="biometrics" className="mb-8">
              <Card>
                <CardHeader>
                  <CardTitle>Biometric Data Input</CardTitle>
                  <CardDescription>Enter your biometrics for personalized analysis.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="height">Height (cm)</Label>
                        <Input id="height" type="number" value={height} onChange={(e) => setHeight(e.target.value)} />
                      </div>
                      <div>
                        <Label htmlFor="weight">Weight (kg)</Label>
                        <Input id="weight" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="ape-index">Ape Index (cm)</Label>
                      <Input id="ape-index" type="number" value={apeIndex} onChange={(e) => setApeIndex(e.target.value)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Climb Definition Section */}
            <section id="climb-definition" className="mb-8">
              <Card>
                <CardHeader>
                  <CardTitle>Climb Definition</CardTitle>
                  <CardDescription>Define a climb by uploading an image, giving it a name and selecting hold colors.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    <div className="flex justify-between">
                      <div className="w-3/4">
                        <Label htmlFor="climb-name">Climb Name</Label>
                        <Input id="climb-name" value={climbName} onChange={(e) => setClimbName(e.target.value)} />
                      </div>
                      
                      <div className="flex items-end gap-2">
                        <QRScanner onScan={handleQRScan} />
                        <SimpleQRScanner onScan={handleQRScan} />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="climb-image">Climb Image</Label>
                        {image && (
                          <div className="mt-2 relative">
                            <img src={image} alt="Climb Preview" style={{maxWidth: '100%', maxHeight: '300px'}} />
                            <canvas 
                              ref={imageCanvasRef} 
                              className="absolute top-0 left-0 w-full h-full" 
                              style={{display: 'none'}} 
                            />
                          </div>
                        )}
                        {!image && (
                          <Alert className="mt-2">
                            <AlertTitle>No Image Uploaded</AlertTitle>
                            <AlertDescription>Please upload a climb image to define the climb.</AlertDescription>
                          </Alert>
                        )}
                        <Input id="climb-image" type="file" accept="image/*" onChange={handleImageUpload} className="mt-2" />
                    </div>
                    <div>
                      <Label>Hold Colors</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['red', 'blue', 'green', 'yellow', 'purple'].map((color) => (
                          <Button key={color} variant={holdColors.includes(color) ? 'default' : 'outline'} onClick={() => toggleHoldColor(color)}>
                            {color}
                          </Button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        onClick={detectHolds}
                        disabled={!image || holdColors.length === 0 || isDetectingHolds}
                      >
                        {isDetectingHolds ? 'Detecting...' : 'Detect Holds'}
                      </Button>
                      
                      <Button 
                        onClick={generateQRCode}
                        disabled={!climbName}
                      >
                        Generate QR Code
                      </Button>
                      
                      {detectedHolds.length > 0 && (
                        <span className="ml-2 text-sm text-muted-foreground">
                          {detectedHolds.length} holds detected
                        </span>
                      )}
                    </div>
                    
                    {qrCodeImageUrl && (
                      <div ref={qrCodeRef} className="mt-4">
                        <img src={qrCodeImageUrl} alt="Climb QR Code" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Climbing Session Recording Section */}
            <section id="session-recording" className="mb-8">
              <Card>
                <CardHeader>
                  <CardTitle>Climbing Session Recording</CardTitle>
                  <CardDescription>Record your climbing session to analyze your performance.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between mb-4">
                    <Button 
                      variant={isCameraOn ? "destructive" : "default"}
                      onClick={toggleCamera}
                    >
                      {isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
                    </Button>
                    
                    <Button 
                      variant={isAIEnabled ? "destructive" : "default"}
                      onClick={toggleAI}
                      disabled={!isCameraOn && !isAIEnabled}
                    >
                      {isAIEnabled ? 'Disable AI Analysis' : 'Enable AI Analysis'}
                    </Button>
                    
                    <Button 
                      onClick={analyzeClimbing}
                      disabled={!isAIEnabled || !bodyPositionData}
                    >
                      Analyze Climbing
                    </Button>
                  </div>

                  {!isCameraOn && (
                    <Alert className="mb-4">
                      <AlertTitle>Camera is Off</AlertTitle>
                      <AlertDescription>Turn on the camera to begin recording and analysis.</AlertDescription>
                    </Alert>
                  )}

                  {!isAIEnabled && isCameraOn && (
                    <Alert className="mb-4">
                      <AlertTitle>AI Analysis is Disabled</AlertTitle>
                      <AlertDescription>Enable AI analysis to detect your pose and climbing movements.</AlertDescription>
                    </Alert>
                  )}

                  {!(hasCameraPermission) && isCameraOn && (
                    <Alert variant="destructive">
                      <AlertTitle>Camera Access Required</AlertTitle>
                      <AlertDescription>Please allow camera access to use this feature.</AlertDescription>
                    </Alert>
                  )}

                  <div className="grid gap-4 mt-4">
                    {availableCameras.length > 1 && (
                      <div>
                        <Label htmlFor="camera-select">Select Camera</Label>
                        <Select 
                          onValueChange={handleCameraChange} 
                          value={selectedCamera || undefined}
                        >
                          <SelectTrigger id="camera-select">
                            <SelectValue placeholder="Select a camera" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableCameras
                              .filter(camera => camera.deviceId && camera.deviceId.trim() !== '')
                              .map((camera) => (
                                <SelectItem key={camera.deviceId} value={camera.deviceId}>
                                  {camera.label || `Camera ${camera.deviceId.substring(0, 8)}...`}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2 relative">
                        <div key={`camera-session-${cameraSessionKey}`} className="relative min-h-[360px] border border-gray-300 rounded-md">
                          <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            style={{ 
                              ...styles.video,
                              display: isCameraOn ? 'block' : 'none'
                            }}
                            className="rounded-md"
                          ></video>
                          {isAIEnabled && (
                            <canvas 
                              ref={canvasRef} 
                              className="absolute top-0 left-0 w-full h-full"
                            ></canvas>
                          )}
                          {isAIEnabled && (
                            <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs flex items-center">
                              <span className={`inline-block w-2 h-2 rounded-full mr-1 ${fps > 30 ? 'bg-green-400' : fps > 15 ? 'bg-yellow-400' : 'bg-red-400'}`}></span>
                              FPS: {fps}
                            </div>
                          )}
                          {!isCameraOn && (
                            <div className="aspect-video bg-slate-200 rounded-md flex items-center justify-center">
                              <p className="text-slate-500">Camera is off</p>
                            </div>
                          )}
                          {isCameraOn && (
                            <div className="absolute bottom-2 right-2 bg-blue-500 text-white px-2 py-1 rounded text-xs">
                              Camera is on - Stream active
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="border border-red-500 rounded-md p-3 bg-white">
                        <h3 className="text-sm font-medium mb-2">Pose Statistics</h3>
                        {isAIEnabled && humanDetected ? (
                          <div className="space-y-3 text-xs">
                            <div>
                              <div className="flex justify-between mb-1">
                                <span>Lean Angle:</span>
                                <span className="font-semibold">{poseStats.leanAngle}°</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div 
                                  className="bg-blue-600 h-1.5 rounded-full" 
                                  style={{ width: `${Math.min(100, Math.abs(poseStats.leanAngle) / 90 * 100)}%` }}
                                ></div>
                              </div>
                            </div>
                            
                            <div>
                              <div className="flex justify-between mb-1">
                                <span>Shoulder Angle:</span>
                                <span className="font-semibold">{poseStats.shoulderAngle}°</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div 
                                  className="bg-purple-500 h-1.5 rounded-full" 
                                  style={{ width: `${Math.min(100, Math.abs(poseStats.shoulderAngle) / 90 * 100)}%` }}
                                ></div>
                              </div>
                            </div>
                            
                            <div>
                              <div className="flex justify-between mb-1">
                                <span>Hip Angle:</span>
                                <span className="font-semibold">{poseStats.hipAngle}°</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div 
                                  className="bg-green-500 h-1.5 rounded-full" 
                                  style={{ width: `${Math.min(100, poseStats.hipAngle / 180 * 100)}%` }}
                                ></div>
                              </div>
                            </div>
                            
                            <div>
                              <div className="flex justify-between mb-1">
                                <span>Knee Angle:</span>
                                <span className="font-semibold">{poseStats.kneeAngle}°</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div 
                                  className="bg-yellow-500 h-1.5 rounded-full" 
                                  style={{ width: `${Math.min(100, poseStats.kneeAngle / 180 * 100)}%` }}
                                ></div>
                              </div>
                            </div>
                            
                            <div>
                              <div className="flex justify-between mb-1">
                                <span>Arm Extension:</span>
                                <span className="font-semibold">{poseStats.armExtension}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div 
                                  className="bg-red-500 h-1.5 rounded-full" 
                                  style={{ width: `${Math.min(100, poseStats.armExtension)}%` }}
                                ></div>
                              </div>
                            </div>
                            
                            {/* NEW: Movement Statistics */}
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <h4 className="text-xs font-medium mb-2">Movement Tracking</h4>
                              
                              <div className="grid grid-cols-2 gap-2">
                                {/* Left Hand */}
                                <div className="border rounded p-2">
                                  <h5 className="text-xs font-medium mb-1">Left Hand</h5>
                                  <div className="flex items-center justify-between">
                                    <div className="relative h-10 w-10">
                                      <div className="absolute inset-0 flex items-center justify-center text-[8px]">
                                        {movementStats.leftHand.direction}°
                                      </div>
                                      <div className="absolute inset-0 border border-blue-200 rounded-full"></div>
                                      <div 
                                        className="absolute w-1 h-4 bg-blue-500 rounded-full top-1/2 left-1/2 origin-bottom transform -translate-x-1/2"
                                        style={{ 
                                          transform: `translate(-50%, 0) rotate(${movementStats.leftHand.direction}deg)`,
                                          transformOrigin: 'center 75%'
                                        }}
                                      ></div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-gray-500">Speed (m/s)</div>
                                      <div className="text-xs font-semibold">{movementStats.leftHand.speed}</div>
                                    </div>
                                  </div>
                                </div>

                                {/* Right Hand */}
                                <div className="border rounded p-2">
                                  <h5 className="text-xs font-medium mb-1">Right Hand</h5>
                                  <div className="flex items-center justify-between">
                                    <div className="relative h-10 w-10">
                                      <div className="absolute inset-0 flex items-center justify-center text-[8px]">
                                        {movementStats.rightHand.direction}°
                                      </div>
                                      <div className="absolute inset-0 border border-blue-200 rounded-full"></div>
                                      <div 
                                        className="absolute w-1 h-4 bg-blue-500 rounded-full top-1/2 left-1/2 origin-bottom transform -translate-x-1/2"
                                        style={{ 
                                          transform: `translate(-50%, 0) rotate(${movementStats.rightHand.direction}deg)`,
                                          transformOrigin: 'center 75%'
                                        }}
                                      ></div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-gray-500">Speed (m/s)</div>
                                      <div className="text-xs font-semibold">{movementStats.rightHand.speed}</div>
                                    </div>
                                  </div>
                                </div>

                                {/* Left Foot */}
                                <div className="border rounded p-2">
                                  <h5 className="text-xs font-medium mb-1">Left Foot</h5>
                                  <div className="flex items-center justify-between">
                                    <div className="relative h-10 w-10">
                                      <div className="absolute inset-0 flex items-center justify-center text-[8px]">
                                        {movementStats.leftFoot.direction}°
                                      </div>
                                      <div className="absolute inset-0 border border-blue-200 rounded-full"></div>
                                      <div 
                                        className="absolute w-1 h-4 bg-blue-500 rounded-full top-1/2 left-1/2 origin-bottom transform -translate-x-1/2"
                                        style={{ 
                                          transform: `translate(-50%, 0) rotate(${movementStats.leftFoot.direction}deg)`,
                                          transformOrigin: 'center 75%'
                                        }}
                                      ></div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-gray-500">Speed (m/s)</div>
                                      <div className="text-xs font-semibold">{movementStats.leftFoot.speed}</div>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Right Foot */}
                                <div className="border rounded p-2">
                                  <h5 className="text-xs font-medium mb-1">Right Foot</h5>
                                  <div className="flex items-center justify-between">
                                    <div className="relative h-10 w-10">
                                      <div className="absolute inset-0 flex items-center justify-center text-[8px]">
                                        {movementStats.rightFoot.direction}°
                                      </div>
                                      <div className="absolute inset-0 border border-blue-200 rounded-full"></div>
                                      <div 
                                        className="absolute w-1 h-4 bg-blue-500 rounded-full top-1/2 left-1/2 origin-bottom transform -translate-x-1/2"
                                        style={{ 
                                          transform: `translate(-50%, 0) rotate(${movementStats.rightFoot.direction}deg)`,
                                          transformOrigin: 'center 75%'
                                        }}
                                      ></div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-gray-500">Speed (m/s)</div>
                                      <div className="text-xs font-semibold">{movementStats.rightFoot.speed}</div>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Body Center */}
                                <div className="border rounded p-2 col-span-2">
                                  <h5 className="text-xs font-medium mb-1">Body Center</h5>
                                  <div className="flex items-center justify-between">
                                    <div className="relative h-10 w-10">
                                      <div className="absolute inset-0 flex items-center justify-center text-[8px]">
                                        {movementStats.bodyCenter.direction}°
                                      </div>
                                      <div className="absolute inset-0 border border-blue-200 rounded-full"></div>
                                      <div 
                                        className="absolute w-1 h-4 bg-blue-500 rounded-full top-1/2 left-1/2 origin-bottom transform -translate-x-1/2"
                                        style={{ 
                                          transform: `translate(-50%, 0) rotate(${movementStats.bodyCenter.direction}deg)`,
                                          transformOrigin: 'center 75%'
                                        }}
                                      ></div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-gray-500">Speed (m/s)</div>
                                      <div className="text-xs font-semibold">{movementStats.bodyCenter.speed}</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <span className="block text-xs text-gray-500 mb-1">Center of Gravity</span>
                              <div className="relative w-full h-16 bg-gray-100 rounded">
                                <div 
                                  className="absolute w-3 h-3 bg-blue-500 rounded-full transform -translate-x-1/2 -translate-y-1/2"
                                  style={{ 
                                    left: `${poseStats.centerOfGravity.x * 100}%`, 
                                    top: `${poseStats.centerOfGravity.y * 100}%` 
                                  }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Enable AI to view statistics
                          </p>
                        )}
                      </div>
                    </div>

                    <Button onClick={isRecording ? handleStopRecording : handleStartRecording} disabled={!hasCameraPermission}>
                      {isRecording ? 'Recording...' : 'Start Recording'}
                    </Button>

                    {humanDetected ? (
                      <Alert>
                        <AlertTitle>Human Detected</AlertTitle>
                        <AlertDescription>Body positioning data is being recorded.</AlertDescription>
                      </Alert>
                    ) : (
                      <Alert variant="destructive">
                        <AlertTitle>No Human Detected</AlertTitle>
                        <AlertDescription>Please ensure a person is in view of the camera.</AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>
            </section>
            
            {/* Compare Climbs Section - Add recording functionality */}
            <section id="compare" className="mb-8">
              <Card>
                <CardHeader>
                  <CardTitle>Compare Climbing Attempts</CardTitle>
                  <CardDescription>Record or upload two videos of climbing attempts to compare performance and technique.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6">
                    {/* Camera Selection for Recording */}
                    <div className="border p-4 rounded-md bg-slate-50">
                      <h3 className="text-md font-medium mb-3">Record Comparison Videos</h3>
                      
                      <div className="grid gap-4 mb-4">
                        <div>
                          <Label htmlFor="camera-select-compare">Select Camera</Label>
                          <Select 
                            onValueChange={handleCameraChange}
                            value={selectedCamera || undefined}
                            disabled={recordingMode !== 'none'}
                          >
                            <SelectTrigger id="camera-select-compare">
                              <SelectValue placeholder="Select a camera" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableCameras
                                .filter(camera => camera.deviceId && camera.deviceId.trim() !== '')
                                .map((camera) => (
                                  <SelectItem key={`compare-${camera.deviceId}`} value={camera.deviceId}>
                                    {camera.label || `Camera ${camera.deviceId.substring(0, 8)}...`}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          {/* First Video */}
                          <div>
                            <h4 className="text-sm font-medium mb-2">First Climbing Attempt</h4>
                            <div className="aspect-video bg-black rounded overflow-hidden mb-2 relative">
                              {recordingMode === 'first' ? (
                                <video 
                                  ref={comparisonPreviewRef1}
                                  className="w-full h-full"
                                  muted
                                  playsInline
                                ></video>
                              ) : compareVideo1 ? (
                                <>
                                  <video 
                                    id="compare-video-1"
                                    src={compareVideo1}
                                    className="w-full h-full"
                                    controls
                                    muted
                                    playsInline
                                  ></video>
                                  <canvas 
                                    ref={comparisonCanvasRef1}
                                    className="absolute top-0 left-0 w-full h-full pointer-events-none"
                                  />
                                </>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-white">
                                  No video recorded
                                </div>
                              )}
                            </div>
                            <Button 
                              onClick={recordingMode === 'first' ? stopCurrentRecording : recordFirstVideo}
                              disabled={recordingMode === 'second'}
                              variant={recordingMode === 'first' ? "destructive" : "default"}
                              className="w-full"
                            >
                              {recordingMode === 'first' ? 'Stop Recording' : 'Record First Video'}
                            </Button>
                          </div>
                          
                          {/* Second Video */}
                          <div>
                            <h4 className="text-sm font-medium mb-2">Second Climbing Attempt</h4>
                            <div className="aspect-video bg-black rounded overflow-hidden mb-2 relative">
                              {recordingMode === 'second' ? (
                                <video 
                                  ref={comparisonPreviewRef2}
                                  className="w-full h-full"
                                  muted
                                  playsInline
                                ></video>
                              ) : compareVideo2 ? (
                                <>
                                  <video 
                                    id="compare-video-2"
                                    src={compareVideo2}
                                    className="w-full h-full"
                                    controls
                                    muted
                                    playsInline
                                  ></video>
                                  <canvas 
                                    ref={comparisonCanvasRef2}
                                    className="absolute top-0 left-0 w-full h-full pointer-events-none"
                                  />
                                </>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-white">
                                  No video recorded
                                </div>
                              )}
                            </div>
                            <Button 
                              onClick={recordingMode === 'second' ? stopCurrentRecording : recordSecondVideo}
                              disabled={recordingMode === 'first' || !compareVideo1}
                              variant={recordingMode === 'second' ? "destructive" : "default"}
                              className="w-full"
                            >
                              {recordingMode === 'second' ? 'Stop Recording' : 'Record Second Video'}
                            </Button>
                          </div>
                        </div>
                        
                        {compareVideo1 && compareVideo2 && (
                          <div className="flex justify-center gap-4">
                            <Button onClick={playBothVideos}>
                              Play Both Videos
                            </Button>
                            <Button onClick={pauseBothVideos} variant="outline">
                              Pause Both Videos
                            </Button>
                            <Button 
                              onClick={compareClimbingRecordings}
                              variant="default"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Compare Recordings
                            </Button>
                            {comparisonResults && (
                              <Button 
                                onClick={() => setShowComparisonResults(true)}
                                variant="outline"
                                className="border-green-500 text-green-600 hover:bg-green-50"
                              >
                                View Results
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Or Divider */}
                    <div className="relative flex items-center py-2">
                      <div className="flex-grow border-t border-gray-300"></div>
                      <span className="flex-shrink mx-4 text-gray-600">OR</span>
                      <div className="flex-grow border-t border-gray-300"></div>
                    </div>
                    
                    {/* Existing Video Upload Section */}
                    <div className="border p-4 rounded-md bg-slate-50">
                      <h3 className="text-md font-medium mb-3">Upload Existing Videos</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="video1">First Climbing Attempt</Label>
                          <Input 
                            id="video1" 
                            type="file" 
                            accept="video/*" 
                            onChange={(e) => handleVideoUpload(e, 1)}
                            className="mt-2"
                          />
                          {compareVideo1 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Video 1 uploaded successfully
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="video2">Second Climbing Attempt</Label>
                          <Input 
                            id="video2" 
                            type="file" 
                            accept="video/*" 
                            onChange={(e) => handleVideoUpload(e, 2)}
                            className="mt-2"
                          />
                          {compareVideo2 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Video 2 uploaded successfully
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
            
            {/* Performance Analysis Section */}
            <section id="analysis" className="mb-8">
              <AnalysisResults results={analysisResults} />
            </section>
            
            {/* Advice Panel */}
            {showAdvicePanel && (
              <div className="fixed top-0 right-0 w-72 h-full bg-white border-l border-gray-200 shadow-lg overflow-y-auto z-10">
                <div className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Advice</h3>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setShowAdvicePanel(false)}
                      className="h-6 w-6 p-0"
                    >
                      <span className="sr-only">Close</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x">
                        <path d="M18 6 6 18"/>
                        <path d="m6 6 12 12"/>
                      </svg>
                    </Button>
                  </div>
                  
                  {adviceContent ? (
                    <div className="prose prose-sm">
                      <p>{adviceContent}</p>
                      
                      {analysisResults?.suggestedTechniques && (
                        <div className="mt-4">
                          <h4 className="text-md font-medium mb-2">Suggested Techniques</h4>
                          <ul className="list-disc pl-5 space-y-1">
                            {analysisResults.suggestedTechniques.map((technique, index) => (
                              <li key={index} className="text-sm">{technique}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {analysisResults?.improvementAreas && (
                        <div className="mt-4">
                          <h4 className="text-md font-medium mb-2">Areas for Improvement</h4>
                          <ul className="list-disc pl-5 space-y-1">
                            {analysisResults.improvementAreas.map((area, index) => (
                              <li key={index} className="text-sm">{area}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No advice available. Analyze your climbing to get personalized advice.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Dialog for showing loaded climb details */}
            <Dialog open={showClimbDetails} onOpenChange={setShowClimbDetails}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Climb Details</DialogTitle>
                  <DialogDescription>
                    Information about the loaded climb.
                  </DialogDescription>
                </DialogHeader>
                
                {loadedClimb && (
                  <div className="space-y-4 py-4">
                    <div>
                      <h3 className="font-medium">Climb Name</h3>
                      <p className="text-sm text-muted-foreground">{loadedClimb.climbName}</p>
                    </div>
                    
                    <div>
                      <h3 className="font-medium">Hold Colors</h3>
                      <div className="flex gap-1 mt-1">
                        {loadedClimb.holdColors.map((color: string) => (
                          <div
                            key={color}
                            className="w-6 h-6 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                    
                    {loadedClimb.detectedHolds && loadedClimb.detectedHolds.length > 0 && (
                      <div>
                        <h3 className="font-medium">Detected Holds</h3>
                        <p className="text-sm text-muted-foreground">
                          {loadedClimb.detectedHolds.length} holds were detected
                        </p>
                      </div>
                    )}
                    
                    {loadedClimb.timestamp && (
                      <div>
                        <h3 className="font-medium">Created On</h3>
                        <p className="text-sm text-muted-foreground">
                          {new Date(loadedClimb.timestamp).toLocaleString()}
                        </p>
                      </div>
                    )}
                    
                    <div className="pt-4">
                      <Button onClick={() => setShowClimbDetails(false)}>
                        Close
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Add Comparison Results Dialog */}
            <Dialog open={showComparisonResults} onOpenChange={setShowComparisonResults}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Climbing Comparison Results</DialogTitle>
                  <DialogDescription>
                    Analysis of the differences between your climbing attempts
                  </DialogDescription>
                </DialogHeader>
                
                {comparisonResults && (
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-3 gap-4 border-b pb-4">
                      <div className="text-center">
                        <div className="text-sm font-semibold text-muted-foreground">Metric</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-semibold">Video 1</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-semibold">Video 2</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 border-b pb-4">
                      <div>
                        <div className="text-sm font-medium">Completion Time</div>
                        <div className="text-xs text-muted-foreground">Time to complete the climb</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${comparisonResults.completionTime.fasterVideo === 1 ? 'text-green-600' : ''}`}>
                          {comparisonResults.completionTime.video1.toFixed(2)}s
                        </div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${comparisonResults.completionTime.fasterVideo === 2 ? 'text-green-600' : ''}`}>
                          {comparisonResults.completionTime.video2.toFixed(2)}s
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 border-b pb-4">
                      <div>
                        <div className="text-sm font-medium">Average Speed</div>
                        <div className="text-xs text-muted-foreground">Average movement speed</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${comparisonResults.avgSpeed.fasterVideo === 1 ? 'text-green-600' : ''}`}>
                          {comparisonResults.avgSpeed.video1.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${comparisonResults.avgSpeed.fasterVideo === 2 ? 'text-green-600' : ''}`}>
                          {comparisonResults.avgSpeed.video2.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm font-medium">Path Efficiency</div>
                        <div className="text-xs text-muted-foreground">How direct the climbing path was</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${comparisonResults.pathEfficiency.moreEfficientVideo === 1 ? 'text-green-600' : ''}`}>
                          {(comparisonResults.pathEfficiency.video1 * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${comparisonResults.pathEfficiency.moreEfficientVideo === 2 ? 'text-green-600' : ''}`}>
                          {(comparisonResults.pathEfficiency.video2 * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-6 pt-4 border-t">
                      <div className="font-medium mb-2">Summary</div>
                      <div className="text-sm">
                        {comparisonResults.completionTime.fasterVideo === comparisonResults.pathEfficiency.moreEfficientVideo ? (
                          <p>
                            Video {comparisonResults.completionTime.fasterVideo} was both faster
                            ({comparisonResults.completionTime.difference.toFixed(2)}s difference) and
                            more efficient in movement.
                          </p>
                        ) : (
                          <p>
                            Video {comparisonResults.completionTime.fasterVideo} was faster
                            ({comparisonResults.completionTime.difference.toFixed(2)}s difference), but
                            Video {comparisonResults.pathEfficiency.moreEfficientVideo} had a more efficient
                            climbing path.
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-end mt-4">
                      <Button onClick={() => setShowComparisonResults(false)}>
                        Close
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </main>
          
        </div>
      
    </SidebarProvider>
  );
};

export default ClimbSightApp;
