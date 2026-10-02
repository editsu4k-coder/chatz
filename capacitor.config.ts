import { type CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.chatz.app",
  appName: "ChatZ",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    StatusBar: {
      style: "DARK",
      overlaysWebView: false,
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#000000",
    },
  },
};

export default config;
