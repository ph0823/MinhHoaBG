export default async function handler(req, res) {
    // Thông tin tài khoản của bạn (Giờ đây nó đã an toàn trên Server)
    const TOKEN_URL = "https://auth.mangadex.org/realms/mangadex/protocol/openid-connect/token";
    const CLIENT_ID = "personal-client-443aa18b-22b2-4ec4-9748-4715056d6de9-d91693d1";
    const CLIENT_SECRET = "tBOd9Qgi308bFldB9Qi06wyQ2M9NQk9y";
    const USERNAME = "chucochm";
    const PASSWORD = "g9yLPwKnBFsEwX4";

    const params = new URLSearchParams();
    params.append("client_id", CLIENT_ID);
    params.append("client_secret", CLIENT_SECRET);
    params.append("grant_type", "password");
    params.append("username", USERNAME);
    params.append("password", PASSWORD);

    try {
        // Server Vercel gọi qua MangaDex (Không bao giờ bị lỗi CORS)
        const mangadexRes = await fetch(TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString()
        });

        const data = await mangadexRes.json();

        // Cấp quyền CORS cho web Frontend của bạn nhận dữ liệu
        res.setHeader('Access-Control-Allow-Credentials', true);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

        if (!mangadexRes.ok) {
            return res.status(mangadexRes.status).json(data);
        }

        // Trả Token về cho file HTML
        return res.status(200).json(data);
        
    } catch (error) {
        return res.status(500).json({ error: "Lỗi Server Vercel", details: error.message });
    }
}
