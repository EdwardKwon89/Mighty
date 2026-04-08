const { spawn } = require("child_process");
const path = require("path");

const ROOM_ID = "Prime_Field_Test_" + Date.now();
const BOT_NAMES = ["King", "Queen", "Jack", "Ace", "Joker"];

console.log(`\n🚀 [ORCHESTRATOR] Starting Real-World Simulation...`);
console.log(`🌐 [ROOM] Targeting Room ID: ${ROOM_ID}\n`);

const processes = [];

BOT_NAMES.forEach((name, i) => {
  const p = spawn("./apps/web/node_modules/.bin/ts-node", ["--project", "apps/web/tsconfig.json", "scripts/play_agent.ts", name, ROOM_ID], {
    shell: true,
    cwd: process.cwd()
  });

  p.stdout.on("data", (data) => {
    process.stdout.write(`[${name}] ${data.toString()}`);
  });

  p.stderr.on("data", (data) => {
    process.stderr.write(`🔴 [${name}] ERROR: ${data.toString()}`);
  });

  processes.push(p);
});

process.on("SIGINT", () => {
  console.log("\n[ORCHESTRATOR] Terminating simulation...");
  processes.forEach(p => p.kill());
  process.exit();
});

console.log(`\n✅ [ORCHESTRATOR] 5 Agents deployed. Monitoring session...\n`);
