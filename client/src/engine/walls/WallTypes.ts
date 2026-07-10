import { Vector3 } from "three";

export interface Wall {
  id: string;

  start: Vector3;

  end: Vector3;

  height: number;

  thickness: number;
}