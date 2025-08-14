const WebSocket = require("ws");
const express = require("express");
const app = express();
const PORT = process.env.PORT || 5000;

// --- CÁC THAM SỐ CẤU HÌNH ---
const WS_URL = "wss://mynygwais.hytsocesk.com/websocket";
const accessToken = "1-0145210c67b14454531b06399b829270"; // Nhớ thay token của bạn
const ID = "binhtool90";

// --- BIẾN TOÀN CỤC ---
let ws;
let keepAliveInterval; 
let pingCounter = 1;
let lastResults = [];
let lastPingTime = Date.now(); // ✅ PHỤC HỒI BIẾN THEO DÕI THỜI GIAN
let currentData = {
  id: ID,
  time: null,
  phien_truoc: {},
  phien_ke_tiep: {},
  pattern: "",
  du_doan: ""
};

// --- CÁC HÀM TIỆN ÍCH ---
function timestamp() {
  return new Date().toLocaleTimeString("vi-VN", { hour12: false });
}

function predictFromMD5(md5) {
  if (!md5 || typeof md5 !== "string") return "Không rõ";
  const char = md5[0].toLowerCase();
  const num = parseInt(char, 16);
  return isNaN(num) ? "Không rõ" : (num % 2 === 0 ? "Xỉu" : "Tài");
}

// --- LOGIC WEBSOCKET CHÍNH ---
function connectWebSocket() {
  if (ws) {
    ws.removeAllListeners();
    ws.terminate();
  }
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }

  ws = new WebSocket(WS_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Origin: "https://i.hit.club",
      Host: "mynygwais.hytsocesk.com"
    }
  });

  console.log(`[...] Đang kết nối đến WebSocket...`);

  ws.on("open", () => {
    console.log(`[✅ ${timestamp()}] WebSocket đã kết nối`);
    lastPingTime = Date.now(); // ✅ RESET BỘ ĐẾM KHI KẾT NỐI MỚI

    ws.send(JSON.stringify([
      1, "MiniGame", "", "", {
        agentId: "1",
        accessToken,
        reconnect: false
      }
    ]));

    setTimeout(() => {
      ws.send(JSON.stringify([
        6, "MiniGame", "taixiuKCBPlugin", { cmd: 2001 }
      ]));
    }, 1000);
    
    keepAliveInterval = setInterval(() => {
      try {
        ws.send(JSON.stringify(["7", "MiniGame", "1", pingCounter++]));
        ws.send(JSON.stringify([
            6, "MiniGame", "taixiuKCBPlugin", { cmd: 2001 }
        ]));
      } catch (e) {
        console.log(`[‼️ ${timestamp()}] Lỗi khi gửi ping:`, e.message);
      }
    }, 10000);
  });

  ws.on("message", (msg) => {
    lastPingTime = Date.now(); // ✅ CẬP NHẬT KHI CÓ TIN NHẮN MỚI
    try {
      const data = JSON.parse(msg);
      // Logic xử lý message giữ nguyên hoàn toàn
      if (!Array.isArray(data) || data[0] !== 5 || typeof data[1] !== "object") return;
      const d = data[1].d;
      if (!d || typeof d.cmd !== "number") return;
      
      const { cmd, sid, md5 } = d;

      if (cmd === 2005) {
        currentData.phien_ke_tiep = { sid, md5 };
        console.log(`[⏭️ ${timestamp()}] Phiên kế tiếp: ${sid} | MD5: ${md5}`);
      }

      if (cmd === 2006 && d.d1 !== undefined) {
        const { d1, d2, d3 } = d;
        const total = d1 + d2 + d3;
        const result = total >= 11 ? "Tài" : "Xỉu";

        lastResults.push(result === "Tài" ? "t" : "x");
        if (lastResults.length > 10) lastResults.shift();

        const pattern = lastResults.join("");
        const du_doan = predictFromMD5(currentData.phien_ke_tiep.md5);

        currentData.phien_truoc = {
          sid,
          ket_qua: `${d1}-${d2}-${d3} = ${total} (${result})`,
          md5
        };
        currentData.pattern = pattern;
        currentData.du_doan = du_doan;
        currentData.time = timestamp();

        console.log(`[🎲 ${timestamp()}] Phiên ${sid}: ${d1}-${d2}-${d3} = ${total} ➜ ${result}`);
        console.log(`           ➜ Dự đoán cho phiên này là: ${du_doan} | Pattern: ${pattern}`);
      }
    } catch (err) {
      // Bỏ qua lỗi
    }
  });

  ws.on("close", () => {
    console.log(`[❌ ${timestamp()}] Mất kết nối WebSocket. Sẽ kết nối lại sau 5 giây...`);
    clearInterval(keepAliveInterval);
    setTimeout(connectWebSocket, 5000);
  });

  ws.on("error", (err) => {
    console.log(`[‼️ ${timestamp()}] WebSocket lỗi:`, err.message);
    ws.close();
  });
}

// ✅ THÊM LẠI BỘ KIỂM TRA ZOMBIE
setInterval(() => {
  const now = Date.now();
  const diff = now - lastPingTime;
  if (diff > 30000) { // Nếu im lặng hơn 30 giây
    console.log(`[⛔ ${timestamp()}] Không có phản hồi trong ${Math.round(diff / 1000)}s. Buộc kết nối lại...`);
    connectWebSocket(); // Gọi hàm kết nối chính để khởi động lại toàn bộ
  }
}, 15000); // Kiểm tra mỗi 15 giây

// --- KHỞI CHẠY SERVER API ---
app.get("/data", (req, res) => {
  res.json(currentData);
});
app.get("/", (req, res) => {
  res.send("🎲 Tool Tài Xỉu HitClub (Hybrid Connect) - by binhtool90 đang chạy...");
});
app.listen(PORT, () => {
  console.log(`[🌐] Server đang chạy tại http://localhost:${PORT}`);
  connectWebSocket();
});
