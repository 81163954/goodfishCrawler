import { createContext, useContext, useEffect, useState } from "react";

// 创建上下文
const KeyValidationContext = createContext(null);

// 提供者组件
export const KeyValidationProvider = ({ children }: any) => {
  const [key, setKey] = useState("");
  const [validationResult, setValidationResult] = useState("");
  const [isValid, setIsValid] = useState(false); // 新增状态用于跟踪验证结果

  // 在组件加载时从 Chrome 本地存储获取状态
  useEffect(() => {
    chrome.storage.local.get("validSuccess", (result) => {
      if (result.validSuccess) {
        setIsValid(true); // 如果存在有效状态，则设置为有效
      }
    });
  }, []);

  // 在组件加载时从 Chrome 本地存储获取状态
  useEffect(() => {
    chrome.storage.local.get("key", (result) => {
      if (result.key) {
        setKey(result.key); // 如果存在有效状态，则设置为有效
      }
    });
  }, []);

  const handleValidateKey = async () => {
    const response = await fetch(
      "http://124.222.146.206:3000/api/validateKey",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key }),
      }
    );
    const data = await response.json();

    if (data.valid) {
      setValidationResult("卡密有效");
      setIsValid(true); // 设置为有效
      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + 1); // 设置过期时间为当前时间加一个月
      chrome.storage.local.set(
        {
          validSuccess: true,
          key: key,
          expiration: expirationDate.toISOString(),
        },
        () => {
          console.log(
            "写入成功: validSuccess = true, key =",
            key,
            "expiration =",
            expirationDate
          );
        }
      );
    } else {
      setValidationResult("卡密无效");
      setIsValid(false); // 设置为无效
    }
  };

  // 如果卡密无效，返回验证页面
  if (!isValid) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-gray-100">
        <div className="text-xl font-bold mb-6 text-gray-800">
          小柚闲鱼助手-卡密验证系统
        </div>
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="输入卡密进行验证"
          className="border border-gray-300 rounded-md p-2 mb-4 w-80 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div
          onClick={handleValidateKey}
          className="bg-indigo-500 cursor-pointer text-white font-semibold py-2 px-4 rounded shadow hover:bg-indigo-500/80 transition duration-200"
        >
          验证卡密
        </div>
        {validationResult && (
          <p className="mt-4 text-lg text-red-600">{validationResult}</p>
        )}
      </div>
    );
  }

  // 如果卡密有效，渲染子组件
  return (
    <KeyValidationContext.Provider
      value={
        { key, setKey, setIsValid, validationResult, handleValidateKey } as any
      }
    >
      {children}
    </KeyValidationContext.Provider>
  );
};

// 自定义 Hook 用于使用上下文
export const useKeyValidation = () => {
  return useContext(KeyValidationContext);
};
