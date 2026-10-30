export type StaircaseShape = "straight" | "l-shaped" | "u-shaped";
export type StaircaseTurnDirection = "left" | "right";

export interface StaircaseDimensions {
    width: number;
    totalRise: number;
    riserCount: number;
    treadDepth: number;
    treadThickness?: number;
    railings?: boolean;
    shape?: StaircaseShape;
    turnDirection?: StaircaseTurnDirection;
}

export interface ProceduralStaircaseData extends StaircaseDimensions {
    id: string;
    position: { x: number; y: number; z: number };
    rotationY: number;
    shape: StaircaseShape;
    flights?: StaircaseFlightParameters[];
}

export interface StaircaseLandingData {
    id: string;
    stairId: string;
    stairConnectionId: string;
    floorId: string;
    position: { x: number; y: number; z: number };
    rotationY: number;
    width: number;
    run: number;
}

export interface StaircaseStepBox {
    x: number;
    y: number;
    width: number;
    height: number;
    depth: number;
}

export interface StraightStaircaseGeometry {
    width: number;
    totalRise: number;
    riserCount: number;
    riserHeight: number;
    treadDepth: number;
    treadCount: number;
    run: number;
    treadThickness: number;
    riserThickness: number;
    treads: StaircaseStepBox[];
    risers: StaircaseStepBox[];
}

export interface StaircaseGeometryBox {
    position: { x: number; y: number; z: number };
    size: { x: number; y: number; z: number };
}

export interface StaircaseFlightGeometry {
    id: string;
    start: { x: number; y: number; z: number };
    startRise: number;
    direction: { x: number; z: number };
    width: number;
    run: number;
    riserCount: number;
    totalRise: number;
    riserHeight: number;
    treadDepth: number;
    treads: StaircaseGeometryBox[];
    risers: StaircaseGeometryBox[];
}

export interface StaircaseFlightParameters {
    id: string;
    start: { x: number; y: number; z: number };
    direction: { x: number; z: number };
    width: number;
    run: number;
    riserCount: number;
    totalRise: number;
    riserHeight: number;
    treadDepth: number;
}

export interface StaircaseLandingGeometry {
    center: { x: number; y: number; z: number };
    size: { x: number; y: number; z: number };
}

export interface StaircaseRailPost {
    position: { x: number; y: number; z: number };
    side: -1 | 1;
}

export interface StaircaseRailSegment {
    start: { x: number; y: number; z: number };
    end: { x: number; y: number; z: number };
    posts: StaircaseRailPost[];
}

export interface ProceduralStaircaseGeometry {
    shape: StaircaseShape;
    run: number;
    width: number;
    flights: StaircaseFlightGeometry[];
    landings: StaircaseLandingGeometry[];
    railings: StaircaseRailSegment[];
}

interface StaircaseFlightLayout {
    id: string;
    start: { x: number; z: number };
    startRise: number;
    direction: { x: number; z: number };
    width: number;
    run: number;
    riserCount: number;
    totalRise: number;
}

interface StaircasePlan {
    run: number;
    width: number;
    flights: StaircaseFlightLayout[];
    landings: StaircaseLandingGeometry[];
}

const STAIR_TREAD_THICKNESS = 0.04;
const STAIR_RISER_THICKNESS = 0.04;
const STAIR_RAIL_THICKNESS = 0.05;
const STAIR_POST_HEIGHT = 0.9;

function splitRiserCount(total: number, firstRun: number, secondRun: number): [number, number] {
    const first = Math.max(2, Math.min(total - 2,
        Math.round(total * firstRun / (firstRun + secondRun))
    ));
    return [first, total - first];
}

