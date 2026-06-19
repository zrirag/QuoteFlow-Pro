import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import * as THREE from 'three';
import { CorpButton } from '../components/ui/CorpButton';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Three.js Corporate Background (Elegant slow rotating abstract geometry)
    if (!canvasRef.current) return;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xFFFFFF); // Solid white

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Create a very subtle, wireframe sphere or abstract shape (corporate grid feel)
    const geometry = new THREE.IcosahedronGeometry(2, 1);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xE5E5E5, // Very light border color
      wireframe: true,
      transparent: true,
      opacity: 0.5
    });
    
    const abstractObject = new THREE.Mesh(geometry, material);
    scene.add(abstractObject);

    camera.position.z = 5;

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      abstractObject.rotation.x += 0.001;
      abstractObject.rotation.y += 0.002;
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // 2. GSAP Entrance Animations
    const tl = gsap.timeline();
    
    // Initial state
    gsap.set([textRef.current, subtitleRef.current, buttonRef.current], { 
      y: 30, 
      opacity: 0 
    });
    gsap.set(canvasRef.current, { opacity: 0 });

    tl.to(canvasRef.current, { opacity: 1, duration: 2, ease: "power2.out" })
      .to(textRef.current, { y: 0, opacity: 1, duration: 1.2, ease: "power3.out" }, "-=1.5")
      .to(subtitleRef.current, { y: 0, opacity: 1, duration: 1, ease: "power3.out" }, "-=0.8")
      .to(buttonRef.current, { y: 0, opacity: 1, duration: 1, ease: "power3.out" }, "-=0.6");

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-corp-bg overflow-hidden flex items-center justify-center">
      {/* ThreeJS Canvas Background */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 z-0"
      />
      
      {/* Content */}
      <div className="relative z-10 text-center max-w-3xl px-6">
        <h1 
          ref={textRef} 
          className="font-serif text-5xl md:text-7xl text-corp-text font-bold tracking-tight mb-6"
        >
          QuoteFlow Pro
        </h1>
        <p 
          ref={subtitleRef} 
          className="text-lg md:text-xl text-corp-text-sec font-light mb-10 max-w-2xl mx-auto"
        >
          Intelligent Quotation Management Platform. Streamline your enterprise workflow with precision and professional elegance.
        </p>
        
        <div ref={buttonRef} className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <CorpButton 
            onClick={() => navigate('/login')} 
            className="px-8 py-3 text-base"
          >
            Access Portal
          </CorpButton>
          <CorpButton 
            variant="outline"
            className="px-8 py-3 text-base"
            onClick={() => navigate('/dashboard')}
          >
            View Demo Dashboard
          </CorpButton>
        </div>
      </div>

      {/* Decorative footer line */}
      <div className="absolute bottom-10 w-full text-center text-xs text-corp-text-muted">
        &copy; {new Date().getFullYear()} QuoteFlow Enterprise Solutions. All rights reserved.
      </div>
    </div>
  );
};
