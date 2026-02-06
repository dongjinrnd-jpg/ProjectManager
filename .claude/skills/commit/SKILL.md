---
name: commit
description: Git 커밋 - 변경사항을 커밋합니다
---

현재 변경사항을 Git에 커밋합니다.

다음 단계를 수행해주세요:

1. **변경 파일 확인**
   - `git status` 실행하여 변경된 파일 목록 확인

2. **변경사항 스테이징**
   - `git add .` 실행

3. **커밋 메시지 입력받기**
   - 사용자에게 "커밋 메시지를 입력해주세요 (간단한 한글):" 질문
   - 예시: "프로젝트 목록 기능 추가", "로그인 버그 수정"

4. **커밋 실행**
   - 다음 형식으로 커밋:
   ```
   git commit -m "[사용자 입력 메시지]

   Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
   ```

5. **완료 메시지**
   - "✅ 커밋 완료: [변경된 파일 개수]개 파일"
   - "다음 단계: /push 로 원격 저장소에 푸시"

⚠️ 주의사항:
- .env.local, service-account-key.json 같은 민감한 파일은 제외 (.gitignore 참조)
