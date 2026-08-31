// api/truyenqq.js
const cheerio = require("cheerio");

/* =========================================================
 * 1. CẤU HÌNH NGUỒN
 * ======================================================= */

const BASES = [
  "https://truyenqqko.com",
  "https://truyenqqto.com",
  "https://m.truyenqqto.com",
  "https://truyenqq.net",
];

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0.0.0 Safari/537.36";

const HTML_HEADERS = {
  "user-agent": USER_AGENT,
  "accept-language": "vi-VN,vi;q=0.9,en;q=0.7",
  accept: "text/html,application/xhtml+xml",
};

const CATEGORY_CONFIG = {
  kids: { label: "Nội dung học sinh" },
  all: { label: "Tất cả truyện" },
  action: { label: "Action", slug: "action", id: 26 },
  adventure: { label: "Adventure", slug: "adventure", id: 27 },
  anime: { label: "Anime", slug: "anime", id: 62 },
  chuyenSinh: { label: "Chuyển Sinh", slug: "chuyen-sinh", id: 91 },
  coDai: { label: "Cổ Đại", slug: "co-dai", id: 90 },
  comedy: { label: "Comedy", slug: "comedy", id: 28 },
  comic: { label: "Comic", slug: "comic", id: 60 },
  demons: { label: "Demons", slug: "demons", id: 99 },
  detective: { label: "Detective", slug: "detective", id: 100 },
  doujinshi: { label: "Doujinshi", slug: "doujinshi", id: 96 },
  drama: { label: "Drama", slug: "drama", id: 29 },
  fantasy: { label: "Fantasy", slug: "fantasy", id: 30 },
  genderBender: { label: "Gender Bender", slug: "gender-bender", id: 45 },
  harem: { label: "Harem", slug: "harem", id: 47 },
  historical: { label: "Historical", slug: "historical", id: 51 },
  horror: { label: "Horror", slug: "horror", id: 44 },
  huyenHuyen: { label: "Huyền Huyễn", slug: "huyen-huyen", id: 468 },
  isekai: { label: "Isekai", slug: "isekai", id: 85 },
  josei: { label: "Josei", slug: "josei", id: 54 },
  mafia: { label: "Mafia", slug: "mafia", id: 69 },
  magic: { label: "Magic", slug: "magic", id: 58 },
  manga: { label: "Manga", slug: "manga" },
  manhua: { label: "Manhua", slug: "manhua", id: 35 },
  manhwa: { label: "Manhwa", slug: "manhwa", id: 49 },
  martialArts: { label: "Martial Arts", slug: "martial-arts", id: 41 },
  military: { label: "Military", slug: "military", id: 101 },
  mystery: { label: "Mystery", slug: "mystery", id: 39 },
  ngonTinh: { label: "Ngôn Tình", slug: "ngon-tinh", id: 87 },
  oneShot: { label: "One shot", slug: "one-shot", id: 95 },
  psychological: { label: "Psychological", slug: "psychological", id: 40 },
  romance: { label: "Romance", slug: "romance", id: 36 },
  schoolLife: { label: "School Life", slug: "school-life", id: 37 },
  sciFi: { label: "Sci-fi", slug: "sci-fi", id: 43 },
  seinen: { label: "Seinen", slug: "seinen", id: 42 },
  shoujo: { label: "Shoujo", slug: "shoujo", id: 38 },
  shoujoAi: { label: "Shoujo Ai", slug: "shoujo-ai", id: 98 },
  shounen: { label: "Shounen", slug: "shounen", id: 31 },
  shounenAi: { label: "Shounen Ai", slug: "shounen-ai", id: 86 },
  sliceOfLife: { label: "Slice of life", slug: "slice-of-life", id: 46 },
  sports: { label: "Sports", slug: "sports", id: 57 },
  supernatural: { label: "Supernatural", slug: "supernatural", id: 32 },
  tragedy: { label: "Tragedy", slug: "tragedy", id: 52 },
  trongSinh: { label: "Trọng Sinh", slug: "trong-sinh", id: 82 },
  truyenMau: { label: "Truyện Màu", slug: "truyen-mau", id: 92 },
  webtoon: { label: "Webtoon", slug: "webtoon", id: 55 },
  xuyenKhong: { label: "Xuyên Không", slug: "xuyen-khong", id: 88 },
};

