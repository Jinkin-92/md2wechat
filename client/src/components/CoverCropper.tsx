import { useCallback, useEffect, useRef, useState } from "react";

interface CoverCropperProps {
  imageSrc: string;
  onCrop: (blob: Blob) => void;
  onCancel: () => void;
  defaultAspect?: number;
}

export function CoverCropper({ imageSrc, onCrop, onCancel, defaultAspect = 2.35 }: CoverCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [aspect, setAspect] = useState(defaultAspect);
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, cropX: 0, cropY: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  const initCrop = useCallback((img: HTMLImageElement, targetAspect: number) => {
    const displayW = Math.min(img.naturalWidth, 560);
    const scale = displayW / img.naturalWidth;
    const displayH = img.naturalHeight * scale;

    let cropW: number, cropH: number;
    if (displayW / displayH > targetAspect) {
      cropH = displayH;
      cropW = cropH * targetAspect;
    } else {
      cropW = displayW;
      cropH = cropW / targetAspect;
    }

    setCrop({
      x: (displayW - cropW) / 2,
      y: (displayH - cropH) / 2,
      width: cropW,
      height: cropH
    });
  }, []);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
      initCrop(img, aspect);
    };
    img.src = imageSrc;
  }, [imageSrc, initCrop, aspect]);

  useEffect(() => {
    if (!imageLoaded || !imgRef.current) return;
    initCrop(imgRef.current, aspect);
  }, [aspect, imageLoaded, initCrop]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const displayW = Math.min(img.naturalWidth, 560);
    const scale = displayW / img.naturalWidth;
    const displayH = img.naturalHeight * scale;

    canvas.width = displayW;
    canvas.height = displayH;

    ctx.clearRect(0, 0, displayW, displayH);
    ctx.drawImage(img, 0, 0, displayW, displayH);

    // Dim outside crop area
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, displayW, crop.y);
    ctx.fillRect(0, crop.y + crop.height, displayW, displayH - crop.y - crop.height);
    ctx.fillRect(0, crop.y, crop.x, crop.height);
    ctx.fillRect(crop.x + crop.width, crop.y, displayW - crop.x - crop.width, crop.height);

    // Crop border
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);
    ctx.setLineDash([]);

    // Corner handles
    const handleSize = 8;
    ctx.fillStyle = "#fff";
    [
      [crop.x, crop.y],
      [crop.x + crop.width, crop.y],
      [crop.x, crop.y + crop.height],
      [crop.x + crop.width, crop.y + crop.height]
    ].forEach(([hx, hy]) => {
      ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
    });
  }, [crop]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x >= crop.x && x <= crop.x + crop.width && y >= crop.y && y <= crop.y + crop.height) {
      setDragging(true);
      setDragStart({ x, y, cropX: crop.x, cropY: crop.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dx = x - dragStart.x;
    const dy = y - dragStart.y;

    const img = imgRef.current;
    if (!img) return;
    const displayW = Math.min(img.naturalWidth, 560);
    const scale = displayW / img.naturalWidth;
    const displayH = img.naturalHeight * scale;

    let newX = Math.max(0, Math.min(displayW - crop.width, dragStart.cropX + dx));
    let newY = Math.max(0, Math.min(displayH - crop.height, dragStart.cropY + dy));

    setCrop((prev) => ({ ...prev, x: newX, y: newY }));
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  const handleConfirm = () => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const displayW = Math.min(img.naturalWidth, 560);
    const scale = img.naturalWidth / displayW;

    const sourceX = crop.x * scale;
    const sourceY = crop.y * scale;
    const sourceW = crop.width * scale;
    const sourceH = crop.height * scale;

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = Math.round(sourceW);
    outputCanvas.height = Math.round(sourceH);
    const ctx = outputCanvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);

    outputCanvas.toBlob(
      (blob) => {
        if (blob) onCrop(blob);
      },
      "image/jpeg",
      0.92
    );
  };

  return (
    <div className="cover-cropper-overlay" ref={containerRef}>
      <div className="cover-cropper-modal">
        <div className="cover-cropper-header">
          <h4>裁剪封面</h4>
          <button className="cover-cropper-close" onClick={onCancel}>×</button>
        </div>

        <div className="cover-cropper-aspects">
          <button className={`cover-cropper-chip ${aspect === 2.35 ? "active" : ""}`} onClick={() => setAspect(2.35)}>
            宽图 2.35:1
          </button>
          <button className={`cover-cropper-chip ${aspect === 1 ? "active" : ""}`} onClick={() => setAspect(1)}>
            正方形 1:1
          </button>
        </div>

        <div className="cover-cropper-canvas-wrap">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: dragging ? "grabbing" : "grab", maxWidth: "100%" }}
          />
        </div>

        <div className="cover-cropper-actions">
          <button className="cover-cropper-btn-secondary" onClick={onCancel}>取消</button>
          <button className="cover-cropper-btn-primary" onClick={handleConfirm}>确认裁剪</button>
        </div>
      </div>
    </div>
  );
}
