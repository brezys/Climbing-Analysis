# ClimbSight

ClimbSight is an indoor rock climbing analysis application that helps climbers improve their technique and performance.

## Features

- **Biometric data tracking**: Record and store climber statistics like height, weight, and ape-index
- **Climb definition**: Upload climb images, detect holds by color, and generate QR codes for climbs
- **Real-time analysis**: Use pose detection to analyze climbing technique and body positioning
- **Climb comparison**: Record or upload multiple climbing attempts and compare them side-by-side
- **Performance metrics**: Analyze motion efficiency, body angles, and movement patterns

## Code Organization

The codebase is organized into modular components for better maintainability:

### Core Libraries

- **lib/pose-detection**: Utilities for body position and angle calculations
- **lib/motion-tracking**: Utilities for tracking movement speed and direction
- **lib/comparison**: Video processing and comparison utilities
- **lib/holds**: Hold detection and color matching algorithms
- **lib/qr-code**: QR code generation and parsing
- **lib/camera**: Camera setup, recording, and management

### Other Files

- **components**: UI components and custom elements
- **app**: Next.js app router configuration and main page
- **lib/types.ts**: Shared TypeScript types for the application

## Getting Started

1. Install dependencies:
   ```
   npm install
   ```

2. Run the development server:
   ```
   npm run dev
   ```

3. Open your browser to http://localhost:3000

## Requirements

- Two webcams for the comparison feature (for simultaneous recording)
- Modern browser with WebRTC support
- Sufficient GPU for real-time pose detection

## Technology Stack

- Next.js
- TypeScript
- Tailwind CSS
- MediaPipe for pose detection
- WebRTC for camera access and recording

## Troubleshooting

### Camera Access

Make sure to grant camera permissions when prompted by the browser. If you accidentally denied permissions, you may need to reset them in your browser settings.

### Pose Detection

The application uses MediaPipe for pose detection. If you're having issues:
- Make sure you're in a well-lit environment
- Stand back from the camera so your full body is visible
- Wear contrasting clothing to the background 