const KIDS_SECTIONS = [
  "comedy", "schoolLife", "adventure", "sports",
  "sliceOfLife", "detective", "comic", "fantasy",
  "magic", "sciFi", "shounen", "shoujo",
];

const KIDS_ALLOWED = new Set([...KIDS_SECTIONS, "anime", "supernatural"]);

const UNSAFE_GENRES = [
  "doujinshi", "gender bender", "harem", "horror", "josei", "mafia",
  "military", "ngôn tình", "psychological", "romance", "seinen",
  "shoujo ai", "shounen ai", "tragedy", 
  "cổ đại", "xuyên không", "trọng sinh", "chuyển sinh" // Bổ sung
];

const UNSAFE_WORDS = [
  "18+", "adult", "mature", "smut", "hentai", "ecchi", "gore", "yaoi", "yuri",
  "boys love", "girls love", "đam mỹ", "bách hợp", "kinh dị", "horror",
  "psychological", "tình dục", "nóng bỏng", "khỏa thân", "khoả thân",
  "ngoại tình", "loạn luân", "cưỡng hiếp", "hiếp dâm", "máu me",
  // Bổ sung các từ khóa từ thực tế bỏ lọt
  "doujinshi", "ác ma", "phản diện", "villainess", "giết", "tuyệt vọng",
  "sát thủ", "yêu nữ", "dục vọng", "bạo chúa", "tổng tài", "quyến rũ", "hôn phu"
];

/* =========================================================
 * 2. CACHE LRU
 * ======================================================= */

const memoryCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;
const MAX_CACHE_SIZE = 100;
const CACHE_VERSION = "category-v7-optimal-cpu";

function cacheGet(key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.time > CACHE_TTL) {
    memoryCache.delete(key);
    return null;
  }

  // Đưa mục vừa dùng xuống cuối Map để tạo cache LRU
  memoryCache.delete(key);
  memoryCache.set(key, entry);
  return entry.value;
}

function cacheSet(key, value) {
  if (memoryCache.has(key)) memoryCache.delete(key);

  memoryCache.set(key, { time: Date.now(), value });

  if (memoryCache.size > MAX_CACHE_SIZE) {
    const oldestKey = memoryCache.keys().next().value;
    memoryCache.delete(oldestKey);
  }
  return value;
}

/* =========================================================
 * 3. HÀM TIỆN ÍCH
 * ======================================================= */

function clean(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeText(value = "") {
  return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function absolute(value, base) {
  try { return new URL(value, base).href; } catch { return ""; }
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isChapterUrl(url) {
  return /(?:-chap(?:ter)?-|\/chap(?:ter)?[-/]|\/chuong[-/])/i.test(String(url || ""));
}

function allowedStoryUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return ["truyenqqko.com", "truyenqqto.com", "truyenqq.net"].some(
      (domain) => host === domain || host.endsWith(`.${domain}`)
    );
  } catch { return false; }
}

function isSafeStory(item) {
  const genres = (item.genres || []).map(normalizeText);
  const hasUnsafeGenre = UNSAFE_GENRES.some((unsafeGenre) =>
    genres.some((genre) => genre === normalizeText(unsafeGenre))
  );

  if (hasUnsafeGenre) return false;

  const searchableText = normalizeText(
    [item.title, item.status, item.latestChapter, ...genres].filter(Boolean).join(" ")
  );
  return !UNSAFE_WORDS.some((word) => searchableText.includes(normalizeText(word)));
}

function storyIdentity(item) {
  return normalizeText(item.url || item.title);
}

function storyListFingerprint(items, size = 8) {
  return items.slice(0, size).map(storyIdentity).filter(Boolean).join("|");
}

function listSimilarity(firstItems, secondItems, sampleSize = 10) {
  const first = new Set(firstItems.slice(0, sampleSize).map(storyIdentity).filter(Boolean));
  const second = new Set(secondItems.slice(0, sampleSize).map(storyIdentity).filter(Boolean));

  if (!first.size || !second.size) return 0;

  let common = 0;
  for (const value of first) {
    if (second.has(value)) common += 1;
  }
  return common / Math.min(first.size, second.size);
}

/* =========================================================
 * 4. TẢI HTML
 * ======================================================= */

async function fetchHtml(url, timeout = 8000) {
  let lastError;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        headers: HTML_HEADERS,
        redirect: "follow",
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`Nguồn trả về HTTP ${response.status}`);
      return { html: await response.text(), finalUrl: response.url };
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error("Không kết nối được nguồn truyện");
}

