import { useState, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Grid,
  ContactShadows,
  Environment,
} from "@react-three/drei";
import * as THREE from "three";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Box,
  Layers,
  Lamp,
  Sofa,
  Lightbulb,
} from "lucide-react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase/firebase";
import styles from "./AuthPage.module.css";

/* ═══════════════════════════════════════
   3D SCENE COMPONENTS
   ═══════════════════════════════════════ */

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color="#e8e4df" roughness={0.8} metalness={0.1} />
    </mesh>
  );
}

function Rug() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
      <planeGeometry args={[5, 3.5]} />
      <meshStandardMaterial color="#c4bdb5" roughness={1} />
    </mesh>
  );
}

function Wall({ position, rotation, size }: { position: [number, number, number]; rotation?: [number, number, number]; size: [number, number, number] }) {
  return (
    <mesh position={position} rotation={rotation ?? [0, 0, 0]} receiveShadow castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#f0eeeb" roughness={0.9} />
    </mesh>
  );
}

function TVUnit() {
  return (
    <group position={[-1.5, 0, -2.4]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[4, 0.6, 0.6]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.8, 0]} castShadow>
        <boxGeometry args={[3, 1.8, 0.1]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.2} metalness={0.5} />
      </mesh>
      {/* drawers */}
      {[-1.2, 1.2].map((x) => (
        <mesh key={x} position={[x, 0.3, 0.35]} castShadow>
          <boxGeometry args={[0.8, 0.4, 0.5]} />
          <meshStandardMaterial color="#e0e0e0" />
        </mesh>
      ))}
    </group>
  );
}

function SofaMesh() {
  return (
    <group position={[1.2, 0, 0.5]} rotation={[0, -0.3, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[3, 0.5, 1.2]} />
        <meshStandardMaterial color="#8a8580" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.5, -0.4]} castShadow>
        <boxGeometry args={[3, 0.8, 0.3]} />
        <meshStandardMaterial color="#8a8580" roughness={0.9} />
      </mesh>
      {[-1.3, 1.3].map((x) => (
        <mesh key={x} position={[x, 0.3, 0]} castShadow>
          <boxGeometry args={[0.4, 0.6, 1.2]} />
          <meshStandardMaterial color="#7a7570" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 0.3, 0.45]} castShadow>
        <boxGeometry args={[2.2, 0.4, 0.3]} />
        <meshStandardMaterial color="#7a7570" roughness={0.9} />
      </mesh>
    </group>
  );
}

function CoffeeTable() {
  return (
    <group position={[0, 0, 1.5]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.15, 1]} />
        <meshStandardMaterial color="#5c4a3d" roughness={0.6} />
      </mesh>
      {[
        [-0.7, -0.3],
        [0.7, -0.3],
        [-0.7, 0.3],
        [0.7, 0.3],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, -0.25, z]} castShadow>
          <boxGeometry args={[0.08, 0.5, 0.08]} />
          <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

function FloorLamp() {
  return (
    <group position={[-2, 0, -1]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.15, 0.2, 0.05, 16]} />
        <meshStandardMaterial color="#d4a574" />
      </mesh>
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 2.4, 8]} />
        <meshStandardMaterial color="#c4a070" metalness={0.3} />
      </mesh>
      <mesh position={[0, 2.5, 0]} castShadow>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial
          color="#fff8e7"
          emissive="#ffaa44"
          emissiveIntensity={0.3}
          transparent
          opacity={0.9}
        />
      </mesh>
      <pointLight position={[0, 2.5, 0]} intensity={2} distance={6} color="#ffcc88" castShadow />
    </group>
  );
}

function PendantLight() {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = 3.5 + Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
    }
  });
  return (
    <group ref={ref} position={[0, 3.5, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.4, 0.6, 0.3, 16]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.8, 8]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <pointLight position={[0, -0.5, 0]} intensity={3} distance={8} color="#ffddaa" castShadow />
    </group>
  );
}

