package com.example.demo.service;

import com.example.demo.dto.response.RideSearchFromTextResponse;
import com.example.demo.dto.response.RideSearchResponse;
import com.example.demo.entity.Province;
import com.example.demo.entity.Ward;
import com.example.demo.repository.ProvinceRepository;
import com.example.demo.repository.WardRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class RideSearchTextService {

    static final Map<String, String> LOCATION_SYNONYMS = buildLocationSynonyms();

    Pattern routePattern = Pattern
            .compile("(?iu)(?:tu|từ)\\s+(.+?)\\s+(?:den|đến)\\s+(.+?)(?:$|,|\\.|;|\\s+l[uú]c|\\s+vao|\\s+vào)");
    Pattern arrowRoutePattern = Pattern.compile("(?iu)(.+?)\\s*(?:->|→|=>|den|đến)\\s+(.+)");
    Pattern seatPattern = Pattern.compile("(?iu)(\\d{1,2})\\s*(?:ghe|ghế|cho|chỗ|ve|vé)");
    Pattern pricePattern = Pattern.compile(
            "(?iu)(?:duoi|dưới|toi da|tối đa|gia|giá|tam|tầm|khoang|khoảng)\\s*(\\d+(?:[\\.,]\\d+)?)\\s*(k|nghin|nghìn|tr|trieu|triệu|vnd|d)?");
    Pattern yyyyMmDdPattern = Pattern.compile("\\b(20\\d{2}-\\d{2}-\\d{2})\\b");
    Pattern ddMmPattern = Pattern.compile("\\b(\\d{1,2})/(\\d{1,2})(?:/(20\\d{2}))?\\b");

    CustomerBookingService customerBookingService;
    AiRideSearchAssistant aiRideSearchAssistant;
    ProvinceRepository provinceRepository;
    WardRepository wardRepository;

    @Transactional(readOnly = true)
    public RideSearchFromTextResponse searchFromText(String rawQueryText) {
        String queryText = rawQueryText == null ? "" : rawQueryText.trim();
        if (!StringUtils.hasText(queryText)) {
            return RideSearchFromTextResponse.builder()
                    .queryText("")
                    .confidence(0.0)
                    .needsClarification(true)
                    .clarificationQuestions(List.of("Bạn muốn đi từ đâu và đến đâu?"))
                    .criteria(RideSearchFromTextResponse.ParsedCriteria.builder().build())
                    .rides(List.of())
                    .build();
        }

        Optional<AiRideSearchAssistant.ParsedRideQuery> aiParsedOptional = aiRideSearchAssistant.parseQuery(queryText);
        AiRideSearchAssistant.ParsedRideQuery aiParsed = aiParsedOptional.orElse(null);

        RouteText routeText = extractRouteText(queryText);
        String fromText = firstNonBlank(aiParsed != null ? aiParsed.getFromText() : null,
                routeText.fromText(),
                extractOriginText(queryText));
        String toText = firstNonBlank(aiParsed != null ? aiParsed.getToText() : null,
                routeText.toText(),
                extractDestinationText(queryText));

        String departureDate = firstNonBlank(aiParsed != null ? aiParsed.getDepartureDate() : null,
                extractDepartureDate(queryText));
        Integer seatCount = aiParsed != null && aiParsed.getSeatCount() != null ? aiParsed.getSeatCount()
                : extractSeatCount(queryText);
        BigDecimal maxPrice = aiParsed != null && aiParsed.getMaxPrice() != null ? aiParsed.getMaxPrice()
                : extractMaxPrice(queryText);

        ResolvedLocation fromResolved = resolveLocation(fromText);
        ResolvedLocation toResolved = resolveLocation(toText);

        List<RideSearchResponse> rides = customerBookingService.searchRides(
                fromResolved.provinceId(),
                toResolved.provinceId(),
                fromResolved.wardId(),
                toResolved.wardId(),
                departureDate,
                "OPEN",
                0,
                50);

        if (seatCount != null && seatCount > 0) {
            rides = rides.stream()
                    .filter(r -> r.getAvailableSeats() != null && r.getAvailableSeats() >= seatCount)
                    .toList();
        }

        if (maxPrice != null) {
            rides = rides.stream()
                    .filter(r -> r.getPrice() != null && r.getPrice().compareTo(maxPrice) <= 0)
                    .toList();
        }

        List<String> clarificationQuestions = new ArrayList<>();
        if (aiParsed != null && aiParsed.getClarificationQuestions() != null) {
            aiParsed.getClarificationQuestions().stream()
                    .filter(StringUtils::hasText)
                    .map(String::trim)
                    .forEach(clarificationQuestions::add);
        }
        if (!StringUtils.hasText(fromResolved.provinceId()) && !StringUtils.hasText(fromResolved.wardId())
                && !StringUtils.hasText(toResolved.provinceId()) && !StringUtils.hasText(toResolved.wardId())) {
            clarificationQuestions.add("Bạn muốn đi từ khu vực nào?");
        }

        double confidence = computeConfidence(aiParsed != null ? aiParsed.getConfidence() : null, fromResolved,
                toResolved, departureDate, seatCount, maxPrice);

        return RideSearchFromTextResponse.builder()
                .queryText(queryText)
                .confidence(confidence)
                .needsClarification(!clarificationQuestions.isEmpty())
                .clarificationQuestions(clarificationQuestions)
                .criteria(RideSearchFromTextResponse.ParsedCriteria.builder()
                        .fromProvinceId(fromResolved.provinceId())
                        .fromProvinceName(fromResolved.provinceName())
                        .fromWardId(fromResolved.wardId())
                        .fromWardName(fromResolved.wardName())
                        .toProvinceId(toResolved.provinceId())
                        .toProvinceName(toResolved.provinceName())
                        .toWardId(toResolved.wardId())
                        .toWardName(toResolved.wardName())
                        .departureDate(departureDate)
                        .seatCount(seatCount)
                        .maxPrice(maxPrice)
                        .build())
                .rides(rides)
                .build();
    }

    private RouteText extractRouteText(String queryText) {
        Matcher matcher = routePattern.matcher(queryText);
        if (matcher.find()) {
            return new RouteText(cleanLocationText(matcher.group(1)), cleanLocationText(matcher.group(2)));
        }

        Matcher arrowMatcher = arrowRoutePattern.matcher(queryText);
        if (arrowMatcher.find()) {
            return new RouteText(cleanLocationText(arrowMatcher.group(1)), cleanLocationText(arrowMatcher.group(2)));
        }

        return new RouteText(null, null);
    }

    private String extractOriginText(String queryText) {
        Pattern originPattern = Pattern.compile(
                "(?iu)(?:di|đi)?\\s*(?:tu|từ)\\s+(.+?)(?:$|,|\\.|;|\\s+l[uú]c|\\s+vao|\\s+vào|\\s+den|\\s+đến)");
        Matcher matcher = originPattern.matcher(queryText);
        if (matcher.find()) {
            return cleanLocationText(matcher.group(1));
        }
        return null;
    }

    private String extractDestinationText(String queryText) {
        Pattern destinationPattern = Pattern
                .compile("(?iu)\\b(?:den|đến)\\s+(.+?)(?:$|,|\\.|;|\\s+l[uú]c|\\s+vao|\\s+vào)");
        Matcher matcher = destinationPattern.matcher(queryText);
        if (matcher.find()) {
            return cleanLocationText(matcher.group(1));
        }
        return null;
    }

    private Integer extractSeatCount(String queryText) {
        Matcher matcher = seatPattern.matcher(queryText);
        if (matcher.find()) {
            try {
                int value = Integer.parseInt(matcher.group(1));
                return value > 0 ? value : null;
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private BigDecimal extractMaxPrice(String queryText) {
        Matcher matcher = pricePattern.matcher(queryText);
        if (!matcher.find()) {
            return null;
        }

        try {
            String rawNumber = matcher.group(1);
            String unit = matcher.group(2);
            if (!StringUtils.hasText(rawNumber)) {
                return null;
            }

            String normalizedNumber = rawNumber.replace(",", ".").replaceAll("[^0-9.]", "");
            if (!StringUtils.hasText(normalizedNumber)) {
                return null;
            }

            BigDecimal value = new BigDecimal(normalizedNumber);
            String unitNorm = normalize(unit);
            if ("k".equals(unitNorm) || "nghin".equals(unitNorm)) {
                return value.multiply(BigDecimal.valueOf(1000));
            }
            if ("tr".equals(unitNorm) || "trieu".equals(unitNorm)) {
                return value.multiply(BigDecimal.valueOf(1_000_000));
            }
            return value;
        } catch (Exception ignored) {
            return null;
        }
    }

    private String extractDepartureDate(String queryText) {
        String normalized = normalize(queryText);
        LocalDate now = LocalDate.now();

        if (normalized.contains("ngay mai") || normalized.contains("mai")) {
            return now.plusDays(1).toString();
        }
        if (normalized.contains("toi nay")) {
            return now.toString();
        }
        if (normalized.contains("hom nay") || normalized.contains("h nay")) {
            return now.toString();
        }

        Matcher matcherYmd = yyyyMmDdPattern.matcher(queryText);
        if (matcherYmd.find()) {
            String date = matcherYmd.group(1);
            try {
                LocalDate.parse(date);
                return date;
            } catch (DateTimeParseException ignored) {
                // Ignore invalid date and keep trying other patterns.
            }
        }

        Matcher matcherDm = ddMmPattern.matcher(queryText);
        if (matcherDm.find()) {
            int day = Integer.parseInt(matcherDm.group(1));
            int month = Integer.parseInt(matcherDm.group(2));
            String yearText = matcherDm.group(3);
            int year = StringUtils.hasText(yearText) ? Integer.parseInt(yearText) : now.getYear();

            try {
                LocalDate parsed = LocalDate.of(year, month, day);
                if (!StringUtils.hasText(yearText) && parsed.isBefore(now)) {
                    parsed = parsed.plusYears(1);
                }
                return parsed.format(DateTimeFormatter.ISO_LOCAL_DATE);
            } catch (Exception ignored) {
                return null;
            }
        }

        return null;
    }

    private ResolvedLocation resolveLocation(String rawLocationText) {
        if (!StringUtils.hasText(rawLocationText)) {
            return ResolvedLocation.empty();
        }

        String locationText = cleanLocationText(rawLocationText);
        if (!StringUtils.hasText(locationText)) {
            return ResolvedLocation.empty();
        }

        String normalizedLocation = normalizeWithSynonyms(locationText);
        String wardSearchKeyword = toWardSearchKeyword(normalizedLocation);

        List<Ward> wardCandidates = wardRepository.searchByName(wardSearchKeyword);
        Optional<Ward> bestWard = wardCandidates.stream()
                .max(Comparator.comparingDouble(w -> scoreLocation(normalizedLocation, w.getName(),
                        w.getProvince() != null ? w.getProvince().getName() : null)));

        if (bestWard.isPresent()) {
            Ward ward = bestWard.get();
            double score = scoreLocation(normalizedLocation, ward.getName(),
                    ward.getProvince() != null ? ward.getProvince().getName() : null);
            if (score >= 0.55d) {
                return ResolvedLocation.fromWard(ward);
            }
        }

        List<Province> provinces = provinceRepository.findAllByOrderByNameAsc();
        Optional<Province> bestProvince = provinces.stream()
                .max(Comparator.comparingDouble(p -> scoreLocation(normalizedLocation, p.getName(), null)));

        if (bestProvince.isPresent()
                && scoreLocation(normalizedLocation, bestProvince.get().getName(), null) >= 0.55d) {
            Province province = bestProvince.get();
            return ResolvedLocation.fromProvince(province);
        }

        return ResolvedLocation.empty();
    }

    private double scoreLocation(String query, String name, String provinceName) {
        String q = normalizeWithSynonyms(cleanLocationText(query));
        String target = normalizeWithSynonyms(cleanLocationText(name));
        String targetWithProvince = normalizeWithSynonyms(
                cleanLocationText((name == null ? "" : name) + " " + (provinceName == null ? "" : provinceName)));

        if (!StringUtils.hasText(q) || !StringUtils.hasText(target)) {
            return 0.0;
        }
        if (q.equals(target) || q.equals(targetWithProvince)) {
            return 1.0;
        }
        if (target.startsWith(q) || targetWithProvince.startsWith(q)) {
            return 0.85;
        }
        if (target.contains(q) || targetWithProvince.contains(q) || q.contains(target)) {
            return 0.7;
        }
        return 0.0;
    }

    private String normalizeWithSynonyms(String text) {
        String normalized = normalize(text);
        if (!StringUtils.hasText(normalized)) {
            return "";
        }

        String result = " " + normalized + " ";
        for (Map.Entry<String, String> entry : LOCATION_SYNONYMS.entrySet()) {
            String alias = entry.getKey();
            String canonical = entry.getValue();
            result = result.replace(" " + alias + " ", " " + canonical + " ");
        }

        return result.replaceAll("\\s+", " ").trim();
    }

    private String toWardSearchKeyword(String normalizedLocation) {
        if (!StringUtils.hasText(normalizedLocation)) {
            return "";
        }

        if (normalizedLocation.contains("my dinh")) {
            return "my dinh";
        }
        if (normalizedLocation.contains("ben thanh")) {
            return "ben thanh";
        }
        if (normalizedLocation.contains("thanh xuan")) {
            return "thanh xuan";
        }
        if (normalizedLocation.contains("thu duc")) {
            return "thu duc";
        }

        return normalizedLocation;
    }

    private static Map<String, String> buildLocationSynonyms() {
        Map<String, String> map = new LinkedHashMap<>();

        map.put("tphcm", "ho chi minh");
        map.put("tp hcm", "ho chi minh");
        map.put("hcm", "ho chi minh");
        map.put("hcmc", "ho chi minh");
        map.put("sai gon", "ho chi minh");
        map.put("saigon", "ho chi minh");
        map.put("sg", "ho chi minh");

        map.put("hanoi", "ha noi");
        map.put("hn", "ha noi");

        map.put("haiphong", "hai phong");
        map.put("hp", "hai phong");

        map.put("danang", "da nang");
        map.put("dn", "da nang");
        map.put("tp da nang", "da nang");

        map.put("cantho", "can tho");
        map.put("ct", "can tho");

        map.put("hue", "thua thien hue");
        map.put("tp hue", "thua thien hue");
        map.put("nha trang", "khanh hoa");
        map.put("quy nhon", "binh dinh");
        map.put("da lat", "lam dong");
        map.put("bien hoa", "dong nai");
        map.put("thu dau mot", "binh duong");
        map.put("vung tau city", "ba ria vung tau");

        map.put("nam sai gon", "ho chi minh");
        map.put("quan 1", "ho chi minh");
        map.put("q1", "ho chi minh");
        map.put("q7", "ho chi minh");
        map.put("go vap", "ho chi minh");

        map.put("br vt", "ba ria vung tau");
        map.put("brvt", "ba ria vung tau");
        map.put("vung tau", "ba ria vung tau");
        map.put("ba ria", "ba ria vung tau");

        map.put("bx my dinh", "my dinh");
        map.put("ben xe my dinh", "my dinh");
        map.put("my dinh", "my dinh");
        map.put("bx mien dong", "mien dong");
        map.put("ben xe mien dong", "mien dong");
        map.put("mien dong", "mien dong");
        map.put("bx mien tay", "mien tay");
        map.put("ben xe mien tay", "mien tay");
        map.put("mien tay", "mien tay");
        map.put("bx nuoc ngam", "nuoc ngam");
        map.put("ben xe nuoc ngam", "nuoc ngam");
        map.put("nuoc ngam", "nuoc ngam");
        map.put("giap bat", "giap bat");
        map.put("ben xe giap bat", "giap bat");

        return map;
    }

    private String cleanLocationText(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }

        String cleaned = value.trim();
        cleaned = cleaned.replaceAll(
                "(?iu)\\b(tinh|tỉnh|thanh pho|thành phố|tp\\.?|quan|quận|huyen|huyện|xa|xã|phuong|phường|thi xa|thị xã|thi tran|thị trấn)\\b",
                " ");
        cleaned = cleaned.replaceAll("[,:;()]+", " ");
        cleaned = cleaned.replaceAll("\\s+", " ").trim();
        return cleaned;
    }

    private String normalize(String text) {
        if (!StringUtils.hasText(text)) {
            return "";
        }
        String normalized = Normalizer.normalize(text, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replace('đ', 'd')
                .replaceAll("[^a-z0-9\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
        return normalized;
    }

    private double computeConfidence(Double aiConfidence,
            ResolvedLocation fromResolved,
            ResolvedLocation toResolved,
            String departureDate,
            Integer seatCount,
            BigDecimal maxPrice) {
        if (aiConfidence != null) {
            return Math.max(0.0, Math.min(1.0, aiConfidence));
        }

        double score = 0.25;
        if (StringUtils.hasText(fromResolved.wardId()) || StringUtils.hasText(fromResolved.provinceId())) {
            score += 0.25;
        }
        if (StringUtils.hasText(toResolved.wardId()) || StringUtils.hasText(toResolved.provinceId())) {
            score += 0.25;
        }
        if (StringUtils.hasText(departureDate)) {
            score += 0.15;
        }
        if (seatCount != null) {
            score += 0.05;
        }
        if (maxPrice != null) {
            score += 0.05;
        }
        return Math.max(0.0, Math.min(1.0, score));
    }

    private String firstNonBlank(String first, String second, String third) {
        if (StringUtils.hasText(first)) {
            return first.trim();
        }
        if (StringUtils.hasText(second)) {
            return second.trim();
        }
        return StringUtils.hasText(third) ? third.trim() : null;
    }

    private String firstNonBlank(String first, String second) {
        return firstNonBlank(first, second, null);
    }

    private static class RouteText {
        final String fromText;
        final String toText;

        RouteText(String fromText, String toText) {
            this.fromText = fromText;
            this.toText = toText;
        }

        String fromText() {
            return fromText;
        }

        String toText() {
            return toText;
        }
    }

    private static class ResolvedLocation {
        final String provinceId;
        final String provinceName;
        final String wardId;
        final String wardName;

        ResolvedLocation(String provinceId, String provinceName, String wardId, String wardName) {
            this.provinceId = provinceId;
            this.provinceName = provinceName;
            this.wardId = wardId;
            this.wardName = wardName;
        }

        static ResolvedLocation empty() {
            return new ResolvedLocation(null, null, null, null);
        }

        static ResolvedLocation fromProvince(Province province) {
            return new ResolvedLocation(province.getId(), province.getName(), null, null);
        }

        static ResolvedLocation fromWard(Ward ward) {
            return new ResolvedLocation(
                    ward.getProvince() != null ? ward.getProvince().getId() : null,
                    ward.getProvince() != null ? ward.getProvince().getName() : null,
                    ward.getId(),
                    ward.getName());
        }

        String provinceId() {
            return provinceId;
        }

        String provinceName() {
            return provinceName;
        }

        String wardId() {
            return wardId;
        }

        String wardName() {
            return wardName;
        }
    }
}
