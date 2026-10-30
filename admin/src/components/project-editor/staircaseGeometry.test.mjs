import assert from "node:assert/strict";
import test from "node:test";
import {
    calculateStraightStaircaseGeometry,
    calculateStraightStaircaseRailings,
    calculateStaircaseDimensionsForFootprint,
    calculateStaircaseGeometry,
    getStaircaseFootprint,
    validateStaircaseDimensions
} from "../../../../shared/staircaseGeometry.ts";

const dimensions = {
    width: 1.2,
    totalRise: 3,
    riserCount: 12,
    treadDepth: 0.28
};

test("straight staircase geometry uses risers for rise and one fewer tread for the run", () => {
    const geometry = calculateStraightStaircaseGeometry(dimensions);

    assert.equal(geometry.riserHeight, 0.25);
    assert.equal(geometry.treadCount, 11);
    assert.equal(geometry.run, 3.08);
    assert.equal(geometry.treadThickness, 0.04);
    assert.equal(geometry.treads.length, 11);
    assert.equal(geometry.risers.length, 12);
    assert.equal(geometry.treads[0].y, 0.23);
    assert.equal(geometry.treads.at(-1).y, 2.73);
    assert.equal(geometry.treads[0].depth, dimensions.width);
    assert.ok(Math.abs(geometry.treads[0].x - geometry.treads[0].width / 2) < 1e-12);
    assert.ok(Math.abs(
        geometry.treads.at(-1).x + geometry.treads.at(-1).width / 2 - geometry.run
    ) < 1e-12);
    assert.equal(geometry.risers[0].y - geometry.risers[0].height / 2, 0);
    assert.equal(
        geometry.risers.at(-1).y + geometry.risers.at(-1).height / 2,
        dimensions.totalRise
    );
    assert.equal("bodyProfile" in geometry, false);
});

test("footprint dimensions use a preferred riser height and preserve the drawn run", () => {
    const derived = calculateStaircaseDimensionsForFootprint(3.2, 1.1);
    const geometry = calculateStraightStaircaseGeometry(derived);

    assert.equal(derived.totalRise, 2.8);
    assert.equal(derived.riserCount, 16);
    assert.equal(geometry.riserHeight, 0.175);
    assert.equal(geometry.treadCount, 15);
    assert.ok(Math.abs(derived.treadDepth - 3.2 / 15) < 1e-12);
    assert.ok(Math.abs(geometry.run - 3.2) < 1e-12);
    assert.equal(derived.width, 1.1);
    assert.equal(derived.railings, true);
});

test("configured step count divides the full wall-height rise and fits the drawn run", () => {
    const derived = calculateStaircaseDimensionsForFootprint(4, 1.2, 3.2, 0.28, 0.175, 18);
    const geometry = calculateStraightStaircaseGeometry(derived);

    assert.equal(derived.riserCount, 18);
    assert.equal(derived.totalRise, 3.2);
    assert.equal(geometry.riserHeight, 3.2 / 18);
    assert.equal(geometry.treadCount, 17);
    assert.equal(derived.treadDepth, 4 / 17);
    assert.equal(geometry.run, 4);
});

test("invalid dimensions are rejected before generating geometry", () => {
    for (const invalid of [
        { ...dimensions, width: 0 },
        { ...dimensions, totalRise: Number.NaN },
        { ...dimensions, riserCount: 2.5 },
        { ...dimensions, riserCount: 1 },
        { ...dimensions, totalRise: 4, riserCount: 2 },
        { ...dimensions, treadDepth: 0.1 },
        { ...dimensions, treadDepth: 1, riserCount: 80 },
        { ...dimensions, totalRise: 0.3, riserCount: 80 }
    ]) {
        assert.ok(validateStaircaseDimensions(invalid));
        assert.throws(() => calculateStraightStaircaseGeometry(invalid));
    }
});

test("footprint rotates around its lower endpoint in the floor coordinate system", () => {
    const footprint = getStaircaseFootprint(
        { x: 2, z: 3 },
        2,
        4,
        Math.PI / 2
    );

    assert.ok(Math.abs(footprint[0].x - 1) < 1e-10);
    assert.ok(Math.abs(footprint[0].z - 3) < 1e-10);
    assert.ok(Math.abs(footprint[1].x - 1) < 1e-10);
    assert.ok(Math.abs(footprint[1].z + 1) < 1e-10);
    assert.ok(Math.abs(footprint[2].x - 3) < 1e-10);
    assert.ok(Math.abs(footprint[2].z + 1) < 1e-10);
});

