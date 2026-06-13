export default async function handler(req, res) {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).send('Missing URL parameter');
    }

    try {
        // Gọi lên server ảnh của MangaDex
        const response = await fetch(targetUrl, {
            headers: {
                'Referer': 'https://mangadex.org/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            return res.status(response.status).send('Lỗi từ server ảnh gốc');
        }

        // Chuyển đổi dữ liệu ảnh sang buffer
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Trả headers phù hợp để trình duyệt / webOS nhận dạng là hình ảnh
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        res.setHeader('Content-Type', contentType);
        
        // Cache ảnh lại trên Vercel CDN trong 1 tuần (tiết kiệm băng thông)
        res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=604800');
        
        // Gửi ảnh về client
        res.send(buffer);

    } catch (error) {
        res.status(500).send('Internal Server Error');
    }
}
