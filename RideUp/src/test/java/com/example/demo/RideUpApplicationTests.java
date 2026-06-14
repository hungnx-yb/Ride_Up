package com.example.demo;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
@Disabled("Disabled context load test because database is not available in test environment")
class RideUpApplicationTests {

	@Test
	void contextLoads() {
	}

}

