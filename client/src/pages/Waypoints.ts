// Waypoints.ts

export type Vec3 = [number, number, number];

export interface Waypoint {
  id: string;
  name: string;
  blurb: string;
  position: Vec3; // camera eye   (Three.js Y-up space)
  target: Vec3;   // lookAt       (Three.js Y-up space)
}

export const MODEL_URL = "/homemodel/interior.opt.glb";

// Model transform (tuned in loader)
export const MODEL_OFFSET: Vec3 = [0, 1.7, 0];
export const MODEL_ROTATION: Vec3 = [-0.087266, 0.034907, 0.017453];

// Waypoints captured in Three.js Y-up space.
// Order is reversed from capture: the walkthrough now plays 4 → 3 → 2 → 1.
export const WAYPOINTS: Waypoint[] = [
  {
    id: "waypoint-1",
    name: "Waypoint 1",
    blurb: "",
    position: [2.1, 1.6, -6.46],
    target: [-2.7, 1.74, -11.97],
  },
  {
    id: "waypoint-2",
    name: "Waypoint 2",
    blurb: "",
    position: [2.8, 1.3, -7.23],
    target: [7.06, 1.59, -10.03],
  },
  {
    id: "waypoint-3",
    name: "Waypoint 3",
    blurb: "",
    position: [0.65, 1.6, -3.73],
    target: [-4.68, 1.53, -3.41],
  },
  {
    id: "waypoint-4",
    name: "Waypoint 4",
    blurb: "",
    position: [0.07, 1.91, -8.8],
    target: [0.44, 1.97, -4.07],
  },
];