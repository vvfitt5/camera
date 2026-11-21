const video = document.querySelector("#video");
const stage = document.querySelector("#cameraStage");
const startButton = document.querySelector("#startButton");
const stopButton = document.querySelector("#stopButton");
const stageHint = document.querySelector("#stageHint");
const errorMessage = document.querySelector("#errorMessage");
const status = document.querySelector("#status");
const swatch = document.querySelector("#swatch");
const colorName = document.querySelector("#colorName");
const colorHex = document.querySelector("#colorHex");
const canvas = document.querySelector("#sampleCanvas");
const context = canvas.getContext("2d", { willReadFrequently: true });

let cameraStream;

async function startCamera() {
  errorMessage.hidden = true;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showError("Trình duyệt không hỗ trợ camera. Hãy mở trang bằng HTTPS trên trình duyệt mới.");
    return;
  }

  startButton.disabled = true;
  startButton.textContent = "Đang mở camera…";
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    });
    video.srcObject = cameraStream;
    await video.play();
    startButton.hidden = true;
    stopButton.hidden = false;
    stageHint.hidden = false;
    status.textContent = "Camera đang bật";
  } catch (error) {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = undefined;
      video.srcObject = null;
    }
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      showError("Bạn chưa cấp quyền camera. Hãy cho phép camera trong trình duyệt rồi thử lại.");
    } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      showError("Không tìm thấy camera trên thiết bị này.");
    } else {
      showError("Không mở được camera. Hãy kiểm tra quyền camera và thử lại.");
    }
    startButton.disabled = false;
    startButton.textContent = "Thử bật lại";
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = undefined;
  }
  video.srcObject = null;
  startButton.hidden = false;
  startButton.disabled = false;
  startButton.textContent = "Bật camera";
  stopButton.hidden = true;
  stageHint.hidden = true;
  status.textContent = "Camera đã tắt";
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  status.textContent = "Không mở được camera";
}

function sampleColor(event) {
  if (!cameraStream || !video.videoWidth || !video.videoHeight) return;

  const bounds = video.getBoundingClientRect();
  const scale = Math.max(bounds.width / video.videoWidth, bounds.height / video.videoHeight);
  const offsetX = (video.videoWidth * scale - bounds.width) / 2;
  const offsetY = (video.videoHeight * scale - bounds.height) / 2;
  const x = Math.max(0, Math.min(video.videoWidth - 1, (event.clientX - bounds.left + offsetX) / scale));
  const y = Math.max(0, Math.min(video.videoHeight - 1, (event.clientY - bounds.top + offsetY) / scale));
  const radius = 4;
  const left = Math.max(0, Math.round(x) - radius);
  const top = Math.max(0, Math.round(y) - radius);
  const width = Math.min(radius * 2 + 1, video.videoWidth - left);
  const height = Math.min(radius * 2 + 1, video.videoHeight - top);

  canvas.width = width;
  canvas.height = height;
  context.drawImage(video, left, top, width, height, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  let red = 0;
  let green = 0;
  let blue = 0;
  const count = pixels.length / 4;

  for (let index = 0; index < pixels.length; index += 4) {
    red += pixels[index];
    green += pixels[index + 1];
    blue += pixels[index + 2];
  }

  red = Math.round(red / count);
  green = Math.round(green / count);
  blue = Math.round(blue / count);
  const hex = `#${[red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`;

  swatch.style.background = hex;
  swatch.setAttribute("aria-label", `Mẫu màu ${hex}`);
  colorName.textContent = getColorName(red, green, blue);
  colorHex.textContent = hex;
}

function getColorName(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta < 0.08) {
    if (lightness < 0.14) return "Đen";
    if (lightness < 0.35) return "Xám đậm";
    if (lightness > 0.88) return "Trắng";
    if (lightness > 0.7) return "Xám nhạt";
    return "Xám";
  }

  let hue;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;

  if (hue < 15 || hue >= 345) return lightness < 0.35 ? "Đỏ sẫm" : "Đỏ";
  if (hue < 42) return lightness < 0.4 ? "Nâu" : "Cam";
  if (hue < 68) return "Vàng";
  if (hue < 155) return "Xanh lá";
  if (hue < 195) return "Xanh ngọc";
  if (hue < 255) return "Xanh dương";
  if (hue < 290) return "Tím";
  return "Hồng";
}

startButton.addEventListener("click", startCamera);
stopButton.addEventListener("click", stopCamera);
stage.addEventListener("click", sampleColor);
window.addEventListener("pagehide", stopCamera);

if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Không thể đăng ký chế độ ngoại tuyến:", error);
    });
  });
}
