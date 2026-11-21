const video = document.querySelector("#video");
const stage = document.querySelector("#cameraStage");
const startButton = document.querySelector("#startButton");
const stopButton = document.querySelector("#stopButton");
const calibrateButton = document.querySelector("#calibrateButton");
const stageHint = document.querySelector("#stageHint");
const errorMessage = document.querySelector("#errorMessage");
const status = document.querySelector("#status");
const swatch = document.querySelector("#swatch");
const colorName = document.querySelector("#colorName");
const colorHex = document.querySelector("#colorHex");
const calibrationStatus = document.querySelector("#calibrationStatus");
const canvas = document.querySelector("#sampleCanvas");
const context = canvas.getContext("2d", { willReadFrequently: true });

let cameraStream;
let colorCalibration;
let calibrating = false;

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
    colorCalibration = undefined;
    calibrating = true;
    startButton.hidden = true;
    stopButton.hidden = false;
    stageHint.hidden = false;
    calibrateButton.disabled = false;
    calibrateButton.textContent = "Lấy mẫu giấy trắng";
    stageHint.textContent = "Chạm vào giấy trắng dưới cùng nguồn sáng để hiệu chuẩn";
    calibrationStatus.textContent = "Cần hiệu chuẩn ánh sáng";
    status.textContent = "Cần hiệu chuẩn";
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
    calibrateButton.disabled = true;
  }
}

function beginCalibration() {
  if (!cameraStream) return;
  errorMessage.hidden = true;
  calibrating = true;
  stageHint.textContent = "Hướng camera vào giấy trắng rồi chạm lên giấy";
  calibrationStatus.textContent = "Đang chờ mẫu giấy trắng";
  status.textContent = "Đang hiệu chuẩn";
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
  calibrateButton.disabled = true;
  stageHint.hidden = true;
  calibrating = false;
  colorCalibration = undefined;
  calibrationStatus.textContent = "Chưa hiệu chuẩn";
  status.textContent = "Camera đã tắt";
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  status.textContent = "Không mở được camera";
}

function createCalibration(red, green, blue) {
  return {
    red: Math.min(3, 220 / red),
    green: Math.min(3, 220 / green),
    blue: Math.min(3, 220 / blue),
  };
}

function correctColor(red, green, blue, calibration) {
  return {
    red: Math.min(255, Math.round(red * calibration.red)),
    green: Math.min(255, Math.round(green * calibration.green)),
    blue: Math.min(255, Math.round(blue * calibration.blue)),
  };
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
  const channels = [[], [], []];

  for (let index = 0; index < pixels.length; index += 4) {
    channels[0].push(pixels[index]);
    channels[1].push(pixels[index + 1]);
    channels[2].push(pixels[index + 2]);
  }

  const [red, green, blue] = channels.map((channel) => {
    channel.sort((a, b) => a - b);
    return channel[Math.floor(channel.length / 2)];
  });

  if (calibrating) {
    if (Math.min(red, green, blue) < 70 || Math.max(red, green, blue) > 245) {
      showError("Mẫu chưa phù hợp. Hãy dùng giấy trắng dưới ánh sáng đều, tránh quá tối hoặc lóa sáng.");
      return;
    }

    colorCalibration = createCalibration(red, green, blue);
    calibrating = false;
    errorMessage.hidden = true;
    calibrateButton.textContent = "Cân bằng lại";
    stageHint.textContent = "Đã cân bằng. Chạm vào vật thể để xem màu";
    calibrationStatus.textContent = "Đã hiệu chuẩn • hiệu chuẩn lại khi đổi ánh sáng";
    status.textContent = "Đã hiệu chuẩn";
    return;
  }

  if (!colorCalibration) {
    beginCalibration();
    showError("Trước tiên hãy cân bằng bằng giấy trắng dưới cùng nguồn sáng.");
    return;
  }

  const corrected = correctColor(red, green, blue, colorCalibration);
  const correctedRed = corrected.red;
  const correctedGreen = corrected.green;
  const correctedBlue = corrected.blue;
  const hex = `#${[correctedRed, correctedGreen, correctedBlue].map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`;

  swatch.style.background = hex;
  swatch.setAttribute("aria-label", `Mẫu màu ${hex}`);
  colorName.textContent = getColorName(correctedRed, correctedGreen, correctedBlue);
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
calibrateButton.addEventListener("click", (event) => {
  event.stopPropagation();
  beginCalibration();
});
stage.addEventListener("click", sampleColor);
window.addEventListener("pagehide", stopCamera);

if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Không thể đăng ký chế độ ngoại tuyến:", error);
    });
  });
}
