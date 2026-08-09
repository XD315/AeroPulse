# 1. Đánh giá các vấn đề phát sinh
## Tuần 1 
### 1.1 Vì sao giữ TP.HCM trong danh sách dù thường xuyên thiếu dữ liệu
- Chọn: vẫn thu thập, chấp nhận tỷ lệ trống cao  
- Vì: chi phí thêm gần như 0, có thể bắt được dữ liệu không thường xuyên,
  và tỷ lệ thiếu dữ liệu tự nó là 1 insight đáng phân tích
- Đánh đổi: cần xử lý riêng phần TP.HCM khi làm EDA để không làm nhiễu phân tích chính  
### 1.2 Dúng tọa độ thay vì tên địa điểm
- Chọn: gọi API theo dạng 
```bash
/feed/geo:{lat};{lng}/
```
 thay vì đoán tên trạm  
  (ví dụ "district-1", "binh-thanh")
- Vì: WAQI không có quy tắc đặt tên trạm cố định theo quận/thành phố.  
- Kết quả: hệ thống tự tìm trạm đang hoạt động gần nhất, tránh lỗi "station not found"

## Tuần 2
### 2.1 VỊ trí trạm của TP HCM bị sai
- Quan sát: kiểm tra station_name thực tế của toàn bộ 48 dòng gắn nhãn
  "ho-chi-minh", phát hiện 0 dòng nào đến từ trạm TP.HCM thật — 46 dòng
  từ Tây Ninh (~80km), 2 dòng từ 1 trạm ở tỉnh Trat, Thái Lan
- Nguyên nhân: endpoint /feed/geo:lat;lng/ luôn trả về trạm gần nhất ĐANG
  HOẠT ĐỘNG mà không giới hạn khoảng cách tối đa, nên khi TP.HCM không có
  trạm nào sống, hệ thống mở rộng tìm kiếm không giới hạn, kể cả ra nước ngoài
 
- Thêm bước validate khoảng cách trước khi chấp nhận dữ liệu**
- Dùng công thức Haversine tính khoảng cách giữa toạ độ mong muốn và toạ độ
  trạm thực tế trả về
- Đặt ngưỡng max_distance_km — nếu trạm vượt ngưỡng, coi như không có dữ liệu
  hợp lệ, bỏ qua thay vì lưu nhầm