function Plant() {
  return (
    <group position={[-2.5, 0, 1.5]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.25, 0.2, 0.4, 16]} />
        <meshStandardMaterial color="#c4a070" />
      </mesh>
      {[
        [0, 0.5, 0, 0.35, "#4a7c59"],
        [0.15, 0.65, 0.1, 0.25, "#5a8c69"],
        [-0.1, 0.6, -0.1, 0.22, "#3d6b4a"],
      ].map(([x, y, z, s, c], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]} castShadow>
          <sphereGeometry args={[s as number, 12, 12]} />
          <meshStandardMaterial color={c as string} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function PictureFrame() {
  return (
    <group position={[2.2, 1.5, -2.45]}>
      <mesh castShadow>
        <boxGeometry args={[0.8, 1.1, 0.05]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[0.7, 1]} />
        <meshStandardMaterial color="#d4c4b0" />
      </mesh>
    </group>
  );
}

function AccentLight({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[0.1, 0.6, 0.1]} />
      <meshStandardMaterial color="#fff" emissive={color} emissiveIntensity={2} />
      <pointLight intensity={1.5} distance={4} color={color} />
    </mesh>
  );
}

function Room() {
  return (
    <group>
      <Floor />
      <Rug />
      <Wall position={[0, 1.5, -2.5]} size={[6, 3, 0.2]} />
      <Wall position={[-2.5, 1.5, 0]} rotation={[0, Math.PI / 2, 0]} size={[5, 3, 0.2]} />
      <TVUnit />
      <SofaMesh />
      <CoffeeTable />
      <FloorLamp />
      <PendantLight />
      <Plant />
      <PictureFrame />
      <AccentLight position={[-2.4, 1.5, -2.4]} color="#ffaa44" />
      <AccentLight position={[2.4, 1.5, -2.4]} color="#ffaa44" />
      <AccentLight position={[-2.4, 1.5, 2.4]} color="#ffaa44" />
      <AccentLight position={[2.4, 1.5, 2.4]} color="#ffaa44" />
    </group>
  );
}

function Scene3D() {
  return (
    <Canvas
      shadows
      camera={{ position: [5, 4, 5], fov: 45 }}
      style={{ background: "#d0d0d5" }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 3]} intensity={1} castShadow shadow-mapSize={1024} />
      <Room />
      <Grid
        position={[0, -0.02, 0]}
        args={[20, 20]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#8888aa"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#aaaacc"
        fadeDistance={15}
        fadeStrength={1}
        infiniteGrid
      />
      <OrbitControls
        autoRotate
        autoRotateSpeed={0.5}
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.2}
        minAzimuthAngle={-Math.PI / 4}
        maxAzimuthAngle={Math.PI / 4}
      />
      <ContactShadows position={[0, -0.01, 0]} opacity={0.4} scale={20} blur={2} far={5} />
      <Environment preset="apartment" />
    </Canvas>
  );
}

/* ═══════════════════════════════════════
   UI COMPONENTS
   ═══════════════════════════════════════ */

type Mode = "login" | "register";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { icon: Box, label: "Walls", active: true },
    { icon: Layers, label: "Floor", active: false },
    { icon: Sofa, label: "Furniture", active: false },
    { icon: Lamp, label: "Decor", active: false },
    { icon: Lightbulb, label: "Lighting", active: false },
  ];

  return (
    <div className={styles.container}>
      {/* ─── LEFT PANEL ─── */}
      <div className={styles.leftPanel}>
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <div className={styles.logoShape} />
          </div>
          <div>
            <h1 className={styles.logoText}>espasyo</h1>
            <p className={styles.logoTagline}>Design your space. Inspire life.</p>
          </div>
        </div>

        <h2 className={styles.heading}>
          {mode === "login" ? "Welcome back!" : "Create account"}
        </h2>
        <p className={styles.subheading}>
          {mode === "login" ? "Log in to continue designing." : "Start your design journey today."}
        </p>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${mode === "login" ? styles.tabActive : ""}`}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            className={`${styles.tab} ${mode === "register" ? styles.tabActive : ""}`}
            onClick={() => setMode("register")}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputWrapper}>
            <Mail size={18} className={styles.inputIcon} />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              required
            />
          </div>

          <div className={styles.inputWrapper}>
            <Lock size={18} className={styles.inputIcon} />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className={styles.eyeBtn}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {mode === "login" && (
            <div className={styles.rowBetween}>
              <label className={styles.remember}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Remember me
              </label>
              <a href="#" className={styles.link}>
                Forgot password?
              </a>
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} className={styles.submitBtn}>
            {loading ? "Please wait..." : mode === "login" ? "Log In" : "Create Account"}
            <ArrowRight size={18} />
          </button>
        </form>

        <div className={styles.divider}>
          <span />
          <p>or continue with</p>
          <span />
        </div>

        <button className={styles.socialBtn}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Google
        </button>

        <button className={styles.socialBtn}>
          <svg width="18" height="18" viewBox="0 0 21 21">
            <rect x="1" y="1" width="9" height="9" fill="#f25022" />
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
            <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
            <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
          </svg>
          Microsoft
        </button>

        <p className={styles.footerText}>
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            className={styles.link}
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Register" : "Log in"}
          </button>
        </p>
      </div>

      {/* ─── RIGHT PANEL (3D) ─── */}
      <div className={styles.rightPanel}>
        <Scene3D />

        {/* Overlay text */}
        <div className={styles.overlayText}>
          <h2>
            Bring your
            <br />
            <span>dream</span> space
            <br />
            to life.
          </h2>
          <p>
            Intuitive tools. Realistic results.
            <br />
            Endless possibilities.
          </p>
        </div>

        {/* Right-side tool icons */}
        <div className={styles.toolIcons}>
          {[Box, Layers, Lightbulb, Sofa].map((Icon, i) => (
            <div key={i} className={styles.toolIcon}>
              <Icon size={20} />
            </div>
          ))}
        </div>

        {/* Bottom design steps */}
        <div className={styles.stepsBar}>
          {steps.map((step, i) => (
            <div key={step.label} className={styles.stepGroup}>
              <div className={styles.step}>
                <div className={`${styles.stepBox} ${step.active ? styles.stepBoxActive : ""}`}>
                  <step.icon size={18} />
                </div>
                <span className={step.active ? styles.stepLabelActive : styles.stepLabel}>
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && <div className={styles.stepLine} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}