function createStaircasePlan(
    dimensions: StaircaseDimensions
): StaircasePlan | null {
    const run = (dimensions.riserCount - 1) * dimensions.treadDepth;
    const width = dimensions.width;
    const shape = dimensions.shape ?? "straight";
    if (shape === "straight") {
        return {
            run,
            width,
            flights: [{
                id: "flight-1",
                start: { x: 0, z: 0 },
                startRise: 0,
                direction: { x: 1, z: 0 },
                width,
                run,
                riserCount: dimensions.riserCount,
                totalRise: dimensions.totalRise
            }],
            landings: []
        };
    }

    if (dimensions.riserCount < 4) return null;
    if (shape === "l-shaped") {
        const laneWidth = Math.min(width / 2, 1.2);
        const firstRun = run - laneWidth;
        const secondRun = width - laneWidth;
        if (laneWidth < 0.3 || firstRun <= 0 || secondRun <= 0) return null;
        const [firstRisers, secondRisers] =
            splitRiserCount(dimensions.riserCount, firstRun, secondRun);
        const leftTurn = (dimensions.turnDirection ?? "left") === "left";
        const firstCenterZ = leftTurn
            ? -width / 2 + laneWidth / 2
            : width / 2 - laneWidth / 2;
        const secondDirection = leftTurn ? 1 : -1;
        const landingCenterZ = firstCenterZ;
        const firstRise = dimensions.totalRise * firstRisers / dimensions.riserCount;
        const landingCenterX = run - laneWidth / 2;
        const landingSize = { x: laneWidth, y: STAIR_TREAD_THICKNESS, z: laneWidth };
        const secondStart = {
            x: landingCenterX,
            z: landingCenterZ + secondDirection * landingSize.z / 2
        };
        return {
            run,
            width,
            flights: [
                {
                    id: "flight-1",
                    start: { x: 0, z: firstCenterZ },
                    startRise: 0,
                    direction: { x: 1, z: 0 },
                    width: laneWidth,
                    run: firstRun,
                    riserCount: firstRisers,
                    totalRise: firstRise
                },
                {
                    id: "flight-2",
                    start: secondStart,
                    startRise: firstRise,
                    direction: { x: 0, z: secondDirection },
                    width: laneWidth,
                    run: secondRun,
                    riserCount: secondRisers,
                    totalRise: dimensions.totalRise - firstRise
                }
            ],
            landings: [{
                center: {
                    x: landingCenterX,
                    y: firstRise - STAIR_TREAD_THICKNESS / 2,
                    z: landingCenterZ
                },
                size: landingSize
            }]
        };
    }

    const laneWidth = Math.min(1.2, (width - 0.15) / 2);
    const flightRun = run - laneWidth;
    const centralGap = width - 2 * laneWidth;
    if (laneWidth < 0.3 || centralGap < 0.15 - 1e-9 || flightRun <= 0) return null;
    const [firstRisers, secondRisers] =
        splitRiserCount(dimensions.riserCount, flightRun, flightRun);
    const firstRise = dimensions.totalRise * firstRisers / dimensions.riserCount;
    return {
        run,
        width,
        flights: [
            {
                id: "flight-1",
                start: { x: 0, z: -width / 2 + laneWidth / 2 },
                startRise: 0,
                direction: { x: 1, z: 0 },
                width: laneWidth,
                run: flightRun,
                riserCount: firstRisers,
                totalRise: firstRise
            },
            {
                id: "flight-2",
                start: { x: run - laneWidth, z: width / 2 - laneWidth / 2 },
                startRise: firstRise,
                direction: { x: -1, z: 0 },
                width: laneWidth,
                run: flightRun,
                riserCount: secondRisers,
                totalRise: dimensions.totalRise - firstRise
            }
        ],
        landings: [{
            center: {
                x: run - laneWidth / 2,
                y: firstRise - STAIR_TREAD_THICKNESS / 2,
                z: 0
            },
            size: { x: laneWidth, y: STAIR_TREAD_THICKNESS, z: width }
        }]
    };
}

