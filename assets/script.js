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

function addEvent({ title, type, location, startDate, endDate, isNow }) {
  const eventCard = createElement("event-card");
  if (isNow)
    eventCard.classList.add("event-now");

  const eventIndicator = createElement("event-indicator");
  eventIndicator.style.backgroundColor = eventColors[type];
  eventCard.appendChild(eventIndicator);

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
  if (authUrl === true)
    return true;

  location.href = authUrl;
  return false;
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
  const filteredEvents = events
      .map(event => {
        event.startDate = new Date(event.start_date);
        event.endDate = new Date(event.end_date);
        event.isNow = event.startDate < now && event.endDate > now;
        return event;
      })
      .toSorted((a, b) => a.startDate - b.startDate)
      .filter(event => event.endDate > now);
  if (filteredEvents.length > 0) {
    eventLists.innerHTML = "";
    filteredEvents.forEach(addEvent);
  }
}

window.addEventListener("pywebviewready", async () => {
  const setLocked = () => eventLists.classList.toggle("pywebview-drag-region", !pywebview.state.locked);
  pywebview.state.addEventListener("change", setLocked);
  setLocked();
  if (await login())
    updateEvents();
});
