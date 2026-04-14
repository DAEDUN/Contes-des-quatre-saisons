# Contes des quatre saisons

4장의 사진을 업로드하면 Gemini AI가 기승전결 구조의 단편 스토리를 생성해주는 웹 애플리케이션입니다.

## 아키텍처

```
[React Client] → [Express Server (EC2)] → [AWS Lambda] → [Gemini API]
                         ↕                      ↕
                    [RDS MySQL]            [RDS MySQL]
```

## 사용한 AWS 리소스

| 리소스 | 용도 |
|--------|------|
| EC2 | Express 백엔드 서버 호스팅 |
| Lambda (Function URL) | Gemini API 호출 및 AI 스토리 생성 처리 |
| RDS (MySQL) | 스토리, 이미지 데이터 저장 |

- Client(React)는 EC2 위에서 빌드된 정적 파일로 서빙하거나, 별도로 배포할 수 있습니다.
- Lambda는 Function URL을 통해 EC2 서버에서 직접 호출됩니다.
- Gemini API 키는 Lambda 환경변수에만 존재하므로 코드에 노출되지 않습니다.

## 실행 방법

### 사전 준비

- Node.js 18 이상
- AWS RDS MySQL 인스턴스
- AWS Lambda 함수 (Gemini API 키가 환경변수로 설정된 상태)

### 1. 환경변수 설정

**server/.env**
```
DB_HOST=your_db_host
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
GEMINI_LAMBDA_URL=your_lambda_function_url
```

**client/.env**
```
REACT_APP_SERVER_URL=http://your_ec2_public_ip
```

### 2. 서버 실행

```bash
cd server
npm install
node server.js
```

서버는 포트 80에서 실행됩니다.

### 3. 클라이언트 실행

```bash
cd client
npm install
npm start        # 개발 모드 (포트 3000)
npm run build    # 프로덕션 빌드
```

### 4. Lambda 배포

```bash
cd gemini-lambda
npm install
zip -r index.zip index.js node_modules/
# AWS 콘솔에서 index.zip을 Lambda 함수에 업로드
# 환경변수에 GEMINI_API_KEY, DB_HOST, DB_USER, DB_PASSWORD, DB_NAME 설정
```

## 주요 기능

- 사진 4장 업로드 (드래그앤드롭 지원)
- AI 기반 기승전결 스토리 자동 생성
- 생성된 스토리 목록 조회 / 상세 보기 / 삭제
