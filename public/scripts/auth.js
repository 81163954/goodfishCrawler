const AUTH_CONFIG = {
  API_HOST: "api.hwwlyz.com",
  APP_KEY: "XY11vUKgrjCt1JWfZaO8",
  APP_SECRET: "h4vmy60a9hq040d6legepvwpkhkwkklw",
  LOGIN_PATH: "/api/v1/card/login",
  HEARTBEAT_PATH: "/api/v1/card/heartbeat",
};

window.AuthService = {
  generateSign(method, params) {
    // 1. 按字母顺序排序参数
    const sortedParams = {};
    Object.keys(params)
      .sort()
      .forEach((key) => {
        sortedParams[key] = params[key];
      });

    // 2. 构建参数字符串，timestamp 保持数字类型
    const paramString = Object.entries(sortedParams)
      .map(([key, value]) => `${key}=${value}`)
      .join("&");

    // 3. 构建签名字符串：method + host + path + paramString + appSecret
    const signStr =
      method.toUpperCase() +
      AUTH_CONFIG.API_HOST +
      AUTH_CONFIG.LOGIN_PATH +
      paramString +
      AUTH_CONFIG.APP_SECRET;

    console.log("参数字符串:", paramString);
    console.log("完整签名字符串:", signStr);

    // 4. 生成 MD5，转小写
    const sign = CryptoJS.MD5(signStr).toString().toLowerCase();
    console.log("最终签名:", sign);

    return sign;
  },

  async getTimestamp() {
    try {
      // 使用百度时间作为时间戳来源
      const response = await fetch("https://www.baidu.com", {
        method: "HEAD",
      });

      const dateStr = response.headers.get("date");
      const timestamp = Math.floor(new Date(dateStr).getTime() / 1000);

      console.log(
        "获取到网络时间:",
        new Date(timestamp * 1000).toLocaleString()
      );
      return timestamp;
    } catch (error) {
      console.error("获取时间戳失败:", error);
      // 如果获取时间戳失败，使用本地时间
      return Math.floor(Date.now() / 1000);
    }
  },

  async verifyCard(card) {
    try {
      // 先获取网络时间戳
      const timestamp = await this.getTimestamp();
      const deviceId = await this.getDeviceId();

      // 构建请求参数，timestamp 保持数字类型
      const params = {
        appKey: AUTH_CONFIG.APP_KEY,
        card: card,
        deviceId: deviceId,
        timestamp: timestamp,
      };

      console.log("验证请求参数:", {
        ...params,
        time: new Date(timestamp * 1000).toLocaleString(),
      });

      // 生成签名
      const sign = this.generateSign("POST", params);
      const requestParams = {
        ...params,
        sign: sign,
      };

      // 发送请求
      const url = `http://${AUTH_CONFIG.API_HOST}${AUTH_CONFIG.LOGIN_PATH}`;
      console.log("发送请求:", {
        url,
        method: "POST",
        params: requestParams,
      });

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestParams),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("验证响应:", data);

      if (data.code === 0) {
        // 保存验证信息，包括心跳相关数据
        await chrome.storage.local.set({
          authInfo: {
            card: card,
            deviceId: deviceId,
            token: data.data.token,
            expireTime: data.data.expiresTs,
            expires: data.data.expires,
            cardType: data.data.cardType,
            serverTime: data.data.serverTime,
            config: data.data.config || "",
          },
        });

        // 启动心跳
        this.startHeartbeat(card, data.data.token);

        return {
          success: true,
          message: "卡密验证成功",
        };
      }

      return {
        success: false,
        message: this.getErrorMessage(data.code),
      };
    } catch (error) {
      console.error("验证请求错误:", error);
      return {
        success: false,
        message: "网络请求失败: " + (error.message || "未知错误"),
      };
    }
  },

  async startHeartbeat(card, token) {
    // 每分钟发送一次心跳
    setInterval(async () => {
      try {
        const timestamp = await this.getTimestamp();
        const params = {
          appKey: AUTH_CONFIG.APP_KEY,
          card: card,
          timestamp: timestamp,
          token: token,
        };

        const sign = this.generateSign("POST", params);
        const requestParams = {
          ...params,
          sign: sign,
        };

        const response = await fetch(
          `http://${AUTH_CONFIG.API_HOST}/api/v1/card/heartbeat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestParams),
          }
        );

        const data = await response.json();
        console.log("心跳响应:", data);

        if (data.code !== 0) {
          console.error("心跳失败:", this.getErrorMessage(data.code));
        }
      } catch (error) {
        console.error("心跳请求失败:", error);
      }
    }, 60000); // 每分钟执行一次
  },

  async getDeviceId() {
    const result = await chrome.storage.local.get("deviceId");
    if (!result.deviceId) {
      const deviceId = "XY_" + Math.random().toString(36).substr(2);
      await chrome.storage.local.set({ deviceId });
      return deviceId;
    }
    return result.deviceId;
  },

  getErrorMessage(code) {
    const errorMessages = {
      51: "参数错误",
      10101: "签名已过期",
      10102: "时间戳错误",
      10103: "密钥不匹配",
      10104: "无效的签名",
      10202: "卡密不存在",
      10203: "卡密已被冻结",
      10204: "卡密已过期",
      10205: "卡密已被使用",
      10206: "卡密超过多开上限",
    };
    return errorMessages[code] || "未知错误";
  },
};
