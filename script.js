const targetTime = new Date("2026-10-10T11:00:00-03:00").getTime();

const timeParts = {
  days: document.getElementById("days"),
  hours: document.getElementById("hours"),
  minutes: document.getElementById("minutes"),
  seconds: document.getElementById("seconds"),
};

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
    document.getElementById("reunion-message").textContent = "The wait is over. Happy haunting, together. ♡";
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

updateCountdown();
setInterval(updateCountdown, 1000);

// A brief, non-interactive apparition on each visit, once the photo is ready.
const surprise = document.querySelector(".surprise");
const surpriseImage = surprise.querySelector("img");
function showSurprise() {
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && surpriseImage.naturalWidth > 0) {
    surprise.classList.add("play");
  }
}
if (surpriseImage.complete) showSurprise();
else surpriseImage.addEventListener("load", showSurprise, { once: true });
surprise.addEventListener("animationend", () => surprise.remove(), { once: true });

