import { useEffect, useRef } from 'react';

export default function CanvasOverlay({ landmarks = [], width = 640, height = 480, score = 0 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 2;
    const pct = Math.round((score || 0) * 100);
    const color = pct >= 75 ? 'rgba(16, 185, 129, 0.95)' : pct >= 40 ? 'rgba(251, 146, 60, 0.95)' : 'rgba(239, 68, 68, 0.95)';

    // draw skeleton lines (subset of MediaPipe POSE_CONNECTIONS)
    const C = [
      [11, 13], [13, 15], // left arm
      [12, 14], [14, 16], // right arm
      [11, 12], // shoulders
      [23, 24], // hips
      [11, 23], [12, 24], // torso
      [23, 25], [25, 27], // left leg
      [24, 26], [26, 28], // right leg
      [27, 29], [29, 31], // left foot
      [28, 30], [30, 32], // right foot
    ];
    ctx.strokeStyle = color;
    C.forEach(([a, b]) => {
      const pa = landmarks[a];
      const pb = landmarks[b];
      if (!isVisible(pa) || !isVisible(pb)) return;
      ctx.beginPath();
      ctx.moveTo(pa.x * width, pa.y * height);
      ctx.lineTo(pb.x * width, pb.y * height);
      ctx.stroke();
    });

    // draw points on top
    ctx.fillStyle = color;
    landmarks.forEach(lm => {
      if (!isVisible(lm)) return;
      const x = lm.x * width;
      const y = lm.y * height;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // simple bounding box
    const visibleLandmarks = landmarks.filter(isVisible);
    if (visibleLandmarks.length > 0) {
      const xs = visibleLandmarks.map(l => l.x * width);
      const ys = visibleLandmarks.map(l => l.y * height);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      ctx.strokeStyle = color;
      ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
    }
  }, [landmarks, width, height, score]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
    />
  );
}

function isVisible(landmark) {
  if (!landmark || !Number.isFinite(landmark.x) || !Number.isFinite(landmark.y)) return false;
  return (landmark.visibility ?? 1) >= 0.4;
}


