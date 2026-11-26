# Mindmap V3.1 – cấu hình nộp bài

## 1. Chuẩn bị

- Tạo một Google Sheets trống dành riêng cho Mindmap; sao chép ID giữa /d/ và /edit trong URL.
- Tạo một thư mục Google Drive riêng tư để lưu JSON bài nộp; sao chép ID thư mục. Không chia sẻ công khai thư mục hoặc bảng tính.
- Tạo dự án Google Apps Script riêng tại script.google.com, dán toàn bộ MindmapServer.gs.
- Trong Cài đặt dự án > Thuộc tính tập lệnh, thêm:
  - MINDMAP_SPREADSHEET_ID: ID bảng tính.
  - MINDMAP_FOLDER_ID: ID thư mục.
  - MINDMAP_TEACHER_PASSWORD: mật khẩu mạnh, tối thiểu 12 ký tự. Không ghi vào HTML hoặc GitHub.

## 2. Triển khai

Triển khai > Tùy chọn triển khai mới > Ứng dụng web. Thực thi với tư cách chủ sở hữu; quyền truy cập phù hợp với tài khoản trường (nếu cần học sinh không đăng nhập, chọn Bất kỳ ai nếu chính sách cho phép). Cấp quyền Drive và Sheets. Sao chép URL kết thúc /exec. Không dùng URL /dev.

## 3. Giáo viên

Mở mindmap.html > Thêm > Giáo viên. Nhập URL /exec và mật khẩu. Nhiệm vụ mặc định TIN9_B7 được tạo tự động. Có thể tạo nhiệm vụ riêng, ghi lại mã MM-... và gửi cho học sinh cùng URL /exec. Lọc theo lớp, nhiệm vụ, tên/STT, Mới nhất/Điểm cao nhất/Tất cả lượt; đặt sĩ số thực tế (1–50) để xem STT chưa nộp. Xem sơ đồ, tải JSON, sửa thông tin, nhập điểm và nhận xét, ẩn bài sai, xuất CSV. Danh sách tự cập nhật 45 giây khi đang mở bảng. Phiên giáo viên 20 phút, dùng sessionStorage lưu token, không lưu mật khẩu. Đăng xuất khi dùng máy chung.

## 4. Học sinh

Bài mặc định TIN9_B7 không cần nhập mã nhiệm vụ. Lần đầu nhập URL /exec tại Nộp bài hoặc Nhiệm vụ. Nếu giáo viên giao nhiệm vụ riêng, nhập mã nhiệm vụ tương ứng. Tạo sơ đồ, Kiểm tra, Nộp bài. Nhập họ tên, lớp 9A1–9A9, STT 1–50. Chỉ coi là đã nộp khi ứng dụng xác nhận. Lưu mã xem nhận xét trên thiết bị riêng nếu cần chuyển máy. Khi mất kết nối, giữ nguyên sơ đồ và thông tin, dùng Kiểm tra bài đã lưu hoặc thử lại; không tạo bài mới chỉ để gửi lại.

## 5. Dữ liệu và giới hạn

- Sheet Mindmap_NhiemVu: thông tin nhiệm vụ.
- Sheet Mindmap_BaiNop: thông tin bài, mã yêu cầu, băm mã truy cập, ID tệp riêng tư, trạng thái, điểm, nhận xét.
- JSON nằm trong thư mục Drive riêng tư. Không lưu payload ảnh trực tiếp vào ô Sheets.
- Giới hạn bài nộp: 4 MB theo độ dài chuỗi JSON (không phải dung lượng tệp chính xác). Mỗi bài chỉnh sửa rồi nộp lại tạo một bản ghi mới. Yêu cầu trùng được kiểm tra bằng requestId và mã bí mật.
- Mã truy cập nhận xét lưu trong trình duyệt; máy dùng chung không phải môi trường riêng tư. Không dùng dữ liệu thật trước khi kiểm tra quyền truy cập.
- Chưa có giới hạn tần suất theo IP hoặc xác thực danh tính học sinh. Chỉ dùng trong phạm vi lớp học có giám sát; không coi đây là cổng thi bảo mật cao.
- Kiểm tra CORS/redirect, quyền tải file và IndexedDB trong Chrome 75 và iframe Google Sites. Nếu môi trường nhúng chặn, thử mở trang trực tiếp. Không coi HTTP no-cors là xác nhận nộp thành công.
- Khi thay đổi Apps Script, cập nhật bản triển khai (Manage deployments > Edit > New version).

- Xóa bài trong dashboard là xóa mềm: trạng thái Đã xóa, không xóa file Drive hoặc dòng dữ liệu. Các bản ghi cũ có STT ngoài 1–50 không bị tự động xóa.
- V3.1 dùng Apps Script riêng của Mindmap; không sửa các Web App của các bài học khác.