async function fetchFromBases(pathBuilder) {
  let lastError;
  for (const base of BASES) {
    try {
      return await fetchHtml(pathBuilder(base));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Nguồn truyện tạm thời không phản hồi");
}

/* =========================================================
 * 5. TRÍCH XUẤT DANH SÁCH TRUYỆN (SỬ DỤNG $ CHEERIO TRỰC TIẾP)
 * ======================================================= */

function extractImageSource(image) {
  const srcset = image.attr("data-srcset") || image.attr("srcset") || "";
  const firstSrcset = srcset.split(",")[0]?.trim().split(/\s+/)[0] || "";

  return (
    image.attr("data-original") || image.attr("data-cfsrc") || image.attr("data-src") ||
    image.attr("data-lazy-src") || image.attr("data-url") || image.attr("data-image") ||
    image.attr("data-echo") || firstSrcset || image.attr("src") || ""
  );
}

function extractGenres(box, $) {
  const genres = [];
  box.find('.list-tags a, .genres a, .genre a, .book_info a[href*="the-loai"], a[href*="/the-loai/"]')
    .each((_, element) => {
      const value = clean($(element).text());
      if (value) genres.push(value);
    });
  return [...new Set(genres)];
}

function extractItems($, base) {
  const items = [];
  const selectors = [
    ".book_avatar", ".book_item", ".story-item", ".item-manga",
    ".list_grid .item", ".comic-item", ".item",
  ];

  $(selectors.join(",")).each((_, element) => {
    const box = $(element);
    let storyLink = box.find('a[href*="/truyen-tranh/"]').filter((__, anchor) => {
      const url = absolute($(anchor).attr("href"), base);
      return url && !isChapterUrl(url);
    }).first();

    if (!storyLink.length && box.is('a[href*="/truyen-tranh/"]')) {
      const ownUrl = absolute(box.attr("href"), base);
      if (!isChapterUrl(ownUrl)) storyLink = box;
    }
    if (!storyLink.length) return;

    const url = absolute(storyLink.attr("href"), base);
    const title = clean(
      storyLink.attr("title") ||
      box.find(".book_name, .title, .name, h2, h3").first().text() ||
      storyLink.text()
    );

    if (!url || !title || isChapterUrl(url)) return;

    const chapterElement = box.find('a[href*="-chap-"], a[href*="/chap-"], a[href*="/chapter-"], a[href*="/chuong-"], .chapter, .last_chapter, .chapter-name').first();
    const image = box.find("img").first();

    items.push({
      title,
      url,
      cover: absolute(extractImageSource(image), base),
      latestChapter: clean(chapterElement.attr("title") || chapterElement.text()),
      status: clean(box.find(".status").first().text()),
      genres: extractGenres(box, $),
    });
  });

  if (items.length < 4) {
    $('a[href*="/truyen-tranh/"]').each((_, element) => {
      const link = $(element);
      const url = absolute(link.attr("href"), base);

      if (!url || isChapterUrl(url) || /(the-loai|tim-kiem|dang-nhap)/i.test(url)) return;

      const parent = link.closest("li, article, .item, .book_item, .story-item");
      const title = clean(
        link.attr("title") ||
        parent.find(".book_name, .title, .name, h2, h3").first().text() ||
        link.text()
      );

      if (!title || /^chapter\s*[\d.]+$/i.test(title)) return;

      const chapterElement = parent.find('a[href*="-chap-"], a[href*="/chap-"], a[href*="/chapter-"], a[href*="/chuong-"]').first();
      const image = parent.find("img").first();

      items.push({
        title,
        url,
        cover: absolute(extractImageSource(image), base),
        latestChapter: clean(chapterElement.attr("title") || chapterElement.text()),
        status: clean(parent.find(".status").first().text()),
        genres: extractGenres(parent, $),
      });
    });
  }
  return uniqueBy(items, (item) => item.url).filter((item) => item.title && !isChapterUrl(item.url));
}

function getTotalPages($, currentPage = 1) {
  let maximumPage = currentPage;
  $('.pagination a, .page_redirect a, a[href*="page="], a[href*="trang-"]').each((_, element) => {
    const textPage = Number.parseInt(clean($(element).text()), 10) || 0;
    const href = $(element).attr("href") || "";
    const queryMatch = href.match(/[?&]page=(\d+)/);
    const pathMatch = href.match(/(?:trang-|page\/)(\d+)/i);

    maximumPage = Math.max(
      maximumPage, textPage,
      queryMatch ? Number(queryMatch[1]) : 0,
      pathMatch ? Number(pathMatch[1]) : 0
    );
  });
  return maximumPage;
}

/* =========================================================
 * 6. TẢI ĐÚNG THỂ LOẠI
 * ======================================================= */

function categoryCandidateUrls(base, config, page) {
  const currentPage = Math.max(1, Number(page) || 1);
  const encodedId = encodeURIComponent(config.id);
  const advancedQuery = `category=${encodedId}&notcategory=&sort=0`;

  const urls = [
    `${base}/tim-kiem-nang-cao/trang-${currentPage}.html?${advancedQuery}`,
    `${base}/tim-kiem-nang-cao.html?${advancedQuery}&page=${currentPage}`,
    `${base}/tim-kiem-nang-cao?${advancedQuery}&page=${currentPage}`,
  ];

  if (config.slug) {
    if (currentPage === 1) {
      urls.push(
        `${base}/the-loai/${config.slug}-${config.id}`,
        `${base}/the-loai/${config.slug}-${config.id}.html`,
        `${base}/the-loai/${config.slug}`,
        `${base}/the-loai/${config.slug}.html`
      );
    } else {
      urls.push(
        `${base}/the-loai/${config.slug}-${config.id}/trang-${currentPage}.html`,
        `${base}/the-loai/${config.slug}-${config.id}.html?page=${currentPage}`,
        `${base}/the-loai/${config.slug}/trang-${currentPage}.html`
      );
    }
  }
  return [...new Set(urls)];
}

function categoryResponseLooksValid(finalUrl, config) {
  try {
    const url = new URL(finalUrl);
    const pathname = url.pathname.toLowerCase();
    const categoryParameter = url.searchParams.get("category");

    if (/tim-kiem-nang-cao/i.test(pathname)) return categoryParameter === String(config.id);
    if (pathname.includes(`/the-loai/${config.slug}`)) return true;
    return false;
  } catch { return false; }
}

function categoryHtmlLooksValid(html, config) {
  const normalizedHtml = normalizeText(html);
  const normalizedLabel = normalizeText(config.label);
  const normalizedSlug = normalizeText(config.slug.replace(/-/g, " "));

  return (
    normalizedHtml.includes(`category=${config.id}`) ||
    normalizedHtml.includes(normalizedLabel) ||
    normalizedHtml.includes(normalizedSlug)
  );
}

async function loadCategoryByKey(categoryKey, page = 1) {
  const config = CATEGORY_CONFIG[categoryKey];
  if (!config || !config.id) throw new Error(`Thể loại ${categoryKey} chưa có mã category`);

  const currentPage = Math.max(1, Number(page) || 1);
  const cacheKey = `${CACHE_VERSION}:category:${categoryKey}:${currentPage}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  let lastError;
  for (const base of BASES) {
    const candidates = categoryCandidateUrls(base, config, currentPage);

    for (const candidateUrl of candidates) {
      try {
        const result = await fetchHtml(candidateUrl);
        if (!categoryResponseLooksValid(result.finalUrl, config)) continue;
        if (/tim-kiem-nang-cao/i.test(result.finalUrl) && !categoryHtmlLooksValid(result.html, config)) continue;
        
        const $ = cheerio.load(result.html); // Parse DOM một lần duy nhất
        const items = extractItems($, result.finalUrl);

        if (!items.length) continue;

        const value = {
          items,
          totalPages: getTotalPages($, currentPage),
          sourceUrl: result.finalUrl,
          fingerprint: storyListFingerprint(items),
        };

        return cacheSet(cacheKey, value);
      } catch (error) {
        lastError = error;
      }
    }
  }
  throw lastError || new Error(`Không tải được thể loại ${config.label}`);
}

/* =========================================================
 * 7. GIỚI HẠN SỐ YÊU CẦU ĐỒNG THỜI
 * ======================================================= */

async function mapLimit(values, concurrency, worker) {
  const results = new Array(values.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      try {
        results[index] = { status: "fulfilled", value: await worker(values[index], index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }
  const workerCount = Math.min(concurrency, values.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

/* =========================================================
 * 8. TRANG CHỦ CHIA THEO NHÓM
 * ======================================================= */

async function sectionsAction(limitText = "6") {
  const limit = Math.min(10, Math.max(4, Number.parseInt(limitText, 10) || 6));
  const cacheKey = `${CACHE_VERSION}:sections:${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const loadedResults = await mapLimit(KIDS_SECTIONS, 3, async (categoryKey) => {
    const result = await loadCategoryByKey(categoryKey, 1);
    return {
      key: categoryKey,
      label: CATEGORY_CONFIG[categoryKey].label,
      items: result.items.filter(isSafeStory),
      totalPages: result.totalPages,
      sourceUrl: result.sourceUrl,
      fingerprint: result.fingerprint,
    };
  });

  const successful = loadedResults.filter((entry) => entry.status === "fulfilled").map((entry) => entry.value);
  const acceptedFingerprints = [];
  const usedStoryUrls = new Set();
  const sections = [];

  for (const section of successful) {
    const duplicatedSource = acceptedFingerprints.some((previous) =>
      previous.fingerprint === section.fingerprint || listSimilarity(previous.items, section.items) >= 0.75
    );

    if (duplicatedSource) continue;

    const distinctItems = [];
    for (const item of section.items) {
      const identity = storyIdentity(item);
      if (!identity || usedStoryUrls.has(identity)) continue;
      usedStoryUrls.add(identity);
      distinctItems.push(item);
      if (distinctItems.length >= limit) break;
    }

    if (distinctItems.length < 2) continue;
    acceptedFingerprints.push({ fingerprint: section.fingerprint, items: section.items });
    sections.push({ key: section.key, label: section.label, items: distinctItems, totalPages: section.totalPages });
  }

  if (!sections.length) throw new Error("Không tải được các nhóm truyện học sinh riêng biệt từ nguồn.");

  return cacheSet(cacheKey, { sections, safeMode: true, generatedAt: Date.now() });
}

/* =========================================================
 * 9. DANH SÁCH TRUYỆN
 * ======================================================= */

async function loadLatestPage(page) {
  const currentPage = Math.max(1, Number(page) || 1);
  let result;
  
  try {
    result = await fetchFromBases((base) => `${base}/truyen-moi-cap-nhat/trang-${currentPage}.html`);
  } catch {
    result = await fetchFromBases((base) => `${base}/?page=${currentPage}`);
  }

  let $ = cheerio.load(result.html); // Parse DOM một lần
  let items = extractItems($, result.finalUrl);

  if (!items.length) {
    result = await fetchFromBases((base) => `${base}/?page=${currentPage}`);
    $ = cheerio.load(result.html); // Parse DOM nếu fallback
    items = extractItems($, result.finalUrl);
  }

  return { items, totalPages: getTotalPages($, currentPage) };
}

async function listAction(pageText, queryText, categoryText = "kids", safeText = "1") {
  const currentPage = Math.max(1, Number.parseInt(pageText, 10) || 1);
  const query = clean(queryText);
  const safeMode = String(safeText) !== "0";
  let category = CATEGORY_CONFIG[categoryText] ? categoryText : "kids";

  if (safeMode && category !== "kids" && !KIDS_ALLOWED.has(category)) category = "kids";

  if (query) {
    const result = await fetchFromBases((base) => `${base}/tim-kiem.html?q=${encodeURIComponent(query)}&page=${currentPage}`);
    const $ = cheerio.load(result.html); // Parse DOM 
    let items = extractItems($, result.finalUrl);
    if (safeMode) items = items.filter(isSafeStory);
    
    return {
      items, page: currentPage, totalPages: getTotalPages($, currentPage),
      category, safeMode, categories: CATEGORY_CONFIG,
    };
  }

  if (!safeMode && category === "all") {
    const result = await loadLatestPage(currentPage);
    return { ...result, page: currentPage, category, safeMode, categories: CATEGORY_CONFIG };
  }

  if (category === "kids") {
    const results = await mapLimit(KIDS_SECTIONS, 3, (key) => loadCategoryByKey(key, currentPage));
    let items = [];
    let totalPages = currentPage;

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      items.push(...result.value.items);
      totalPages = Math.max(totalPages, result.value.totalPages || currentPage);
    }
    items = uniqueBy(items, storyIdentity).filter(isSafeStory);

    return { items, page: currentPage, totalPages, category, safeMode: true, categoryLabel: CATEGORY_CONFIG.kids.label, categories: CATEGORY_CONFIG };
  }

  const categoryResult = await loadCategoryByKey(category, currentPage);
  let items = categoryResult.items;
  if (safeMode) items = items.filter(isSafeStory);

  return { items, page: currentPage, totalPages: categoryResult.totalPages, category, categoryLabel: CATEGORY_CONFIG[category].label, safeMode, categories: CATEGORY_CONFIG };
}

/* =========================================================
 * 10. CHI TIẾT TRUYỆN VÀ MỤC LỤC
 * ======================================================= */

async function detailAction(rawUrl) {
  if (!allowedStoryUrl(rawUrl)) throw Object.assign(new Error("Địa chỉ truyện không hợp lệ"), { status: 400 });

  const { html, finalUrl } = await fetchHtml(rawUrl);
  const $ = cheerio.load(html);

  const title = clean($("h1").first().text() || $('meta[property="og:title"]').attr("content"));
  const coverElement = $(".book_avatar img, .story-detail-info img, .detail-info img, .book-info img").first();
  const cover = absolute(extractImageSource(coverElement) || $('meta[property="og:image"]').attr("content"), finalUrl);
  const description = clean($(".story-detail-info .detail-content, .detail-content, .story-description, .book_detail .detail").first().text() || $('meta[name="description"]').attr("content"));
  const author = clean($('.info-item:contains("Tác giả"), .book_info li:contains("Tác giả"), .story-detail-info li:contains("Tác giả")').first().text()).replace(/^Tác giả\s*:?/i, "");
  const status = clean($('.info-item:contains("Tình trạng"), .book_info li:contains("Tình trạng"), .story-detail-info li:contains("Tình trạng")').first().text()).replace(/^Tình trạng\s*:?/i, "");

  const chapters = [];
  $(".list_chapter a, .list-chapter a, .works-chapter-list a, .chapter-list a, .story-detail-list a, a[href*='-chap-'], a[href*='/chap-'], a[href*='/chapter-'], a[href*='/chuong-']").each((_, element) => {
    const link = $(element);
    const url = absolute(link.attr("href"), finalUrl);
    const chapterTitle = clean(link.attr("title") || link.text());
    const date = clean(link.closest("li,div").find(".chapter-time, .time, .date").first().text());

    if (url && chapterTitle && isChapterUrl(url)) chapters.push({ title: chapterTitle, url, date });
  });

  return { story: { title, cover, description, author, status, url: finalUrl }, chapters: uniqueBy(chapters, (chapter) => chapter.url) };
}

/* =========================================================
 * 11. NỘI DUNG CHƯƠNG
 * ======================================================= */

function normalizeImageCandidate(value, base) {
  if (!value) return "";
  const source = String(value).trim().replace(/^['"]|['"]$/g, "").replace(/\\\//g, "/").replace(/\\u002F/gi, "/").replace(/&amp;/g, "&");
  if (!source || source.startsWith("data:image")) return "";
  const url = absolute(source, base);
  if (!url || /(?:logo|avatar|banner|loading|spinner|icon|favicon)/i.test(url)) return "";
  return url;
}

function pushImage(pages, value, base) {
  const url = normalizeImageCandidate(value, base);
  if (url) pages.push(url);
}

async function chapterAction(rawUrl) {
  if (!allowedStoryUrl(rawUrl)) throw Object.assign(new Error("Địa chỉ chương không hợp lệ"), { status: 400 });

  const { html, finalUrl } = await fetchHtml(rawUrl);
  const $ = cheerio.load(html);
  const pages = [];
  
  const chapterRoots = [".page-chapter", ".page_chapter", ".chapter_content", ".chapter-content", "#chapter-content", ".reading-detail", ".page-reading", ".chapter-reading", ".reader-area", ".reader-content", ".reading-content", "#viewer", "#reader", "#chapter-reading", "#chapter_content"];
  const imageSelector = chapterRoots.map((root) => `${root} img`).join(",");
  const images = $(imageSelector).length ? $(imageSelector) : $("img");

  images.each((_, element) => { pushImage(pages, extractImageSource($(element)), finalUrl); });
  $(chapterRoots.map((root) => `${root} source`).join(",")).each((_, element) => {
    const srcset = $(element).attr("data-srcset") || $(element).attr("srcset") || "";
    const source = srcset.split(",")[0]?.trim().split(/\s+/)[0];
    pushImage(pages, source, finalUrl);
  });

  if (!pages.length) {
    const urlPattern = /https?:\\?\/\\?\/[^\s"'<>\\]+?\.(?:avif|webp|jpe?g|png)(?:\?[^\s"'<>\\]*)?/gi;
    $("script").each((_, element) => {
      const script = $(element).html() || "";
      const matches = script.match(urlPattern) || [];
      matches.forEach((value) => pushImage(pages, value, finalUrl));
    });
  }

  if (!pages.length) {
    const matches = html.match(/https?:\\?\/\\?\/[^\s"'<>\\]+?\.(?:avif|webp|jpe?g|png)(?:\?[^\s"'<>\\]*)?/gi) || [];
    matches.forEach((value) => pushImage(pages, value, finalUrl));
  }

  return { chapter: finalUrl, title: clean($("h1").first().text() || $(".chapter-title").first().text() || $("title").text()), pages: uniqueBy(pages, (url) => url) };
}

/* =========================================================
 * 12. PROXY ẢNH
 * ======================================================= */

function isBlockedImageHost(hostname) {
  const host = hostname.toLowerCase();
  return (host === "localhost" || host === "0.0.0.0" || host === "::1" || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host));
}

function safeReferer(rawReferer) {
  if (rawReferer && allowedStoryUrl(rawReferer)) return rawReferer;
  return "https://truyenqqko.com/";
}

async function imageAction(rawUrl, rawReferer, response) {
  let imageUrl;
  try { imageUrl = new URL(rawUrl); } catch { throw Object.assign(new Error("Địa chỉ ảnh không hợp lệ"), { status: 400 }); }
  if (!["https:", "http:"].includes(imageUrl.protocol) || isBlockedImageHost(imageUrl.hostname)) throw Object.assign(new Error("Địa chỉ ảnh không được hỗ trợ"), { status: 400 });

  const referer = safeReferer(rawReferer);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000); // 8000ms Timeout

  try {
    const imageResponse = await fetch(imageUrl.href, {
      headers: { "user-agent": USER_AGENT, accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8", "accept-language": "vi-VN,vi;q=0.9,en;q=0.7", referer, origin: new URL(referer).origin },
      redirect: "follow", signal: controller.signal,
    });

    if (!imageResponse.ok) throw Object.assign(new Error(`Máy chủ ảnh trả về HTTP ` + imageResponse.status), { status: imageResponse.status });
    
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    if (!contentType.toLowerCase().startsWith("image/")) throw Object.assign(new Error(`Nguồn không trả về ảnh (${contentType})`), { status: 502 });

    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    response.setHeader("Content-Type", contentType);
    response.setHeader("Content-Length", buffer.length);
    response.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400");
    response.setHeader("X-Content-Type-Options", "nosniff");

    return response.status(200).send(buffer);
  } finally {
    clearTimeout(timer);
  }
}

/* =========================================================
 * 13. RESPONSE VÀ ROUTER VERCEL
 * ======================================================= */

function sendJson(response, status, payload, cacheControl = "no-store") {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", cacheControl);
  return response.status(status).json(payload);
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { error: "Chỉ hỗ trợ phương thức GET" });
  }

  const action = clean(request.query?.action || "list").toLowerCase();
  try {
    if (action === "sections") {
      const result = await sectionsAction(request.query?.limit);
      return sendJson(response, 200, result, "public, s-maxage=300, stale-while-revalidate=600");
    }
    if (action === "list") {
      const result = await listAction(request.query?.page, request.query?.q, request.query?.category, request.query?.safe);
      return sendJson(response, 200, result);
    }
    if (action === "detail") {
      const result = await detailAction(request.query?.url);
      return sendJson(response, 200, result);
    }
    if (action === "chapter") {
      const result = await chapterAction(request.query?.url);
      return sendJson(response, 200, result);
    }
    if (action === "image") {
      return await imageAction(request.query?.url, request.query?.ref, response);
    }
    return sendJson(response, 400, { error: `Action không hợp lệ: ${action}` });
  } catch (error) {
    const status = Number(error?.status) || (error?.name === "AbortError" ? 504 : 500);
    console.error("[truyenqq]", action, error);
    return sendJson(response, status, { error: error?.name === "AbortError" ? "Nguồn truyện phản hồi quá lâu" : error?.message || "Lỗi máy chủ không xác định" });
  }
};