export const PROFILE_IMAGE_DATA_URL_REGEX =
  /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i;

export const MAX_PROFILE_IMAGE_FILE_BYTES = 750_000;
export const MAX_PROFILE_IMAGE_STORAGE_BYTES = 400_000;
export const MAX_PROFILE_IMAGE_DIMENSION = 1024;

export const MAX_PROFILE_IMAGE_DATA_URL_LENGTH =
  Math.ceil((MAX_PROFILE_IMAGE_STORAGE_BYTES * 4) / 3) + 256;

function estimateBase64SizeBytes(base64: string) {
  const trimmed = base64.trim();
  const padding = trimmed.endsWith("==") ? 2 : trimmed.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((trimmed.length * 3) / 4) - padding);
}

export function validateProfileImageDataUrl(dataUrl: string) {
  if (!PROFILE_IMAGE_DATA_URL_REGEX.test(dataUrl)) {
    return "Invalid image format. Use PNG, JPG, WEBP, or GIF.";
  }

  if (dataUrl.length > MAX_PROFILE_IMAGE_DATA_URL_LENGTH) {
    return "Profile image is too large. Please use an image under 400KB.";
  }

  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) {
    return "Invalid image data.";
  }

  const base64 = dataUrl.slice(commaIndex + 1);
  const estimatedBytes = estimateBase64SizeBytes(base64);
  if (estimatedBytes > MAX_PROFILE_IMAGE_STORAGE_BYTES) {
    return "Profile image is too large. Please use an image under 400KB.";
  }

  return null;
}

export async function validateProfileImageDimensions(dataUrl: string) {
  if (typeof Image === "undefined") {
    return null;
  }

  return new Promise<string | null>((resolve) => {
    const img = new Image();

    img.onload = () => {
      if (
        img.naturalWidth > MAX_PROFILE_IMAGE_DIMENSION ||
        img.naturalHeight > MAX_PROFILE_IMAGE_DIMENSION
      ) {
        resolve(
          `Image dimensions are too large. Max ${MAX_PROFILE_IMAGE_DIMENSION}x${MAX_PROFILE_IMAGE_DIMENSION}px.`,
        );
        return;
      }

      resolve(null);
    };

    img.onerror = () => {
      resolve("Unable to read image dimensions.");
    };

    img.src = dataUrl;
  });
}
