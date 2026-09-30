import type { Corner } from "./Corner";

export interface Wall {

    id: string;

    start: Corner;

    end: Corner;

}