function createFlightGeometry(
    layout: StaircaseFlightLayout,
    thickness: number
): StaircaseFlightGeometry {
    const riserHeight = layout.totalRise / layout.riserCount;
    const treadDepth = layout.run / (layout.riserCount - 1);
    const alongX = layout.direction.x !== 0;
    const treadSize = alongX
        ? { x: treadDepth, y: thickness, z: layout.width }
        : { x: layout.width, y: thickness, z: treadDepth };
    const riserSize = alongX
        ? { x: STAIR_RISER_THICKNESS, y: riserHeight, z: layout.width }
        : { x: layout.width, y: riserHeight, z: STAIR_RISER_THICKNESS };
    const treads = Array.from({ length: layout.riserCount - 1 }, (_, index) => {
        const step = index + 1;
        const distance = (step - 0.5) * treadDepth;
        const center = {
            x: layout.start.x + layout.direction.x * distance,
            z: layout.start.z + layout.direction.z * distance
        };
        return {
            position: {
                x: center.x,
                y: layout.startRise + step * riserHeight - thickness / 2,
                z: center.z
            },
            size: treadSize
        };
    });
    const risers = Array.from({ length: layout.riserCount }, (_, index) => {
        const isFinal = index === layout.riserCount - 1;
        const height = isFinal ? riserHeight : riserHeight - thickness;
        const distance = index === 0
            ? STAIR_RISER_THICKNESS / 2
            : isFinal
                ? layout.run - STAIR_RISER_THICKNESS / 2
                : index * treadDepth;
        return {
            position: {
                x: layout.start.x + layout.direction.x * distance,
                y: layout.startRise + index * riserHeight + height / 2,
                z: layout.start.z + layout.direction.z * distance
            },
            size: { ...riserSize, y: height }
        };
    });
    return {
        id: layout.id,
        start: { ...layout.start, y: layout.startRise },
        startRise: layout.startRise,
        direction: layout.direction,
        width: layout.width,
        run: layout.run,
        riserCount: layout.riserCount,
        totalRise: layout.totalRise,
        riserHeight,
        treadDepth,
        treads,
        risers
    };
}

function createFlightRailings(flight: StaircaseFlightGeometry): StaircaseRailSegment[] {
    const startOffset = 0;
    const endOffset = flight.run;
    if (endOffset <= startOffset) return [];
    const railHeight = STAIR_POST_HEIGHT + STAIR_RAIL_THICKNESS / 2;
    const cross = { x: -flight.direction.z, z: flight.direction.x };
    return ([-1, 1] as const).map(side => {
        const sideOffset = side * (flight.width / 2 + STAIR_RAIL_THICKNESS / 2);
        const pointAt = (distance: number, elevation: number) => ({
            x: flight.start.x + flight.direction.x * distance + cross.x * sideOffset,
            y: flight.startRise + elevation + railHeight,
            z: flight.start.z + flight.direction.z * distance + cross.z * sideOffset
        });
        const postAt = (distance: number, elevation: number) => ({
            x: flight.start.x + flight.direction.x * distance + cross.x * sideOffset,
            y: flight.startRise + elevation + STAIR_POST_HEIGHT / 2,
            z: flight.start.z + flight.direction.z * distance + cross.z * sideOffset
        });
        return {
            start: pointAt(startOffset, 0),
            end: pointAt(endOffset, flight.totalRise),
            posts: [
                { position: postAt(-STAIR_RAIL_THICKNESS / 2, 0), side },
                { position: postAt(flight.run + STAIR_RAIL_THICKNESS / 2, flight.totalRise), side }
            ]
        };
    });
}

export function getStaircaseFootprintRun(dimensions: Pick<StaircaseDimensions, "riserCount" | "treadDepth">): number {
    return (dimensions.riserCount - 1) * dimensions.treadDepth;
}

