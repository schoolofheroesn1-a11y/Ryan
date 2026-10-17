import { describe, expect, it } from "vitest";
import { activeFilterCount, filtersToQuery, parseLibraryFilters } from "@/lib/search-params";

describe("parseLibraryFilters", () => {
  it("отбрасывает неизвестные значения", () => {
    const f = parseLibraryFilters({ type: ["TIP", "HACK"], grade: "99", cost: "FREE", sort: "drop table", page: "-1" });
    expect(f.types).toEqual(["TIP"]);
    expect(f.grade).toBeNull();
    expect(f.cost).toEqual(["FREE"]);
    expect(f.sort).toBe("new");
    expect(f.page).toBe(1);
  });

  it("по умолчанию сортирует по релевантности при наличии запроса", () => {
    expect(parseLibraryFilters({ q: " рефлексия " })).toMatchObject({ q: "рефлексия", sort: "relevance" });
  });

  it("считает фильтры и собирает строку запроса обратно", () => {
    const f = parseLibraryFilters({ q: "игра", type: ["CASE", "TIP"], grade: "5", verification: "AUTHOR_TESTED" });
    expect(activeFilterCount(f)).toBe(4);
    const roundTrip = parseLibraryFilters(Object.fromEntries(new URLSearchParams(filtersToQuery(f)).entries()));
    expect(roundTrip.q).toBe("игра");
    expect(filtersToQuery(f, { page: 2 })).toContain("page=2");
  });
});
