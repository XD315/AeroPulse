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
### 2.1 Vị trí trạm của TP HCM bị sai
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

  ### 2.2   Quan sát: 2 kiểu bất thường khác nhau giữa các địa điểm  
  - Hà Nội: AQI nền thấp, nhưng có nhiều outlier đột biến (đến >150) —
  bất thường dạng "đột biến rời rạc"
- Thái Nguyên: AQI nền cao liên tục (trung vị ~85), không phải đột biến
  đơn lẻ mà là mức ô nhiễm cao kéo dài  
## Tuân 3  
### Khái niệm Z-score
- Z-score đo 1 điểm dữ liệu lệch khỏi mức bình thường bao xa, tính theo
đơn vị "độ dao động thường thấy" (độ lệch chuẩn) của chính nhóm nó thuộc về,
không phải theo số tuyệt đối.  
Công thức: z = (giá trị - trung bình nhóm) / độ lệch chuẩn nhóm
### Kết quả Z-score thay đổi theo thời gian
- Vì mean/std được tính lại mỗi lần chạy dựa trên toàn bộ dữ liệu hiện có,
  số lượng và danh sách điểm bất thường sẽ thay đổi khi có thêm dữ liệu mới
- Đây là đặc điểm tự nhiên của phương pháp tính theo batch, không phải lỗi.  
### So sánh Z-score vs IQR — kết quả thực nghiệm

Dùng pd.crosstab() đối chiếu kết quả 2 phương pháp (tính riêng theo từng
địa điểm, cùng áp dụng trên 868 dòng dữ liệu):

|                        | IQR: Bình thường | IQR: Bất thường |
|------------------------|-------------------|-------------------|
| Z-score: Bình thường  | 828               | 35                |
| Z-score: Bất thường   | 0                 | 5                 |

**Phát hiện chính**: IQR phát hiện 40 điểm bất thường, Z-score chỉ phát
hiện 5 — và toàn bộ 5 điểm Z-score tìm được đều nằm trong tập của IQR
(không có điểm nào Z-score tìm được mà IQR bỏ sót).

**Giải thích**: Z-score dùng mean/std, dễ bị chính các điểm cực đoan
"kéo giãn" ngưỡng phát hiện, khiến nó trở nên kém nhạy hơn. IQR dựa vào
phân vị (Q1/Q3), ít bị ảnh hưởng bởi giá trị cụ thể của outlier, nên
nhạy hơn đáng kể trong dữ liệu này.

**Quyết định**: chọn IQR làm phương pháp chính cho hệ thống, vì nhạy hơn
và ít bị bóp méo bởi chính outlier nó đang cố phát hiện. Giữ Z-score làm
phương pháp đối chiếu/xác nhận.  

## Tuần 4
### 4.1 Đánh giá chất lượng AI report — cần thận trọng với "ảo giác hợp lý"

Test với điểm bất thường tại Hà Tĩnh (AQI=74, PM2.5=74, temp=34.8°C,
humidity=53%, wind=4m/s), Gemini sinh ra 3 giả thuyết rất chi tiết và
có vẻ hợp lý (đốt rơm rạ, gió Lào, khu công nghiệp Vũng Áng/Formosa).

Vấn đề cần lưu ý: các giả thuyết này dựa trên KIẾN THỨC NỀN của AI về
địa lý/khí hậu Hà Tĩnh, không phải suy luận từ chính dữ liệu số đưa vào.
AI không có cách nào biết thực sự có đốt rơm hay không tại thời điểm đó —
đây là suy đoán hợp lý về mặt logic, không phải phát hiện có bằng chứng.

Quyết định: trong UI/báo cáo cuối, cần ghi rõ đây là "gợi ý khả năng"
(AI-generated hypothesis), không phải "kết luận xác định" — tránh người
dùng hiểu nhầm đây là phân tích dựa trên bằng chứng chắc chắn.
## Tuần 5
### Giới hạn rate limit của Gemini free tier
- Vấn đề: gói miễn phí giới hạn 5 request/phút, endpoint gọi AI cho
  nhiều địa điểm liên tiếp dễ vượt giới hạn (lỗi 429)
- Giải pháp tạm thời: thêm time.sleep(13) giữa các lần gọi, đảm bảo
  không vượt 5 lần/phút

## Tuần 6
### 6.1 IsolationForest flagged AQI=7 (không khí sạch) là "bất thường"

- Quan sát: sau khi chạy `/api/anomalies`, phát hiện model đánh dấu các
  điểm như AQI=7 (Huế) và AQI=61 (Việt Trì) là bất thường — rõ ràng
  không phải cảnh báo ô nhiễm có ý nghĩa gì với người dùng.

- Nguyên nhân kỹ thuật: `contamination=0.05` **ép** IsolationForest đánh
  dấu đúng 5% điểm dữ liệu là outlier bất kể thực tế. Khi data phần lớn
  bình thường, model vẫn phải tìm đủ 5% — dẫn đến flagged cả điểm sạch
  lẫn điểm nguy hiểm như nhau.

- Giải pháp áp dụng (2 tầng):
  1. **Giảm contamination** từ `0.05` → `0.03`: giảm áp lực ép model,
     chỉ 3% bị đánh dấu → ít false positive hơn.
  2. **Thêm domain threshold `AQI > 100`** sau khi model cho kết quả:
     theo ngưỡng WHO/US EPA, AQI ≤ 100 là mức chấp nhận được — không cần
     hiển thị cảnh báo dù model có flagged.

- Đánh đổi: có thể bỏ sót một số bất thường "tích cực" (AQI đột ngột
  thấp hơn bình thường, ví dụ sau mưa lớn). Chấp nhận được vì mục tiêu
  chính của hệ thống là **cảnh báo ô nhiễm**, không phải theo dõi không
  khí sạch.  
- Tại vì trước kia là do chỉ tìm điểm khác biệt chưa quan tâm nó có nguy hiểm hay không.
- Pattern tổng quát: **ML (thống kê) + Domain Rule (nghiệp vụ)** là cách
  kết hợp phổ biến trong Production anomaly detection để đảm bảo cảnh báo
  vừa có cơ sở toán học vừa có ý nghĩa thực tế.

### 6.2 Thẻ AI hiển thị ISO string thay vì ngày đọc được

- Quan sát: trường `time` trong panel phân tích AI hiển thị
  `2026-09-25T07:12:38.088772` — người dùng không cần giờ/giây, chỉ cần
  biết ngày xảy ra bất thường.

- Giải pháp: thêm hàm `formatDateOnly(isoStr)` trong `ListOfPlace.jsx`
  để chỉ render `DD/MM/YYYY`, không thay đổi dữ liệu gốc lưu trong state.

- Nguyên tắc: transform dữ liệu ở tầng hiển thị (View), không ở tầng
  dữ liệu (Model) — giữ raw ISO string nguyên vẹn nếu cần dùng lại.