export function calculateStaircaseGeometry(
    dimensions: StaircaseDimensions
): ProceduralStaircaseGeometry {
    const error = validateStaircaseDimensions(dimensions);
    if (error) throw new Error(error);
    const plan = createStaircasePlan(dimensions);
    if (!plan) throw new Error("The selected staircase shape does not fit the drawn footprint.");
    const flights = plan.flights.map(flight =>
        createFlightGeometry(flight, dimensions.treadThickness ?? STAIR_TREAD_THICKNESS)
    );
    return {
        shape: dimensions.shape ?? "straight",
        run: plan.run,
        width: plan.width,
        flights,
        landings: plan.landings,
        railings: flights.flatMap(createFlightRailings)
    };
}

export interface StraightStaircaseRailingSide {
    side: -1 | 1;
    center: { x: number; y: number; z: number };
    length: number;
    rotationZ: number;
    posts: Array<{ x: number; y: number; z: number }>;
}

export function calculateStraightStaircaseRailings(
    geometry: Pick<StraightStaircaseGeometry, "width" | "run" | "totalRise">
): StraightStaircaseRailingSide[] {
    const railThickness = 0.05;
    const postHeight = 0.9;
    const firstPostX = railThickness / 2;
    const lastPostX = geometry.run - railThickness / 2;
    const horizontalSpan = lastPostX - firstPostX;
    if (horizontalSpan <= 0) return [];

    return ([-1, 1] as const).map(side => {
        const centerZ = side * (geometry.width / 2 - railThickness / 2);
        const riseAt = (x: number) =>
            ((x - firstPostX) / horizontalSpan) * geometry.totalRise;
        const firstRise = riseAt(firstPostX);
        const lastRise = riseAt(lastPostX);
        return {
            side,
            center: {
                x: (firstPostX + lastPostX) / 2,
                y: (firstRise + lastRise) / 2 + postHeight + railThickness / 2,
                z: centerZ
            },
            length: Math.hypot(horizontalSpan, geometry.totalRise),
            rotationZ: Math.atan2(geometry.totalRise, horizontalSpan),
            posts: [
                { x: firstPostX, y: firstRise + postHeight / 2, z: centerZ },
                { x: lastPostX, y: lastRise + postHeight / 2, z: centerZ }
            ]
        };
    });
}

export function calculateStaircaseDimensionsForFootprint(
    run: number,
    width: number,
    totalRise = 2.8,
    preferredTreadDepth = 0.28,
    preferredRiserHeight = 0.175,
    configuredRiserCount?: number
): StaircaseDimensions {
    if (
        !Number.isFinite(run) ||
        !Number.isFinite(width) ||
        !Number.isFinite(totalRise) ||
        !Number.isFinite(preferredTreadDepth) ||
        preferredTreadDepth <= 0 ||
        !Number.isFinite(preferredRiserHeight) ||
        preferredRiserHeight <= 0
    ) {
        return { width, totalRise, riserCount: 0, treadDepth: Number.NaN };
    }

    const riserCount = configuredRiserCount === undefined
        ? Math.max(2, Math.min(80, Math.round(totalRise / preferredRiserHeight)))
        : configuredRiserCount;
    if (!Number.isInteger(riserCount) || riserCount < 2 || riserCount > 80) {
        return { width, totalRise, riserCount, treadDepth: Number.NaN };
    }
    const treadCount = riserCount - 1;
    return {
        width,
        totalRise,
        riserCount,
        treadDepth: run / treadCount,
        treadThickness: 0.04,
        railings: true
    };
}

