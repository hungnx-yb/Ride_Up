package com.example.demo.controller;


import com.example.demo.constant.StoragePrefixConstant;
import com.example.demo.dto.response.ApiResponse;
import com.example.demo.service.FileService;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/file")
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE, makeFinal = true)
public class FileController {
    FileService fileService;


    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<String> uploadFiles(@RequestParam("file") MultipartFile file) {
        return ApiResponse.<String>builder()
                .result(fileService.upload(file, StoragePrefixConstant.ATTACHMENTS))
                .message("File uploaded successfully")
                .build();
    }
}
