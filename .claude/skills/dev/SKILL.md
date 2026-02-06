---
name: dev
description: 개발 시작 - 모든 핵심 문서를 로드합니다
---

프로젝트 개발을 시작합니다. 다음 핵심 문서들을 읽어주세요:

@docs/CODEX.md
@docs/00-rules/PROJECT_RULES.md
@docs/01-planning/PRD.md
@docs/01-planning/Roadmap.md
@docs/02-technical/Database_ERD.md
@docs/04-tracking/PROGRESS.md

모든 문서를 읽은 후, 다음을 확인하고 응답해주세요:

✅ 규칙 체크리스트:
- 절대 금지 사항 (별도 백엔드 API 서버 금지 등)
- 기술 스택 (Next.js 14+, Google Sheets, TypeScript)
- 권한 체계 (5단계: 일반/팀장/관리자/경영진/시스템관리자)
- 코딩 컨벤션 (PascalCase, camelCase 등)

📋 진행 상황 체크:
- PROGRESS.md의 "다음 단계" 항목 확인 (현재 해야 할 작업)
- PRD.md의 기능 체크박스 확인 (구현 완료 여부)

그리고 이렇게 응답해주세요:
"✅ 개발 준비 완료했습니다.
📍 현재 진행: [PROGRESS.md에서 확인한 다음 단계]
어떤 기능을 구현할까요?"

---

## 📁 Obsidian 연동 워크플로우 (필수)

### ⚠️ 새 .md 파일 생성 시 워크플로우

**새 문서(.md) 파일을 생성해야 할 때, 다음 순서를 반드시 따르세요:**

#### 1단계: 프로젝트 폴더에 파일 생성
- Claude가 Write 도구로 프로젝트 폴더에 파일 생성
- 예: `e:\Project\vibecode\ProjectManager\docs\{docs폴더}\{파일명}.md`

#### 2단계: 사용자에게 mklink 명령어 제공
```
📁 Obsidian 연동

파일이 생성되었습니다: {파일명}.md

🔗 관리자 CMD에서 아래 명령어를 순서대로 실행하세요:

:: 1. 원본을 Obsidian으로 복사
copy "e:\Project\vibecode\ProjectManager\docs\{docs폴더}\{파일명}.md" "G:\내 드라이브\MyKnowledge\ReservedDataForge\40. projects\41. Active_Builds\Dev_Project_Manager\{Obsidian폴더}\{Obsidian파일명}.md"

:: 2. 프로젝트 폴더의 파일 삭제
del "e:\Project\vibecode\ProjectManager\docs\{docs폴더}\{파일명}.md"

:: 3. 심볼릭 링크 생성
mklink "e:\Project\vibecode\ProjectManager\docs\{docs폴더}\{파일명}.md" "G:\내 드라이브\MyKnowledge\ReservedDataForge\40. projects\41. Active_Builds\Dev_Project_Manager\{Obsidian폴더}\{Obsidian파일명}.md"
```

**사용자가 위 명령어를 수동으로 실행합니다.**

---

### 폴더 매핑 테이블

| docs 폴더 | Obsidian 폴더 | Obsidian 파일명 규칙 |
|-----------|---------------|----------------------|
| `01-planning/` | `10_Planning/` | `1x_{파일명}.md` |
| `02-technical/` | `20_Architecture/` | `2x_{파일명}.md` |
| `04-tracking/` | `30_Dev_Log/` | `{파일명}.md` |
| `00-rules/` | `20_Architecture/` | `2x_{파일명}.md` |
| `03-guides/` | `90_References/` | `{파일명}.md` |

### Obsidian 베이스 경로
```
G:\내 드라이브\MyKnowledge\ReservedDataForge\40. projects\41. Active_Builds\Dev_Project_Manager
```

### 프로젝트 베이스 경로
```
e:\Project\vibecode\ProjectManager\docs
```

---

### 예시: API_Guide.md를 02-technical/에 생성할 경우

**1단계: Claude가 파일 생성**
```
Write 도구로 파일 생성:
e:\Project\vibecode\ProjectManager\docs\02-technical\API_Guide.md
```

**2단계: 사용자에게 명령어 제공**
```
📁 Obsidian 연동

파일이 생성되었습니다: API_Guide.md

🔗 관리자 CMD에서 아래 명령어를 순서대로 실행하세요:

:: 1. 원본을 Obsidian으로 복사
copy "e:\Project\vibecode\ProjectManager\docs\02-technical\API_Guide.md" "G:\내 드라이브\MyKnowledge\ReservedDataForge\40. projects\41. Active_Builds\Dev_Project_Manager\20_Architecture\25_API_Guide.md"

:: 2. 프로젝트 폴더의 파일 삭제
del "e:\Project\vibecode\ProjectManager\docs\02-technical\API_Guide.md"

:: 3. 심볼릭 링크 생성
mklink "e:\Project\vibecode\ProjectManager\docs\02-technical\API_Guide.md" "G:\내 드라이브\MyKnowledge\ReservedDataForge\40. projects\41. Active_Builds\Dev_Project_Manager\20_Architecture\25_API_Guide.md"
```
