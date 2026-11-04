# 🐑 Sheepa Library — Tủ Sách Tự Dịch

> Trang web đọc sách dịch cá nhân theo phong cách tối giản (Minimalism), hỗ trợ Light / Dark Mode, đọc trực tuyến mượt mà và tải sách về máy, được tối ưu riêng để lưu trữ miễn phí trên **GitHub Pages**.

---

## ✨ Điểm Nổi Bật

- 🌿 **Phong Cách Tối Giản (Minimalism)**: Thiết kế tập trung vào con chữ (Zen typography), không banner quảng cáo hay thành phần rườm rà.
- 🌓 **Light / Dark Mode**: Tự động nhận diện theme hệ thống, có nút chuyển đổi thủ công và lưu trạng thái vào trình duyệt.
- 📖 **Trình Đọc Zen Reader**:
  - Tùy chỉnh cỡ chữ ($A^-$ / $A^+$), đổi giữa font Serif (cổ điển) và Sans-serif (hiện đại).
  - Thanh tiến trình đọc (Reading progress bar) trực quan ở mép trên cùng.
  - Chuyển chương nhanh bằng nút bấm hoặc phím mũi tên `←` / `→`.
  - Mục lục chương dạng trượt (Drawer).
- 💾 **Tải Sách Offline**: Hỗ trợ tải định dạng `.txt` (thuần chữ) và `.md` (Markdown cho Obsidian/Notion).
- ⚡ **Tương thích 100% với GitHub Pages**: Định tuyến URL dạng hash (`#/`, `#/book/:id`, `#/read/:bookId/:chapterId`) giúp gửi link trực tiếp cho bạn bè mà không bao giờ gặp lỗi 404 khi tải lại trang!

---

## 📂 Cấu Trúc Thư Mục

```text
sheepa-library/
├── index.html                   # Trang chủ chính
├── data/
│   └── books.json               # Danh mục toàn bộ sách (tác giả, tình trạng, chương)
├── content/
│   ├── books/                   # Nội dung từng cuốn sách dịch
│   │   ├── hoang-tu-be/
│   │   │   ├── chuong-1.md
│   │   │   ├── chuong-2.md
│   │   │   └── chuong-3.md
│   │   └── nha-gia-kim/
│   └── downloads/               # File sách tải về (.txt, .epub, .pdf)
├── public/
│   ├── assets/                  # Logo Sheepa
│   └── icons/                   # Bộ 60 icon Sheepa
├── src/
│   ├── css/
│   │   └── style.css            # Toàn bộ CSS giao diện & theme
│   └── js/
│       └── app.js               # Logic router, markdown renderer, reader settings
└── .github/
    └── workflows/
        └── deploy.yml           # Tự động xuất bản lên GitHub Pages mỗi khi push
```

---

## 🚀 Hướng Dẫn Đưa Lên GitHub Pages (3 Bước Đơn Giản)

### Cách 1: Sử dụng GitHub Desktop hoặc Git (Khuyên dùng)
1. Đăng nhập [GitHub.com](https://github.com) và tạo một Repository mới (ví dụ đặt tên là `sheepa-library` hoặc `<ten-tai-khoan>.github.io`), để chế độ **Public**.
2. Đẩy toàn bộ thư mục này lên GitHub repository đó:
   ```bash
   git init
   git add .
   git commit -m "Khởi tạo website Sheepa Library"
   git branch -M main
   git remote add origin https://github.com/<ten-tai-khoan>/sheepa-library.git
   git push -u origin main
   ```
3. Truy cập vào Repository trên GitHub:
   - Vào **Settings** -> **Pages**.
   - Ở mục **Build and deployment** > **Source**, chọn **GitHub Actions**.
4. GitHub Actions sẽ tự động chạy file `.github/workflows/deploy.yml` và kích hoạt website của bạn tại địa chỉ:
   `https://<ten-tai-khoan>.github.io/sheepa-library/`

---

### Cách 2: Tải lên trực tiếp qua giao diện web GitHub (Nếu không dùng Git)
1. Tạo Repository mới trên GitHub (chọn **Public** và tích **Add a README file**).
2. Nhấn nút **Add file** -> **Upload files**, kéo thả toàn bộ các file và thư mục của dự án vào và nhấn **Commit changes**.
3. Vào **Settings** -> **Pages** -> Chọn Source là **GitHub Actions**.

---

## ✍️ Cách Thêm Cuốn Sách Mới hoặc Thêm Chương Mới

Mỗi khi dịch xong một cuốn sách hoặc chương mới, bạn chỉ cần thực hiện 2 thao tác cực kỳ đơn giản:

### 1. Tạo file nội dung chương (`.md`)
Tạo file trong thư mục `content/books/<ten-sach>/chuong-x.md`:
```markdown
# Chương I: Tiêu đề chương

Nội dung bản dịch của bạn ở đây...
Bạn có thể in đậm **chữ**, in nghiêng *chữ*, hoặc làm trích dẫn:
> "Lời thoại hoặc triết lý đáng nhớ..."
```

### 2. Khai báo vào `data/books.json`
Mở file `data/books.json` và thêm chương hoặc cuốn sách mới:
```json
{
  "id": "ten-sach",
  "title": "Tên Sách Tiếng Việt",
  "originalTitle": "Tựa Gốc",
  "author": "Tên Tác Giả",
  "translator": "Sheepa Translator",
  "category": "Văn học cổ điển",
  "status": "ongoing",
  "statusText": "Đang dịch",
  "icon": "public/icons/01_sheep_reading.png",
  "description": "Tóm tắt ngắn gọn về tác phẩm...",
  "chapters": [
    {
      "id": "chuong-1",
      "title": "Chương I: Tiêu đề chương",
      "path": "content/books/ten-sach/chuong-1.md"
    }
  ]
}
```

Website sẽ tự động cập nhật danh sách và mục lục ngay lập tức!
