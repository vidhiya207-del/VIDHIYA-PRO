import { createServerFn } from "@tanstack/react-start";

export const getFirebaseWebConfig = createServerFn({ method: "GET" }).handler(async () => {
  const projectId = process.env.FIREBASE_PROJECT_ID ?? "";
  return {
    apiKey: process.env.FIREBASE_API_KEY ?? "",
    authDomain: projectId ? `${projectId}.firebaseapp.com` : "",
    projectId,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.FIREBASE_APP_ID ?? "",
    vapidKey: process.env.FIREBASE_VAPID_KEY ?? "",
  };
});
