import { HOUSE_CATS } from "./challenge.js";
import { crewStamps, stampCount, SKIES } from "./crew-progress.js";
export function catAvatar(name) {
  const cat = HOUSE_CATS.find((cat) => cat.name === name) || HOUSE_CATS[0];
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="21" fill="${cat.body}18"/><path d="M12 31 10 11 28 22m9 0 17-11-2 21" fill="${cat.ear}" stroke="${cat.body}" stroke-width="3"/><ellipse cx="32" cy="37" rx="23" ry="20" fill="${cat.body}"/><path d="m23 21 4 8m5-11v10m9-7-4 8M11 36l8 3m-7 7 8-2m33-8-8 3m7 7-8-2" stroke="${cat.stripe}" stroke-width="3" stroke-linecap="round"/><ellipse cx="23" cy="37" rx="5" ry="5.5" fill="${cat.eyes}"/><ellipse cx="41" cy="37" rx="5" ry="5.5" fill="${cat.eyes}"/><path d="M23 34v6m18-6v6" stroke="#18202a" stroke-width="2.5" stroke-linecap="round"/><path d="m29 44 3 3 3-3" fill="#d6a69f"/><path d="M26 49q3 3 6-2 3 5 6 2" fill="none" stroke="${cat.stripe}" stroke-width="1.8" stroke-linecap="round"/></svg>`;
}
const element = (tag, className, text = "") => {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
};
export function renderCrew(progress, sky, onSky) {
  const stamps = stampCount(progress);
  document.getElementById("stampTotal").textContent = `${stamps} / 9 stamps`;
  const grid = document.getElementById("crewBook");
  grid.replaceChildren();
  for (const cat of HOUSE_CATS) {
    const stats = progress.cats[cat.name],
      row = element("div", "crew-row"),
      avatar = element("span", "crew-avatar");
    avatar.innerHTML = catAvatar(cat.name);
    const info = element("div", "crew-info");
    info.append(
      element("strong", "", cat.name),
      element("small", "", `${stats.treats} treats · best ${stats.best}`),
    );
    const marks = element("div", "crew-stamps");
    for (const stamp of crewStamps(stats)) {
      const mark = element(
        "span",
        `crew-stamp${stamp.earned ? " earned" : ""}`,
        stamp.earned ? "✦" : "·",
      );
      mark.tabIndex = 0;
      const label = `${cat.name}: ${stamp.label} — ${stamp.earned ? "earned" : `${stamp.value}/${stamp.target}`}`;
      mark.setAttribute("aria-label", label);
      mark.dataset.tip = label;
      marks.append(mark);
    }
    row.append(avatar, info, marks);
    grid.append(row);
  }
  const choices = document.getElementById("skyPicker");
  choices.replaceChildren();
  for (const option of SKIES) {
    const locked = stamps < option.stamps,
      button = element("button", `sky-choice ${option.id}`);
    button.type = "button";
    button.disabled = locked;
    button.setAttribute("aria-pressed", String(option.id === sky.id));
    button.setAttribute(
      "aria-label",
      `${option.name}${locked ? `, unlock at ${option.stamps} stamps` : ""}`,
    );
    button.append(
      element("span", "sky-swatch"),
      element("span", "", option.name),
      element("small", "", locked ? `${option.stamps} stamps` : "Unlocked"),
    );
    button.addEventListener("click", () => onSky(option.id));
    choices.append(button);
  }
  document.getElementById("crewNext").textContent =
    stamps < 3
      ? `${3 - stamps} more stamps unlock Peach sunset.`
      : stamps < 6
        ? `${6 - stamps} more stamps unlock Catnip aurora.`
        : "Every sky is yours. The crew approves.";
}
