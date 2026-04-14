require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const axios = require("axios");
const cors = require("cors");

const app = express();
const port = 80;

// 미들웨어 설정
app.use(cors());
app.use(express.json({ limit: "20mb" }));

// 데이터베이스 연결 상태를 저장할 변수
let dbConnection = null;

// 데이터베이스 연결 함수
const connectToDatabase = () => {
  try {
    const requiredEnvVars = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
    const missingEnvVars = requiredEnvVars.filter(
      (envVar) => !process.env[envVar],
    );

    if (missingEnvVars.length > 0) {
      console.error(
        "필수 데이터베이스 환경변수가 없습니다:",
        missingEnvVars.join(", "),
      );
      return null;
    }

    const connection = mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    return new Promise((resolve, reject) => {
      connection.connect(async (err) => {
        if (err) {
          console.error("데이터베이스 연결 실패:", err);
          reject(err);
          return;
        }

        console.log("데이터베이스 연결 성공");

        try {
          await createStoriesTable(connection);
          dbConnection = connection;
          resolve(connection);
        } catch (error) {
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error("데이터베이스 연결 중 오류:", error);
    return Promise.reject(error);
  }
};

// stories 테이블 생성 함수
const createStoriesTable = (connection) => {
  return new Promise((resolve, reject) => {
    const createTableQuery = `
            CREATE TABLE IF NOT EXISTS stories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) DEFAULT NULL,
                image1 MEDIUMTEXT,
                image2 MEDIUMTEXT,
                image3 MEDIUMTEXT,
                image4 MEDIUMTEXT,
                story TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

    connection.query(createTableQuery, (err, result) => {
      if (err) {
        console.error("테이블 생성 중 오류:", err);
        reject(err);
        return;
      }
      console.log("Stories 테이블 준비 완료");
      resolve(result);
    });
  });
};

// DB 연결 상태 체크 미들웨어
const checkDbConnection = (req, res, next) => {
  if (!dbConnection) {
    return res.status(503).json({
      error: "데이터베이스 연결 실패",
      message:
        "현재 데이터베이스 서비스를 이용할 수 없습니다. 잠시 후 다시 시도해주세요.",
    });
  }
  next();
};

// Gemini Lambda 호출 함수 (이미지 Base64 배열 전달)
const callGeminiLambda = async (images, storyId) => {
  if (!process.env.GEMINI_LAMBDA_URL) {
    throw new Error("Gemini Lambda URL이 설정되지 않았습니다");
  }

  try {
    const response = await axios.post(
      process.env.GEMINI_LAMBDA_URL,
      { images, storyId },
      { timeout: 60000 },
    );
    return response.data;
  } catch (error) {
    console.error("Gemini Lambda 호출 중 오류:", error);
    throw new Error("Gemini 서비스 호출 실패");
  }
};

// 기본 경로
app.get("/", (req, res) => {
  res.json({
    message: "스토리텔링 서버 실행 중",
    status: {
      database: dbConnection ? "연결됨" : "연결 안됨",
      gemini_lambda_url: process.env.GEMINI_LAMBDA_URL ? "설정됨" : "설정 안됨",
    },
  });
});

// 스토리 생성 요청 (사진 4장 업로드 + AI 스토리 생성)
app.post("/stories", checkDbConnection, async (req, res) => {
  const { images } = req.body;

  if (!images || !Array.isArray(images) || images.length !== 4) {
    return res.status(400).json({ error: "사진 4장을 업로드해주세요" });
  }

  if (!process.env.GEMINI_LAMBDA_URL) {
    return res.status(503).json({
      error: "AI 서비스 사용 불가",
      message: "현재 AI 서비스를 사용할 수 없습니다.",
    });
  }

  try {
    // 1. DB에 이미지 포함하여 스토리 레코드 생성
    const insertSql =
      "INSERT INTO stories (image1, image2, image3, image4) VALUES (?, ?, ?, ?)";
    const storyId = await new Promise((resolve, reject) => {
      dbConnection.query(insertSql, images, (err, result) => {
        if (err) reject(err);
        else resolve(result.insertId);
      });
    });

    // 2. Lambda 호출하여 스토리 생성
    console.log("Gemini Lambda 함수 호출 중...");
    const aiResponse = await callGeminiLambda(images, storyId);
    console.log("Gemini Lambda 함수 호출 완료");

    // 3. 최신 데이터 조회하여 반환
    const selectSql = "SELECT * FROM stories WHERE id = ?";
    dbConnection.query(selectSql, [storyId], (err, results) => {
      if (err) {
        return res.status(500).json({ error: "스토리 조회 실패" });
      }
      res.status(201).json(results[0]);
    });
  } catch (error) {
    console.error("스토리 생성 중 오류:", error);
    res.status(500).json({
      error: "스토리 생성 실패",
      message: "잠시 후 다시 시도해주세요",
    });
  }
});

// 전체 스토리 조회
app.get("/stories", checkDbConnection, async (req, res) => {
  const sql = "SELECT * FROM stories ORDER BY created_at DESC";

  dbConnection.query(sql, (err, results) => {
    if (err) {
      console.error("스토리 조회 중 오류:", err);
      return res.status(500).json({ error: "스토리 조회 실패" });
    }
    res.json(results);
  });
});

// 특정 스토리 삭제
app.delete("/stories/:id", checkDbConnection, async (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM stories WHERE id = ?";

  dbConnection.query(sql, [id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: "스토리 삭제 실패" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "해당 스토리를 찾을 수 없습니다" });
    }
    res.json({ message: "스토리가 삭제되었습니다" });
  });
});

// 전체 스토리 삭제
app.delete("/stories", checkDbConnection, async (req, res) => {
  const sql = "DELETE FROM stories";

  dbConnection.query(sql, (err, result) => {
    if (err) {
      return res.status(500).json({ error: "전체 스토리 삭제 실패" });
    }
    res.json({
      message: "모든 스토리가 삭제되었습니다",
      deletedCount: result.affectedRows,
    });
  });
});


// 예상치 못한 에러 처리
process.on("uncaughtException", (error) => {
  console.error("처리되지 않은 에러:", error);
  process.exit(1);
});

process.on("unhandledRejection", (error) => {
  console.error("처리되지 않은 Promise 거부:", error);
  process.exit(1);
});

// 서버 시작
const startServer = async () => {
  try {
    await connectToDatabase();

    app.listen(port, () => {
      console.log("\n=== 서버 상태 ===");
      console.log(`포트: ${port}`);
      console.log(
        `Gemini Lambda URL: ${
          process.env.GEMINI_LAMBDA_URL ? "설정됨 ✅" : "설정 안됨 ⚠️"
        }`,
      );
      if (!process.env.GEMINI_LAMBDA_URL) {
        console.log(
          "※ Lambda URL이 설정되지 않은 AI 기능은 사용할 수 없습니다.",
        );
      }
      console.log("=================\n");
    });
  } catch (error) {
    console.error("서버 시작 실패:", error);
    process.exit(1);
  }
};

startServer();
