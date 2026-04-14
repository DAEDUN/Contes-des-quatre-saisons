mysql -h DBHOST -u user_18 -p

pw_18

use db_18;
DROP TABLE stories;

-- 이미지 컬럼 추가 후 테이블 재생성이 필요할 때 사용
-- 서버 재시작하면 CREATE TABLE IF NOT EXISTS로 자동 생성됨