export function validateStaircaseDimensions(
    dimensions: StaircaseDimensions
): string | null {
    if (!Number.isFinite(dimensions.width) || dimensions.width < 0.3 || dimensions.width > 20) {
        return "Stair width must be between 0.3 m and 20 m.";
    }
    if (!Number.isFinite(dimensions.totalRise) || dimensions.totalRise < 0.3 || dimensions.totalRise > 10) {
        return "Total rise must be between 0.3 m and 10 m.";
    }
    if (!Number.isInteger(dimensions.riserCount) || dimensions.riserCount < 2 || dimensions.riserCount > 80) {
        return "Riser count must be a whole number between 2 and 80.";
    }
    if (!Number.isFinite(dimensions.treadDepth) || dimensions.treadDepth < 0.15 || dimensions.treadDepth > 1) {
        return "Tread depth must be between 0.15 m and 1 m.";
    }
    if (dimensions.totalRise / dimensions.riserCount > 0.5) {
        return "Riser height cannot exceed 0.5 m.";
    }
    if (
        dimensions.treadThickness !== undefined &&
        (!Number.isFinite(dimensions.treadThickness) ||
            dimensions.treadThickness < 0.02 ||
            dimensions.treadThickness > 0.15)
    ) {
        return "Tread thickness must be between 0.02 m and 0.15 m.";
    }
    if (dimensions.totalRise / dimensions.riserCount <= (dimensions.treadThickness ?? 0.04)) {
        return "Riser height must be greater than tread thickness.";
    }
    if ((dimensions.riserCount - 1) * dimensions.treadDepth > 50) {
        return "The staircase run cannot exceed 50 m.";
    }
    if (dimensions.shape && !["straight", "l-shaped", "u-shaped"].includes(dimensions.shape)) {
        return "Choose a supported staircase shape.";
    }
    if (dimensions.shape === "l-shaped" || dimensions.shape === "u-shaped") {
        const plan = createStaircasePlan(dimensions);
        if (!plan) {
            return dimensions.shape === "u-shaped"
                ? "The U-shaped staircase needs room for two flights and a central gap."
                : "The L-shaped staircase needs room for two flights and a landing.";
        }
        for (const flight of plan.flights) {
            const flightTreadDepth = flight.run / (flight.riserCount - 1);
            if (flightTreadDepth < 0.15 || flightTreadDepth > 1) {
                return "The selected shape leaves a flight with an unreasonable tread depth.";
            }
        }
        if (dimensions.shape === "l-shaped" &&
            dimensions.turnDirection !== undefined &&
            dimensions.turnDirection !== "left" &&
            dimensions.turnDirection !== "right") {
            return "Choose a left or right turn for the L-shaped staircase.";
        }
    }
    return null;
}

export function calculateStraightStaircaseGeometry(
    dimensions: StaircaseDimensions
): StraightStaircaseGeometry {
    const error = validateStaircaseDimensions(dimensions);
    if (error) throw new Error(error);

    const treadThickness = dimensions.treadThickness ?? 0.04;
    const flight = createFlightGeometry({
        id: "flight-1",
        start: { x: 0, z: 0 },
        startRise: 0,
        direction: { x: 1, z: 0 },
        width: dimensions.width,
        run: getStaircaseFootprintRun(dimensions),
        riserCount: dimensions.riserCount,
        totalRise: dimensions.totalRise
    }, treadThickness);
    const treadCount = dimensions.riserCount - 1;
    return {
        ...dimensions,
        riserHeight: flight.riserHeight,
        treadCount,
        run: flight.run,
        treadThickness,
        riserThickness: STAIR_RISER_THICKNESS,
        treads: flight.treads.map(tread => ({
            x: tread.position.x,
            y: tread.position.y,
            width: tread.size.x,
            height: tread.size.y,
            depth: tread.size.z
        })),
        risers: flight.risers.map(riser => ({
            x: riser.position.x,
            y: riser.position.y,
            width: riser.size.x,
            height: riser.size.y,
            depth: riser.size.z
        }))
    };
}

export interface StairFootprintPoint {
    x: number;
    z: number;
}

export function getStaircaseFootprint(
    position: { x: number; z: number },
    width: number,
    run: number,
    rotationY: number
): StairFootprintPoint[] {
    const cosine = Math.cos(rotationY);
    const sine = Math.sin(rotationY);
    return [
        { x: 0, z: -width / 2 },
        { x: run, z: -width / 2 },
        { x: run, z: width / 2 },
        { x: 0, z: width / 2 }
    ].map(point => ({
        x: position.x + point.x * cosine + point.z * sine,
        z: position.z - point.x * sine + point.z * cosine
    }));
}
