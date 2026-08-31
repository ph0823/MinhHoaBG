// api/truyenqq.js
const axios = require("axios");
const cheerio = require("cheerio");

module.exports = async (req, res) => {
  const { slug, chapter } = req.query;

  try {
    if (slug && !chapter) {
      // Lấy danh sách chương
      const url = `https://truyenqq.net/truyen-tranh/${slug}.html`;
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);

      const chapters = [];
      $(".list-chapter li a").each((i, el) => {
        chapters.push({
          title: $(el).text().trim(),
          link: $(el).attr("href")
        });
      });

      res.status(200).json({ slug, chapters });
    } else if (chapter) {
      // Lấy chi tiết chương
      const { data } = await axios.get(chapter);
      const $ = cheerio.load(data);

      const pages = [];
      $(".page-chapter img").each((i, el) => {
        pages.push($(el).attr("src"));
      });

      res.status(200).json({ chapter, pages });
    } else {
      res.status(400).json({ error: "Thiếu tham số slug hoặc chapter" });
    }
  } catch (error) {
    res.status(500).json({ error: "Không lấy được dữ liệu" });
  }
};
