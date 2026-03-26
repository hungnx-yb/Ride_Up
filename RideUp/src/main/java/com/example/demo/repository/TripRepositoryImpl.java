package com.example.demo.repository;

import com.example.demo.entity.Trip;
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
    public List<Trip> searchTrips(String fromWardId, String toWardId, LocalDate departureDate) {
        StringBuilder jpql = new StringBuilder(
                "SELECT DISTINCT t FROM Trip t " +
                "JOIN t.pickupPoints pp " +
                "JOIN t.dropoffPoints dp " +
                "JOIN FETCH t.driver d " +
                "JOIN FETCH d.user du " +
            "LEFT JOIN FETCH d.vehicle dv " +
                "WHERE t.departureTime IS NOT NULL "
        );

        if (StringUtils.hasText(fromWardId)) {
            jpql.append("AND pp.ward.id = :fromWardId ");
        }
        if (StringUtils.hasText(toWardId)) {
            jpql.append("AND dp.ward.id = :toWardId ");
        }
        if (departureDate != null) {
            jpql.append("AND t.departureTime >= :fromDateTime AND t.departureTime < :toDateTime ");
        }

        jpql.append("ORDER BY t.departureTime ASC");

        TypedQuery<Trip> query = entityManager.createQuery(jpql.toString(), Trip.class);

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

        return query.getResultList();
    }
}