test("railing rails ascend between vertical posts and mirror across the stair width", () => {
    const geometry = calculateStraightStaircaseGeometry({
        width: 1.2,
        totalRise: 2.8,
        riserCount: 16,
        treadDepth: 3.2 / 15
    });
    const sides = calculateStraightStaircaseRailings(geometry);

    assert.equal(sides.length, 2);
    assert.ok(sides[0].rotationZ > 0);
    for (const railing of sides) {
        assert.ok(Math.abs(railing.center.z) > 0.5);
        assert.equal(railing.posts[0].x, 0.025);
        assert.equal(railing.posts[1].x, geometry.run - 0.025);
        assert.equal(railing.posts[0].y - 0.45, 0);
        assert.equal(railing.posts[1].y - 0.45, geometry.totalRise);
        assert.ok(Math.abs(
            railing.center.y - railing.length / 2 * Math.sin(railing.rotationZ) - 0.925
        ) < 1e-12);
        assert.ok(Math.abs(
            railing.center.y + railing.length / 2 * Math.sin(railing.rotationZ)
            - geometry.totalRise - 0.925
        ) < 1e-12);
        assert.ok(Math.abs(railing.posts[0].y + 0.45
            - (railing.center.y - railing.length / 2 * Math.sin(railing.rotationZ) - 0.025)) < 1e-12);
        assert.ok(Math.abs(railing.posts[1].y + 0.45
            - (railing.center.y + railing.length / 2 * Math.sin(railing.rotationZ) - 0.025)) < 1e-12);
    }
    assert.equal(sides[0].center.x, sides[1].center.x);
    assert.equal(sides[0].center.y, sides[1].center.y);
    assert.equal(sides[0].center.z, -sides[1].center.z);
    assert.equal(sides[0].rotationZ, sides[1].rotationZ);
});

test("L-shaped staircases connect perpendicular flights with a landing for either turn", () => {
    for (const turnDirection of ["left", "right"]) {
        const geometry = calculateStaircaseGeometry({
            width: 2.4,
            totalRise: 2.8,
            riserCount: 16,
            treadDepth: 4 / 15,
            shape: "l-shaped",
            turnDirection
        });

        assert.equal(geometry.flights.length, 2);
        assert.equal(geometry.landings.length, 1);
        assert.deepEqual(geometry.flights[0].direction, { x: 1, z: 0 });
        assert.deepEqual(
            geometry.flights[1].direction,
            { x: 0, z: turnDirection === "left" ? 1 : -1 }
        );
        assert.equal(
            geometry.flights[0].riserCount + geometry.flights[1].riserCount,
            16
        );
        assert.ok(Math.abs(
            geometry.flights[0].totalRise + geometry.flights[1].totalRise - 2.8
        ) < 1e-12);
        assert.equal(geometry.flights[1].startRise, geometry.flights[0].totalRise);
        assert.equal(geometry.railings.length, 4);
        const [firstFlight, secondFlight] = geometry.flights;
        const [landing] = geometry.landings;
        const firstFlightEnd = {
            x: firstFlight.start.x + firstFlight.direction.x * firstFlight.run,
            z: firstFlight.start.z + firstFlight.direction.z * firstFlight.run
        };
        const landingStartEdgeX = landing.center.x - landing.size.x / 2;
        const landingExitEdgeZ = landing.center.z +
            secondFlight.direction.z * landing.size.z / 2;
        assert.ok(Math.abs(firstFlightEnd.x - landingStartEdgeX) < 1e-12);
        assert.ok(Math.abs(firstFlightEnd.z - landing.center.z) < 1e-12);
        assert.ok(Math.abs(secondFlight.start.x - landing.center.x) < 1e-12);
        assert.ok(Math.abs(secondFlight.start.z - landingExitEdgeZ) < 1e-12);
        assert.equal(firstFlight.width, landing.size.z);
        assert.equal(secondFlight.width, landing.size.x);
        assert.ok(Math.abs(
            landing.center.y + landing.size.y / 2 - firstFlight.totalRise
        ) < 1e-12);
        const firstFlightLastTread = firstFlight.treads.at(-1);
        assert.ok(Math.abs(
            firstFlightLastTread.position.x + firstFlightLastTread.size.x / 2 -
            landingStartEdgeX
        ) < 1e-12);
        const secondFlightFirstTread = secondFlight.treads[0];
        assert.ok(Math.abs(
            secondFlightFirstTread.position.z -
            secondFlight.direction.z * secondFlightFirstTread.size.z / 2 -
            landingExitEdgeZ
        ) < 1e-12);
        for (let flightIndex = 0; flightIndex < geometry.flights.length; flightIndex += 1) {
            const flight = geometry.flights[flightIndex];
            const flightRails = geometry.railings.slice(flightIndex * 2, flightIndex * 2 + 2);
            for (const rail of flightRails) {
                assert.ok(rail.end.y > rail.start.y);
                assert.equal(rail.posts.length, 2);
                assert.ok(Math.abs(rail.posts[0].position.y - (flight.startRise + 0.45)) < 1e-12);
                assert.ok(Math.abs(
                    rail.posts[1].position.y - (flight.startRise + flight.totalRise + 0.45)
                ) < 1e-12);
                const cross = { x: -flight.direction.z, z: flight.direction.x };
                const firstOffset =
                    (rail.posts[0].position.x - flight.start.x) * cross.x +
                    (rail.posts[0].position.z - flight.start.z) * cross.z;
                assert.ok(Math.abs(
                    Math.abs(firstOffset) - (flight.width / 2 + 0.025)
                ) < 1e-12);
            }
            assert.equal(flightRails[0].start.y, flightRails[1].start.y);
            assert.equal(flightRails[0].end.y, flightRails[1].end.y);
        }
        for (const flight of geometry.flights) {
            assert.equal(flight.treads.length, flight.riserCount - 1);
            assert.equal(flight.risers.length, flight.riserCount);
            assert.ok(flight.treadDepth >= 0.15 && flight.treadDepth <= 1);
        }
    }
});

