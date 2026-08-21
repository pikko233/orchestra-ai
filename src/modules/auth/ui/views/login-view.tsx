"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { FcGoogle } from "react-icons/fc";

export const LoginView = () => {
  const handleLogin = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/project",
    });
  };

  return (
    <div className="h-screen w-screen flex justify-center items-center bg-linear-to-br from-cyan-50 to-cyan-100 dark:from-gray-900 dark:to-black">
      {/* 登录卡片 */}
      <div className="flex flex-col items-center gap-5 min-w-[25%] p-10 rounded-lg shadow-2xl bg-white dark:bg-gray-900">
        <h1 className="text-2xl font-bold">欢迎回来</h1>
        <span className="text-sm text-muted-foreground">
          登录你的账户以继续
        </span>
        <Button
          type="button"
          onClick={() => handleLogin()}
          variant="outline"
          className="w-full py-5 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
        >
          <FcGoogle />
          使用 Google 登录
        </Button>
      </div>
    </div>
  );
};
