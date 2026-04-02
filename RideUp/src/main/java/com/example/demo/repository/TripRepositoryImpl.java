package com.example.demo.repository;

import com.example.demo.entity.Trip;
import com.example.demo.enums.TripStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Repository
public class TripRepositoryImpl implements TripRepositoryCustom {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public List<Trip> searchTrips(String fromProvinceId,
            String toProvinceId,
            String fromWardId,
            String toWardId,
            LocalDate departureDate,
            TripStatus status,
            int page,
            int size) {
        StringBuilder jpql = new StringBuilder(
                "SELECT t FROM Trip t " +
                        "JOIN FETCH t.driver d " +
                        "JOIN FETCH d.user du " +
                        "LEFT JOIN FETCH d.vehicle dv " +
                        "WHERE t.status = :status "

        );

        if (StringUtils.hasText(fromWardId)) {
            jpql.append(
                    "AND EXISTS (SELECT 1 FROM TripPickupPoint pp WHERE pp.trip = t AND pp.ward.id = :fromWardId) ");
        } else if (StringUtils.hasText(fromProvinceId)) {
            jpql.append(
                    "AND EXISTS (SELECT 1 FROM TripPickupPoint pp WHERE pp.trip = t AND pp.ward.province.id = :fromProvinceId) ");
        }
        if (StringUtils.hasText(toWardId)) {
            jpql.append("AND EXISTS (SELECT 1 FROM TripDropoffPoint dp WHERE dp.trip = t AND dp.ward.id = :toWardId) ");
        } else if (StringUtils.hasText(toProvinceId)) {
            jpql.append(
                    "AND EXISTS (SELECT 1 FROM TripDropoffPoint dp WHERE dp.trip = t AND dp.ward.province.id = :toProvinceId) ");
        }
        if (departureDate != null) {
            jpql.append("AND t.departureTime >= :fromDateTime AND t.departureTime < :toDateTime ");
        }

        jpql.append("ORDER BY t.departureTime ASC");

        TypedQuery<Trip> query = entityManager.createQuery(jpql.toString(), Trip.class);
        query.setParameter("status", status);

        if (StringUtils.hasText(fromProvinceId)) {
            query.setParameter("fromProvinceId", fromProvinceId.trim());
        }
        if (StringUtils.hasText(toProvinceId)) {
            query.setParameter("toProvinceId", toProvinceId.trim());
        }
        if (StringUtils.hasText(fromWardId)) {
            query.setParameter("fromWardId", fromWardId.trim());
        }
        if (StringUtils.hasText(toWardId)) {
            query.setParameter("toWardId", toWardId.trim());
        }
        if (departureDate != null) {
            LocalDateTime fromDateTime = departureDate.atStartOfDay();
            LocalDateTime toDateTime = departureDate.plusDays(1).atStartOfDay();
            query.setParameter("fromDateTime", fromDateTime);
            query.setParameter("toDateTime", toDateTime);
        }

        int safePage = Math.max(page, 0);
        int safeSize = Math.max(size, 1);
        query.setFirstResult(safePage * safeSize);
        query.setMaxResults(safeSize);

        return query.getResultList();
    }
}
