function createElement(className, innerText) {
  const element = document.createElement(innerText ? "span" : "div");
  element.className = className;
  element.innerText = innerText ?? "";
  return element;
}

const eventColors = {
  "Chung": "#62b7d8",
  "Lịch học": "#6fd0db",
  "Lịch thi": "#e97c9b",
  "Bài tập": "#f4bf68",
  "Họp lớp": "#bd7df5",
  "Cá nhân": "#88d288",
  "Khác": "#c4c3c1",
};
const locale = "vi-VN";

const eventLists = document.querySelector(".event-lists");

function addEvent({ title, type, location, start_date, end_date }) {
  const eventCard = createElement("event-card");

  const eventIndicator = createElement("event-indicator");
  eventIndicator.style.backgroundColor = eventColors[type];
  eventCard.appendChild(eventIndicator);

  const startDate = new Date(start_date);
  const endDate = new Date(end_date);

  const startTime = startDate.toLocaleString(locale, { hour: "2-digit", minute: "2-digit" });
  const endTime = endDate.toLocaleString(locale, { hour: "2-digit", minute: "2-digit" });
  const time = `${startTime} - ${endTime}`;

  const month = startDate.toLocaleString(locale, { month: "long" });
  const weekday = startDate.toLocaleString(locale, { weekday: "long" });
  const day = startDate.getDay();

  const eventDetails = createElement("event-details");
  eventDetails.appendChild(createElement("event-title", title));
  eventDetails.appendChild(createElement("event-time", time));
  eventDetails.appendChild(createElement("event-location", location));
  eventCard.appendChild(eventDetails);

  const eventDate = createElement("event-date");
  eventDate.appendChild(createElement("event-month", month));
  eventDate.appendChild(createElement("event-weekday", weekday));
  eventDate.appendChild(createElement("event-day", day));
  eventCard.appendChild(eventDate);

  eventLists.appendChild(eventCard);
}

async function login() {
  const params = new URLSearchParams(location.search);
  if (params.has("code")) {
    await pywebview.api.exchange(location.href);
    location.search = "";
  }

  const authUrl = await pywebview.api.authorize();
  if (authUrl !== true)
    location.href = authUrl;
}

async function updateEvents() {
  const now = new Date();
  const day = now.getDay();

  const diffToMonday = day === 0 ? 6 : day - 1;

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - diffToMonday);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const events = await pywebview.api.fetch_events(weekStart.toISOString(), weekEnd.toISOString());
  eventLists.innerHTML = "";
  events.forEach(addEvent);
}

window.addEventListener("pywebviewready", () => {
  const setLocked = () => eventLists.classList.toggle("pywebview-drag-region", !pywebview.state.locked);
  pywebview.state.addEventListener("change", setLocked);
  setLocked();
  login().then(updateEvents);
});
