import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef } from "react";
import { Vector3 } from "three";

// Camera movement speed
const PAN_SPEED = 5;
const ZOOM_SPEED = 5;

export default function CameraControls() {
    const { camera, gl } = useThree();
    
    const mouseDown = useRef({ x: 0, y: 0, button: -1 });
    const isDragging = useRef(false);
    const startedOnCanvas = useRef(false);
    
    // Store camera position for smooth movement
    const targetPosition = useRef(camera.position.clone());
    const targetLookAt = useRef(new Vector3(0, 0, 0));
    
    // Handle pointer down for camera control start
    const handlePointerDown = useCallback((e: PointerEvent) => {
        const target = e.target as Node | null;
        
        // Only handle canvas events
        const onCanvas = target !== null && 
            (target === gl.domElement || gl.domElement.contains(target));
        
        if (!onCanvas) return;
        
        // Left click for panning, middle click for zoom
        if (e.button === 0 || e.button === 1 || e.button === 2) {
            mouseDown.current = {
                x: e.clientX,
                y: e.clientY,
                button: e.button
            };
            isDragging.current = false;
            startedOnCanvas.current = true;
        }
    }, [gl]);
    
    // Handle pointer move for camera control
    const handlePointerMove = useCallback((e: PointerEvent) => {
        if (!startedOnCanvas.current || mouseDown.current.button === -1) return;
        
        const dx = e.clientX - mouseDown.current.x;
        const dy = e.clientY - mouseDown.current.y;
        
        // Check if mouse moved enough to be considered a drag
        if (Math.sqrt(dx * dx + dy * dy) > 5) {
            isDragging.current = true;
        }
        
        if (!isDragging.current) return;
        
        // Pan camera (right click or middle click)
        if (mouseDown.current.button === 0) {
            // Orbit/pan logic
            const panX = -dx * 0.02;
            const panZ = -dy * 0.02;
            
            // Move camera position
            camera.position.x += panX * PAN_SPEED;
            camera.position.z += panZ * PAN_SPEED;
            
            // Update lookAt target
            targetLookAt.current.x += panX * PAN_SPEED;
            targetLookAt.current.z += panZ * PAN_SPEED;
            
            camera.lookAt(targetLookAt.current);
        }
        
        // Zoom with right click or middle click
        if (mouseDown.current.button === 1 || mouseDown.current.button === 2) {
            const zoomDelta = -dy * 0.01 * ZOOM_SPEED;
            
            // Zoom in/out
            const direction = new Vector3()
                .copy(camera.position)
                .sub(targetLookAt.current)
                .normalize();
            
            const distance = camera.position.distanceTo(targetLookAt.current);
            const newDistance = Math.max(0.5, Math.min(50, distance + zoomDelta * 10));
            
            camera.position.copy(
                targetLookAt.current.clone().add(direction.multiplyScalar(newDistance))
            );
            camera.lookAt(targetLookAt.current);
        }
        
        mouseDown.current.x = e.clientX;
        mouseDown.current.y = e.clientY;
        
    }, [camera]);
    
    // Handle pointer up
    const handlePointerUp = useCallback((e: PointerEvent) => {
        if (!startedOnCanvas.current) return;
        
        // If it was just a click (not a drag), don't do anything
        if (!isDragging.current) {
            // Let other components handle click events
            mouseDown.current = { x: 0, y: 0, button: -1 };
            isDragging.current = false;
            startedOnCanvas.current = false;
            return;
        }
        
        mouseDown.current = { x: 0, y: 0, button: -1 };
        isDragging.current = false;
        startedOnCanvas.current = false;
    }, []);
    
    // Prevent context menu on canvas
    const handleContextMenu = useCallback((e: MouseEvent) => {
        const target = e.target as Node | null;
        const onCanvas = target !== null && 
            (target === gl.domElement || gl.domElement.contains(target));
        
        if (onCanvas) e.preventDefault();
    }, [gl]);
    
    useEffect(() => {
        window.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        window.addEventListener("contextmenu", handleContextMenu);
        
        return () => {
            window.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("contextmenu", handleContextMenu);
        };
    }, [handlePointerDown, handlePointerMove, handlePointerUp, handleContextMenu]);
    
    return null; // This component only handles logic, no render
}