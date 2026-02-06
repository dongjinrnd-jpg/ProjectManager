---
name: push
description: Git 푸시 - 원격 저장소에 푸시합니다
---

원격 저장소에 푸시합니다.

다음 단계를 수행해주세요:

1. **원격 저장소 확인**
   - `git remote -v` 실행

2. **원격 저장소가 설정되지 않은 경우**
   - 사용자에게 질문: "원격 저장소 URL을 입력해주세요:"
   - 예시: https://github.com/username/ProjectManager.git
   - 입력받은 URL로 remote 추가:
   ```bash
   git remote add origin [사용자_입력_URL]
   ```

3. **현재 브랜치 확인**
   - `git branch` 실행
   - main 또는 master 확인

4. **푸시 실행**
   - 첫 푸시인 경우:
   ```bash
   git push -u origin main
   ```
   - 이미 연결된 경우:
   ```bash
   git push
   ```

5. **완료 메시지**
   - "✅ 푸시 완료"
   - "원격 저장소: [URL]"
   - "브랜치: [브랜치명]"

⚠️ 에러 처리:
- "rejected" 에러 시: pull 먼저 실행 후 다시 push
- "no upstream" 에러 시: -u 옵션 사용
