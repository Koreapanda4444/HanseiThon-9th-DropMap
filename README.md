# 버릴지도

버릴지도는 버리려는 물건의 올바른 배출 방법을 찾고, 주변의 수거 시설을 지도에서 확인할 수 있는 모바일·PC 반응형 웹 서비스입니다.

## 주요 기능

- Kakao 지도에서 장소·주소 검색, 현재 위치 이동, 현재 영역의 수거 시설 조회와 마커 클러스터링
- 시설 종류별 필터링, 상세 정보 확인, 즐겨찾기
- 품목명과 별칭을 기반으로 올바른 배출 방법 검색
- 회원가입·로그인과 계정 기반 시설 정보 제보 및 처리 내역 관리
- Kakao 외부 길찾기 연결
- 전국 공공데이터 5종과 중소형 폐가전 OpenAPI 데이터 정규화
- Oracle을 우선 사용하고 연결할 수 없을 때 로컬 공공데이터로 자동 전환
- 로딩, 검색 결과 없음, API 오류 등 실제 서비스 상태별 화면 제공

## 기술 스펙

### 프론트엔드

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- TanStack Query
- Zustand
- Kakao Maps JavaScript API
- 모바일·PC 반응형 웹

### 백엔드

- Node.js 20
- Fastify 5
- TypeScript
- Zod
- HttpOnly 쿠키 세션과 scrypt 비밀번호 해시
- Kakao Local REST API
- localhost:4000 실행

### 데이터베이스

- Oracle Database
- Oracle Spatial
- node-oracledb Thin mode
- Oracle 연결 실패 시 로컬 공공데이터 메모리 조회
