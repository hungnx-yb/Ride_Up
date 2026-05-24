package com.example.demo.service;

import com.example.demo.config.SupabaseStorageConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

/**
 * Service xử lý upload, xóa và lấy URL công khai của file trên Supabase Storage.
 *
 * <p>Được sử dụng để lưu trữ ảnh tài liệu của tài xế:
 * ảnh CCCD (mặt trước/sau), ảnh GPLX, ảnh xe, ảnh đăng ký xe, ảnh bảo hiểm.
 * Các file được lưu dưới dạng public object trong Supabase bucket,
 * trả về đường dẫn object path để lưu vào DB, không lưu full URL vì
 * base URL có thể thay đổi khi migrate storage.</p>
 *
 * <p>Giao tiếp với Supabase qua HTTP REST API sử dụng {@link RestTemplate}.
 * Header {@code x-upsert: true} cho phép ghi đè file trùng tên thay vì báo lỗi.</p>
 *
 * @author Phạm Quang Huy (B22DCCN394)
 * @see SupabaseStorageConfig
 * @see FileController
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FileService {

    private final SupabaseStorageConfig supabaseConfig;
    private final RestTemplate restTemplate;


    /**
     * Upload một file lên Supabase Storage và trả về đường dẫn object.
     *
     * <p><b>Quy tắc đặt tên file:</b>
     * {@code {prefix}/{UUID}-{sanitizedOriginalName}}
     * <br>UUID đảm bảo không trùng tên dù nhiều user upload file cùng tên.
     * Sanitize loại bỏ ký tự đặc biệt nguy hiểm trong tên file gốc.</p>
     *
     * <p><b>Content-Type detection:</b> Lấy từ MultipartFile, fallback về
     * {@code application/octet-stream} nếu null hoặc không hợp lệ để tránh
     * exception khi client gửi content-type sai định dạng.</p>
     *
     * <p><b>Header {@code x-upsert: true}:</b> Cho phép ghi đè object cùng path
     * trên Supabase thay vì trả lỗi 409 Conflict. Hữu ích khi tài xế cập nhật
     * lại cùng loại ảnh (ví dụ chụp lại CCCD).</p>
     *
     * @param file   file cần upload (binary)
     * @param prefix tiền tố thư mục, xem {@link com.example.demo.constant.StoragePrefixConstant}
     * @return object path dạng "{prefix}/{uuid}-{filename}" để lưu vào DB
     * @throws RuntimeException nếu Supabase trả HTTP error hoặc network timeout
     */
    public String upload(MultipartFile file, String prefix) {
        try {
            String originalName = file.getOriginalFilename();
            String safeOriginalName = sanitizeFileName(originalName);
            String fileName = prefix + "/" + UUID.randomUUID() + "-" + safeOriginalName;

            String uploadUrl = supabaseConfig.getStorageApiUrl()
                    + "/object/" + supabaseConfig.getBucket() + "/" + fileName;

            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + supabaseConfig.getApiKey());
            headers.set("apikey", supabaseConfig.getApiKey());
            String rawContentType = file.getContentType();
            MediaType mediaType;
            try {
                mediaType = StringUtils.hasText(rawContentType)
                        ? MediaType.parseMediaType(rawContentType)
                        : MediaType.APPLICATION_OCTET_STREAM;
            } catch (InvalidMediaTypeException ex) {
                mediaType = MediaType.APPLICATION_OCTET_STREAM;
            }
            headers.setContentType(mediaType);
            headers.set("x-upsert", "true");

            HttpEntity<byte[]> requestEntity = new HttpEntity<>(file.getBytes(), headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    uploadUrl, HttpMethod.POST, requestEntity, String.class
            );

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("File uploaded successfully: {}", fileName);
                return fileName;
            } else {
                throw new RuntimeException("Upload failed with status: " + response.getStatusCode());
            }

        } catch (HttpStatusCodeException e) {
            log.error("Supabase upload failed status={} body={}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new RuntimeException("Upload failed: " + e.getStatusCode() + " - " + e.getResponseBodyAsString(), e);
        } catch (Exception e) {
            log.error("Upload failed", e);
            throw new RuntimeException("Upload failed: " + e.getMessage(), e);
        }
    }


    /**
     * Lấy URL công khai từ object path đã lưu trên Supabase.
     *
     * @param objectPath đường dẫn object trong bucket
     * @return full URL để client có thể tải file
     */
    public String getFileUrl(String objectPath) {
        return supabaseConfig.getPublicUrl(objectPath);
    }

    /**
     * Làm sạch tên file gốc trước khi dùng làm path trên Supabase Storage.
     *
     * <p>Thay thế các ký tự không an toàn {@code \\/:*?"<>|} bằng dấu gạch dưới.
     * Các ký tự này có thể gây lỗi khi tạo URL hoặc gây path traversal attack
     * nếu không được lọc.</p>
     *
     * @param originalName tên file gốc từ client (có thể null)
     * @return tên file an toàn, fallback về "file.bin" nếu sau sanitize vẫn rỗng
     */
    private String sanitizeFileName(String originalName) {
        String fallback = "file.bin";
        if (originalName == null || originalName.isBlank()) {
            return fallback;
        }
        String sanitized = originalName.replaceAll("[\\\\/:*?\"<>|]+", "_").trim();
        return sanitized.isEmpty() ? fallback : sanitized;
    }

    /**
     * Xóa một object path trên Supabase Storage.
     *
     * @param objectPath đường dẫn object cần xóa
     * @throws RuntimeException nếu Supabase trả lỗi hoặc kết nối thất bại
     */
    public void delete(String objectPath) {
        try {
            String deleteUrl = supabaseConfig.getStorageApiUrl()
                    + "/object/" + supabaseConfig.getBucket() + "/" + objectPath;

            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + supabaseConfig.getApiKey());
            headers.set("apikey", supabaseConfig.getApiKey());

            HttpEntity<Void> requestEntity = new HttpEntity<>(headers);

            restTemplate.exchange(deleteUrl, HttpMethod.DELETE, requestEntity, String.class);
            log.info("File deleted successfully: {}", objectPath);

        } catch (Exception e) {
            throw new RuntimeException("Delete failed: " + e.getMessage(), e);
        }
    }
}



