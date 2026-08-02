const targetTime = new Date("2026-08-09T13:55:00+03:00").getTime();
const callsigns = ["TK8810", "THY8810"];

const timeParts = {
  days: document.getElementById("days"),
  hours: document.getElementById("hours"),
  minutes: document.getElementById("minutes"),
  seconds: document.getElementById("seconds"),
};

const flightDot = document.getElementById("flight-dot");
const flightMessage = document.getElementById("flight-message");
const flightDetails = document.getElementById("flight-details");

function pad(value) {
  return String(value).padStart(2, "0");
}

function updateCountdown() {
  const distance = targetTime - Date.now();

  if (distance <= 0) {
    timeParts.days.textContent = "00";
    timeParts.hours.textContent = "00";
    timeParts.minutes.textContent = "00";
    timeParts.seconds.textContent = "00";
    return;
  }

  const totalSeconds = Math.floor(distance / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  timeParts.days.textContent = pad(days);
  timeParts.hours.textContent = pad(hours);
  timeParts.minutes.textContent = pad(minutes);
  timeParts.seconds.textContent = pad(seconds);
}

function setFlightState(type, message, details = "") {
  flightDot.className = `status-dot ${type}`;
  flightMessage.textContent = message;

  if (details) {
    flightDetails.hidden = false;
    flightDetails.innerHTML = details;
  } else {
    flightDetails.hidden = true;
    flightDetails.innerHTML = "";
  }
}

function formatCoordinate(value) {
  return Number(value).toFixed(3);
}

async function checkFlight() {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch("https://opensky-network.org/api/states/all", {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error("OpenSky did not return flight data.");
    }

    const data = await response.json();
    const state = data.states?.find((item) => callsigns.includes(String(item[1]).trim().toUpperCase()));

    if (!state) {
      setFlightState(
        "quiet",
        "Live aircraft data is not showing TK8810 yet. The tracker links below are ready for takeoff day."
      );
      return;
    }

    const longitude = formatCoordinate(state[5]);
    const latitude = formatCoordinate(state[6]);
    const altitude = state[7] ? `${Math.round(state[7]).toLocaleString()} m` : "Unavailable";
    const speed = state[9] ? `${Math.round(state[9] * 3.6).toLocaleString()} km/h` : "Unavailable";

    setFlightState(
      "live",
      "TK8810 appears to be live in public aircraft data.",
      `<p><strong>Position:</strong> ${latitude}, ${longitude}</p>
       <p><strong>Altitude:</strong> ${altitude}</p>
       <p><strong>Ground speed:</strong> ${speed}</p>`
    );
  } catch (error) {
    setFlightState(
      "quiet",
      "Live lookup is not available from this browser right now. Use the tracker links below for TK8810."
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
}

updateCountdown();
checkFlight();

setInterval(updateCountdown, 1000);
setInterval(checkFlight, 5 * 60 * 1000);
