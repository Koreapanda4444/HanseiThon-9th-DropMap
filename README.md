# 버릴지도

버릴지도는 버리려는 물건의 올바른 배출 방법을 찾고, 주변의 수거 시설을 지도에서 확인할 수 있는 모바일·PC 반응형 웹 서비스입니다. 브라우저에서 바로 사용할 수 있으며 PWA를 지원해 휴대폰 홈 화면에 설치하여 앱처럼 실행할 수 있습니다.

## 주요 기능

- Kakao 지도에서 현재 위치와 현재 보고 있는 지도 영역을 기준으로 수거 시설 조회
- 시설 종류별 필터링, 상세 정보 확인, 즐겨찾기
- 품목명과 별칭을 기반으로 올바른 배출 방법 검색
- 익명 기기 ID를 이용한 시설 정보 제보 등록 및 조회
- Kakao 외부 길찾기 연결
- 시설 및 데이터 출처 통계 제공
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
- 반응형 웹 및 PWA

### 백엔드

- Node.js 20
- Fastify 5
- TypeScript
- Zod
- Kakao Local REST API

### 데이터베이스

- Oracle Database
- Oracle Spatial
- node-oracledb Thin mode
