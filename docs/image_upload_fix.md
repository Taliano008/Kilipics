# Image Upload & Rendering Fixes

This document details the issues found and fixes applied to resolve the merchant photo uploading and image rendering feature in the React Native / Expo application.

## 1. Issue: "Unsupported FormDataPart implementation"
**Root Cause**: In older versions of React Native, sending a plain Javascript object (`{ uri, name, type }`) via `FormData` was the standard method for uploading files. However, the modern Expo network stack (SDK 50+ with the WinterCG-compliant fetch API) no longer supports this legacy pattern and strictly requires a `Blob` or `File` object.
**Attempted Fix**: We initially bypassed this by reading the local file URI using `fetch(uri).blob()` and attaching the resulting Blob to the `FormData` directly.

## 2. Issue: Image Uploaded Successfully but Rendered as Blank/Transparent
**Root Cause 1 (Backend URL Configuration)**: The backend API returned the photo's public URL as `http://localhost:3000/uploads/...`. When the Android device (or emulator) attempted to load this image, it looked for `localhost` on the *phone itself* rather than the backend server.
**Fix**: Updated the `backend/.env` file to use the local IP address (`http://10.8.120.251:3000/uploads`) for `UPLOADS_BASE_URL` so that devices on the network can correctly resolve the image URLs.

**Root Cause 2 (React Native Fetch Blob Bug)**: React Native's internal `fetch` polyfill has known bugs when attempting to read local device paths (`file://` URIs). Specifically, the fetch call silently failed and returned a 14-byte text string (`"File not found"`). Because we used `.blob()`, it wrapped that tiny text string into a Blob and uploaded it. The backend successfully received and saved the text string as a `.jpg` file, which the React Native `<Image>` component couldn't render.
**Fix**: Completely removed the buggy `fetch` + `FormData` logic. We installed `expo-file-system` and refactored the upload handler to use `FileSystem.uploadAsync()`. This leverages Expo's native file streaming capabilities to pipe raw image bytes directly from disk to the server, bypassing all `FormData` and `Blob` limitations entirely.

## 3. Supplementary Fix: Performance Warnings
**Issue**: The Metro Bundler reported a warning: `Response.blob() is using React Native's Blob... This may be slow for large responses.`
**Fix**: Installed the `expo-blob` package to provide native-optimized Blob bindings for Expo, which eliminated the warning and improved performance for any remaining Blob operations in the app.

---

### Files Modified
*   **`src/api/merchant.ts`**: Rewrote the `uploadMerchantPhoto` function to use `expo-file-system`.
*   **`package.json` & `pnpm-lock.yaml`**: Added `expo-file-system` and `expo-blob` dependencies.
*   **`backend/.env`**: Corrected `UPLOADS_BASE_URL` to point to the local network IP instead of localhost.
