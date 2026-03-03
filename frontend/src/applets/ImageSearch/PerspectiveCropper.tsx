import React, { useState, useRef, useEffect } from 'react';

interface Point {
  x: number;
  y: number;
}

interface PerspectiveCropperProps {
  image: string;
  onPointsChange: (points: Point[]) => void;
}

export default function PerspectiveCropper({ image, onPointsChange }: PerspectiveCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<Point[]>([
    { x: 100, y: 100 },
    { x: 300, y: 100 },
    { x: 300, y: 300 },
    { x: 100, y: 300 }
  ]);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [imgDims, setImgDims] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const img = new Image();
    img.src = image;
    img.onload = () => {
      setImgDims({ width: img.naturalWidth, height: img.naturalHeight });
      // Initialize points to a reasonable square centered in the image
      const w = 200;
      const h = 200;
      const cx = 150; 
      const cy = 150;
      const initialPoints = [
        { x: cx - w/2, y: cy - h/2 },
        { x: cx + w/2, y: cy - h/2 },
        { x: cx + w/2, y: cy + h/2 },
        { x: cx - w/2, y: cy + h/2 }
      ];
      setPoints(initialPoints);
      onPointsChange(initialPoints);
    };
  }, [image]);

  const handlePointerDown = (idx: number) => {
    setDraggingIdx(idx);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingIdx === null || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    const newPoints = [...points];
    newPoints[draggingIdx] = { x, y };
    setPoints(newPoints);
    onPointsChange(newPoints);
  };

  const handlePointerUp = () => {
    setDraggingIdx(null);
  };

  // SVG Polygon Path
  const polygonPath = `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y} L ${points[2].x} ${points[2].y} L ${points[3].x} ${points[3].y} Z`;

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center bg-black touch-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <img 
        src={image} 
        className="max-w-full max-h-full object-contain pointer-events-none select-none"
        alt="To Crop"
      />
      
      <svg 
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox={`0 0 ${containerRef.current?.clientWidth || 500} ${containerRef.current?.clientHeight || 500}`}
      >
        <path 
          d={polygonPath} 
          fill="rgba(59, 130, 246, 0.2)" 
          stroke="#3b82f6" 
          strokeWidth="2" 
          strokeDasharray="4"
        />
      </svg>

      {points.map((p, i) => (
        <div
          key={i}
          className={`absolute w-8 h-8 -ml-4 -mt-4 rounded-full border-2 border-white shadow-xl flex items-center justify-center cursor-move transition-transform ${draggingIdx === i ? 'scale-125 bg-blue-500' : 'bg-blue-600/80 hover:bg-blue-500'}`}
          style={{ left: p.x, top: p.y, touchAction: 'none' }}
          onPointerDown={() => handlePointerDown(i)}
        >
          <div className="w-2 h-2 bg-white rounded-full"></div>
          
          {/* Magnifying Glass Preview (Mobile Friendly) */}
          {draggingIdx === i && (
             <div className="absolute bottom-full mb-6 w-32 h-32 rounded-full border-4 border-white overflow-hidden bg-black shadow-2xl pointer-events-none animate-in zoom-in-50">
                <div 
                  className="w-full h-full"
                  style={{
                    backgroundImage: `url(${image})`,
                    backgroundSize: `${(containerRef.current?.clientWidth || 0) * 4}px auto`,
                    backgroundPosition: `${-p.x * 4 + 64}px ${-p.y * 4 + 64}px`,
                    backgroundRepeat: 'no-repeat'
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-full h-0.5 bg-blue-500/50 absolute"></div>
                  <div className="w-0.5 h-full bg-blue-500/50 absolute"></div>
                </div>
             </div>
          )}
        </div>
      ))}
      
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 text-xs font-bold text-white pointer-events-none shadow-lg">
        Drag 4 corners to fit the chart area
      </div>
    </div>
  );
}
