export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function money(n, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  let a = Math.abs(n);
  return (
    (n < 0 ? "−" : "") +
    "$" +
    (a >= 1e9
      ? (a / 1e9).toFixed(digits) + "B"
      : a >= 1e6
        ? (a / 1e6).toFixed(digits) + "M"
        : a >= 1e3
          ? (a / 1e3).toFixed(1) + "K"
          : a.toLocaleString("en-US", { maximumFractionDigits: 2 }))
  );
}
export const pct = (n, d = 1) =>
  Number.isFinite(n) ? (n * 100).toFixed(d) + "%" : "—";
export const number = (n, d = 0) =>
  Number.isFinite(n)
    ? n.toLocaleString("en-US", { maximumFractionDigits: d })
    : "—";
export const tone = (n) => (n >= 0 ? "positive" : "negative");
export const button = (label, action, id = "", className = "", extra = "") =>
  `<button type="button" class="${className}" data-action="${action}" data-id="${esc(id)}" ${extra}>${label}</button>`;
export const tag = (text, type = "") =>
  `<span class="tag ${type}">${esc(text)}</span>`;
export const stat = (label, value, note, icon = "◇") =>
  `<div class="card"><div class="metric-label">${esc(label)}<span class="badge-icon">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-foot">${note}</div></div>`;
export const empty = (text, action = "") =>
  `<div class="empty">${text}${action ? '<div class="action-row center">' + action + "</div>" : ""}</div>`;
export const field = (label, name, type, value, extra = "") =>
  `<label class="form-row"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
export const select = (label, name, options, current) =>
  `<label class="form-row"><span>${label}</span><select name="${name}">${options.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(current) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`;
export const row = (label, value, cls = "") =>
  `<div class="statement-row ${cls}"><span>${label}</span><strong>${value}</strong></div>`;
let chartId = 0;
export function chart(
  values,
  {
    height = 210,
    color = "#72975f",
    currency = true,
    label = "Historical values",
  } = {},
) {
  let data = values.length > 1 ? values : [values[0] || 0, values[0] || 0],
    min = Math.min(...data),
    max = Math.max(...data),
    range = Math.max(max - min, Math.abs(max) * 0.08, 1);
  min -= range * 0.12;
  max += range * 0.12;
  const points = data.map((n, i) => [
      55 + (i / (data.length - 1)) * 530,
      175 - ((n - min) / (max - min)) * 150,
    ]),
    id = "fill" + chartId++;
  return `<svg class="chart" style="height:${height}px" viewBox="0 0 605 205" role="img" aria-label="${esc(label)}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${color}" stop-opacity=".21"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${[
    0, 1, 2, 3,
  ]
    .map((i) => {
      let y = 25 + i * 50,
        n = max - ((max - min) * i) / 3;
      return `<line x1="55" x2="590" y1="${y}" y2="${y}" stroke="#e8eee8" stroke-dasharray="3 4"/><text x="0" y="${y + 4}" fill="#8b9c90" font-size="10">${currency ? money(n, 1) : number(n, 2)}</text>`;
    })
    .join(
      "",
    )}<path d="M${points.map((p) => p.join(",")).join(" L")} L585,185 L55,185 Z" fill="url(#${id})"/><polyline points="${points.map((p) => p.join(",")).join(" ")}" stroke="${color}" fill="none" stroke-width="2.5"/><circle cx="585" cy="${points.at(-1)[1]}" r="4" fill="${color}" stroke="white" stroke-width="2"/></svg>`;
}
export const heading = (title, note, aside = "") =>
  `<div class="card-header"><div><h2>${title}</h2>${note ? '<p class="subtitle">' + note + "</p>" : ""}</div>${aside}</div>`;
export function newsList(logs) {
  return logs.length
    ? logs
        .map(
          (l) =>
            `<div class="news-item"><span class="news-dot ${l.type === "alert" ? "red" : ""}"></span><div><p>${esc(l.text)}</p><small>Turn ${l.turn} · ${esc(l.type)}</small></div></div>`,
        )
        .join("")
    : empty("Your next decision will start the story.");
}
