import { normalizePage, paginate } from "./pagination";

describe("normalizePage", () => {
  it("usa defaults (page 1, limit 20)", () => {
    expect(normalizePage({})).toEqual({ page: 1, limit: 20, skip: 0, take: 20 });
  });
  it("calcula skip/take a partir de page y limit", () => {
    expect(normalizePage({ page: 3, limit: 10 })).toEqual({
      page: 3,
      limit: 10,
      skip: 20,
      take: 10
    });
  });
  it("clampa limit al máximo (50) y trata 0 como default", () => {
    expect(normalizePage({ limit: 999 }).limit).toBe(50);
    expect(normalizePage({ limit: 0 }).limit).toBe(20);
  });
  it("fuerza page >= 1", () => {
    expect(normalizePage({ page: -5 }).page).toBe(1);
  });
});

describe("paginate", () => {
  it("devuelve data + meta con totalPages", async () => {
    const result = await paginate<number>(
      { page: 2, limit: 10 },
      {
        findMany: (skip, take) => {
          expect(skip).toBe(10);
          expect(take).toBe(10);
          return Promise.resolve([1, 2, 3]);
        },
        count: () => Promise.resolve(25)
      }
    );
    expect(result.data).toEqual([1, 2, 3]);
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3 });
  });
});