test("U-shaped staircases use opposing parallel flights, an open central gap, and a connecting landing", () => {
    const geometry = calculateStaircaseGeometry({
        width: 2.4,
        totalRise: 2.8,
        riserCount: 16,
        treadDepth: 4 / 15,
        shape: "u-shaped"
    });

    assert.equal(geometry.flights.length, 2);
    assert.equal(geometry.landings.length, 1);
    assert.deepEqual(geometry.flights[0].direction, { x: 1, z: 0 });
    assert.deepEqual(geometry.flights[1].direction, { x: -1, z: 0 });
    assert.notEqual(geometry.flights[0].start.z, geometry.flights[1].start.z);
    assert.equal(
        geometry.flights[0].riserCount + geometry.flights[1].riserCount,
        16
    );
    assert.ok(Math.abs(
        geometry.flights[0].totalRise + geometry.flights[1].totalRise - 2.8
    ) < 1e-12);
    const firstLaneEdge = geometry.flights[0].start.z + geometry.flights[0].width / 2;
    const secondLaneEdge = geometry.flights[1].start.z - geometry.flights[1].width / 2;
    assert.ok(secondLaneEdge - firstLaneEdge >= 0.15 - 1e-12);
    assert.ok(geometry.landings[0].size.z >= geometry.width);
    assert.equal(geometry.railings.length, 4);
    for (const rail of geometry.railings) {
        assert.ok(rail.end.y > rail.start.y);
    }
});

test("straight generic geometry remains equivalent to the legacy generator", () => {
    const legacy = calculateStraightStaircaseGeometry(dimensions);
    const generic = calculateStaircaseGeometry({ ...dimensions, shape: "straight" });
    assert.equal(generic.flights.length, 1);
    assert.deepEqual(
        generic.flights[0].treads.map(box => ({
            x: box.position.x,
            y: box.position.y,
            width: box.size.x,
            height: box.size.y,
            depth: box.size.z
        })),
        legacy.treads
    );
    assert.deepEqual(
        generic.flights[0].risers.map(box => ({
            x: box.position.x,
            y: box.position.y,
            width: box.size.x,
            height: box.size.y,
            depth: box.size.z
        })),
        legacy.risers
    );
});
