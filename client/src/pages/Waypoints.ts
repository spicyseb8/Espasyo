export type Vec3 = [number, number, number];

export interface Waypoint {
  id: string;
  name: string;
  blurb: string;
  position: Vec3; // camera eye   (Three.js Y-up space)
  target: Vec3; // lookAt         (Three.js Y-up space)
}

export const MODEL_URL = "/homemodel/interior.opt.glb";

// The waypoints below are already shifted to the model's native location,
// so the model itself must NOT be moved.
export const MODEL_OFFSET: Vec3 = [0, 0, 0];

// Model rotation in radians (Euler XYZ). Adjust this if the GLB is turned wrong.
export const MODEL_ROTATION: Vec3 = [0, 0, 0];

// The array below is written in Z-up numbers (z = height). Three.js is Y-up,
// so convert each vector:  [x, y, z]  ->  [x, z, -y]
const zUp = ([x, y, z]: Vec3): Vec3 => [x, z, -y];

interface ZUpWaypoint extends Omit<Waypoint, "position" | "target"> {
  position: Vec3;
  target: Vec3;
}

const WAYPOINTS_Z_UP: ZUpWaypoint[] = [
  {
    id: "waypoint-1",
    name: "Waypoint 1",
    blurb: "",
    position: [0.19, 9.21, 0.38],
    target: [0.45, 4.07, 0.34],
  },
  {
    id: "waypoint-2",
    name: "Waypoint 2",
    blurb: "",
    position: [-2.65, 6.38, 0.42],
    target: [-6.61, 11.01, 0.26],
  },
  {
    id: "waypoint-3",
    name: "Waypoint 3",
    blurb: "",
    position: [4.41, 14.63, 0.42],
    target: [5.32, 6.04, 0.29],
  },
  {
    id: "waypoint-4",
    name: "Waypoint 4",
    blurb: "",
    position: [0.09, 8.24, 0.42],
    target: [0.38, 4.06, 0.33],
  },
  {
    id: "waypoint-5",
    name: "Waypoint 5",
    blurb: "",
    position: [2.61, 6.74, 0.77],
    target: [-1.98, 11.87, 0.48],
  },
];

export const WAYPOINTS: Waypoint[] = WAYPOINTS_Z_UP.map((wp) => ({
  ...wp,
  position: zUp(wp.position),
  target: zUp(wp.target),
}));