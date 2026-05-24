package com.example.demo.controller;


import com.example.demo.constant.StoragePrefixConstant;
import com.example.demo.dto.response.ApiResponse;
import com.example.demo.service.FileService;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * REST Controller xử lý upload file cho tài xế.
 *
 * <p>Endpoint này đóng vai trò gateway mỏng để nhận MultipartFile từ client,
 * gọi {@link FileService} để upload lên Supabase, và trả về object path
 * để client lưu vào DB.</p>
 *
 * @author Phạm Quang Huy (B22DCCN394)
 * @see FileService
 */
@RestController
@RequestMapping("/file")
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE, makeFinal = true)
public class FileController {
    FileService fileService;


    /**
     * Upload file lên Supabase Storage và trả về object path.
     *
     * <p>Sử dụng {@link StoragePrefixConstant#ATTACHMENTS} để gom nhóm các file
     * tài xế (CCCD, GPLX, ảnh xe) trong cùng namespace.</p>
     *
     * @param file MultipartFile từ client
     * @return ApiResponse chứa object path đã upload
     */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<String> uploadFiles(@RequestParam("file") MultipartFile file) {
        return ApiResponse.<String>builder()
                .result(fileService.upload(file, StoragePrefixConstant.ATTACHMENTS))
                .message("File uploaded successfully")
                .build();
    }
}
