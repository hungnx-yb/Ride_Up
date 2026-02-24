package com.example.demo.config;

import com.example.demo.constant.RedisPrefixKeyConstant;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;


@Component
public class CustomJwtDecoder implements JwtDecoder {

    @Value("${jwt.signerKey}")
    private String signerKey;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    private volatile NimbusJwtDecoder nimbusJwtDecoder;

    @Override
    public Jwt decode(String token) throws JwtException {
        if (nimbusJwtDecoder == null) {
            synchronized (this) {
                if (nimbusJwtDecoder == null) {
                    SecretKeySpec keySpec = new SecretKeySpec(signerKey.getBytes(StandardCharsets.UTF_8), "HmacSHA512");
                    nimbusJwtDecoder = NimbusJwtDecoder
                            .withSecretKey(keySpec)
                            .macAlgorithm(MacAlgorithm.HS512)
                            .build();
                }
            }
        }

        Jwt jwt = nimbusJwtDecoder.decode(token);
        String jti = jwt.getId();

        if (jti == null) {
            throw new JwtException("Token missing jti");
        }

        boolean exists = redisTemplate.hasKey(RedisPrefixKeyConstant.TOKEN+token);
        if (!exists) {
            throw new JwtException("Token expired or revoked (Redis)");
        }

        return jwt;
    }
}
