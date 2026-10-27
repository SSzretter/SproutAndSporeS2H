// Headless physics check: runs the default simulation state through simulateEnvironmentTick
// and prints room / tent climate and what each piece of equipment is doing.
// Usage: npm run sim -- [hours=12] [outdoorTempF=60] [outdoorRh=50]
(globalThis as any).localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { createDefaultSimulationState } = await import('../src/utils/storage.ts');
const { simulateEnvironmentTick } = await import('../src/utils/physics.ts');
const { getEquipmentActivity } = await import('../src/utils/equipmentStatus.ts');

const [hours = 12, outdoorTempF = 60, outdoorRh = 50] = process.argv.slice(2).map(Number);
const state = createDefaultSimulationState();
const outside = { ...state.outside, tempF: outdoorTempF, tempC: ((outdoorTempF - 32) * 5) / 9, rh: outdoorRh };

const fmt = (c: { tempF: number; rh: number; co2Ppm?: number }) =>
  `${c.tempF.toFixed(1)}°F  ${c.rh.toFixed(1)}% RH  ${Math.round(c.co2Ppm ?? 0)} ppm`;

let rooms = structuredClone(state.rooms ?? [state.room]);
let simTime = state.simTime;
const events: string[] = [];
for (let m = 0; m < hours * 60; m++) {
  simTime += 60_000;
  rooms = rooms.map(room => {
    const result = simulateEnvironmentTick(room, outside, simTime, 1);
    for (const e of result.events) events.push(`${new Date(simTime).toLocaleString()}  ${e.title}: ${e.message}`);
    return result.room;
  });
}

const hour = new Date(simTime).getHours();
console.log(`After ${hours} h, outdoors ${outdoorTempF}°F / ${outdoorRh}% RH (ends ${new Date(simTime).toLocaleString()})`);
for (const room of rooms) {
  console.log(`\n${room.name}: ${fmt(room.climate)}`);
  const show = (items: typeof room.items, indent: string) => {
    for (const item of items) {
      const a = getEquipmentActivity(item, hour);
      if (a) console.log(`${indent}${a.activity.padEnd(7)} ${item.name} — ${a.label}`);
    }
  };
  show(room.items, '  ');
  for (const tent of room.tents) {
    console.log(`  [${tent.name}] ${fmt(tent.climate)}`);
    show(tent.items, '    ');
  }
}
if (events.length) console.log(`\nEvents (${events.length}, last 10):\n${events.slice(-10).join('\n')}`);
