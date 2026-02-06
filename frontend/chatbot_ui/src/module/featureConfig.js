// src/module/featureConfig.js
const featureConfig = {
    // 預設 90 天， -1 為關閉
    passwordMaxDaysLimit: 90,
    // true 為開啟密碼強度判斷
    passwordStrength: true,
    // true 為開啟使用者 TOTP 驗證
    userTotpVerify: true
};

export default featureConfig;
