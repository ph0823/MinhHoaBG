// api/truyenqq.js
const cheerio = require("cheerio");

const BASES = [
  "https://truyenqqko.com",
  "https://truyenqqto.com",
  "https://m.truyenqqto.com",
  "https://truyenqq.net",
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 Chrome/124 Safari/537.36";

const headers = {
  "user-agent": UA,
  "accept-language": "vi-VN,vi;q=0.9,en;q=0.7",
  accept: "text/html,application/xhtml+xml",
};

const CATEGORY_CONFIG = {
  kids: {
    label: "Thiếu nhi chọn lọc",
    groups: [
      "comedy",
      "school",
      "adventure",
      "sports",
      "slice",
    ],
  },

  comedy: {
    label: "Hài hước",
    aliases: [
      "comedy",
      "hai-huoc",
      "hài hước",
    ],
  },

  school: {
    label: "Học đường",
    aliases: [
      "school-life",
      "hoc-duong",
      "học đường",
    ],
  },

  adventure: {
    label: "Phiêu lưu",
    aliases: [
      "adventure",
      "phieu-luu",
      "phiêu lưu",
    ],
  },

  sports: {
    label: "Thể thao",
    aliases: [
      "sports",
      "sport",
      "the-thao",
      "thể thao",
    ],
  },

  slice: {
    label: "Đời thường",
    aliases: [
      "slice-of-life",
      "doi-thuong",
      "đời thường",
    ],
  },

  all: {
    label: "Tất cả truyện",
  },
};

const UNSAFE_WORDS = [
  "18+",
  "adult",
  "mature",
  "smut",
  "hentai",
  "ecchi",
  "gore",
  "yaoi",
  "yuri",
  "boys love",
  "girls love",
  "đam mỹ",
  "bách hợp",
  "kinh dị",
  "horror",
  "psychological",
  "tình dục",
  "nóng bỏng",
  "khoả thân",
  "khỏa thân",
  "ngoại tình",
  "loạn luân",
  "dâm",
  "cưỡng hiếp",
  "hiếp dâm",
  "máu me",
  "bạo lực",
];

/**
 * Chuyển URL tương đối thành URL tuyệt đối.
 */
function absolute(value, base) {
  try {
    return new URL(value, base).href;
  } catch {
    return "";
  }
}

/**
 * Làm sạch khoảng trắng.
 */
function clean(value = "") {
  return String(value)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Chuẩn hóa chữ thường và bỏ dấu tiếng Việt.
 */
function normalizeText(value = "") {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Kiểm tra truyện có chứa từ khóa không phù hợp hay không.
 */
function isSafeStory(item) {
  const haystack = normalizeText(
    [
      item.title,
      item.status,
      item.latestChapter,
      ...(item.genres || []),
    ]
      .filter(Boolean)
      .join(" ")
  );

  return !UNSAFE_WORDS.some((word) =>
    haystack.includes(normalizeText(word))
  );
}

/**
 * Trích xuất thể loại của một truyện.
 */
function extractGenres(box, $) {
  const values = [];

  box
    .find(
      '.list-tags a,' +
        '.genres a,' +
        '.genre a,' +
        '.book_info a[href*="the-loai"],' +
        'a[href*="/the-loai/"]'
    )
    .each((_, element) => {
      const value = clean($(element).text());

      if (value) {
        values.push(value);
      }
    });

  return [...new Set(values)];
}

/**
 * Loại bỏ phần tử trùng lặp.
 */
function uniqueBy(items, keyFn) {
  const seen = new Set();

  return items.filter((item) => {
    const key = keyFn(item);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

/**
 * Chỉ cho phép URL truyện thuộc các tên miền nguồn.
 */
function allowedUrl(raw) {
  try {
    const url = new URL(raw);

    if (url.protocol !== "https:") {
      return false;
    }

    const hostname =
      url.hostname.toLowerCase();

    const allowedDomains = [
      "truyenqqko.com",
      "truyenqqto.com",
      "truyenqq.net",
    ];

    return allowedDomains.some(
      (domain) =>
        hostname === domain ||
        hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

/**
 * Tải HTML từ một URL.
 */
async function fetchHtml(url) {
  let lastError;

  for (
    let attempt = 0;
    attempt < 2;
    attempt += 1
  ) {
    let timer;

    try {
      const controller =
        new AbortController();

      timer = setTimeout(() => {
        controller.abort();
      }, 14000);

      const response = await fetch(url, {
        headers,
        redirect: "follow",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Nguồn trả về HTTP ${response.status}`
        );
      }

      const html =
        await response.text();

      return {
        html,
        finalUrl: response.url,
      };
    } catch (error) {
      lastError = error;
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  throw (
    lastError ||
    new Error(
      "Không kết nối được nguồn truyện"
    )
  );
}

/**
 * Thử tải lần lượt từ các tên miền.
 */
async function fetchFromBases(
  pathBuilder
) {
  let lastError;

  for (const base of BASES) {
    try {
      return await fetchHtml(
        pathBuilder(base)
      );
    } catch (error) {
      lastError = error;
    }
  }

  throw (
    lastError ||
    new Error(
      "Nguồn truyện tạm thời không phản hồi"
    )
  );
}

/**
 * Trích xuất ảnh bìa.
 */
function extractCover(
  element,
  $,
  base
) {
  const image =
    element.find("img").first();

  const srcset =
    image.attr("srcset") ||
    image.attr("data-srcset") ||
    "";

  const firstSrcset =
    srcset
      .split(",")[0]
      ?.trim()
      .split(/\s+/)[0] || "";

  const source =
    image.attr("data-original") ||
    image.attr("data-cfsrc") ||
    image.attr("data-src") ||
    image.attr("data-lazy-src") ||
    firstSrcset ||
    image.attr("src") ||
    "";

  if (
    !source ||
    source.startsWith("data:image") ||
    source === "#" ||
    source === "/"
  ) {
    return "";
  }

  return absolute(source, base);
}

/**
 * Kiểm tra URL có phải chương truyện.
 */
function isChapterUrl(url) {
  return /(?:-chap(?:ter)?-|\/chap(?:ter)?[-/]|\/chuong[-/])/i.test(
    url
  );
}

/**
 * Trích xuất danh sách truyện từ HTML.
 */
function extractItems(html, base) {
  const $ = cheerio.load(html);
  const items = [];

  const selectors = [
    ".book_avatar",
    ".book_item",
    ".story-item",
    ".item-manga",
    ".list_grid .item",
    ".comic-item",
    ".item",
  ];

  $(selectors.join(",")).each(
    (_, element) => {
      const box = $(element);

      let linkElement = box
        .find(
          'a[href*="/truyen-tranh/"]'
        )
        .filter((_, anchor) => {
          const href =
            $(anchor).attr("href") ||
            "";

          const url = absolute(
            href,
            base
          );

          return (
            url &&
            !isChapterUrl(url)
          );
        })
        .first();

      if (
        !linkElement.length &&
        box.is(
          'a[href*="/truyen-tranh/"]'
        )
      ) {
        const ownUrl = absolute(
          box.attr("href"),
          base
        );

        if (!isChapterUrl(ownUrl)) {
          linkElement = box;
        }
      }

      if (!linkElement.length) {
        return;
      }

      const url = absolute(
        linkElement.attr("href"),
        base
      );

      const title = clean(
        linkElement.attr("title") ||
          box
            .find(
              ".book_name," +
                ".title," +
                ".name," +
                "h3," +
                "h2"
            )
            .first()
            .text() ||
          linkElement.text()
      );

      const chapterElement = box
        .find(
          'a[href*="-chap-"],' +
            'a[href*="/chap-"],' +
            'a[href*="/chapter-"],' +
            'a[href*="/chuong-"],' +
            ".chapter," +
            ".last_chapter," +
            ".chapter-name"
        )
        .first();

      if (
        url &&
        title &&
        !isChapterUrl(url)
      ) {
        items.push({
          title,
          url,

          cover: extractCover(
            box,
            $,
            base
          ),

          latestChapter: clean(
            chapterElement.attr(
              "title"
            ) ||
              chapterElement.text()
          ),

          status: clean(
            box
              .find(".status")
              .first()
              .text()
          ),

          genres: extractGenres(
            box,
            $
          ),
        });
      }
    }
  );

  /*
   * Dự phòng nếu giao diện nguồn thay đổi.
   */
  if (items.length < 4) {
    $(
      'a[href*="/truyen-tranh/"]'
    ).each((_, element) => {
      const linkElement =
        $(element);

      const url = absolute(
        linkElement.attr("href"),
        base
      );

      if (
        !url ||
        isChapterUrl(url) ||
        /(the-loai|tim-kiem|dang-nhap)/i.test(
          url
        )
      ) {
        return;
      }

      const parent =
        linkElement.closest(
          "li," +
            "article," +
            ".item," +
            ".book_item," +
            ".story-item"
        );

      const title = clean(
        linkElement.attr("title") ||
          parent
            .find(
              ".book_name," +
                ".title," +
                ".name," +
                "h3," +
                "h2"
            )
            .first()
            .text() ||
          linkElement.text()
      );

      if (
        !title ||
        /^chapter\s*[\d.]+$/i.test(
          title
        )
      ) {
        return;
      }

      const chapterElement =
        parent
          .find(
            'a[href*="-chap-"],' +
              'a[href*="/chap-"],' +
              'a[href*="/chapter-"],' +
              'a[href*="/chuong-"]'
          )
          .first();

      items.push({
        title,
        url,

        cover: extractCover(
          parent,
          $,
          base
        ),

        latestChapter: clean(
          chapterElement.attr(
            "title"
          ) ||
            chapterElement.text()
        ),

        status: clean(
          parent
            .find(".status")
            .first()
            .text()
        ),

        genres: extractGenres(
          parent,
          $
        ),
      });
    });
  }

  return uniqueBy(
    items,
    (item) => item.url
  ).filter(
    (item) =>
      item.title &&
      !isChapterUrl(item.url) &&
      !/^chapter\s*[\d.]+$/i.test(
        item.title
      )
  );
}

/**
 * Xác định tổng số trang.
 */
function getTotalPages(
  html,
  currentPage = 1
) {
  const $ = cheerio.load(html);

  let maximumPage =
    currentPage;

  $(
    ".pagination a," +
      ".page_redirect a," +
      'a[href*="page="]'
  ).each((_, element) => {
    const textPage =
      Number.parseInt(
        clean($(element).text()),
        10
      );

    const href =
      $(element).attr("href") ||
      "";

    const queryMatch =
      href.match(
        /[?&]page=(\d+)/
      );

    const pathMatch =
      href.match(
        /(?:trang-|page\/)(\d+)/i
      );

    maximumPage = Math.max(
      maximumPage,
      textPage || 0,

      queryMatch
        ? Number(queryMatch[1])
        : 0,

      pathMatch
        ? Number(pathMatch[1])
        : 0
    );
  });

  return maximumPage;
}

/**
 * Tìm các đường dẫn thể loại hiện có.
 */
async function discoverCategoryLinks() {
  const result =
    await fetchFromBases(
      (base) => base
    );

  const $ = cheerio.load(
    result.html
  );

  const links = [];

  $(
    'a[href*="/the-loai/"]'
  ).each((_, element) => {
    const href = absolute(
      $(element).attr("href"),
      result.finalUrl
    );

    const text = clean(
      $(element).text()
    );

    if (href) {
      links.push({
        href,
        text,

        key: normalizeText(
          `${text} ${href}`
        ),
      });
    }
  });

  return uniqueBy(
    links,
    (item) => item.href
  );
}

/**
 * Tìm URL tương ứng với nhóm thể loại.
 */
function findCategoryLink(
  links,
  categoryKey
) {
  const config =
    CATEGORY_CONFIG[categoryKey];

  if (!config?.aliases) {
    return "";
  }

  for (
    const alias of config.aliases
  ) {
    const key =
      normalizeText(alias);

    const found = links.find(
      (item) =>
        item.key.includes(key)
    );

    if (found) {
      return found.href;
    }
  }

  return "";
}

/**
 * Thêm tham số trang vào URL thể loại.
 */
function withPage(url, page) {
  if (page <= 1) {
    return url;
  }

  try {
    const parsed =
      new URL(url);

    parsed.searchParams.set(
      "page",
      page
    );

    return parsed.href;
  } catch {
    return url;
  }
}

/**
 * Tải một trang thể loại.
 */
async function loadCategoryPage(
  url,
  page
) {
  const result =
    await fetchHtml(
      withPage(url, page)
    );

  return {
    items: extractItems(
      result.html,
      result.finalUrl
    ),

    totalPages: getTotalPages(
      result.html,
      page
    ),
  };
}

/**
 * Lấy danh sách truyện.
 */
async function listAction(
  page,
  queryText,
  categoryText = "kids",
  safeText = "1"
) {
  const currentPage = Math.max(
    1,
    Number.parseInt(page, 10) ||
      1
  );

  const query =
    clean(queryText);

  const category =
    CATEGORY_CONFIG[categoryText]
      ? categoryText
      : "kids";

  const safeMode =
    String(safeText) !== "0";

  /*
   * Tìm kiếm truyện.
   */
  if (query) {
    const result =
      await fetchFromBases(
        (base) =>
          `${base}/tim-kiem.html` +
          `?q=${encodeURIComponent(
            query
          )}` +
          `&page=${currentPage}`
      );

    let items = extractItems(
      result.html,
      result.finalUrl
    );

    if (safeMode) {
      items =
        items.filter(isSafeStory);
    }

    return {
      items,
      page: currentPage,

      totalPages: getTotalPages(
        result.html,
        currentPage
      ),

      category,
      safeMode,
    };
  }

  /*
   * Hiển thị tất cả truyện mới cập nhật.
   */
  if (category === "all") {
    const result =
      await fetchFromBases(
        (base) =>
          `${base}/truyen-moi-cap-nhat/` +
          `trang-${currentPage}.html`
      );

    let items = extractItems(
      result.html,
      result.finalUrl
    );

    /*
     * Dự phòng khi nguồn không dùng
     * đường dẫn trang-x.html.
     */
    if (!items.length) {
      const alternative =
        await fetchFromBases(
          (base) =>
            `${base}/?page=${currentPage}`
        );

      items = extractItems(
        alternative.html,
        alternative.finalUrl
      );

      if (safeMode) {
        items =
          items.filter(isSafeStory);
      }

      return {
        items,
        page: currentPage,

        totalPages: getTotalPages(
          alternative.html,
          currentPage
        ),

        category,
        safeMode,
      };
    }

    if (safeMode) {
      items =
        items.filter(isSafeStory);
    }

    return {
      items,
      page: currentPage,

      totalPages: getTotalPages(
        result.html,
        currentPage
      ),

      category,
      safeMode,
    };
  }

  /*
   * Tải danh sách các thể loại từ nguồn.
   */
  const links =
    await discoverCategoryLinks();

  const requestedGroups =
    category === "kids"
      ? CATEGORY_CONFIG.kids.groups
      : [category];

  const categoryUrls =
    requestedGroups
      .map((key) => ({
        key,

        url: findCategoryLink(
          links,
          key
        ),
      }))
      .filter(
        (item) => item.url
      );

  if (!categoryUrls.length) {
    throw new Error(
      "Không tìm thấy đường dẫn thể loại từ nguồn truyện."
    );
  }

  /*
   * Tải đồng thời các thể loại phù hợp.
   */
  const results =
    await Promise.allSettled(
      categoryUrls.map(
        (item) =>
          loadCategoryPage(
            item.url,
            currentPage
          )
      )
    );

  let items = [];
  let totalPages =
    currentPage;

  results.forEach((result) => {
    if (
      result.status ===
      "fulfilled"
    ) {
      items.push(
        ...result.value.items
      );

      totalPages = Math.max(
        totalPages,
        result.value.totalPages ||
          currentPage
      );
    }
  });

  items = uniqueBy(
    items,
    (item) => item.url
  );

  if (
    safeMode ||
    category === "kids"
  ) {
    items =
      items.filter(isSafeStory);
  }

  /*
   * Sắp xếp ổn định để tránh dồn toàn bộ
   * truyện của một thể loại lên đầu.
   */
  items.sort((a, b) =>
    normalizeText(
      a.title
    ).localeCompare(
      normalizeText(b.title),
      "vi"
    )
  );

  return {
    items,
    page: currentPage,
    totalPages,
    category,

    safeMode:
      safeMode ||
      category === "kids",

    categoryLabel:
      CATEGORY_CONFIG[category].label,
  };
}

/**
 * Lấy thông tin truyện và danh sách chương.
 */
async function detailAction(rawUrl) {
  if (!allowedUrl(rawUrl)) {
    throw Object.assign(
      new Error(
        "Địa chỉ truyện không hợp lệ"
      ),
      {
        status: 400,
      }
    );
  }

  const {
    html,
    finalUrl,
  } = await fetchHtml(rawUrl);

  const $ =
    cheerio.load(html);

  const title = clean(
    $("h1").first().text() ||
      $(
        'meta[property="og:title"]'
      ).attr("content")
  );

  const coverElement = $(
    ".book_avatar img," +
      ".story-detail-info img," +
      ".detail-info img," +
      ".book-info img"
  ).first();

  const cover = absolute(
    coverElement.attr(
      "data-original"
    ) ||
      coverElement.attr(
        "data-cfsrc"
      ) ||
      coverElement.attr(
        "data-src"
      ) ||
      coverElement.attr(
        "data-lazy-src"
      ) ||
      coverElement.attr("src") ||
      $(
        'meta[property="og:image"]'
      ).attr("content"),

    finalUrl
  );

  const description = clean(
    $(
      ".story-detail-info .detail-content," +
        ".story-detail-info .story-detail-info," +
        ".detail-content," +
        ".story-description," +
        ".book_detail .detail"
    )
      .first()
      .text() ||
      $(
        'meta[name="description"]'
      ).attr("content")
  );

  const author = clean(
    $(
      '.info-item:contains("Tác giả"),' +
        '.book_info li:contains("Tác giả"),' +
        '.story-detail-info li:contains("Tác giả")'
    )
      .first()
      .text()
  ).replace(
    /^Tác giả\s*:?/i,
    ""
  );

  const status = clean(
    $(
      '.info-item:contains("Tình trạng"),' +
        '.book_info li:contains("Tình trạng"),' +
        '.story-detail-info li:contains("Tình trạng")'
    )
      .first()
      .text()
  ).replace(
    /^Tình trạng\s*:?/i,
    ""
  );

  const chapters = [];

  $(
    ".list_chapter a," +
      ".list-chapter a," +
      ".works-chapter-list a," +
      ".chapter-list a," +
      ".story-detail-list a," +
      'a[href*="-chap-"],' +
      'a[href*="/chap-"],' +
      'a[href*="/chapter-"],' +
      'a[href*="/chuong-"]'
  ).each((_, element) => {
    const linkElement =
      $(element);

    const url = absolute(
      linkElement.attr("href"),
      finalUrl
    );

    const chapterTitle =
      clean(
        linkElement.attr("title") ||
          linkElement.text()
      );

    const date = clean(
      linkElement
        .closest("li,div")
        .find(
          ".chapter-time," +
            ".time," +
            ".date"
        )
        .first()
        .text()
    );

    if (
      url &&
      chapterTitle &&
      isChapterUrl(url)
    ) {
      chapters.push({
        title: chapterTitle,
        url,
        date,
      });
    }
  });

  return {
    story: {
      title,
      cover,
      description,
      author,
      status,
      url: finalUrl,
    },

    chapters: uniqueBy(
      chapters,
      (chapter) => chapter.url
    ),
  };
}

/**
 * Chuẩn hóa URL ảnh chương.
 */
function normalizeImageCandidate(
  value,
  base
) {
  if (!value) {
    return "";
  }

  let source = String(value)
    .trim()
    .replace(
      /^['"]|['"]$/g,
      ""
    )
    .replace(
      /\\\//g,
      "/"
    )
    .replace(
      /\\u002F/gi,
      "/"
    )
    .replace(
      /&amp;/g,
      "&"
    );

  if (
    !source ||
    source.startsWith(
      "data:image"
    )
  ) {
    return "";
  }

  const url =
    absolute(source, base);

  if (
    !url ||
    /(?:logo|avatar|banner|loading|spinner|icon|favicon)/i.test(
      url
    )
  ) {
    return "";
  }

  return url;
}

/**
 * Thêm URL ảnh nếu hợp lệ.
 */
function pushImage(
  pages,
  value,
  base
) {
  const url =
    normalizeImageCandidate(
      value,
      base
    );

  if (url) {
    pages.push(url);
  }
}

/**
 * Tìm URL ảnh trong một mảng JavaScript.
 */
function extractUrlsFromArrayText(
  rawArray,
  base
) {
  const pages = [];

  if (!rawArray) {
    return pages;
  }

  const normalized =
    rawArray
      .replace(/'/g, '"')
      .replace(/,\s*]/g, "]");

  try {
    const parsed =
      JSON.parse(normalized);

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const source =
          typeof item === "string"
            ? item
            : item?.src ||
              item?.url ||
              item?.image ||
              item?.link;

        pushImage(
          pages,
          source,
          base
        );
      }
    }
  } catch {
    /*
     * Mảng có thể không phải JSON chuẩn.
     * Regex phía dưới tiếp tục xử lý.
     */
  }

  const urlPattern =
    /https?:\\?\/\\?\/[^\s"'<>\\]+?\.(?:avif|webp|jpe?g|png)(?:\?[^\s"'<>\\]*)?/gi;

  const matches =
    rawArray.match(
      urlPattern
    ) || [];

  for (const match of matches) {
    pushImage(
      pages,
      match,
      base
    );
  }

  return pages;
}

/**
 * Lấy nội dung một chương truyện.
 */
async function chapterAction(
  rawUrl
) {
  if (!allowedUrl(rawUrl)) {
    throw Object.assign(
      new Error(
        "Địa chỉ chương không hợp lệ"
      ),
      {
        status: 400,
      }
    );
  }

  const {
    html,
    finalUrl,
  } = await fetchHtml(rawUrl);

  const $ =
    cheerio.load(html);

  const pages = [];

  /*
   * Các vùng thường chứa ảnh chương.
   */
  const chapterRoots = [
    ".page-chapter",
    ".page_chapter",
    ".chapter_content",
    ".chapter-content",
    "#chapter-content",
    ".reading-detail",
    ".page-reading",
    ".chapter-reading",
    ".reader-area",
    ".reader-content",
    ".reading-content",
    "#viewer",
    "#reader",
    "#chapter-reading",
    "#chapter_content",
  ];

  const imageSelector =
    chapterRoots
      .map(
        (root) =>
          `${root} img`
      )
      .join(",");

  /*
   * Ưu tiên vùng đọc truyện.
   * Nếu không thấy thì kiểm tra mọi thẻ img.
   */
  const candidates =
    $(imageSelector).length > 0
      ? $(imageSelector)
      : $("img");

  candidates.each(
    (_, element) => {
      const image =
        $(element);

      const srcset =
        image.attr(
          "data-srcset"
        ) ||
        image.attr("srcset") ||
        "";

      const firstSrcset =
        srcset
          .split(",")[0]
          ?.trim()
          .split(/\s+/)[0] ||
        "";

      const source =
        image.attr(
          "data-original"
        ) ||
        image.attr(
          "data-cfsrc"
        ) ||
        image.attr(
          "data-url"
        ) ||
        image.attr(
          "data-image"
        ) ||
        image.attr(
          "data-lazy-src"
        ) ||
        image.attr(
          "data-src"
        ) ||
        image.attr(
          "data-echo"
        ) ||
        image.attr(
          "data-lazy"
        ) ||
        image.attr(
          "data-original-src"
        ) ||
        firstSrcset ||
        image.attr("src");

      pushImage(
        pages,
        source,
        finalUrl
      );
    }
  );

  /*
   * Xử lý thẻ source nằm trong picture.
   */
  $(
    chapterRoots
      .map(
        (root) =>
          `${root} source`
      )
      .join(",")
  ).each((_, element) => {
    const sourceElement =
      $(element);

    const srcset =
      sourceElement.attr(
        "data-srcset"
      ) ||
      sourceElement.attr(
        "srcset"
      ) ||
      "";

    const source =
      srcset
        .split(",")[0]
        ?.trim()
        .split(/\s+/)[0] ||
      "";

    pushImage(
      pages,
      source,
      finalUrl
    );
  });

  /*
   * Một số trang nhúng danh sách ảnh
   * trong biến JavaScript hoặc JSON.
   */
  if (!pages.length) {
    const arrayPatterns = [
      /\b(?:listImage|listImages|chapterImages|chapter_images|images|imageList|pages)\s*[=:]\s*(\[[\s\S]*?\])\s*[;,<]/i,

      /["'](?:images|chapter_images|chapterImages|pages|listImage|listImages)["']\s*:\s*(\[[\s\S]*?\])/i,

      /\b(?:listImage|chapterImages|images)\s*=\s*JSON\.parse\(\s*['"](\[[\s\S]*?\])['"]\s*\)/i,
    ];

    for (
      const pattern of arrayPatterns
    ) {
      const match =
        html.match(pattern);

      if (!match) {
        continue;
      }

      const found =
        extractUrlsFromArrayText(
          match[1],
          finalUrl
        );

      pages.push(...found);

      if (pages.length) {
        break;
      }
    }
  }

  /*
   * Dự phòng: tìm URL ảnh trong từng script.
   */
  if (!pages.length) {
    $("script").each(
      (_, element) => {
        const script =
          $(element).html() ||
          "";

        if (!script) {
          return;
        }

        const urlPattern =
          /https?:\\?\/\\?\/[^\s"'<>\\]+?\.(?:avif|webp|jpe?g|png)(?:\?[^\s"'<>\\]*)?/gi;

        const matches =
          script.match(
            urlPattern
          ) || [];

        for (
          const value of matches
        ) {
          pushImage(
            pages,
            value,
            finalUrl
          );
        }
      }
    );
  }

  /*
   * Dự phòng cuối: tìm ảnh trong toàn bộ HTML.
   */
  if (!pages.length) {
    const urlPattern =
      /https?:\\?\/\\?\/[^\s"'<>\\]+?\.(?:avif|webp|jpe?g|png)(?:\?[^\s"'<>\\]*)?/gi;

    const matches =
      html.match(
        urlPattern
      ) || [];

    for (
      const value of matches
    ) {
      pushImage(
        pages,
        value,
        finalUrl
      );
    }
  }

  return {
    chapter: finalUrl,

    title: clean(
      $("h1").first().text() ||
        $(".chapter-title")
          .first()
          .text() ||
        $("title").text()
    ),

    pages: uniqueBy(
      pages,
      (url) => url
    ),
  };
}

/**
 * Tạo Referer an toàn cho proxy ảnh.
 */
function safeReferer(
  rawReferer
) {
  try {
    if (
      rawReferer &&
      allowedUrl(rawReferer)
    ) {
      return new URL(
        rawReferer
      ).href;
    }
  } catch {
    // Bỏ qua URL không hợp lệ.
  }

  return "https://truyenqqko.com/";
}

/**
 * Chặn địa chỉ mạng nội bộ để tránh SSRF.
 */
function isBlockedImageHost(
  hostname
) {
  const host =
    hostname.toLowerCase();

  return (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(
      host
    )
  );
}

/**
 * Proxy ảnh để tránh lỗi CORS và hotlink.
 */
async function imageAction(
  rawUrl,
  rawReferer,
  response
) {
  let imageUrl;

  try {
    imageUrl =
      new URL(rawUrl);
  } catch {
    throw Object.assign(
      new Error(
        "Địa chỉ ảnh không hợp lệ"
      ),
      {
        status: 400,
      }
    );
  }

  if (
    !["https:", "http:"].includes(
      imageUrl.protocol
    ) ||
    isBlockedImageHost(
      imageUrl.hostname
    )
  ) {
    throw Object.assign(
      new Error(
        "Địa chỉ ảnh không được hỗ trợ"
      ),
      {
        status: 400,
      }
    );
  }

  const referer =
    safeReferer(
      rawReferer
    );

  const origin =
    new URL(referer).origin;

  const controller =
    new AbortController();

  const timer =
    setTimeout(() => {
      controller.abort();
    }, 20000);

  try {
    const imageResponse =
      await fetch(
        imageUrl.href,
        {
          headers: {
            "user-agent": UA,

            accept:
              "image/avif," +
              "image/webp," +
              "image/apng," +
              "image/svg+xml," +
              "image/*," +
              "*/*;q=0.8",

            "accept-language":
              "vi-VN," +
              "vi;q=0.9," +
              "en;q=0.7",

            referer,
            origin,
          },

          redirect: "follow",
          signal:
            controller.signal,
        }
      );

    if (!imageResponse.ok) {
      throw Object.assign(
        new Error(
          `Máy chủ ảnh trả về HTTP ${imageResponse.status}`
        ),
        {
          status:
            imageResponse.status,
        }
      );
    }

    const contentType =
      imageResponse.headers.get(
        "content-type"
      ) ||
      "image/jpeg";

    /*
     * Tránh trả HTML lỗi dưới dạng ảnh.
     */
    if (
      !contentType
        .toLowerCase()
        .startsWith("image/")
    ) {
      throw Object.assign(
        new Error(
          `Nguồn không trả về ảnh (${contentType})`
        ),
        {
          status: 502,
        }
      );
    }

    const arrayBuffer =
      await imageResponse.arrayBuffer();

    const buffer =
      Buffer.from(arrayBuffer);

    response.setHeader(
      "Content-Type",
      contentType
    );

    response.setHeader(
      "Content-Length",
      buffer.length
    );

    response.setHeader(
      "Cache-Control",
      "public, max-age=86400, " +
        "s-maxage=604800, " +
        "stale-while-revalidate=86400"
    );

    response.setHeader(
      "X-Content-Type-Options",
      "nosniff"
    );

    return response
      .status(200)
      .send(buffer);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Trả dữ liệu JSON.
 */
function sendJson(
  response,
  status,
  payload
) {
  response.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  response.setHeader(
    "Cache-Control",
    "no-store"
  );

  return response
    .status(status)
    .json(payload);
}

/**
 * Điểm vào chính của Vercel Serverless Function.
 */
module.exports =
  async function handler(
    request,
    response
  ) {
    if (
      request.method !== "GET"
    ) {
      response.setHeader(
        "Allow",
        "GET"
      );

      return sendJson(
        response,
        405,
        {
          error:
            "Chỉ hỗ trợ phương thức GET",
        }
      );
    }

    const action = clean(
      request.query?.action ||
        "list"
    ).toLowerCase();

    try {
      /*
       * Danh sách và tìm kiếm truyện.
       */
      if (action === "list") {
        const result =
          await listAction(
            request.query?.page,
            request.query?.q,
            request.query?.category,
            request.query?.safe
          );

        return sendJson(
          response,
          200,
          result
        );
      }

      /*
       * Thông tin truyện và mục lục.
       */
      if (action === "detail") {
        const result =
          await detailAction(
            request.query?.url
          );

        return sendJson(
          response,
          200,
          result
        );
      }

      /*
       * Nội dung một chương.
       */
      if (
        action === "chapter"
      ) {
        const result =
          await chapterAction(
            request.query?.url
          );

        return sendJson(
          response,
          200,
          result
        );
      }

      /*
       * Proxy ảnh.
       */
      if (action === "image") {
        return await imageAction(
          request.query?.url,
          request.query?.ref,
          response
        );
      }

      return sendJson(
        response,
        400,
        {
          error:
            `Action không hợp lệ: ${action}`,
        }
      );
    } catch (error) {
      const status =
        Number(error?.status) ||
        (
          error?.name ===
          "AbortError"
            ? 504
            : 500
        );

      console.error(
        "[truyenqq]",
        action,
        error
      );

      return sendJson(
        response,
        status,
        {
          error:
            error?.name ===
            "AbortError"
              ? "Nguồn truyện phản hồi quá lâu"
              : error?.message ||
                "Lỗi máy chủ không xác định",
        }
      );
    }
  };