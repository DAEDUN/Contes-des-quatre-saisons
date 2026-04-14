const { GoogleGenerativeAI } = require("@google/generative-ai");
const mysql = require("mysql2");

exports.handler = async (event) => {
  console.log("EC2 -> Lambda로 전달된 데이터 수신");

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  let inputData;
  try {
    inputData = JSON.parse(event.body);
  } catch (error) {
    console.error("JSON 파싱 오류:", error);
    return { statusCode: 400, body: "Invalid JSON format" };
  }

  if (!inputData || !inputData.images || !inputData.storyId) {
    console.error("Invalid request: No images or storyId provided");
    return { statusCode: 400, body: "No images or storyId provided" };
  }

  const { images, storyId } = inputData;
  console.log(`이미지 ${images.length}장 수신, storyId: ${storyId}`);

  try {
    // 이미지 파트 구성 (Base64 → Gemini 멀티모달 입력)
    const imageParts = images.map((base64, index) => {
      // "data:image/jpeg;base64,..." 형식에서 실제 데이터 추출
      const matches = base64.match(/^data:(.+);base64,(.+)$/);
      if (!matches) throw new Error(`이미지 ${index + 1} 형식 오류`);

      return {
        inlineData: {
          mimeType: matches[1],
          data: matches[2],
        },
      };
    });

    // 프롬프트 구성
    const prompt = `당신은 창의적인 스토리 작가입니다. 
사용자가 제공한 4장의 사진을 순서대로 분석하고, 이 사진들을 연결하는 감동적이고 흥미로운 단편 소설 또는 영화 시나리오를 작성해주세요.

규칙:
1. 각 사진이 스토리의 한 장면이 되도록 자연스럽게 연결하세요.
2. 등장인물, 배경, 감정을 생생하게 묘사하세요.
3. 기승전결 구조로 작성하세요 (1장: 기, 2장: 승, 3장: 전, 4장: 결).
4. 한국어로 작성하세요.
5. 스토리 제목을 맨 처음에 【제목: ...】 형식으로 포함하세요.
6. 최소 500자 이상 작성하세요.`;

    // Gemini API 호출 (텍스트 + 이미지 멀티모달)
    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const aiResponse = response.text();

    console.log("AI 스토리 생성 완료");

    // 제목 추출
    const titleMatch = aiResponse.match(/【제목:\s*(.+?)】/);
    const title = titleMatch ? titleMatch[1].trim() : "무제";

    // 데이터베이스에 스토리 저장
    const dbConfig = {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    };
    const db = mysql.createConnection(dbConfig);
    db.connect();

    const sql = "UPDATE stories SET title = ?, story = ? WHERE id = ?";
    const values = [title, aiResponse, storyId];
    await new Promise((resolve, reject) => {
      db.query(sql, values, (err, result) => {
        if (err) reject(err);
        resolve(result);
      });
    });

    db.end();

    return aiResponse;
  } catch (error) {
    console.error("Error:", error);
    throw new Error("Lambda function error");
  }
};
