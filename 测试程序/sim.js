"use strict";

const presets = [[1, 0, 3, 2], [2, 3, 0, 1], [3, 2, 1, 0]];
const pairLabels = ["0↔1  /  2↔3", "0↔2  /  1↔3", "0↔3  /  1↔2"];
const get = id => document.getElementById(id);
const server = n => "S0" + (n + 1);
const x = n => 103 + 178 * n;
const state = { topology: 0, src: 0, dst: 1, rate: 60, fallback: true };
let paused = false;
const colors = { opt: "#ace78c", idle: "#69897e", node: "#24443a", edge: "#577769", flow: "#ffb571", text: "#edf5ec", sub: "#adc5b8", elec: "#8faebe" };
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function svgText(cx, y, words, size = 13, fill = colors.sub, weight = 500, anchor = "middle") {
  return `<text x="${cx}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${words}</text>`;
}
function line(d, color, width = 2, extra = "") {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
}
function box(cx, y, w, h, fill, stroke, radius = 7) {
  return `<rect x="${cx - w / 2}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}"/>`;
}
function lane(i, partner) {
  const first = Math.min(i, partner);
  return first === 0 ? 70 : 87;
}
function routeType() {
  if (presets[state.topology][state.src] === state.dst) return "optical";
  return state.fallback ? "electrical" : "blocked";
}
function renderGraph(kind, sending) {
  const mate = presets[state.topology];
  let svg = box(370, 15, 695, 130, "#1b352d", "#4a6957", 10);
  svg += svgText(43, 42, "MEMS", 19, "#d4f7a6", 700, "start");
  svg += svgText(107, 41, "光交换矩阵", 12, colors.sub, 500, "start");
  svg += svgText(695, 41, "IN 01–04　/　OUT 17–20", 11, colors.sub, 500, "end");
  for (let i = 0; i < 4; i++) {
    const j = mate[i], a = x(i), b = x(j);
    if (i < j) {
      const y = lane(i, j);
      svg += line(`M${a} 106 V${y} H${b} V106`, colors.opt, 2.5);
    }
    svg += line(`M${a} 141 V199 M${a} 249 V290`, colors.idle, 2);
  }
  // The separate electrical path is an aggregate simulation of a ToR interconnect.
  const a = x(state.src), b = x(state.dst);
  if (kind === "electrical") {
    svg += line(`M${a} 206 V173 H${b} V206`, colors.elec, 2.5, 'stroke-dasharray="5 5"');
  }
  const y = kind === "optical" ? lane(state.src, state.dst) : 173;
  const route = `M${a} 304 V${y} H${b} V304`;
  if (sending) {
    svg += line(route, colors.flow, 3, 'stroke-dasharray="4 6"');
    const mid = (a + b) / 2, dir = Math.sign(b - a);
    svg += line(`M${mid - 5 * dir} ${y - 5} l${7 * dir} 5 l${-7 * dir} 5`, colors.flow, 3);
  }
  for (let i = 0; i < 4; i++) {
    const cx = x(i), active = i === state.src || i === state.dst;
    svg += box(cx, 106, 91, 36, "#254638", "#58775f", 4);
    svg += svgText(cx, 120, "IN　 OUT", 9);
    svg += svgText(cx, 136, `${i + 1}　/　${i + 17}`, 13, colors.text, 650);
    svg += box(cx, 198, 114, 52, colors.node, active ? "#b7c991" : colors.edge);
    svg += svgText(cx, 220, "ToR " + i, 19, colors.text, 700);
    for (let p = -2; p < 3; p++) svg += box(cx + p * 13, 232, 8, 5, "#86a593", "none", 1);
    svg += box(cx, 290, 136, 54, active ? "#304c3b" : "#203a32", active ? "#bbcd91" : colors.edge);
    svg += svgText(cx, 312, server(i) + (i === state.src ? " · 源" : i === state.dst ? " · 目的" : ""), 16, colors.text, 650);
    svg += svgText(cx, 332, "10.0.0." + (101 + i), 12);
  }
  if (sending && !reduceMotion.matches) {
    const duration = (3.3 - state.rate * 0.018).toFixed(2);
    svg += `<circle r="4" fill="${colors.flow}" stroke="#263827"><animateMotion dur="${duration}s" repeatCount="indefinite" path="${route}"/></circle>`;
  }
  get("network").innerHTML = svg;
}
function render() {
  const kind = routeType();
  const rate = paused || kind === "blocked" ? 0 : state.rate;
  renderGraph(kind, rate > 0);
  get("map-name").textContent = "拓扑 " + (state.topology + 1);
  get("route-nodes").textContent = server(state.src) + " → " + server(state.dst);
  get("route-kind").textContent = { optical: "光路直达", electrical: "电路径转发", blocked: "无可用路径" }[kind];
  get("delivered").textContent = rate;
  let why;
  if (kind === "optical") why = `ToR ${state.src} 与 ToR ${state.dst} 已配对，正向光路为 IN ${state.src + 1} → OUT ${state.dst + 17}。`;
  if (kind === "electrical") why = "两端未配对，使用模拟的机架间电路径。虚线代表逻辑连通，具体布线已简化。";
  if (kind === "blocked") why = "两端未配对，电路径已关闭。可以改变配对，或启用电路径恢复传输。";
  if (state.rate === 0) why += " 发送速率为零，业务空闲。";
  if (paused) why = "仿真已暂停。 " + why;
  get("explain").textContent = why;
  get("pause").textContent = paused ? "▷　继续仿真" : "Ⅱ　暂停仿真";
  get("pause").setAttribute("aria-pressed", String(paused));
  get("mappings").innerHTML = presets[state.topology].map((dst, src) =>
    `<div class="mapping"><b>IN ${src + 1} → OUT ${dst + 17}</b><span>ToR${src}→${dst}</span></div>`).join("");
}
function logEvent(message) {
  const li = document.createElement("li"), time = document.createElement("time");
  time.textContent = new Date().toLocaleTimeString("en-GB");
  li.append(time, document.createTextNode(message));
  const list = get("events");
  list.prepend(li);
  if (list.children.length > 40) list.lastElementChild.remove();
}
function readForm() {
  return {
    topology: Number(document.querySelector('input[name="topology"]:checked').value),
    src: Number(get("src").value), dst: Number(get("dst").value),
    rate: Number(get("rate").value), fallback: get("fallback").checked
  };
}
function updateDraft() {
  const draft = readForm();
  get("requested").textContent = draft.rate + " Gbit/s";
  const valid = draft.src !== draft.dst;
  const changed = Object.keys(state).some(k => state[k] !== draft[k]);
  get("apply").disabled = !valid || !changed;
  get("draft-state").textContent = !valid ? "源节点和目的节点须不同" : changed ? "有待应用的更改" : "配置已同步";
}
get("presets").innerHTML = pairLabels.map((label, i) =>
  `<label class="preset"><input type="radio" name="topology" value="${i}" ${i === 0 ? "checked" : ""}><b>拓扑 ${i + 1}</b><code>${label}</code></label>`).join("");
for (const endpoint of ["src", "dst"]) {
  for (let i = 0; i < 4; i++) get(endpoint).add(new Option(server(i), i));
  get(endpoint).value = state[endpoint];
}
get("controls").addEventListener("input", updateDraft);
get("reverse").addEventListener("click", () => {
  const from = get("src").value;
  get("src").value = get("dst").value;
  get("dst").value = from;
  updateDraft();
});
get("controls").addEventListener("submit", e => {
  e.preventDefault();
  if (get("apply").disabled) return;
  Object.assign(state, readForm());
  render();
  logEvent(`拓扑 ${state.topology + 1} · ${get("route-nodes").textContent} · ${get("route-kind").textContent} · 请求 ${state.rate} Gbit/s`);
  updateDraft();
});
get("pause").addEventListener("click", () => {
  paused = !paused;
  render();
  logEvent(paused ? "暂停业务传输" : "恢复业务传输");
});
reduceMotion.addEventListener("change", render);
updateDraft();
render();
logEvent("仿真启动 · 拓扑 1 · S01 → S02");
