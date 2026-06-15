export default async function handler(req, res) {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({
            error: "Thiếu tham số url"
        });
    }

    try {
        const response = await fetch(targetUrl, {
            method: "GET",
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
                "Accept": "application/json,text/plain,*/*",
                "Referer": "https://mangadex.org/",
                "Origin": "https://mangadex.org"
            }
        });

        const text = await response.text();

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "*");

        try {
            const json = JSON.parse(text);

            return res.status(response.status).json(json);
        } catch {
            return res.status(502).json({
                error: "MangaDex không trả về JSON",
                status: response.status,
                preview: text.substring(0, 500)
            });
        }
    } catch (error) {
        return res.status(500).json({
            error: "Lỗi Vercel Proxy",
            details: error.message
        });
    }
}
