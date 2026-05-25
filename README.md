# 🎮 Kéo Búa Bao — Multiplayer Socket.IO Game

## Cài đặt & Chạy

### 1. Cài dependencies
```bash
cd rps-game
npm install
```

### 2. Khởi động server
```bash
node server.js
# hoặc dùng nodemon để auto-restart:
npm run dev
```

### 3. Mở trình duyệt
Truy cập: http://localhost:3000

Mở **2 tab/cửa sổ** để chơi với nhau!

---

## Cấu trúc
```
rps-game/
├── server.js          ← Node.js + Socket.IO server
├── package.json
└── public/
    └── index.html     ← Client (HTML + CSS + JS)
```

## Luật chơi
- ✊ **Kéo** thắng ✌️ Búa
- 🤚 **Bao** thắng ✊ Kéo  
- ✌️ **Búa** thắng 🤚 Bao

## Tính năng
- Tạo phòng / Vào phòng bằng mã 5 ký tự
- Danh sách phòng real-time
- Hiển thị lựa chọn sau khi cả 2 đã chọn
- Đánh lại mà không cần rời phòng
- Xử lý khi đối thủ rời phòng
- Server log màu với thời gian
