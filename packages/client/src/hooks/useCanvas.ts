import { useEffect, useRef } from 'react';
import { Canvas } from 'fabric';

export function useCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      backgroundColor: '#f8fafc',
      selection: true,
      preserveObjectStacking: true,
    });

    fabricRef.current = canvas;

    const resizeCanvas = () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      canvas.setDimensions({ width, height });
      canvas.renderAll();
    };

    resizeCanvas();

    const observer = new ResizeObserver(resizeCanvas);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
      canvas.dispose();
      fabricRef.current = null;
    };
  }, []);

  return { canvasRef, fabricRef, containerRef };
}
