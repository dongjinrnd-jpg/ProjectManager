/**
 * 클라이언트 사이드 이미지 리사이즈 유틸
 *
 * Canvas API를 사용하여 이미지를 리사이즈하고 JPEG로 변환합니다.
 * Supabase Storage 용량 절약을 위해 업로드 전에 사용합니다.
 */

/**
 * 이미지 파일을 리사이즈합니다.
 *
 * @param file - 원본 이미지 파일
 * @param maxSize - 최대 가로/세로 픽셀 (기본 800px)
 * @param quality - JPEG 품질 0~1 (기본 0.8)
 * @returns 리사이즈된 이미지 Blob (JPEG)
 */
export async function resizeImage(
  file: File,
  maxSize: number = 800,
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // 리사이즈 필요 여부 확인
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context를 생성할 수 없습니다.'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('이미지 변환에 실패했습니다.'));
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 불러올 수 없습니다.'));
    };

    img.src = url;
  });
}
