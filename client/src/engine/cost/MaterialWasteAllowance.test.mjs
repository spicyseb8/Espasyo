import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createServer } from "vite";

const vite = await createServer({
    appType: "custom",
    configFile: false,
    optimizeDeps: { noDiscovery: true },
    root: process.cwd(),
    server: { middlewareMode: true, hmr: false }
});

const { calculateMaterialWasteReportTotals } = await vite.ssrLoadModule(
    "/../shared/cost/MaterialWasteAllowance.ts"
);

after(async () => {
    await vite.close();
});

test("adds 10% to wall and flooring categories without changing other costs", () => {
    const floors = [
        {
            subtotal: 18000,
            items: [
                { category: "wallFinish", subtotal: 5000 },
                { category: "flooring", subtotal: 10000 },
                { category: "furniture", subtotal: 2000 },
                { category: "doors", subtotal: 1000 }
            ]
        }
    ];

    const totals = calculateMaterialWasteReportTotals(floors);

    assert.deepEqual(totals.floors[0], {
        wallMaterials: {
            originalSubtotal: 5000,
            allowance: 500,
            adjustedSubtotal: 5500
        },
        flooringMaterials: {
            originalSubtotal: 10000,
            allowance: 1000,
            adjustedSubtotal: 11000
        },
        subtotal: 19500
    });
    assert.equal(totals.total, 19500);
    assert.equal(floors[0].subtotal, 18000);
});

test("calculates allowances independently for each floor and ignores empty categories", () => {
    const totals = calculateMaterialWasteReportTotals([
        {
            subtotal: 15000,
            items: [
                { category: "wallFinish", subtotal: 5000 },
                { category: "flooring", subtotal: 10000 }
            ]
        },
        {
            subtotal: 2300,
            items: [
                { category: "furniture", subtotal: 2000 },
                { category: "windows", subtotal: 300 }
            ]
        }
    ]);

    assert.deepEqual(
        totals.floors.map(floor => floor.subtotal),
        [16500, 2300]
    );
    assert.deepEqual(totals.floors[1].wallMaterials, {
        originalSubtotal: 0,
        allowance: 0,
        adjustedSubtotal: 0
    });
    assert.deepEqual(totals.floors[1].flooringMaterials, {
        originalSubtotal: 0,
        allowance: 0,
        adjustedSubtotal: 0
    });
    assert.equal(totals.total, 18800);
});
