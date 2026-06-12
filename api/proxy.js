export default async function handler(req, res) {
    // Lấy url đích mà frontend muốn gọi
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({ error: "Thiếu tham số url" });
    }

    try {
        // Máy chủ Vercel đóng vai trò là một người dùng thật (Giả mạo User-Agent) để gọi sang MangaDex
        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
            }
        });

        const data = await response.json();

        // Bơm Header CORS cho phép trang web Vercel của bạn nhận lại dữ liệu
        res.setHeader('Access-Control-Allow-Credentials', true);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

        return res.status(response.status).json(data);
    } catch (error) {
        return res.status(500).json({ error: "Lỗi Vercel Proxy", details: error.message });
    }
}
