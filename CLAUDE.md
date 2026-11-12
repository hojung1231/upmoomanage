# 업무관리 (upmoomanage)

React + Vite 웹앱. GitHub Pages(https://hojung1231.github.io/upmoomanage/)로 배포, main 푸시 시 자동 배포.
데이터는 Firebase Firestore(.env 의 VITE_FIREBASE_*), 미설정 시 localStorage.

## "회의록 요약해줘" 요청을 받으면
앱의 회의록에서 '요약 요청'을 누르면 status가 `requested`가 된다. 요약은 Claude Code가 직접 한다 (API 키 없음).
1. `node scripts/notes.mjs pending` 으로 요청된 회의록(원문 포함)을 읽는다.
2. 각 회의록을 읽고 아래 JSON을 만든다 (한국어):
   - `title`: 회의 내용 한 줄 제목
   - `summary`: 핵심 3~7줄, 각 줄 "- "로 시작, 줄바꿈 구분
   - `checklist`: 확인·실행할 일/결정 사항 (문자열 배열, 중복 없이)
   - `schedules`: 날짜·기한·기간이 언급된 것만 `{title, date: "YYYY-MM-DD", endDate?: "YYYY-MM-DD", reason}`.
     상대 날짜("다음 주 금요일")는 pending 출력의 `today` 기준으로 계산. 기간이면 date=시작, endDate=끝.
3. 스크래치 폴더에 JSON 파일로 쓰고 `node scripts/notes.mjs save <id> <파일>` 로 저장.
4. 사용자에게 회의록별 요약과 스케줄 후보를 짧게 알려준다. 스케줄 등록 여부는 앱에서 사용자가 고른다.
