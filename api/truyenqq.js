// api/truyenqq.js
const cheerio = require("cheerio");

const BASES = [
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

function absolute(value, base) {
  try {
    return new URL(value, base).href;
  } catch {
    return "";
  }
}

function clean(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

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

function allowedUrl(raw) {
  try {
    const url = new URL(raw);

    return (
      url.protocol === "https:" &&
      /(^|\.)truyenqq(to)?\.com$|(^|\.)truyenqq\.net$/i.test(url.hostname)
    );
  } catch {
    return false;
  }
}

async function fetchHtml(url) {
  let lastError;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const controller = new AbortController();

      const timer = setTimeout(() => {
        controller.abort();
      }, 14000);

      const response = await fetch(url, {
        headers,
        redirect: "follow",
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`Nguồn trả về HTTP ${response.status}`);
      }

      return {
        html: await response.text(),
        finalUrl: response.url,
      };
    } catch (error) {
      lastError = error;
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

function extractCover(element, $, base) {
  const image = element.find("img").first();

  return absolute(
    image.attr("data-original") ||
      image.attr("data-src") ||
      image.attr("data-lazy-src") ||
      image.attr("src") ||
      "",
    base
  );
}

function extractItems(html, base) {
  const $ = cheerio.load(html);
  const items = [];

  const selectors = [
    ".book_avatar",
    ".story-item",
    ".item-manga",
    ".list_grid .item",
    ".comic-item",
    ".item",
  ];

  $(selectors.join(",")).each((_, element) => {
    const box = $(element);

    let linkElement = box
      .find('a[href*="/truyen-tranh/"]')
      .first();

    if (
      !linkElement.length &&
      box.is('a[href*="/truyen-tranh/"]')
    ) {
      linkElement = box;
    }

    const url = absolute(linkElement.attr("href"), base);

    const title = clean(
      linkElement.attr("title") ||
        box
          .find(".book_name,.title,.name,h3,h2")
          .first()
          .text() ||
        linkElement.text()
    );

    if (url && title) {
      items.push({
        title,
        url,
        cover: extractCover(box, $, base),
        latestChapter: clean(
          box
            .find(
              ".chapter,.last_chapter,.chapter-name,.list_chapter a"
            )
            .first()
            .text()
        ),
        status: clean(box.find(".status").first().text()),
      });
    }
  });

  /*
   * Selector dự phòng nếu cấu trúc trang nguồn thay đổi
   * hoặc không tìm được đủ truyện bằng selector chính.
   */
  if (items.length < 4) {
    $('a[href*="/truyen-tranh/"]').each((_, element) => {
      const linkElement = $(element);
      const url = absolute(linkElement.attr("href"), base);

      const title = clean(
        linkElement.attr("title") || linkElement.text()
      );

      const parent = linkElement.closest("li,article,div");

      if (title.length > 1) {
        items.push({
          title,
          url,
          cover: extractCover(parent, $, base),
          latestChapter: clean(
            parent
              .find(
                'a[href*="/chap-"], a[href*="/chuong-"]'
              )
              .first()
              .text()
          ),
        });
      }
    });
  }

  return uniqueBy(items, (item) => item.url).filter(
    (item) =>
      !/(the-loai|tim-kiem|dang-nhap)/i.test(item.url)
  );
}

function getTotalPages(html, currentPage = 1) {
  const $ = cheerio.load(html);
  let maximumPage = currentPage;

  $(
    '.pagination a, .page_redirect a, a[href*="page="]'
  ).each((_, element) => {
    const textPage = Number.parseInt(
      clean($(element).text()),
      10
    );

    const href = $(element).attr("href") || "";
    const match = href.match(/[?&]page=(\d+)/);

    maximumPage = Math.max(
      maximumPage,
      textPage || 0,
      match ? Number(match[1]) : 0
    );
  });

  return maximumPage;
}

async function listAction(page, queryText) {
  const currentPage = Math.max(
    1,
    Number.parseInt(page, 10) || 1
  );

  const query = clean(queryText);

  const result = await fetchFromBases((base) => {
    if (query) {
      return (
        `${base}/tim-kiem.html` +
        `?q=${encodeURIComponent(query)}` +
        `&page=${currentPage}`
      );
    }

    return (
      `${base}/truyen-moi-cap-nhat/` +
      `trang-${currentPage}.html`
    );
  });

  let items = extractItems(
    result.html,
    result.finalUrl
  );

  /*
   * Một số tên miền không còn đường dẫn
   * /truyen-moi-cap-nhat/trang-x.html.
   * Khi đó thử đường dẫn trang chủ có tham số page.
   */
  if (!items.length && !query) {
    const alternative = await fetchFromBases(
      (base) => `${base}/?page=${currentPage}`
    );

    items = extractItems(
      alternative.html,
      alternative.finalUrl
    );

    return {
      items,
      page: currentPage,
      totalPages: getTotalPages(
        alternative.html,
        currentPage
      ),
    };
  }

  return {
    items,
    page: currentPage,
    totalPages: getTotalPages(
      result.html,
      currentPage
    ),
  };
}

async function detailAction(rawUrl) {
  if (!allowedUrl(rawUrl)) {
    throw Object.assign(
      new Error("Địa chỉ truyện không hợp lệ"),
      { status: 400 }
    );
  }

  const { html, finalUrl } = await fetchHtml(rawUrl);
  const $ = cheerio.load(html);

  const title = clean(
    $("h1").first().text() ||
      $('meta[property="og:title"]').attr("content")
  );

  const coverElement = $(
    ".book_avatar img," +
      ".story-detail-info img," +
      ".detail-info img," +
      ".book-info img"
  ).first();

  const cover = absolute(
    coverElement.attr("data-original") ||
      coverElement.attr("data-src") ||
      coverElement.attr("src") ||
      $('meta[property="og:image"]').attr("content"),
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
      $('meta[name="description"]').attr("content")
  );

  const author = clean(
    $(
      '.info-item:contains("Tác giả"),' +
        '.book_info li:contains("Tác giả"),' +
        '.story-detail-info li:contains("Tác giả")'
    )
      .first()
      .text()
  ).replace(/^Tác giả\s*:?/i, "");

  const status = clean(
    $(
      '.info-item:contains("Tình trạng"),' +
        '.book_info li:contains("Tình trạng"),' +
        '.story-detail-info li:contains("Tình trạng")'
    )
      .first()
      .text()
  ).replace(/^Tình trạng\s*:?/i, "");

  const chapters = [];

  $(
    ".list_chapter a," +
      ".list-chapter a," +
      ".works-chapter-list a," +
      ".chapter-list a," +
      ".story-detail-list a," +
      'a[href*="/chap-"],' +
      'a[href*="/chuong-"]'
  ).each((_, element) => {
    const linkElement = $(element);

    const url = absolute(
      linkElement.attr("href"),
      finalUrl
    );

    const chapterTitle = clean(
      linkElement.attr("title") ||
        linkElement.text()
    );

    const date = clean(
      linkElement
        .closest("li,div")
        .find(".chapter-time,.time,.date")
        .first()
        .text()
    );

    if (url && chapterTitle) {
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

async function chapterAction(rawUrl) {
  if (!allowedUrl(rawUrl)) {
    throw Object.assign(
      new Error("Địa chỉ chương không hợp lệ"),
      { status: 400 }
    );
  }

  const { html, finalUrl } = await fetchHtml(rawUrl);
  const $ = cheerio.load(html);

  const pages = [];

  $(
    ".page-chapter img," +
      ".page_chapter img," +
      ".chapter_content img," +
      ".chapter-content img," +
      "#chapter-content img," +
      ".reading-detail img," +
      ".page-reading img"
  ).each((_, element) => {
    const image = $(element);

    const source =
      image.attr("data-original") ||
      image.attr("data-src") ||
      image.attr("data-lazy-src") ||
      image.attr("src");

    const url = absolute(source, finalUrl);

    if (
      url &&
      !/logo|avatar|banner|loading/i.test(url)
    ) {
      pages.push(url);
    }
  });

  /*
   * Một số trang nhúng danh sách ảnh trong JavaScript
   * thay vì đưa trực tiếp vào thẻ img.
   */
  if (!pages.length) {
    const patterns = [
      /\b(?:listImage|chapterImages|images)\s*=\s*(\[[\s\S]*?\]);/i,
      /"images"\s*:\s*(\[[\s\S]*?\])/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);

      if (!match) {
        continue;
      }

      try {
        const parsedImages = JSON.parse(match[1]);

        parsedImages.forEach((item) => {
          const source =
            typeof item === "string"
              ? item
              : item.src;

          const url = absolute(source, finalUrl);

          if (url) {
            pages.push(url);
          }
        });
      } catch {
        // Bỏ qua nếu dữ liệu JavaScript không phải JSON hợp lệ.
      }

      if (pages.length) {
        break;
      }
    }
  }

  return {
    chapter: finalUrl,
    title: clean(
      $("h1").first().text() ||
        $("title").text()
    ),
    pages: uniqueBy(pages, (url) => url),
  };
}

async function imageAction(rawUrl, response) {
  let imageUrl;

  try {
    imageUrl = new URL(rawUrl);
  } catch {
    throw Object.assign(
      new Error("Ảnh không hợp lệ"),
      { status: 400 }
    );
  }

  if (imageUrl.protocol !== "https:") {
    throw Object.assign(
      new Error("Ảnh không hợp lệ"),
      { status: 400 }
    );
  }

  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, 16000);

  const imageResponse = await fetch(imageUrl, {
    headers: {
      ...headers,
      accept:
        "image/avif,image/webp,image/apng," +
        "image/*,*/*;q=0.8",
      referer: "https://truyenqqto.com/",
    },
    redirect: "follow",
    signal: controller.signal,
  });

  clearTimeout(timer);

  if (!imageResponse.ok) {
    throw new Error(
      `Không tải được ảnh (${imageResponse.status})`
    );
  }

  response.setHeader(
    "Content-Type",
    imageResponse.headers.get("content-type") ||
      "image/jpeg"
  );

  response.setHeader(
    "Cache-Control",
    "public, max-age=86400, " +
      "s-maxage=604800, " +
      "stale-while-revalidate=86400"
  );

  const buffer = Buffer.from(
    await imageResponse.arrayBuffer()
  );

  response.status(200).send(buffer);
}

module.exports = async (request, response) => {
  response.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  response.setHeader(
    "Cache-Control",
    "s-maxage=300, stale-while-revalidate=600"
  );

  try {
    const action = request.query.action || "list";

    if (action === "image") {
      return await imageAction(
        request.query.url,
        response
      );
    }

    let data;

    if (action === "list") {
      data = await listAction(
        request.query.page,
        request.query.q
      );
    } else if (action === "detail") {
      data = await detailAction(
        request.query.url
      );
    } else if (action === "chapter") {
      data = await chapterAction(
        request.query.url
      );
    } else {
      throw Object.assign(
        new Error("Tác vụ không hợp lệ"),
        { status: 400 }
      );
    }

    response.status(200).json(data);
  } catch (error) {
    console.error(error);

    response
      .status(error.status || 500)
      .json({
        error:
          error.name === "AbortError"
            ? "Nguồn truyện phản hồi quá lâu"
            : error.message ||
              "Không lấy được dữ liệu",
      });
  }
};